const { normalizeSearchText, parseDecimal } = require('./normalization');

// Currency and receipt-vocabulary signals commonly present on Jordanian grocery
// receipts, in both English and Arabic. Any one of these appearing is a strong
// signal (but not proof) that the image is a receipt rather than an arbitrary photo.
const CURRENCY_TERMS = ['jod', 'jd', 'دينار', 'د.أ'].map(normalizeSearchText);

const RECEIPT_VOCABULARY_TERMS = [
  'total', 'subtotal', 'net total', 'grand total', 'vat', 'tax', 'cash', 'change',
  'discount', 'invoice', 'receipt', 'cashier', 'qty', 'quantity', 'price', 'amount',
  'المجموع', 'الاجمالي', 'الإجمالي', 'الضريبة', 'نقدا', 'فيزا', 'الفاتورة', 'الكمية', 'السعر',
].map(normalizeSearchText);

// Matches lines that end in (or are mostly made of) a decimal number, which is the
// dominant visual pattern on a receipt: "ITEM NAME    1.250" / "حليب  1.250".
const PRICE_LIKE_LINE = /(\d{1,4}[.,]\d{1,3})\s*$/;

function countPriceLikeLines(lines) {
  return lines.filter(line => PRICE_LIKE_LINE.test(line.trim())).length;
}

function countValidDecimals(lines) {
  let count = 0;
  for (const line of lines) {
    const match = line.match(PRICE_LIKE_LINE);
    if (match && parseDecimal(match[1]) !== null) count += 1;
  }
  return count;
}

function containsAnyTerm(normalizedText, terms) {
  return terms.some(term => normalizedText.includes(term));
}

/**
 * Cheap, local heuristic check for "does this OCR text look like a grocery
 * receipt?" Intended to run against a fast/free local OCR pass (e.g. tesseract)
 * BEFORE spending a paid Google Vision call on an image that most likely is not
 * a receipt at all (a selfie, a screenshot, a random document, etc.).
 *
 * This is intentionally forgiving: real receipts vary a lot (faded thermal
 * paper, cropped edges, a single visible column of items). The goal is to
 * reject clearly-not-a-receipt images, not to be a strict validator. When in
 * doubt, this returns isReceipt: true so we never block a real receipt scan on
 * a shaky local OCR pass.
 *
 * @param {{ text: string, lines?: Array<{text: string}> }} ocrResult - output
 *   from any OCR provider following the project's provider-neutral contract.
 * @returns {{ isReceipt: boolean, confidence: number, reasons: string[] }}
 */
function looksLikeReceipt(ocrResult) {
  const rawText = ocrResult?.text || '';
  const lineTexts = (ocrResult?.lines || rawText.split('\n'))
    .map(line => (typeof line === 'string' ? line : line.text || ''))
    .map(line => line.trim())
    .filter(Boolean);

  const reasons = [];

  if (lineTexts.length < 3) {
    return { isReceipt: false, confidence: 0, reasons: ['too_few_lines'] };
  }

  const normalizedText = normalizeSearchText(rawText);
  const priceLikeLineCount = countPriceLikeLines(lineTexts);
  const validDecimalCount = countValidDecimals(lineTexts);
  const hasCurrencyTerm = containsAnyTerm(normalizedText, CURRENCY_TERMS);
  const hasVocabularyTerm = containsAnyTerm(normalizedText, RECEIPT_VOCABULARY_TERMS);

  if (priceLikeLineCount > 0) reasons.push(`price_like_lines:${priceLikeLineCount}`);
  if (validDecimalCount > 0) reasons.push(`valid_decimals:${validDecimalCount}`);
  if (hasCurrencyTerm) reasons.push('currency_term');
  if (hasVocabularyTerm) reasons.push('receipt_vocabulary_term');

  // Score-based decision: each independent signal nudges confidence up.
  // Two or more valid decimal-looking price lines is the single strongest
  // signal on its own, since random photos essentially never contain that.
  let confidence = 0;
  if (validDecimalCount >= 2) confidence += 0.5;
  else if (validDecimalCount === 1) confidence += 0.2;
  if (hasCurrencyTerm) confidence += 0.25;
  if (hasVocabularyTerm) confidence += 0.25;
  confidence = Math.min(confidence, 1);

  // Require at least one concrete signal beyond "text exists" — an image with
  // no price-like lines, no currency term, and no receipt vocabulary is almost
  // certainly not a receipt, regardless of how much text was OCR'd from it.
  const isReceipt = validDecimalCount >= 1 || hasCurrencyTerm || hasVocabularyTerm;

  if (!isReceipt) reasons.push('no_receipt_signals_found');

  return { isReceipt, confidence, reasons };
}

module.exports = { looksLikeReceipt };
