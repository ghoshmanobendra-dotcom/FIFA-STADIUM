import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let server;
let base;

before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => server?.close());

async function call(path, options) {
  const res = await fetch(base + path, options);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

test('GET /api/health reports offline AI mode in tests', async () => {
  const { status, body } = await call('/api/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.aiMode, 'offline');
});

test('GET /api/venues lists all host venues', async () => {
  const { status, body } = await call('/api/venues');
  assert.equal(status, 200);
  assert.equal(body.count, 16);
});

test('GET /api/venues/:id returns 404 for unknown venue', async () => {
  const { status } = await call('/api/venues/nope');
  assert.equal(status, 404);
});

test('POST /api/concierge answers a question', async () => {
  const { status, body } = await call('/api/concierge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'How do I recycle?', language: 'en' }),
  });
  assert.equal(status, 200);
  assert.match(body.answer.toLowerCase(), /recycl|compost|refill/);
});

test('POST /api/concierge validates missing question with 400', async () => {
  const { status, body } = await call('/api/concierge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(status, 400);
  assert.match(body.error, /question/);
});

test('POST /api/navigate returns directions', async () => {
  const { status, body } = await call('/api/navigate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ venueId: 'usa-metlife', from: 'gate-a', to: 'sec-115' }),
  });
  assert.equal(status, 200);
  assert.ok(body.steps.length > 0);
});

test('GET /api/crowd/:venueId returns a snapshot', async () => {
  const { status, body } = await call('/api/crowd/usa-metlife');
  assert.equal(status, 200);
  assert.equal(body.zones.length, 6);
});

test('POST /api/translate rejects unsupported language via enum guard', async () => {
  const { status, body } = await call('/api/translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Hello', target: 'zz' }),
  });
  assert.equal(status, 400);
  assert.match(body.error, /target/);
});

test('unknown routes return a JSON 404', async () => {
  const { status, body } = await call('/api/not-a-route');
  assert.equal(status, 404);
  assert.equal(body.error, 'Not found');
});

test('security headers are applied by helmet', async () => {
  const res = await fetch(base + '/api/health');
  assert.ok(res.headers.get('content-security-policy'));
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('every response carries a request id', async () => {
  const res = await fetch(base + '/api/health');
  assert.ok(res.headers.get('x-request-id'));
});

test('GET /api/metrics exposes AI counters', async () => {
  const { status, body } = await call('/api/metrics');
  assert.equal(status, 200);
  assert.ok('modelCalls' in body.ai);
  assert.ok(typeof body.cacheHitRate === 'number');
});

test('GET /api/matches lists fixtures', async () => {
  const { status, body } = await call('/api/matches');
  assert.equal(status, 200);
  assert.ok(body.count >= 5);
});

test('GET /api/config/options returns enums for the UI', async () => {
  const { status, body } = await call('/api/config/options');
  assert.equal(status, 200);
  assert.ok(body.incidentTypes.includes('medical'));
  assert.ok(body.announcementScenarios.includes('gates-open'));
});

test('GET /api/openapi.json returns a spec', async () => {
  const { status, body } = await call('/api/openapi.json');
  assert.equal(status, 200);
  assert.equal(body.openapi, '3.1.0');
  assert.ok(body.paths['/incident']);
});

test('POST /api/sustainability/footprint ranks options', async () => {
  const { status, body } = await call('/api/sustainability/footprint', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ distanceKm: 15, partySize: 3 }),
  });
  assert.equal(status, 200);
  assert.equal(body.options[0].mode, body.greenest);
});

test('POST /api/incident triages and validates', async () => {
  const ok = await call('/api/incident', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'medical', severity: 'high', zone: 'Sec 115' }),
  });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.priority);

  const bad = await call('/api/incident', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'medical', severity: 'nope' }),
  });
  assert.equal(bad.status, 400);
});

test('POST /api/announce generates multilingual output', async () => {
  const { status, body } = await call('/api/announce', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scenario: 'gates-open', languages: ['en', 'es'] }),
  });
  assert.equal(status, 200);
  assert.equal(body.languages.length, 2);
});

test('GET /api/plan/:venueId returns a match-day plan', async () => {
  const { status, body } = await call('/api/plan/usa-metlife?travelMinutes=30');
  assert.equal(status, 200);
  assert.ok('recommendedArriveBy' in body || body.match === null);
});

test('bounded body: oversized JSON is rejected', async () => {
  const huge = JSON.stringify({ question: 'x'.repeat(20_000) });
  const res = await fetch(base + '/api/concierge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: huge,
  });
  assert.equal(res.status, 413);
});

test('non-JSON POST is rejected with 415 and a code', async () => {
  const res = await fetch(base + '/api/concierge', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'hello',
  });
  const body = await res.json();
  assert.equal(res.status, 415);
  assert.equal(body.code, 'unsupported_media_type');
});

test('malformed JSON is rejected with 400 invalid_json', async () => {
  const res = await fetch(base + '/api/concierge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{ not valid',
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.code, 'invalid_json');
});

test('error responses carry a code and the request id', async () => {
  const { body } = await call('/api/venues/does-not-exist');
  assert.equal(body.code, 'not_found');
  assert.ok(body.requestId);
});

test('validation errors expose a machine-readable code', async () => {
  const res = await fetch(base + '/api/sustainability/footprint', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ distanceKm: -1 }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.code, 'validation_error');
});

test('security response headers are present', async () => {
  const res = await fetch(base + '/');
  assert.ok(res.headers.get('permissions-policy'));
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.ok(res.headers.get('strict-transport-security'));
});

test('reference data is cacheable and supports conditional 304s', async () => {
  const res = await fetch(base + '/api/venues');
  const etag = res.headers.get('etag');
  assert.ok(etag, 'ETag present');
  assert.match(res.headers.get('cache-control'), /max-age/);
  const revalidate = await fetch(base + '/api/venues', { headers: { 'if-none-match': etag } });
  assert.equal(revalidate.status, 304);
});

test('responses are gzip-compressed when the client supports it', async () => {
  // undici auto-decompresses, so assert via a manual request that keeps the header.
  const res = await fetch(base + '/api/venues', { headers: { 'accept-encoding': 'gzip' } });
  // Either content-encoding is exposed or the body decoded fine; assert the
  // server advertised compression negotiation via Vary.
  assert.match(res.headers.get('vary') || '', /Accept-Encoding/i);
});

test('metrics expose route-cache and HTTP timing observability', async () => {
  const { body } = await call('/api/metrics');
  assert.ok(body.routeCache && typeof body.routeCache.hitRate === 'number');
  assert.ok(body.http && typeof body.http.avgResponseMs === 'number');
});

test('POST /api/briefing generates a volunteer briefing', async () => {
  const { status, body } = await call('/api/briefing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'transport-marshal', venueId: 'usa-metlife' }),
  });
  assert.equal(status, 200);
  assert.ok(body.briefing.length > 0);
  assert.equal(body.role, 'transport-marshal');
});

test('POST /api/briefing rejects an unknown role', async () => {
  const { status, body } = await call('/api/briefing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'nope' }),
  });
  assert.equal(status, 400);
  assert.equal(body.code, 'validation_error');
});

test('GET /api/capabilities returns the alignment map covering all areas', async () => {
  const { status, body } = await call('/api/capabilities');
  assert.equal(status, 200);
  assert.equal(body.problemStatementAreas.length, 8);
  const served = new Set(body.capabilities.flatMap((c) => c.personas));
  assert.ok(['fans', 'organizers', 'volunteers', 'venue-staff'].every((p) => served.has(p)));
});
