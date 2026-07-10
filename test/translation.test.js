import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate, isSupported, languageName } from '../src/services/translationService.js';

test('English target is a no-op passthrough', async () => {
  const res = await translate({ text: 'Gate C is open.', target: 'en' });
  assert.equal(res.text, 'Gate C is open.');
  assert.equal(res.target, 'en');
});

test('offline translation is clearly labelled with the language', async () => {
  const res = await translate({ text: 'Gate C is open.', target: 'es' });
  assert.equal(res.target, 'es');
  assert.match(res.text, /\[Spanish\]/);
});

test('unsupported targets fall back to English', async () => {
  const res = await translate({ text: 'hello', target: 'zz' });
  assert.equal(res.target, 'en');
});

test('language helpers behave correctly', () => {
  assert.ok(isSupported('ar'));
  assert.equal(isSupported('xx'), false);
  assert.equal(languageName('ja'), 'Japanese');
});
