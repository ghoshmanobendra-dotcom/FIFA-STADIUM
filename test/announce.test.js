import { test } from 'node:test';
import assert from 'node:assert/strict';
import { announce } from '../src/services/announcementService.js';

test('generates a known scenario in the requested languages', async () => {
  const res = await announce({ scenario: 'gates-open', languages: ['en', 'es', 'fr'] });
  assert.equal(res.scenario, 'gates-open');
  assert.equal(res.languages.length, 3);
  assert.match(res.base, /Gates are now open/);
  const en = res.languages.find((l) => l.language === 'en');
  assert.equal(en.text, res.base); // English passthrough
});

test('supports a custom message over a scenario', async () => {
  const res = await announce({ message: 'Section 120 is now closed.', languages: ['en', 'de'] });
  assert.equal(res.scenario, 'custom');
  assert.match(res.base, /Section 120/);
  assert.match(res.languages.find((l) => l.language === 'de').text, /\[German\]/);
});

test('filters unsupported languages and de-duplicates', async () => {
  const res = await announce({ scenario: 'delay', languages: ['en', 'en', 'zz'] });
  assert.deepEqual(
    res.languages.map((l) => l.language),
    ['en'],
  );
});

test('defaults to en/es/fr when no languages given', async () => {
  const res = await announce({ scenario: 'evacuation' });
  assert.deepEqual(res.languages.map((l) => l.language).sort(), ['en', 'es', 'fr']);
});

test('rejects when neither message nor known scenario is supplied', async () => {
  await assert.rejects(
    () => announce({}),
    (e) => e.status === 400,
  );
  await assert.rejects(
    () => announce({ scenario: 'nope' }),
    (e) => e.status === 400,
  );
});
