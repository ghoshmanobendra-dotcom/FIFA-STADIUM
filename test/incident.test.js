import { test } from 'node:test';
import assert from 'node:assert/strict';
import { triage } from '../src/services/incidentService.js';

test('a critical fire is P1 and escalates', async () => {
  const res = await triage({ type: 'fire', severity: 'critical', zone: 'Upper Concourse' });
  assert.equal(res.priority, 'P1');
  assert.equal(res.escalate, true);
  assert.equal(res.targetResponseMinutes, 2);
  assert.match(res.dispatchTeam, /Fire/);
});

test('a low accessibility request is lower priority and does not escalate', async () => {
  const res = await triage({ type: 'accessibility', severity: 'low' });
  assert.ok(['P3', 'P4'].includes(res.priority));
  assert.equal(res.escalate, false);
});

test('higher severity never yields a less urgent priority', async () => {
  const order = { P1: 1, P2: 2, P3: 3, P4: 4 };
  const low = await triage({ type: 'medical', severity: 'low' });
  const high = await triage({ type: 'medical', severity: 'critical' });
  assert.ok(order[high.priority] <= order[low.priority]);
});

test('produces actionable steps and includes venue context', async () => {
  const res = await triage({
    venueId: 'usa-sofi',
    type: 'crowd-surge',
    severity: 'high',
    zone: 'Gate 1',
  });
  assert.ok(res.actions.length >= 2);
  assert.equal(res.venue.id, 'usa-sofi');
  assert.match(res.brief, /Gate 1/);
});

test('rejects unknown type or severity', async () => {
  await assert.rejects(
    () => triage({ type: 'alien', severity: 'high' }),
    (e) => e.status === 400,
  );
  await assert.rejects(
    () => triage({ type: 'medical', severity: 'apocalyptic' }),
    (e) => e.status === 400,
  );
});
