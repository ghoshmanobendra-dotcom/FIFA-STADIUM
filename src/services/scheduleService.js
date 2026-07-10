/**
 * Match-schedule intelligence.
 *
 * Surfaces fixtures and turns the next match at a venue into a personalised,
 * GenAI-authored match-day plan — recommended departure/arrival times allowing
 * for travel and gate queues, plus practical reminders. Timing maths is
 * deterministic; the model adds the friendly plan narrative.
 */
import { generate } from './aiService.js';
import { getVenue, getNextMatch, getMatchesForVenue, matches } from './knowledgeBase.js';

/** Gates open this many minutes before kickoff; we advise arriving then. */
const GATES_OPEN_BEFORE_MIN = 90;

/**
 * Retrieve all tournament match fixtures.
 * @returns {Array<object>}
 */
export function listMatches() {
  return matches;
}

/**
 * @param {{ venueId: string, travelMinutes?: number, now?: Date }} input
 * @returns {Promise<object>}
 */
export async function planMatchDay({ venueId, travelMinutes = 45, now = new Date() }) {
  const venue = getVenue(venueId);
  if (!venue) {
    const err = new Error(`Unknown venue "${venueId}"`);
    err.status = 404;
    throw err;
  }

  const match = getNextMatch(now, venueId);
  if (!match) {
    return {
      venue: { id: venue.id, name: venue.name },
      match: null,
      plan: `No upcoming fixtures are scheduled at ${venue.name}. Check the official app for updates.`,
      source: 'offline',
    };
  }

  const travel = Math.min(Math.max(Number(travelMinutes) || 45, 0), 480);
  const kickoff = new Date(match.kickoff);
  const arriveBy = new Date(kickoff.getTime() - GATES_OPEN_BEFORE_MIN * 60_000);
  const departBy = new Date(arriveBy.getTime() - travel * 60_000);
  const fmt = (d) =>
    d.toLocaleString('en-US', {
      timeZone: venue.timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const { text, source } = await generate({
    system:
      'You are a helpful match-day planner. In 3-4 short sentences, give a ' +
      'fan a clear plan using the times provided. Encourage public transit and ' +
      'arriving early. Be concrete and friendly.',
    prompt:
      `Venue: ${venue.name} (${venue.city}). Fixture: ${match.stage}, ${match.home} v ${match.away}. ` +
      `Kickoff ${fmt(kickoff)}. Advise arriving by ${fmt(arriveBy)} (gates open) and leaving home by ` +
      `${fmt(departBy)} for a ${travel}-minute journey.`,
    fallback: () =>
      `For ${match.home} v ${match.away} (${match.stage}) at ${venue.name}, kickoff is ${fmt(kickoff)}. ` +
      `Leave by ${fmt(departBy)} for your ${travel}-minute trip and aim to arrive by ${fmt(arriveBy)} when gates open. ` +
      `Use public transit or the official shuttle, keep your mobile ticket ready, and carry an empty reusable bottle.`,
  });

  return {
    venue: { id: venue.id, name: venue.name, timezone: venue.timezone },
    match: { ...match, kickoffLocal: fmt(kickoff) },
    recommendedDepartBy: departBy.toISOString(),
    recommendedArriveBy: arriveBy.toISOString(),
    travelMinutes: travel,
    plan: text,
    source,
  };
}

export { getMatchesForVenue };
export default { listMatches, planMatchDay };
