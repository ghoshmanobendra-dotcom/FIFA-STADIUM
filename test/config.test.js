import { test } from 'node:test';
import assert from 'node:assert/strict';
import config from '../src/config.js';

test('exposes a frozen, well-typed configuration', () => {
  assert.equal(Object.isFrozen(config), true);
  assert.equal(typeof config.port, 'number');
  assert.equal(config.isTest, true);
  assert.equal(typeof config.rateLimit.max, 'number');
  assert.equal(typeof config.rateLimit.aiMax, 'number');
  assert.ok(config.bodyLimit);
});

test('AI is disabled when no API key is present', () => {
  // No ANTHROPIC_API_KEY is set for this file, so the offline engine is active.
  assert.equal(config.ai.apiKey, '');
  assert.equal(config.ai.enabled, false);
});

test('AI model defaults to a current Claude model', () => {
  assert.match(config.ai.model, /claude/);
  assert.ok(config.ai.maxTokens > 0);
});
