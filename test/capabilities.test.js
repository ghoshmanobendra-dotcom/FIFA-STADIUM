import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capabilities } from '../src/services/knowledgeBase.js';

const PROBLEM_STATEMENT_AREAS = [
  'navigation',
  'crowd-management',
  'accessibility',
  'transportation',
  'sustainability',
  'multilingual-assistance',
  'operational-intelligence',
  'real-time-decision-support',
];

const NAMED_PERSONAS = ['fans', 'organizers', 'volunteers', 'venue-staff'];

test('every problem-statement capability area is covered by a feature', () => {
  const covered = new Set(capabilities.capabilities.flatMap((c) => c.areas));
  for (const area of PROBLEM_STATEMENT_AREAS) {
    assert.ok(covered.has(area), `area "${area}" must be covered`);
  }
});

test('every named audience/persona is served by at least one feature', () => {
  const served = new Set(capabilities.capabilities.flatMap((c) => c.personas));
  for (const persona of NAMED_PERSONAS) {
    assert.ok(served.has(persona), `persona "${persona}" must be served`);
  }
});

test('each capability maps to a valid endpoint, area(s) and persona(s)', () => {
  const areaIds = new Set(capabilities.problemStatementAreas);
  const personaIds = new Set(capabilities.personas.map((p) => p.id));
  for (const cap of capabilities.capabilities) {
    assert.match(cap.endpoint, /^(GET|POST) \/api\//);
    assert.ok(cap.areas.length > 0 && cap.areas.every((a) => areaIds.has(a)), cap.id);
    assert.ok(cap.personas.length > 0 && cap.personas.every((p) => personaIds.has(p)), cap.id);
    assert.ok(typeof cap.genai === 'string' && cap.genai.length > 0);
  }
});
