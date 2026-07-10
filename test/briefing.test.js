import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brief, ROLES } from '../src/services/briefingService.js';

test('generates a role-specific briefing with duties and escalation', async () => {
  const res = await brief({ role: 'accessibility-host' });
  assert.equal(res.role, 'accessibility-host');
  assert.equal(res.roleLabel, ROLES['accessibility-host'].label);
  assert.ok(res.duties.length >= 1);
  assert.match(res.briefing.toLowerCase(), /step-free|accessible|sensory/);
  assert.ok(res.phrases.es);
});

test('incorporates venue and zone context when provided', async () => {
  const res = await brief({
    role: 'steward',
    venueId: 'usa-metlife',
    zone: 'East Gate',
    shift: 'Kickoff',
  });
  assert.equal(res.venue.id, 'usa-metlife');
  assert.equal(res.zone, 'East Gate');
  assert.match(res.briefing, /MetLife Stadium/);
  assert.match(res.briefing, /East Gate/);
});

test('covers every defined role', async () => {
  for (const role of Object.keys(ROLES)) {
    const res = await brief({ role });
    assert.ok(res.briefing.length > 0, `briefing for ${role}`);
  }
});

test('rejects an unknown role', async () => {
  await assert.rejects(
    () => brief({ role: 'astronaut' }),
    (e) => e.status === 400,
  );
});
