import { test } from 'node:test';
import assert from 'node:assert/strict';
import { footprint } from '../src/services/sustainabilityService.js';

test('ranks options greenest-first and identifies the greenest', async () => {
  const res = await footprint({ distanceKm: 20, partySize: 2 });
  assert.equal(res.options[0].mode, res.greenest);
  for (let i = 1; i < res.options.length; i++) {
    assert.ok(res.options[i].totalKgCO2e >= res.options[i - 1].totalKgCO2e);
  }
});

test('per-passenger modes scale with party size, solo car does not', async () => {
  const one = await footprint({ distanceKm: 10, partySize: 1, modes: ['metro', 'car'] });
  const four = await footprint({ distanceKm: 10, partySize: 4, modes: ['metro', 'car'] });
  const metro1 = one.options.find((o) => o.mode === 'metro').totalKgCO2e;
  const metro4 = four.options.find((o) => o.mode === 'metro').totalKgCO2e;
  const car1 = one.options.find((o) => o.mode === 'car').totalKgCO2e;
  const car4 = four.options.find((o) => o.mode === 'car').totalKgCO2e;
  assert.ok(metro4 > metro1); // per passenger
  assert.equal(car1, car4); // per vehicle, independent of party
});

test('computes a positive saving versus the baseline', async () => {
  const res = await footprint({ distanceKm: 30 });
  assert.ok(res.savingKg >= 0);
  assert.ok(res.savingPct >= 0 && res.savingPct <= 100);
});

test('rejects invalid distance', async () => {
  await assert.rejects(
    () => footprint({ distanceKm: 0 }),
    (e) => e.status === 400,
  );
  await assert.rejects(
    () => footprint({ distanceKm: -5 }),
    (e) => e.status === 400,
  );
  await assert.rejects(
    () => footprint({ distanceKm: 'abc' }),
    (e) => e.status === 400,
  );
});

test('rejects when no valid modes are supplied', async () => {
  await assert.rejects(
    () => footprint({ distanceKm: 10, modes: ['rocket'] }),
    (e) => e.status === 400,
  );
});
