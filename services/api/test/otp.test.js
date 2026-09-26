const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY ||= 'test-anon-key';

const { normalizePhone } = require('../src/services/auth/otp');

test('normalizes a phone number with spaces, dashes, and a plus sign', () => {
  assert.equal(normalizePhone('+962 79 123 4567'), '+9627912 34567'.replace(/\s/g, ''));
  assert.equal(normalizePhone('+962-79-123-4567'), '+9627912 34567'.replace(/\s/g, ''));
});

test('treats equivalent phone numbers as the same after normalization', () => {
  const a = normalizePhone('+962 79 123 4567');
  const b = normalizePhone('+962-79-123-4567');
  const c = normalizePhone('+962791234567');

  assert.equal(a, b);
  assert.equal(b, c);
});

test('strips non-digit characters other than a leading plus', () => {
  assert.equal(normalizePhone('(962) 79-123-4567'), '9627912 34567'.replace(/\s/g, ''));
});

test('trims surrounding whitespace', () => {
  assert.equal(normalizePhone('  +962791234567  '), '+962791234567');
});
