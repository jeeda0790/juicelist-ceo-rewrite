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
  assert.ok(result.reasons.includes('insufficient_combined_signals'));
});

test('rejects a single signal alone even when it is a receipt-vocabulary word (needs a second signal)', () => {
  const result = looksLikeReceipt({
    text: 'MEAT MASTER\nCASHIER: 12\nsome garbled ocr noise here\nno prices or currency visible',
  });

  assert.equal(result.isReceipt, false);
  assert.ok(result.reasons.includes('receipt_vocabulary_term'));
  assert.ok(result.reasons.includes('insufficient_combined_signals'));
});

test('accepts receipt vocabulary combined with a currency term, even without a clean decimal price line', () => {
  const result = looksLikeReceipt({
    text: 'MEAT MASTER\nCASHIER: 12\nAmount due in JOD\nsome garbled ocr noise here',
  });

  assert.equal(result.isReceipt, true);
  assert.ok(result.reasons.includes('receipt_vocabulary_term'));
  assert.ok(result.reasons.includes('currency_term'));
});

test('rejects a social-media stats screenshot with comma-grouped numbers that look like decimals', () => {
  // Real false-positive case: "Views 63,436" / "Viewers 17,148" parse as
  // decimal-looking numbers, but there is no currency term or receipt
  // vocabulary anywhere, so a single signal type must not be enough.
  const result = looksLikeReceipt({
    text: 'Insights\nOverview Content Audience\nAll content 30 days\nViews 63,436\nNet followers +101\nInteractions 1,729\nViewers 17,148\nStories 31K',
  });

  assert.equal(result.isReceipt, false);
  assert.ok(result.reasons.includes('insufficient_combined_signals'));
});

test('rejects a shopping page with one price and a generic word like "discount"', () => {
  // Real false-positive case: a product page with "Extra 27% discount" and a
  // single price ("€67,41") used to trip both the (now-removed, too-generic)
  // "discount" vocabulary term and a lone decimal.
  const result = looksLikeReceipt({
    text: 'Every 4 weeks\nExtra 27% discount\nMaximum savings\nAdd to Cart | 27% OFF | 67,41\nWe ship to Jordan\nNeed help?',
  });

  assert.equal(result.isReceipt, false);
  assert.ok(result.reasons.includes('insufficient_combined_signals'));
});

test('rejects an app screenshot whose nav bar happens to contain a currency label', () => {
  // Real false-positive case: a LinkedIn screenshot with "JOD 0" in the nav
  // bar tripped the currency-term signal alone with nothing else receipt-like.
  const result = looksLikeReceipt({
    text: 'Search\nHome My Network Jobs Messaging Notifications Me For Business JOD 0\nA provocative title\n150\n5 comments 16 reposts\nMost relevant',
  });

  assert.equal(result.isReceipt, false);
  assert.ok(result.reasons.includes('currency_term'));
  assert.ok(result.reasons.includes('insufficient_combined_signals'));
});

test('accepts a long itemized price column on its own, even with no currency term or vocabulary visible', () => {
  // A heavily cropped receipt photo might show only the item/price column.
  // Six or more valid decimal price lines is treated as strong enough on its own.
  const result = looksLikeReceipt({
    text: 'ITEM A\n1.200\nITEM B\n3.100\nITEM C\n1.080\nITEM D\n0.600\nITEM E\n8.750\nITEM F\n21.000',
  });

  assert.equal(result.isReceipt, true);
  assert.ok(result.reasons.some(r => r.startsWith('valid_decimals:')));
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
