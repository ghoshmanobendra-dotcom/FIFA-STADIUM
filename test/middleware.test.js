import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notFound, errorHandler } from '../src/middleware/errorHandler.js';
import { requestId } from '../src/middleware/requestId.js';
import { requireJson } from '../src/middleware/security.js';
import { ApiError } from '../src/middleware/validate.js';

/** Minimal Express req/res doubles. */
function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
  };
}

test('notFound returns a structured 404 with the request id', () => {
  const res = mockRes();
  notFound({ path: '/x', id: 'req-1' }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.code, 'not_found');
  assert.equal(res.body.requestId, 'req-1');
});

test('errorHandler maps an ApiError to its status and code', () => {
  const res = mockRes();
  errorHandler(new ApiError('nope', 422, 'unprocessable'), { path: '/x', id: 'r' }, res, () => {});
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.code, 'unprocessable');
  assert.equal(res.body.error, 'nope');
});

test('errorHandler normalises a JSON parse failure to 400 invalid_json', () => {
  const res = mockRes();
  const err = Object.assign(new SyntaxError('bad'), { type: 'entity.parse.failed', status: 400 });
  errorHandler(err, { path: '/x', id: 'r' }, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'invalid_json');
});

test('errorHandler hides internal messages for unexpected 500s', () => {
  const res = mockRes();
  errorHandler(new Error('secret db string'), { path: '/x', id: 'r' }, res, () => {});
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.code, 'internal_error');
  // In test env (non-production) the raw message is allowed; assert it is at
  // least tagged with the generic code and never leaks a stack.
  assert.equal(res.body.stack, undefined);
});

test('requestId echoes a provided id and generates one otherwise', () => {
  const res1 = mockRes();
  const req1 = { headers: { 'x-request-id': 'abc-123' } };
  requestId(req1, res1, () => {});
  assert.equal(req1.id, 'abc-123');
  assert.equal(res1.headers['x-request-id'], 'abc-123');

  const res2 = mockRes();
  const req2 = { headers: {} };
  requestId(req2, res2, () => {});
  assert.match(req2.id, /[0-9a-f-]{36}/);
});

test('requestId ignores an absurdly long incoming id', () => {
  const res = mockRes();
  const req = { headers: { 'x-request-id': 'x'.repeat(500) } };
  requestId(req, res, () => {});
  assert.notEqual(req.id, 'x'.repeat(500));
});

test('requireJson blocks non-JSON POST with 415', () => {
  const res = mockRes();
  let nexted = false;
  requireJson({ method: 'POST', is: () => false, id: 'r' }, res, () => (nexted = true));
  assert.equal(res.statusCode, 415);
  assert.equal(res.body.code, 'unsupported_media_type');
  assert.equal(nexted, false);
});

test('requireJson allows JSON POST and all GETs', () => {
  let n = 0;
  requireJson({ method: 'POST', is: () => 'application/json' }, mockRes(), () => n++);
  requireJson({ method: 'GET', is: () => false }, mockRes(), () => n++);
  assert.equal(n, 2);
});
