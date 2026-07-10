import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planMatchDay, listMatches } from '../src/services/scheduleService.js';
import { getNextMatch } from '../src/services/knowledgeBase.js';

test('lists sample fixtures', () => {
  assert.ok(listMatches().length >= 5);
});

test('getNextMatch returns the earliest upcoming fixture', () => {
  const early = new Date('2026-01-01T00:00:00Z');
  const next = getNextMatch(early);
  assert.ok(next);
  // Nothing scheduled before it.
  for (const m of listMatches()) {
    if (m.id !== next.id) {
      assert.ok(new Date(m.kickoff) >= new Date(next.kickoff));
    }
  }
});

test('builds a plan with departure before arrival before kickoff', async () => {
  const res = await planMatchDay({
    venueId: 'usa-metlife',
    travelMinutes: 60,
    now: new Date('2026-01-01T00:00:00Z'),
  });
  assert.ok(res.match);
  const depart = new Date(res.recommendedDepartBy).getTime();
  const arrive = new Date(res.recommendedArriveBy).getTime();
  const kickoff = new Date(res.match.kickoff).getTime();
  assert.ok(depart < arrive);
  assert.ok(arrive < kickoff);
});

test('handles a venue with no upcoming fixtures gracefully', async () => {
  const res = await planMatchDay({
    venueId: 'can-bmo',
    now: new Date('2030-01-01T00:00:00Z'),
  });
  assert.equal(res.match, null);
  assert.match(res.plan, /No upcoming fixtures/);
});

test('rejects an unknown venue', async () => {
  await assert.rejects(
    () => planMatchDay({ venueId: 'ghost' }),
    (e) => e.status === 404,
  );
});
