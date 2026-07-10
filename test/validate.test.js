import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  requireString,
  optionalString,
  requireEnum,
  requireNumber,
  optionalNumber,
  toBoolean,
  optionalStringArray,
  MAX_TEXT_LENGTH,
} from '../src/middleware/validate.js';

test('requireString trims and returns valid input', () => {
  assert.equal(requireString('  hi  ', 'field'), 'hi');
});

test('requireString rejects empty, non-string and over-length input', () => {
  assert.throws(() => requireString('', 'f'), /required/);
  assert.throws(() => requireString('   ', 'f'), /required/);
  assert.throws(() => requireString(42, 'f'), /required/);
  assert.throws(() => requireString('x'.repeat(MAX_TEXT_LENGTH + 1), 'f'), /characters or fewer/);
});

test('optionalString allows empty but still validates when present', () => {
  assert.equal(optionalString(undefined, 'f'), undefined);
  assert.equal(optionalString('', 'f'), undefined);
  assert.equal(optionalString(' ok ', 'f'), 'ok');
  assert.throws(() => optionalString('y'.repeat(999), 'f', 10), /characters or fewer/);
});

test('requireEnum enforces the allow-list', () => {
  assert.equal(requireEnum('es', 'lang', ['en', 'es']), 'es');
  assert.throws(() => requireEnum('zz', 'lang', ['en', 'es']), /must be one of/);
});

test('validation errors carry a 400 status and a code', () => {
  try {
    requireString('', 'field');
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err.status, 400);
    assert.equal(err.code, 'validation_error');
  }
});

test('requireNumber accepts numeric strings and enforces range', () => {
  assert.equal(requireNumber('42', 'n'), 42);
  assert.equal(requireNumber(3.5, 'n', { min: 0, max: 10 }), 3.5);
  assert.throws(() => requireNumber('abc', 'n'), /must be a number/);
  assert.throws(() => requireNumber(11, 'n', { max: 10 }), /between/);
  assert.throws(() => requireNumber(-1, 'n', { min: 0 }), /between/);
  assert.throws(() => requireNumber(3.5, 'n', { integer: true }), /whole number/);
});

test('optionalNumber returns undefined for blanks but validates otherwise', () => {
  assert.equal(optionalNumber(undefined, 'n'), undefined);
  assert.equal(optionalNumber('', 'n'), undefined);
  assert.equal(optionalNumber('7', 'n', { min: 1 }), 7);
  assert.throws(() => optionalNumber(0, 'n', { min: 1 }), /between/);
});

test('toBoolean coerces common truthy/falsy encodings', () => {
  assert.equal(toBoolean(true), true);
  assert.equal(toBoolean('true'), true);
  assert.equal(toBoolean('1'), true);
  assert.equal(toBoolean('false'), false);
  assert.equal(toBoolean('0'), false);
  assert.equal(toBoolean(undefined), false);
  assert.equal(toBoolean('nonsense', true), true);
});

test('optionalStringArray filters, bounds and validates type', () => {
  assert.equal(optionalStringArray(undefined, 'a'), undefined);
  assert.deepEqual(optionalStringArray(['a', 2, 'b'], 'a'), ['a', 'b']);
  assert.equal(optionalStringArray(['x'.repeat(100)], 'a', { maxItemLength: 10 }).length, 0);
  assert.equal(optionalStringArray(new Array(50).fill('x'), 'a', { maxItems: 5 }).length, 5);
  assert.throws(() => optionalStringArray('not-array', 'a'), /must be an array/);
});
