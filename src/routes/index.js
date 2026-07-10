/**
 * API router. Mounts every feature route under a single versioned prefix and
 * provides the shared async-handler wrapper so route bodies can `await`
 * services without repetitive try/catch. All input passes through the
 * validators in ../middleware/validate.js before reaching a service.
 */
import { Router } from 'express';
import { createHash } from 'node:crypto';
import { ask } from '../services/conciergeService.js';
import { route as findRoute, routeCacheStats } from '../services/navigationService.js';
import { httpMetrics } from '../middleware/timing.js';
import { snapshot } from '../services/crowdService.js';
import { translate, LANGUAGES, RTL_LANGUAGES } from '../services/translationService.js';
import { footprint } from '../services/sustainabilityService.js';
import { triage, INCIDENT_TYPES, SEVERITIES } from '../services/incidentService.js';
import { announce, SCENARIOS } from '../services/announcementService.js';
import { brief, ROLES } from '../services/briefingService.js';
import { listMatches, planMatchDay } from '../services/scheduleService.js';
import { metrics } from '../services/aiService.js';
import {
  venues,
  tournament,
  getZoneGraph,
  emissionModes,
  capabilities,
} from '../services/knowledgeBase.js';
import {
  ApiError,
  requireString,
  optionalString,
  requireEnum,
  requireNumber,
  optionalNumber,
  optionalStringArray,
  toBoolean,
} from '../middleware/validate.js';
import { openapi } from './openapi.js';
import config from '../config.js';

/** Wrap an async handler so rejected promises reach the error middleware. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Reference data is static for the life of the process, so we serialise it and
 * compute a strong ETag ONCE at startup. Requests are then served with a
 * `Cache-Control` + `ETag`, and a matching `If-None-Match` short-circuits to a
 * body-less `304` — cutting bandwidth and CPU for these hot, unchanging routes.
 */
function prebuild(body) {
  const json = JSON.stringify(body);
  const etag = `"${createHash('sha1').update(json).digest('base64url')}"`;
  return { json, etag };
}

function serveStatic(req, res, { json, etag }, maxAgeSec = 300) {
  res.setHeader('Cache-Control', `public, max-age=${maxAgeSec}`);
  res.setHeader('ETag', etag);
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.type('application/json').send(json);
}

const router = Router();

// Pre-serialised static payloads (+ ETags) built once at startup.
const REF = {
  tournament: prebuild({ tournament, languages: LANGUAGES, rtlLanguages: RTL_LANGUAGES }),
  venues: prebuild({ count: venues.length, venues }),
  matches: prebuild({ count: listMatches().length, matches: listMatches() }),
  transport: prebuild({ modes: emissionModes }),
  openapi: prebuild(openapi),
  capabilities: prebuild(capabilities),
  config: prebuild({
    languages: LANGUAGES,
    rtlLanguages: RTL_LANGUAGES,
    incidentTypes: INCIDENT_TYPES,
    severities: SEVERITIES,
    announcementScenarios: Object.keys(SCENARIOS),
    briefingRoles: Object.entries(ROLES).map(([id, r]) => ({ id, label: r.label })),
    transportModes: emissionModes.map((m) => ({ id: m.id, label: m.label })),
  }),
};
const VENUE_DETAILS = new Map(
  venues.map((v) => {
    const graph = getZoneGraph(v.id);
    const wayfindingNodes = graph
      ? graph.nodes.map(({ id, label, type }) => ({ id, label, type }))
      : [];
    return [v.id, prebuild({ venue: v, hasWayfinding: Boolean(graph), wayfindingNodes })];
  }),
);

// --- Health, metrics & metadata -------------------------------------------
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    aiMode: config.ai.enabled ? 'model' : 'offline',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

router.get('/metrics', (req, res) => {
  const total = metrics.modelCalls + metrics.offlineCalls + metrics.cacheHits;
  const routeTotal = routeCacheStats.hits + routeCacheStats.misses;
  res.json({
    ai: { ...metrics },
    totalGenerations: total,
    cacheHitRate: total ? Number((metrics.cacheHits / total).toFixed(3)) : 0,
    routeCache: {
      size: routeCacheStats.size,
      hits: routeCacheStats.hits,
      misses: routeCacheStats.misses,
      hitRate: routeTotal ? Number((routeCacheStats.hits / routeTotal).toFixed(3)) : 0,
    },
    http: { requests: httpMetrics.requests, avgResponseMs: httpMetrics.avgMs },
    uptimeSeconds: Math.round(process.uptime()),
    memoryMB: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1)),
  });
});

router.get('/tournament', (req, res) => serveStatic(req, res, REF.tournament));

router.get('/openapi.json', (req, res) => serveStatic(req, res, REF.openapi, 3600));

// --- Reference data (cacheable, ETag + 304) -------------------------------
router.get('/venues', (req, res) => serveStatic(req, res, REF.venues));

router.get('/venues/:id', (req, res) => {
  const detail = VENUE_DETAILS.get(req.params.id);
  if (!detail) throw new ApiError(`Unknown venue "${req.params.id}"`, 404, 'not_found');
  serveStatic(req, res, detail);
});

router.get('/matches', (req, res) => serveStatic(req, res, REF.matches));

router.get('/transport/modes', (req, res) => serveStatic(req, res, REF.transport));

router.get('/config/options', (req, res) => serveStatic(req, res, REF.config));

/**
 * Machine-readable proof of problem-statement coverage: every capability mapped
 * to the GenAI area(s) it addresses and the persona(s) it serves.
 */
router.get('/capabilities', (req, res) => serveStatic(req, res, REF.capabilities));

// --- Multilingual concierge (GenAI) ---------------------------------------
router.post(
  '/concierge',
  wrap(async (req, res) => {
    const question = requireString(req.body?.question, 'question');
    const language = optionalString(req.body?.language, 'language', 8);
    const venueId = optionalString(req.body?.venueId, 'venueId', 64);
    res.json(await ask({ question, language, venueId }));
  }),
);

// --- Wayfinding / navigation (GenAI) --------------------------------------
router.post(
  '/navigate',
  wrap(async (req, res) => {
    const venueId = requireString(req.body?.venueId, 'venueId', 64);
    const from = requireString(req.body?.from, 'from', 64);
    const to = requireString(req.body?.to, 'to', 64);
    const accessibleOnly = toBoolean(req.body?.accessibleOnly);
    res.json(await findRoute({ venueId, from, to, accessibleOnly }));
  }),
);

// --- Crowd & operational intelligence (GenAI) -----------------------------
router.get(
  '/crowd/:venueId',
  wrap(async (req, res) => {
    const timeBucket = optionalString(req.query?.t, 't', 32);
    res.json(await snapshot({ venueId: req.params.venueId, timeBucket }));
  }),
);

// --- Translation (GenAI) ---------------------------------------------------
router.post(
  '/translate',
  wrap(async (req, res) => {
    const text = requireString(req.body?.text, 'text');
    const target = requireEnum(req.body?.target, 'target', LANGUAGES);
    res.json(await translate({ text, target }));
  }),
);

// --- Sustainability & transport (GenAI) -----------------------------------
router.post(
  '/sustainability/footprint',
  wrap(async (req, res) => {
    const distanceKm = requireNumber(req.body?.distanceKm, 'distanceKm', { min: 0.1, max: 20_000 });
    const partySize = optionalNumber(req.body?.partySize, 'partySize', {
      min: 1,
      max: 60,
      integer: true,
    });
    const modes = optionalStringArray(req.body?.modes, 'modes');
    res.json(await footprint({ distanceKm, partySize, modes }));
  }),
);

// --- Real-time incident decision support (GenAI) --------------------------
router.post(
  '/incident',
  wrap(async (req, res) => {
    const type = requireEnum(req.body?.type, 'type', INCIDENT_TYPES);
    const severity = requireEnum(req.body?.severity, 'severity', SEVERITIES);
    const zone = optionalString(req.body?.zone, 'zone', 80);
    const detail = optionalString(req.body?.detail, 'detail', 500);
    const venueId = optionalString(req.body?.venueId, 'venueId', 64);
    res.json(await triage({ venueId, type, severity, zone, detail }));
  }),
);

// --- Multilingual PA announcements (GenAI) --------------------------------
router.post(
  '/announce',
  wrap(async (req, res) => {
    const message = optionalString(req.body?.message, 'message', 500);
    const scenario = optionalString(req.body?.scenario, 'scenario', 40);
    const languages = optionalStringArray(req.body?.languages, 'languages');
    res.json(await announce({ message, scenario, languages }));
  }),
);

// --- Volunteer & staff shift briefing (GenAI) -----------------------------
router.post(
  '/briefing',
  wrap(async (req, res) => {
    const role = requireEnum(req.body?.role, 'role', Object.keys(ROLES));
    const venueId = optionalString(req.body?.venueId, 'venueId', 64);
    const zone = optionalString(req.body?.zone, 'zone', 80);
    const shift = optionalString(req.body?.shift, 'shift', 40);
    res.json(await brief({ role, venueId, zone, shift }));
  }),
);

// --- Match-day plan (GenAI) -----------------------------------------------
router.get(
  '/plan/:venueId',
  wrap(async (req, res) => {
    const travelMinutes = optionalNumber(req.query?.travelMinutes, 'travelMinutes', {
      min: 0,
      max: 480,
    });
    res.json(await planMatchDay({ venueId: req.params.venueId, travelMinutes }));
  }),
);

export default router;
