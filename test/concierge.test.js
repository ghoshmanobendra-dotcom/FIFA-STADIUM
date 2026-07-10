import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ask } from '../src/services/conciergeService.js';

test('answers a known question from the knowledge base (offline)', async () => {
  const res = await ask({ question: 'Where do I find accessible seating?' });
  assert.equal(res.source, 'offline');
  assert.match(res.answer.toLowerCase(), /accessible|step-free|companion/);
  assert.ok(res.topics.includes('accessibility'));
});

test('grounds the answer in a venue when venueId is provided', async () => {
  const res = await ask({ question: 'Where can I eat?', venueId: 'usa-metlife' });
  assert.match(res.answer, /MetLife Stadium/);
  assert.equal(res.venue.id, 'usa-metlife');
});

test('falls back gracefully when nothing matches', async () => {
  const res = await ask({ question: 'quasar xylophone teleport' });
  assert.match(res.answer.toLowerCase(), /guest services|steward/);
  assert.deepEqual(res.topics, []);
});

test('defaults unsupported languages to English but keeps supported ones', async () => {
  const en = await ask({ question: 'tickets?', language: 'zz' });
  assert.equal(en.language, 'en');

  const es = await ask({ question: 'tickets?', language: 'es' });
  assert.equal(es.language, 'es');
  assert.match(es.answer, /\[Spanish\]/);
});
