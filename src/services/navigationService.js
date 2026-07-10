/**
 * In-venue wayfinding.
 *
 * Computes the shortest route between two points on a venue's zone graph using
 * Dijkstra's algorithm, with an `accessibleOnly` mode that excludes stairs and
 * other non-step-free edges. A generative layer then turns the raw path into
 * friendly, human natural-language directions (with an offline fallback that
 * produces perfectly usable turn-by-turn text without a model).
 */
import { generate } from './aiService.js';
import { getZoneGraph, getVenue } from './knowledgeBase.js';

/**
 * Memoised graph computations. Venue maps are static, so a given
 * (venue, from, to, accessibleOnly) always yields the same path — there is no
 * reason to re-run Dijkstra on a repeated query. Bounded to avoid unbounded
 * growth. Only the deterministic path is cached; natural-language directions
 * still flow through the AI gateway (which has its own cache).
 */
const routeCache = new Map();
const ROUTE_CACHE_MAX = 500;

export const routeCacheStats = {
  get size() {
    return routeCache.size;
  },
  hits: 0,
  misses: 0,
};

/**
 * Compute (and memoise) the deterministic part of a route: ordered steps and
 * total distance. Throws tagged HTTP errors for unknown venues/nodes/routes.
 * @param {string} venueId
 * @param {string} from
 * @param {string} to
 * @param {boolean} accessibleOnly
 */
function computePath(venueId, from, to, accessibleOnly) {
  const key = `${venueId}|${from}|${to}|${accessibleOnly}`;
  const cached = routeCache.get(key);
  if (cached) {
    routeCacheStats.hits++;
    return cached;
  }
  routeCacheStats.misses++;

  const graph = getZoneGraph(venueId);
  if (!graph) {
    const err = new Error(`No wayfinding map available for venue "${venueId}"`);
    err.status = 404;
    throw err;
  }

  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  if (!nodes.has(from) || !nodes.has(to)) {
    const err = new Error('Unknown start or destination node for this venue');
    err.status = 400;
    throw err;
  }

  const path = shortestPath(graph, from, to, accessibleOnly);
  if (!path) {
    const err = new Error(
      accessibleOnly
        ? 'No step-free route exists between these points'
        : 'No route exists between these points',
    );
    err.status = 422;
    throw err;
  }

  const steps = buildSteps(path, nodes);
  const totalDistance = path.reduce((sum, edge) => sum + (edge.distance || 0), 0);
  const result = { steps, totalDistance };

  if (routeCache.size >= ROUTE_CACHE_MAX) routeCache.delete(routeCache.keys().next().value);
  routeCache.set(key, result);
  return result;
}

/** Test/ops helper. */
export function _resetRouteCache() {
  routeCache.clear();
  routeCacheStats.hits = 0;
  routeCacheStats.misses = 0;
}

/**
 * @param {{ venueId: string, from: string, to: string, accessibleOnly?: boolean }} input
 * @returns {Promise<object>}
 */
export async function route({ venueId, from, to, accessibleOnly = false }) {
  const { steps, totalDistance } = computePath(venueId, from, to, accessibleOnly);
  const venue = getVenue(venueId);

  const { text, source } = await generate({
    system:
      'You are a calm, clear in-stadium wayfinding guide. Turn the route steps ' +
      'into short, friendly directions a fan can follow while walking. Number ' +
      'each step. Note accessibility where relevant.',
    prompt: buildDirectionsPrompt(venue, steps, accessibleOnly),
    fallback: () => offlineDirections(steps, accessibleOnly),
  });

  return {
    venueId,
    from,
    to,
    accessibleOnly,
    totalDistanceMeters: totalDistance,
    estimatedWalkMinutes: Math.max(1, Math.round(totalDistance / 70)),
    steps,
    directions: text,
    source,
  };
}

/**
 * Dijkstra shortest path. Returns an ordered array of traversed edges, or null.
 * @param {object} graph
 * @param {string} start
 * @param {string} goal
 * @param {boolean} accessibleOnly
 */
function shortestPath(graph, start, goal, accessibleOnly) {
  /** @type {Map<string, Array<object>>} */
  const adjacency = new Map();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const edge of graph.edges) {
    if (accessibleOnly && edge.accessible === false) continue;
    // Treat edges as bidirectional corridors.
    adjacency.get(edge.from)?.push({ ...edge, to: edge.to });
    adjacency.get(edge.to)?.push({ ...edge, from: edge.to, to: edge.from });
  }

  const dist = new Map(graph.nodes.map((n) => [n.id, Infinity]));
  const prevEdge = new Map();
  const visited = new Set();
  dist.set(start, 0);

  while (visited.size < graph.nodes.length) {
    // Pick the nearest unvisited node.
    let current = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d;
        current = id;
      }
    }
    if (current === null) break;
    if (current === goal) break;
    visited.add(current);

    for (const edge of adjacency.get(current) || []) {
      if (visited.has(edge.to)) continue;
      const candidate = dist.get(current) + (edge.distance || 1);
      if (candidate < dist.get(edge.to)) {
        dist.set(edge.to, candidate);
        prevEdge.set(edge.to, { edge, from: current });
      }
    }
  }

  if (!Number.isFinite(dist.get(goal))) return null;

  // Reconstruct edge path.
  const edges = [];
  let node = goal;
  while (node !== start) {
    const step = prevEdge.get(node);
    if (!step) return null;
    edges.unshift({ ...step.edge, from: step.from, to: node });
    node = step.from;
  }
  return edges;
}

/**
 * @param {Array<object>} path
 * @param {Map<string, object>} nodes
 */
function buildSteps(path, nodes) {
  return path.map((edge) => {
    const to = nodes.get(edge.to);
    return {
      to: to.label,
      type: to.type,
      distanceMeters: edge.distance || 0,
      accessible: edge.accessible !== false,
      note: edge.note || null,
    };
  });
}

/**
 * Format path steps into a wayfinding prompt for the model.
 * @param {object|null} venue
 * @param {Array<object>} steps
 * @param {boolean} accessibleOnly
 * @returns {string}
 */
function buildDirectionsPrompt(venue, steps, accessibleOnly) {
  const header = venue ? `Venue: ${venue.name}.` : '';
  const mode = accessibleOnly ? 'Step-free (accessible) route requested.' : '';
  const lines = steps
    .map(
      (s, i) =>
        `${i + 1}. Go to ${s.to} (${s.distanceMeters} m` +
        `${s.accessible ? ', step-free' : ', stairs'})${s.note ? ` — ${s.note}` : ''}`,
    )
    .join('\n');
  return `${header} ${mode}\nRoute steps:\n${lines}`;
}

/**
 * @param {Array<object>} steps
 * @param {boolean} accessibleOnly
 */
function offlineDirections(steps, accessibleOnly) {
  const intro = accessibleOnly ? 'Here is your step-free route:' : 'Here is your route:';
  const body = steps
    .map(
      (s, i) =>
        `${i + 1}. Head to ${s.to} — about ${s.distanceMeters} m${s.accessible ? '' : ' (stairs)'}.`,
    )
    .join(' ');
  return `${intro} ${body} You have arrived. Ask any steward in a purple vest if you need help.`;
}

export default { route, routeCacheStats, _resetRouteCache };
