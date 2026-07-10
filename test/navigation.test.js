import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route, routeCacheStats, _resetRouteCache } from '../src/services/navigationService.js';

test('computes a route with steps, distance and walk estimate', async () => {
  const res = await route({ venueId: 'usa-metlife', from: 'gate-a', to: 'sec-115' });
  assert.ok(res.steps.length >= 1);
  assert.ok(res.totalDistanceMeters > 0);
  assert.ok(res.estimatedWalkMinutes >= 1);
  assert.match(res.directions, /Section 115/);
  assert.equal(res.steps.at(-1).to, 'Section 115');
});

test('accessible-only route avoids stairs-only edges', async () => {
  // Direct lower->upper concourse edge is stairs-only; accessible route must use
  // the elevator and therefore be longer.
  const stairs = await route({ venueId: 'usa-metlife', from: 'gate-a', to: 'sec-320' });
  const stepFree = await route({
    venueId: 'usa-metlife',
    from: 'gate-a',
    to: 'sec-320',
    accessibleOnly: true,
  });
  assert.ok(stepFree.steps.every((s) => s.accessible));
  assert.ok(stepFree.totalDistanceMeters >= stairs.totalDistanceMeters);
});

test('rejects unknown venue with 404', async () => {
  await assert.rejects(
    () => route({ venueId: 'nope', from: 'a', to: 'b' }),
    (err) => err.status === 404,
  );
});

test('rejects unknown nodes with 400', async () => {
  await assert.rejects(
    () => route({ venueId: 'usa-metlife', from: 'gate-a', to: 'no-such-node' }),
    (err) => err.status === 400,
  );
});

test('finds the shortest of multiple possible paths', async () => {
  const res = await route({ venueId: 'usa-metlife', from: 'restroom-1', to: 'food-1' });
  // restroom-1 -> concourse-lower -> food-1 == 25 + 35
  assert.equal(res.totalDistanceMeters, 60);
});

test('memoises identical route computations (Dijkstra runs once)', async () => {
  _resetRouteCache();
  const args = { venueId: 'usa-metlife', from: 'gate-a', to: 'sec-320', accessibleOnly: true };
  const first = await route(args);
  const second = await route(args);
  assert.equal(routeCacheStats.misses, 1, 'path computed once');
  assert.equal(routeCacheStats.hits, 1, 'second call served from cache');
  assert.deepEqual(first.steps, second.steps);
  assert.equal(first.totalDistanceMeters, second.totalDistanceMeters);
});

test('different route parameters are cached separately', async () => {
  _resetRouteCache();
  await route({ venueId: 'usa-metlife', from: 'gate-a', to: 'sec-115' });
  await route({ venueId: 'usa-metlife', from: 'gate-a', to: 'food-1' });
  assert.equal(routeCacheStats.size, 2);
  assert.equal(routeCacheStats.hits, 0);
});

test('wayfinding is available at the additional venues', async () => {
  const sofi = await route({
    venueId: 'usa-sofi',
    from: 'gate-1',
    to: 'sec-501',
    accessibleOnly: true,
  });
  assert.ok(sofi.steps.every((s) => s.accessible));
  assert.match(sofi.directions, /Section 501/);

  const azteca = await route({ venueId: 'mex-azteca', from: 'puerta-1', to: 'oracion' });
  assert.match(azteca.directions, /Oración|Oracion|Prayer/);
});
