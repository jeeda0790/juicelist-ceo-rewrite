const { normalizeSearchText, parseDecimal } = require('./normalization');

// Currency and receipt-vocabulary signals commonly present on Jordanian grocery
// receipts, in both English and Arabic. Any one of these appearing is a strong
// signal (but not proof) that the image is a receipt rather than an arbitrary photo.
const CURRENCY_TERMS = ['jod', 'jd', 'دينار', 'د.أ'].map(normalizeSearchText);

// Deliberately excludes generic words that show up constantly outside receipts
// too ("total", "price", "amount", "discount", "cash", "qty" all appear on
// ordinary shopping/checkout web pages, invoices-as-emails, etc.). Kept terms
// are ones that are specifically about a point-of-sale transaction slip.
const RECEIPT_VOCABULARY_TERMS = [
  'subtotal', 'net total', 'grand total', 'vat', 'invoice no', 'cashier',
  'المجموع', 'الاجمالي', 'الإجمالي', 'الضريبة', 'نقدا', 'فيزا', 'الفاتورة', 'الكاشير',
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

  // Bug fix: when a provider gives structured `lines` (its authoritative OCR
  // output) rather than a flat `text` string, currency/vocabulary detection
  // must scan those lines too - not just whatever (possibly empty or
  // unrelated) `text` field came alongside them.
  const normalizedText = normalizeSearchText(
    ocrResult?.lines ? lineTexts.join('\n') : rawText
  );
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

  // A single signal is NOT enough on its own: a social-media stats screen has
  // decimal-looking numbers ("63,436" views), a shopping page has a price and
  // the word "discount", and an app's nav bar can contain "JOD" as a currency
  // label with no receipt anywhere in sight. Each of those trips exactly one
  // signal. Real receipts consistently trip at least two independent signals
  // at once (a price column AND a currency mark, or several price lines AND
  // vocabulary like "total"/"VAT"). So we require either:
  //   - at least two of the three independent signal types together, or
  //   - a genuinely strong price column on its own (3+ valid decimal lines),
  //     since an itemized list that long essentially never appears outside
  //     a real receipt.
  const signalTypesPresent =
    (validDecimalCount >= 1 ? 1 : 0) +
    (hasCurrencyTerm ? 1 : 0) +
    (hasVocabularyTerm ? 1 : 0);

  const isReceipt = validDecimalCount >= 6 || signalTypesPresent >= 2;

  if (!isReceipt) reasons.push('insufficient_combined_signals');

  return { isReceipt, confidence, reasons };
}

module.exports = { looksLikeReceipt };
