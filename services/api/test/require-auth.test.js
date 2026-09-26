const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SESSION_TOKEN_SECRET ||= 'test-secret-do-not-use-in-production';

const { requireAuth } = require('../src/middleware/require-auth');
const { issueSessionToken } = require('../src/services/auth/tokens');

function mockReqRes(authHeader) {
  const req = { headers: authHeader ? { authorization: authHeader } : {} };
  let statusCode;
  let jsonBody;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      jsonBody = body;
      return this;
    },
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  return { req, res, next, getResult: () => ({ statusCode, jsonBody, nextCalled }) };
}

test('rejects a request with no Authorization header', () => {
  const { req, res, next, getResult } = mockReqRes(undefined);
  requireAuth(req, res, next);

  const { statusCode, jsonBody, nextCalled } = getResult();
  assert.equal(statusCode, 401);
  assert.equal(jsonBody.code, 'AUTH_REQUIRED');
  assert.equal(nextCalled, false);
});

test('rejects a request with a malformed Authorization header', () => {
  const { req, res, next, getResult } = mockReqRes('NotBearer sometoken');
  requireAuth(req, res, next);

  const { statusCode, nextCalled } = getResult();
  assert.equal(statusCode, 401);
  assert.equal(nextCalled, false);
});

test('rejects a request with an invalid token', () => {
  const { req, res, next, getResult } = mockReqRes('Bearer garbage-token');
  requireAuth(req, res, next);

  const { statusCode, jsonBody, nextCalled } = getResult();
  assert.equal(statusCode, 401);
  assert.equal(jsonBody.code, 'AUTH_INVALID');
  assert.equal(nextCalled, false);
});

test('accepts a request with a valid token and sets req.userId', () => {
  const token = issueSessionToken('user-abc');
  const { req, res, next, getResult } = mockReqRes(`Bearer ${token}`);
  requireAuth(req, res, next);

  const { nextCalled } = getResult();
  assert.equal(nextCalled, true);
  assert.equal(req.userId, 'user-abc');
});
