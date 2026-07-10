/**
 * Loads and indexes static domain data (venues + concierge knowledge) once at
 * startup, and exposes small, pure lookup helpers.
 *
 * Keeping retrieval logic here means both the live-model prompts and the
 * offline fallback draw from exactly the same authoritative source, so answers
 * stay consistent regardless of which engine responds.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

/**
 * Load and parse a JSON data file from the data directory.
 * @param {string} name
 * @returns {any}
 */
function load(name) {
  return JSON.parse(readFileSync(join(dataDir, name), 'utf8'));
}

const venuesData = load('venues.json');
const knowledgeData = load('knowledge.json');
const scheduleData = load('schedule.json');
const sustainabilityData = load('sustainability.json');
const capabilitiesData = load('capabilities.json');

const venuesById = new Map(venuesData.venues.map((v) => [v.id, v]));

export const tournament = venuesData.tournament;
export const venues = venuesData.venues;
export const zones = venuesData.zones;
export const knowledgeEntries = knowledgeData.entries;
export const matches = scheduleData.matches;
export const emissionModes = sustainabilityData.modes;
export const sustainabilityTips = sustainabilityData.tips;
export const capabilities = capabilitiesData;

/**
 * Retrieve a venue by ID.
 * @param {string} id
 * @returns {object|null}
 */
export function getVenue(id) {
  return venuesById.get(id) || null;
}

/**
 * Filter all matches for a specific venue.
 * @param {string} venueId
 * @returns {Array<object>}
 */
export function getMatchesForVenue(venueId) {
  return matches.filter((m) => m.venueId === venueId);
}

/**
 * Next scheduled match at or after a reference time.
 * @param {Date} [now]
 * @param {string} [venueId] optionally restrict to a venue
 */
export function getNextMatch(now = new Date(), venueId) {
  const pool = venueId ? getMatchesForVenue(venueId) : matches;
  return (
    pool
      .filter((m) => new Date(m.kickoff).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0] || null
  );
}

/**
 * Retrieve a transport emission mode by ID.
 * @param {string} id
 * @returns {object|null}
 */
export function getEmissionMode(id) {
  return emissionModes.find((m) => m.id === id) || null;
}

/**
 * Retrieve wayfinding zone graph data for a venue.
 * @param {string} id
 * @returns {object|null}
 */
export function getZoneGraph(id) {
  return zones[id] || null;
}

/**
 * Escape a string for safe use inside a RegExp.
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word / stem match: the term must begin at a word boundary so that a
 * keyword like "phone" does not spuriously match inside "xylophone", while
 * intentional stems like "sustainab" still match "sustainability". Matching is
 * anchored at the start of the term only, which keeps stemming behaviour.
 * @param {string} haystack
 * @param {string} term
 */
function matchesTerm(haystack, term) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}`, 'i').test(haystack);
}

/**
 * Rank knowledge-base entries against a free-text query using boundary-aware
 * keyword overlap. Deterministic and dependency-free — ideal for both the
 * offline engine and for building grounding context for the live model.
 * @param {string} query
 * @param {number} [limit]
 * @returns {Array<{ entry: object, score: number }>}
 */
export function searchKnowledge(query, limit = 3) {
  const normalized = String(query || '').toLowerCase();
  if (!normalized.trim()) return [];

  const scored = knowledgeEntries
    .map((entry) => {
      let score = 0;
      for (const keyword of entry.keywords) {
        if (matchesTerm(normalized, keyword)) score += keyword.length;
      }
      if (matchesTerm(normalized, entry.topic)) score += 5;
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

export default {
  tournament,
  venues,
  zones,
  knowledgeEntries,
  matches,
  emissionModes,
  sustainabilityTips,
  getVenue,
  getZoneGraph,
  getMatchesForVenue,
  getNextMatch,
  getEmissionMode,
  searchKnowledge,
};
