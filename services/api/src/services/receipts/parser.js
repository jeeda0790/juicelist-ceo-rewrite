const {
  hasArabic,
  hasLatin,
  normalizeNumericCharacters,
  normalizeSearchText,
  parseDecimal,
  sanitizeText,
} = require('./normalization');
const { applyOcrNameCorrections } = require('./name-corrections');

const STORE_DEFINITIONS = [
  { id: 'COZMO', aliases: ['cozmo', 'كوزمو'] },
  { id: 'C-TOWN', aliases: ['c town', 'ctown', 'سي تاون'] },
  { id: 'MEAT_MASTER', aliases: ['meat master', 'meatmaster', 'ميت ماستر'] },
  { id: 'ALKARMEL', aliases: ['alkarmel', 'al karmel', 'al-karmel', 'الكرمل'] },
  { id: 'CASHMERE', aliases: ['cashmere', 'كشمير', 'كشير لمستخطرات'] },
  { id: 'TAHA_QASHOU', aliases: ['taha and qashou', 'taha & qashou', 'طه وقاشوع'] },
  { id: 'SW_ALRIYADH', aliases: ['sw alriyadh', 'مؤسسة باقة التجارية'] },
];

const SUMMARY_AND_METADATA_TERMS = [
  'total', 'net', 'net total', 'grand total', 'subtotal', 'net sell', 'netsell', 'vat',
  'tax', 'tax vad', 'change',
  'cash', 'discount', 'discoont', 'savings', 'invoice', 'receipt', 'date', 'time', 'amount due',
  'balance due', 'visa', 'mastercard', 'payment', 'currency', 'loyalty', 'points',
  'transaction', 'cashier', 'printed on', 'thank you', 'items', 'promoter', 'tax no',
  'invoice no', 'invoice date', 'barcode qty price amount', 'item description qty price total',
  'المجموع', 'المجموع الكلي', 'المجموع الفرعي', 'الاجمالي', 'الإجمالي', 'الصافي',
  'الضريبة', 'الضرية', 'ضريبة', 'نقدا', 'فيزا', 'المبلغ النقدي', 'الباقي', 'خصم', 'الخصم',
  'توفير', 'فاتورة', 'الفاتورة',
  'التاريخ', 'الوقت', 'المبلغ المستحق', 'المبلغ المطلوب', 'الدفع', 'الدفعة', 'الدقعة',
  'الدفعات', 'عدد المواد', 'رقم الفاتورة', 'رقم الكاش', 'الرقم الضريبي', 'البائع',
  'البضاعة المباعة', 'اهلا وسهلا', 'أهلا وسهلا', 'وصف المادة',
].map(normalizeSearchText);

const COLUMN_HEADER_TERMS = [
  'barcode', 'qty', 'quantity', 'price', 'amount', 'description', 'unit price',
  'الكمية', 'السعر', 'صافي السعر', 'المادة',
].map(normalizeSearchText);

function detectStore(text) {
  const normalized = normalizeSearchText(text);
  const match = STORE_DEFINITIONS.find(store =>
    store.aliases.some(alias => normalized.includes(normalizeSearchText(alias)))
  );

  return match?.id || 'GENERIC';
}

function isSummaryOrMetadata(line) {
  const normalized = normalizeSearchText(line);
  if (!normalized) return true;

  const withoutLeadingNumbers = normalized.replace(/^(?:\d+(?: \d+)*\s+)+/, '');
  const summaryCandidates = [normalized, withoutLeadingNumbers];

  if (SUMMARY_AND_METADATA_TERMS.some(term =>
    summaryCandidates.some(candidate => candidate === term || candidate.startsWith(`${term} `))
  )) return true;

  const headerMatches = COLUMN_HEADER_TERMS.filter(term =>
    normalized === term || normalized.includes(` ${term} `) ||
    normalized.startsWith(`${term} `) || normalized.endsWith(` ${term}`)
  ).length;

  if (headerMatches >= 2) return true;
  if (/^(?:tel|pos|inv|customer|customer name|branch)\b/i.test(normalized)) return true;
  if (/\b(?:thank you|hope to see|tax no|invoice no|invoice date)\b/i.test(normalized)) return true;
  return false;
}

function extractNumberTokens(line) {
  const normalized = normalizeNumericCharacters(line);
  return normalized.match(/[+-]?\d+(?:[.,]\d+)?/g) || [];
}

function isBarcodeToken(token) {
  return /^\d{8,16}$/.test(String(token).replace(/[.,]/g, ''));
}

function usableNumberTokens(lineOrTokens) {
  const tokens = Array.isArray(lineOrTokens) ? lineOrTokens : extractNumberTokens(lineOrTokens);
  return tokens.filter(token => !isBarcodeToken(token));
}

function hasMonetaryToken(tokens) {
  return tokens.some(token => /[.,]\d{2,3}$/.test(token));
}

function isPriceOnlyLine(line) {
  const normalized = normalizeNumericCharacters(line)
    .replace(/(?:JOD|JD|د\.?\s*أ|دينار)/gi, '')
    .replace(/[xX*×:=|\[\]()]/g, ' ')
    .trim();

  if (!normalized) return false;
  const letters = normalized.match(/\p{L}/gu) || [];
  const tokens = usableNumberTokens(normalized);
  return letters.length <= 3 && tokens.length > 0 && hasMonetaryToken(tokens);
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function tokenVariants(token) {
  const parsed = parseDecimal(token);
  if (parsed == null) return [];

  const variants = [{ value: parsed, scaled: false }];
  const compact = String(token).replace(/[^0-9]/g, '');
  if (!/[.,]/.test(token) && compact.length >= 4 && compact.length <= 6) {
    variants.push({ value: parsed / 1000, scaled: true });
  }

  return variants;
}

function inferPriceTuple(numberTokens) {
  const tokens = usableNumberTokens(numberTokens);
  if (tokens.length === 0) return null;

  if (tokens.length === 1) {
    const value = parseDecimal(tokens[0]);
    if (value == null) return null;
    return { quantity: 1, unitPrice: value, totalPrice: value, ambiguous: false };
  }

  if (tokens.length === 2) {
    const first = parseDecimal(tokens[0]);
    const second = parseDecimal(tokens[1]);
    if (first == null || second == null) return null;

    if (Number.isInteger(first) && first > 0 && first <= 100 && second >= first) {
      return {
        quantity: first,
        unitPrice: roundMoney(second / first),
        totalPrice: second,
        ambiguous: true,
      };
    }

    return { quantity: 1, unitPrice: first, totalPrice: first, ambiguous: true };
  }

  const values = tokens.map(tokenVariants);
  const candidates = [];

  for (let quantityIndex = 0; quantityIndex < values.length; quantityIndex += 1) {
    for (const quantityVariant of values[quantityIndex]) {
      const quantity = quantityVariant.value;
      if (quantity <= 0 || quantity > 100) continue;

      for (let totalIndex = 0; totalIndex < values.length; totalIndex += 1) {
        if (totalIndex === quantityIndex) continue;

        for (const totalVariant of values[totalIndex]) {
          const totalPrice = totalVariant.value;
          if (totalPrice < 0 || totalPrice > 100000) continue;
          const derivedUnitPrice = totalPrice / quantity;

          for (let unitIndex = 0; unitIndex < values.length; unitIndex += 1) {
            if (unitIndex === quantityIndex || unitIndex === totalIndex) continue;

            for (const unitVariant of values[unitIndex]) {
              const relativeError = Math.abs(unitVariant.value - derivedUnitPrice) /
                Math.max(derivedUnitPrice, 0.001);
              const quantityPenalty = Number.isInteger(quantity) ? 0 : 0.12;
              const quantitySizePenalty = Math.max(0, quantity - 1) * 0.002;
              const scalePenalty = [quantityVariant, totalVariant, unitVariant]
                .filter(variant => variant.scaled).length * 0.015;
              const totalPenalty = totalPrice < derivedUnitPrice ? 0.2 : 0;
              const score = relativeError + quantityPenalty + quantitySizePenalty +
                scalePenalty + totalPenalty;

              candidates.push({
                quantity,
                unitPrice: roundMoney(derivedUnitPrice),
                totalPrice,
                score,
                printedUnitError: relativeError,
              });
            }
          }
        }
      }
    }
  }

  candidates.sort((a, b) => a.score - b.score || b.totalPrice - a.totalPrice);
  const best = candidates[0];
  if (!best) return null;

  return {
    quantity: best.quantity,
    unitPrice: best.unitPrice,
    totalPrice: best.totalPrice,
    ambiguous: best.printedUnitError > 0.03,
  };
}

function cleanItemName(value) {
  const structurallyClean = sanitizeText(value)
    ?.replace(/^\s*(?:\(?0\d{1,2}\)?|\d+[.)-])\s*/, '')
    .replace(/\s*[([]\s*0?\d{1,3}(?:\s+\d+)?\s*[)\]]?\s*$/u, '')
    .replace(/^[|\[\]{}:;\s]+|[|\[\]{}:;\s]+$/g, '')
    .replace(/\s*\|\s*[a-z]$/i, '')
    .replace(/\s+[-:]+\s*$/, '')
    .trim();

  return structurallyClean ? applyOcrNameCorrections(structurallyClean) : null;
}

function itemNames(value) {
  const name = cleanItemName(value);
  if (!name) return { raw_name: null, raw_name_ar: null };

  return {
    raw_name: hasLatin(name) ? name : null,
    raw_name_ar: hasArabic(name) ? name : null,
  };
}

function makeItem(name, tuple, confidence) {
  if (!tuple || tuple.unitPrice > 10000 || tuple.totalPrice > 100000) return null;
  const names = itemNames(name);
  if (!names.raw_name && !names.raw_name_ar) return null;

  return {
    ...names,
    quantity: tuple.quantity,
    unit_price: roundMoney(tuple.totalPrice / tuple.quantity),
    total_price: tuple.totalPrice,
    ocr_confidence: confidence,
    needs_review: tuple.ambiguous,
  };
}

function splitInlineItem(line) {
  const normalized = normalizeNumericCharacters(line)
    .replace(/(?:JOD|JD|د\.?\s*أ|دينار)/gi, '')
    .trim();

  const trailing = normalized.match(/^(.*\p{L}.*?)\s+([^\p{L}]*\d[\d.,\s|\][(){}+-]*)$/u);
  if (
    trailing &&
    (trailing[1].match(/\p{L}/gu) || []).length >= 4 &&
    hasMonetaryToken(usableNumberTokens(trailing[2]))
  ) {
    return { name: trailing[1], tokens: usableNumberTokens(trailing[2]), confidence: 0.78 };
  }

  const leading = normalized.match(/^([\d.,\s|\][(){}+-]*\d)\s+(.*\p{L}.*)$/u);
  if (
    leading &&
    (leading[2].match(/\p{L}/gu) || []).length >= 4 &&
    hasMonetaryToken(usableNumberTokens(leading[1]))
  ) {
    return { name: leading[2], tokens: usableNumberTokens(leading[1]), confidence: 0.72 };
  }

  return null;
}

function parseInlineItem(line) {
  if (isSummaryOrMetadata(line)) return null;
  const split = splitInlineItem(line);
  if (!split) return null;
  return makeItem(split.name, inferPriceTuple(split.tokens), split.confidence);
}

function looksLikeNameLine(line) {
  const cleaned = cleanItemName(line);
  if (!cleaned || cleaned.length < 2 || isSummaryOrMetadata(cleaned)) return false;
  const letters = cleaned.match(/\p{L}/gu) || [];
  if (letters.length < 3 || isPriceOnlyLine(cleaned)) return false;
  return letters.length / cleaned.length >= 0.3;
}

function combineBilingualNames(first, second) {
  const firstNames = itemNames(first);
  const secondNames = itemNames(second);
  return {
    raw_name: firstNames.raw_name || secondNames.raw_name,
    raw_name_ar: firstNames.raw_name_ar || secondNames.raw_name_ar,
  };
}

function findNamesForNumericRow(lines, index, usedNameLines) {
  const before = index - 1;
  const after = index + 1;
  let primaryIndex = null;
  let direction = 0;

  if (before >= 0 && !usedNameLines.has(before) && looksLikeNameLine(lines[before])) {
    primaryIndex = before;
    direction = -1;
  } else if (after < lines.length && !usedNameLines.has(after) && looksLikeNameLine(lines[after])) {
    primaryIndex = after;
    direction = 1;
  }

  if (primaryIndex == null) return null;
  const nameIndexes = [primaryIndex];
  const secondaryIndex = primaryIndex + direction;
  if (
    secondaryIndex >= 0 && secondaryIndex < lines.length &&
    !usedNameLines.has(secondaryIndex) && looksLikeNameLine(lines[secondaryIndex]) &&
    ((hasArabic(cleanItemName(lines[primaryIndex])) && !hasLatin(cleanItemName(lines[primaryIndex])) &&
      hasLatin(cleanItemName(lines[secondaryIndex])) && !hasArabic(cleanItemName(lines[secondaryIndex]))) ||
      (hasLatin(cleanItemName(lines[primaryIndex])) && !hasArabic(cleanItemName(lines[primaryIndex])) &&
      hasArabic(cleanItemName(lines[secondaryIndex])) && !hasLatin(cleanItemName(lines[secondaryIndex]))))
  ) {
    nameIndexes.push(secondaryIndex);
  }

  return nameIndexes;
}

function appendContinuation(item, line) {
  const continuation = cleanItemName(line);
  if (!continuation) return;

  if (hasArabic(continuation) && item.raw_name_ar) {
    item.raw_name_ar = `${item.raw_name_ar} ${continuation}`;
  } else if (hasLatin(continuation) && item.raw_name) {
    item.raw_name = `${item.raw_name} ${continuation}`;
  }
}

function parseReceiptLines(inputLines) {
  const lines = inputLines
    .map(line => sanitizeText(normalizeNumericCharacters(line)))
    .filter(Boolean);
  const items = [];
  const usedNameLines = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isSummaryOrMetadata(line)) continue;

    const inlineItem = parseInlineItem(line);
    if (inlineItem) {
      const nextLine = lines[index + 1];
      const followingLine = lines[index + 2];
      if (
        nextLine && looksLikeNameLine(nextLine) &&
        !hasMonetaryToken(usableNumberTokens(nextLine)) &&
        (!followingLine || isSummaryOrMetadata(followingLine) || !isPriceOnlyLine(followingLine))
      ) {
        appendContinuation(inlineItem, nextLine);
        usedNameLines.add(index + 1);
      }
      items.push(inlineItem);
      continue;
    }

    if (!isPriceOnlyLine(line)) continue;
    const tuple = inferPriceTuple(extractNumberTokens(line));
    const nameIndexes = findNamesForNumericRow(lines, index, usedNameLines);
    if (!tuple || !nameIndexes) continue;

    const item = makeItem(lines[nameIndexes[0]], tuple, nameIndexes.length > 1 ? 0.82 : 0.75);
    if (!item) continue;
    if (nameIndexes.length > 1) {
      Object.assign(item, combineBilingualNames(lines[nameIndexes[0]], lines[nameIndexes[1]]));
    }

    nameIndexes.forEach(nameIndex => usedNameLines.add(nameIndex));
    items.push(item);
  }

  return items.filter((item, index) => {
    const key = `${item.raw_name || ''}|${item.raw_name_ar || ''}|${item.quantity}|${item.total_price}`;
    return items.findIndex(candidate =>
      `${candidate.raw_name || ''}|${candidate.raw_name_ar || ''}|${candidate.quantity}|${candidate.total_price}` === key
    ) === index;
  });
}

function parseReceiptText(rawText) {
  const text = sanitizeText(rawText) || '';
  const lines = text.split('\n');

  return {
    store: detectStore(text),
    items: parseReceiptLines(lines),
    raw_text: text,
  };
}

module.exports = {
  cleanItemName,
  detectStore,
  extractNumberTokens,
  inferPriceTuple,
  isPriceOnlyLine,
  isSummaryOrMetadata,
  parseInlineItem,
  parseReceiptLines,
  parseReceiptText,
};
