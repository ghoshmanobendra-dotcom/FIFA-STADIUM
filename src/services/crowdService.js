/**
 * Crowd management & operational intelligence.
 *
 * Turns raw, per-zone occupancy telemetry into an at-a-glance operational
 * picture plus GenAI-authored, prioritised recommendations for control-room
 * staff. Density is modelled deterministically (seeded per venue + time bucket)
 * so demos and tests are reproducible; in production the same shape would be
 * fed by real sensor / turnstile feeds.
 */
import { generate } from './aiService.js';
import { getVenue } from './knowledgeBase.js';

const ZONES = [
  'North Gate',
  'East Gate',
  'Lower Concourse',
  'Upper Concourse',
  'Transit Hub',
  'Food Court',
];

/**
 * Density band thresholds (occupancy ratio 0..1).
 * @param {number} ratio
 * @returns {'critical'|'high'|'moderate'|'low'}
 */
function band(ratio) {
  if (ratio >= 0.85) return 'critical';
  if (ratio >= 0.7) return 'high';
  if (ratio >= 0.4) return 'moderate';
  return 'low';
}

/**
 * Deterministic pseudo-random generator so a given (venue, minute) always
 * yields the same snapshot — essential for reproducible tests and stable demos.
 * @param {string} seed
 */
function seededRatios(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ZONES.map((zone, idx) => {
    h ^= idx + 0x9e3779b9;
    h = Math.imul(h, 16777619);
    const value = ((h >>> 0) % 1000) / 1000; // 0..1
    return Number(value.toFixed(2));
  });
}

/**
 * Build a live operational snapshot for a venue.
 * @param {{ venueId: string, timeBucket?: string }} input
 * @returns {Promise<object>}
 */
export async function snapshot({ venueId, timeBucket }) {
  const venue = getVenue(venueId);
  if (!venue) {
    const err = new Error(`Unknown venue "${venueId}"`);
    err.status = 404;
    throw err;
  }

  const bucket = timeBucket || currentBucket();
  const ratios = seededRatios(`${venueId}:${bucket}`);
  const zones = ZONES.map((name, i) => ({
    zone: name,
    occupancy: ratios[i],
    status: band(ratios[i]),
  }));

  const hotspots = zones.filter((z) => z.status === 'critical' || z.status === 'high');
  const overall = band(ratios.reduce((a, b) => a + b, 0) / ratios.length);

  const { text, source } = await generate({
    system:
      'You are an operations advisor in a stadium control room. Given zone ' +
      'density data, produce 2-4 short, prioritised, actionable recommendations ' +
      'to keep fans safe and moving. Be specific and calm.',
    prompt: buildOpsPrompt(venue, zones, overall),
    fallback: () => offlineRecommendations(zones, hotspots, overall),
  });

  return {
    venue: { id: venue.id, name: venue.name, capacity: venue.capacity },
    timeBucket: bucket,
    overallStatus: overall,
    zones,
    hotspots: hotspots.map((h) => h.zone),
    recommendations: text,
    source,
  };
}

/**
 * Get the current 15-minute ISO time bucket.
 * @returns {string}
 */
function currentBucket() {
  // 15-minute buckets keep snapshots stable within a short window.
  const now = new Date();
  const minutes = Math.floor(now.getUTCMinutes() / 15) * 15;
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}T${now.getUTCHours()}:${minutes}`;
}

/**
 * Format zone data into a prompt for the operations advisor.
 * @param {object} venue
 * @param {Array<object>} zones
 * @param {string} overall
 * @returns {string}
 */
function buildOpsPrompt(venue, zones, overall) {
  const lines = zones
    .map((z) => `- ${z.zone}: ${Math.round(z.occupancy * 100)}% (${z.status})`)
    .join('\n');
  return `Venue: ${venue.name} (capacity ${venue.capacity}). Overall: ${overall}.\nZone density:\n${lines}`;
}

/**
 * Offline fallback generator for crowd recommendations.
 * @param {Array<object>} zones
 * @param {Array<object>} hotspots
 * @param {string} overall
 * @returns {string}
 */
function offlineRecommendations(zones, hotspots, overall) {
  if (hotspots.length === 0) {
    return `Overall density is ${overall}. All zones flowing normally — maintain standard staffing and keep monitoring the Transit Hub as the match ends.`;
  }
  const recs = hotspots.map((z, i) => {
    const pct = Math.round(z.occupancy * 100);
    const action = z.zone.includes('Gate')
      ? `open additional lanes and redirect arrivals to the nearest quieter gate`
      : z.zone.includes('Transit')
        ? `stagger egress messaging and hold fans in concourse lounges for 10 minutes`
        : `deploy stewards to ease flow and open overflow routes`;
    return `${i + 1}. ${z.zone} at ${pct}% (${z.status}) — ${action}.`;
  });
  return `Priority actions (overall ${overall}): ${recs.join(' ')}`;
}

export default { snapshot, ZONES };
