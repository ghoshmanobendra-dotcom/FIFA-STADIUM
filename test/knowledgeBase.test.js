import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchKnowledge, getVenue, getZoneGraph, venues } from '../src/services/knowledgeBase.js';

test('loads all 16 host venues', () => {
  assert.equal(venues.length, 16);
  assert.ok(venues.every((v) => v.id && v.name && v.capacity > 0));
});

test('getVenue returns a known venue and null for unknown', () => {
  assert.equal(getVenue('usa-metlife').name, 'MetLife Stadium');
  assert.equal(getVenue('does-not-exist'), null);
});

test('getZoneGraph returns a graph only where wayfinding exists', () => {
  assert.ok(getZoneGraph('usa-metlife'));
  assert.equal(getZoneGraph('can-bmo'), null);
});

test('searchKnowledge ranks relevant entries first', () => {
  const results = searchKnowledge('how do I recycle my bottle?');
  assert.ok(results.length > 0);
  assert.equal(results[0].entry.topic, 'sustainability');
});

test('searchKnowledge returns nothing for empty or irrelevant input', () => {
  assert.equal(searchKnowledge('').length, 0);
  assert.equal(searchKnowledge('   ').length, 0);
  assert.equal(searchKnowledge('xylophone quasar').length, 0);
});

test('searchKnowledge respects the limit', () => {
  const results = searchKnowledge('accessible transport food gate', 2);
  assert.ok(results.length <= 2);
});
