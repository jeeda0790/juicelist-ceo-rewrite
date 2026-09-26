const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SESSION_TOKEN_SECRET ||= 'test-secret-do-not-use-in-production';

const { issueSessionToken, verifySessionToken } = require('../src/services/auth/tokens');

test('issues a token that verifies back to the same user id', () => {
  const token = issueSessionToken('user-123');
  const session = verifySessionToken(token);

  assert.equal(session?.userId, 'user-123');
});

test('rejects a token that has been tampered with', () => {
  const token = issueSessionToken('user-123');
  const [payload, signature] = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ userId: 'someone-else', expiresAt: Date.now() + 1000000 })).toString('base64url');
  const tampered = `${tamperedPayload}.${signature}`;

  assert.equal(verifySessionToken(tampered), null);
});

test('rejects a garbage/malformed token', () => {
  assert.equal(verifySessionToken('not-a-real-token'), null);
  assert.equal(verifySessionToken(''), null);
  assert.equal(verifySessionToken(undefined), null);
});

test('rejects an expired token', () => {
  // Issue a token that is already expired by constructing it directly
  // (issueSessionToken always sets a future expiry, so we build one by hand).
  const crypto = require('node:crypto');
  const payload = JSON.stringify({ userId: 'user-123', expiresAt: Date.now() - 1000 });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', process.env.SESSION_TOKEN_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  const expiredToken = `${encodedPayload}.${signature}`;

  assert.equal(verifySessionToken(expiredToken), null);
});

test('two tokens for different users do not verify as each other', () => {
  const tokenA = issueSessionToken('user-a');
  const tokenB = issueSessionToken('user-b');

  assert.equal(verifySessionToken(tokenA)?.userId, 'user-a');
  assert.equal(verifySessionToken(tokenB)?.userId, 'user-b');
});
