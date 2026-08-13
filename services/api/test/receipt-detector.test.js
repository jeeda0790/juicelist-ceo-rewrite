const test = require('node:test');
const assert = require('node:assert/strict');
const { looksLikeReceipt } = require('../src/services/receipts/receipt-detector');

test('accepts a typical English receipt with price lines and currency terms', () => {
  const result = looksLikeReceipt({
    text: 'COZMO SUPERMARKET\nMILK 1L\n1.250\nBREAD\n0.500\nTOTAL 1.750 JOD',
  });

  assert.equal(result.isReceipt, true);
  assert.ok(result.confidence > 0.5);
});

test('accepts a typical Arabic receipt with price lines and currency terms', () => {
  const result = looksLikeReceipt({
    text: 'الكرمل فريش\nحليب\n1.250\nخبز\n0.500\nالمجموع 1.750 دينار',
  });

  assert.equal(result.isReceipt, true);
});

test('rejects an image with almost no text at all', () => {
  const result = looksLikeReceipt({ text: 'hi' });

  assert.equal(result.isReceipt, false);
  assert.ok(result.reasons.includes('too_few_lines'));
});

test('rejects a plausible-length block of text with no prices or receipt vocabulary', () => {
  const result = looksLikeReceipt({
    text: 'Happy birthday!\nHope you have a wonderful day\nSee you at the party\nLove, Sara',
  });

  assert.equal(result.isReceipt, false);
  assert.ok(result.reasons.includes('no_receipt_signals_found'));
});

test('accepts text with receipt vocabulary even without a clean decimal price line', () => {
  const result = looksLikeReceipt({
    text: 'MEAT MASTER\nCASHIER: 12\nQTY PRICE AMOUNT\nsome garbled ocr noise here',
  });

  assert.equal(result.isReceipt, true);
  assert.ok(result.reasons.includes('receipt_vocabulary_term'));
});

test('accepts line objects (provider-neutral OCR contract) as well as raw text', () => {
  const result = looksLikeReceipt({
    text: 'ignored when lines is present',
    lines: [
      { text: 'C-TOWN', confidence: 0.9 },
      { text: 'MILK 1L' },
      { text: '1.250' },
      { text: 'TOTAL 1.250 JOD' },
    ],
  });

  assert.equal(result.isReceipt, true);
});

test('gives higher confidence to two or more valid decimal price lines than to just one', () => {
  const single = looksLikeReceipt({ text: 'random text\nmore text\n1.250\nno other signal here' });
  const multiple = looksLikeReceipt({
    text: 'random text\nmore text\n1.250\n2.400\n0.800\nno other signal here',
  });

  assert.ok(multiple.confidence > single.confidence);
});
