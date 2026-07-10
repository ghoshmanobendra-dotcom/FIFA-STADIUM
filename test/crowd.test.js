import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshot } from '../src/services/crowdService.js';

test('produces a full zone snapshot for a valid venue', async () => {
  const res = await snapshot({ venueId: 'usa-metlife', timeBucket: 'fixed-1' });
  assert.equal(res.zones.length, 6);
  assert.ok(['low', 'moderate', 'high', 'critical'].includes(res.overallStatus));
  assert.ok(res.zones.every((z) => z.occupancy >= 0 && z.occupancy <= 1));
  assert.ok(typeof res.recommendations === 'string' && res.recommendations.length > 0);
});

test('gives a calm "flowing normally" recommendation when there are no hotspots', async () => {
  // Deterministic seed "q2" yields an all-low snapshot with zero hotspots.
  const res = await snapshot({ venueId: 'usa-metlife', timeBucket: 'q2' });
  assert.equal(res.hotspots.length, 0);
  assert.match(res.recommendations, /flowing normally|maintain standard staffing/);
});

test('is deterministic for the same venue and time bucket', async () => {
  const a = await snapshot({ venueId: 'usa-att', timeBucket: 'bucket-x' });
  const b = await snapshot({ venueId: 'usa-att', timeBucket: 'bucket-x' });
  assert.deepEqual(a.zones, b.zones);
});

test('differs across time buckets', async () => {
  const a = await snapshot({ venueId: 'usa-att', timeBucket: 'bucket-1' });
  const b = await snapshot({ venueId: 'usa-att', timeBucket: 'bucket-2' });
  assert.notDeepEqual(a.zones, b.zones);
});

test('hotspots only include high/critical zones', async () => {
  const res = await snapshot({ venueId: 'mex-azteca', timeBucket: 'peak' });
  for (const zone of res.hotspots) {
    const match = res.zones.find((z) => z.zone === zone);
    assert.ok(['high', 'critical'].includes(match.status));
  }
});

test('rejects an unknown venue with 404', async () => {
  await assert.rejects(
    () => snapshot({ venueId: 'ghost-stadium' }),
    (err) => err.status === 404,
  );
});
