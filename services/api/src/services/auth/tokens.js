const crypto = require('crypto');

// A minimal, dependency-free session token: base64url(payload) + "." +
// HMAC-SHA256 signature, verified with the same secret at read time. This
// avoids adding a JWT library as a new dependency for a small, single-purpose
// token. The payload only ever holds a user id and an expiry - nothing
// sensitive - so a stolen token is bounded by TOKEN_TTL_MS above.
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret() {
  const secret = process.env.SESSION_TOKEN_SECRET;
  if (!secret) {
    throw new Error('Missing SESSION_TOKEN_SECRET environment variable');
  }
  return secret;
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(payloadString) {
  return crypto.createHmac('sha256', getSecret()).update(payloadString).digest('base64url');
}

function issueSessionToken(userId) {
  const payload = JSON.stringify({ userId, expiresAt: Date.now() + TOKEN_TTL_MS });
  const encodedPayload = base64UrlEncode(payload);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return null;
  }

  if (!payload?.userId || typeof payload.expiresAt !== 'number') return null;
  if (Date.now() > payload.expiresAt) return null;

  return { userId: payload.userId };
}

module.exports = { issueSessionToken, verifySessionToken };
