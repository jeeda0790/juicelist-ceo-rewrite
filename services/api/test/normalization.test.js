const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeDigits,
  normalizeSearchText,
  parseDecimal,
} = require('../src/services/receipts/normalization');

test('normalizes Arabic-Indic and Eastern Arabic digits', () => {
  assert.equal(normalizeDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
  assert.equal(normalizeDigits('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
});

test('parses Jordanian three-decimal values with Arabic separators', () => {
  assert.equal(parseDecimal('١٫٢٥٠ د.أ'), 1.25);
  assert.equal(parseDecimal('1,250 JD'), 1.25);
});

test('normalizes Arabic search variants without changing display data', () => {
  assert.equal(normalizeSearchText('إجمالي الـمُشْتَرَيَات'), 'اجمالي المشتريات');
});
