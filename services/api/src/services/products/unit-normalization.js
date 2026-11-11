const { normalizeNumericCharacters } = require('../receipts/normalization');

// Turns a receipt line like "LAMB 500G @ 4.000 JD" into a price per kilo, and
// "PEPSI 6 x 330ML @ 2.100 JD" into a price per litre, so different pack sizes
// of the same product can be compared fairly.
//
// Everything is derived from the item name plus the quantity and price already
// on the receipt, at read time. Nothing is stored, so improving the rules here
// automatically improves every receipt that was already scanned.

// Each entry: unit words (English + Arabic) -> how many base units one of it is.
// Base units are kg for weight and l for liquid.
const UNIT_TABLE = [
  { type: 'mass', toBase: 1, words: ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms', 'كغ', 'كغم', 'كجم', 'كيلو', 'كيلوغرام', 'كيلوجرام'] },
  { type: 'mass', toBase: 0.001, words: ['g', 'gm', 'gms', 'gr', 'grm', 'gram', 'grams', 'غ', 'غم', 'جم', 'جرام', 'غرام', 'غرامات'] },
  { type: 'volume', toBase: 1, words: ['l', 'lt', 'ltr', 'ltrs', 'liter', 'liters', 'litre', 'litres', 'لتر', 'لترات', 'ليتر', 'ليترات', 'ل'] },
  { type: 'volume', toBase: 0.01, words: ['cl'] },
  { type: 'volume', toBase: 0.001, words: ['ml', 'mls', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'مل', 'ملل', 'ملي', 'ملليلتر'] },
  { type: 'piece', toBase: 1, words: ['pcs', 'pc', 'pieces', 'piece', 'ct', 'count', 'حبة', 'حبات', 'قطعة', 'قطع'] },
];

const BASE_UNIT_BY_TYPE = { mass: 'kg', volume: 'l', piece: 'piece' };

const WORD_TO_UNIT = new Map();
for (const unit of UNIT_TABLE) {
  for (const word of unit.words) WORD_TO_UNIT.set(word, unit);
}

// Longest words first so "kg" is tried before "g" and "ml" before "l".
const UNIT_PATTERN = [...WORD_TO_UNIT.keys()]
  .sort((a, b) => b.length - a.length)
  .join('|');

const NUMBER = String.raw`\d+(?:\.\d+)?`;
// A unit word only counts when it is not glued to other letters or digits, so
// "500G" matches but "500GLOBE" and "3GB" do not.
const NOT_LETTER_BEFORE = String.raw`(?<![\p{L}\p{N}])`;
const NOT_LETTER_AFTER = String.raw`(?![\p{L}\p{N}])`;
const MULTIPLY = String.raw`[x*×]`;

const MULTI_BEFORE = new RegExp(
  `${NOT_LETTER_BEFORE}(\\d+)\\s*${MULTIPLY}\\s*(${NUMBER})\\s*(${UNIT_PATTERN})${NOT_LETTER_AFTER}`, 'iu'
);
const MULTI_AFTER = new RegExp(
  `${NOT_LETTER_BEFORE}(${NUMBER})\\s*(${UNIT_PATTERN})\\s*${MULTIPLY}\\s*(\\d+)${NOT_LETTER_AFTER}`, 'iu'
);
const SINGLE = new RegExp(
  `${NOT_LETTER_BEFORE}(${NUMBER})\\s*(${UNIT_PATTERN})${NOT_LETTER_AFTER}`, 'giu'
);

function cleanForSizeSearch(text) {
  return normalizeNumericCharacters(text)
    // "1,5L" is one and a half litres; "1,000 g" is a thousand grams.
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
    .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2')
    .toLowerCase();
}

function toPackSize(count, value, unitWord) {
  const unit = WORD_TO_UNIT.get(unitWord.toLowerCase());
  if (!unit || !(value > 0) || !(count > 0)) return null;

  return {
    type: unit.type,
    size: { value, unit: unitWord.toLowerCase() },
    pack_count: count,
    base_unit: BASE_UNIT_BY_TYPE[unit.type],
    base_quantity: count * value * unit.toBase,
  };
}

/**
 * Finds the pack size in one piece of text, e.g. "PEPSI 6 x 330ML".
 * Returns null when the text has no recognisable size.
 */
function parsePackSize(text) {
  if (!text) return null;
  const cleaned = cleanForSizeSearch(text);

  let match = MULTI_BEFORE.exec(cleaned);
  if (match) return toPackSize(Number(match[1]), Number(match[2]), match[3]);

  match = MULTI_AFTER.exec(cleaned);
  if (match) return toPackSize(Number(match[3]), Number(match[1]), match[2]);

  // Plain sizes. Prefer a weight or volume over a piece count, because
  // "CHEESE 200G 12 SLICES" should be priced per kilo, not per slice.
  let firstPiece = null;
  SINGLE.lastIndex = 0;
  while ((match = SINGLE.exec(cleaned)) !== null) {
    const pack = toPackSize(1, Number(match[1]), match[2]);
    if (!pack) continue;
    if (pack.type !== 'piece') return pack;
    if (!firstPiece) firstPiece = pack;
  }

  return firstPiece;
}

function roundMoney(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * Works out the price per kilo / litre / piece for one receipt line.
 *
 * unitPrice is the price of one pack as printed on the receipt. Returns null
 * when there is not enough information.
 *
 * Two sources, in order of trust:
 *  - "name": the pack size is written in the item name (500G, 1.5L, 6 x 330ML).
 *  - "weighed_quantity": no size in the name but the quantity is a fraction
 *    (0.750), which on a grocery receipt means a weighed item sold per kilo.
 *    This is a guess, so it is marked low confidence.
 */
function computeUnitPrice({ name, nameAr, quantity, unitPrice }) {
  const price = Number(unitPrice);
  if (!Number.isFinite(price) || price <= 0) return null;

  const pack = parsePackSize(name) || parsePackSize(nameAr);
  if (pack) {
    return {
      source: 'name',
      confidence: 'high',
      pack_size: pack.size,
      pack_count: pack.pack_count,
      base_unit: pack.base_unit,
      base_quantity: roundMoney(pack.base_quantity),
      price_per_base_unit: roundMoney(price / pack.base_quantity),
    };
  }

  const qty = Number(quantity);
  if (Number.isFinite(qty) && qty > 0 && qty < 10 && !Number.isInteger(qty)) {
    return {
      source: 'weighed_quantity',
      confidence: 'low',
      pack_size: null,
      pack_count: 1,
      base_unit: 'kg',
      base_quantity: roundMoney(qty),
      price_per_base_unit: roundMoney(price),
    };
  }

  return null;
}

/**
 * Given price observations (each with unit_info from computeUnitPrice), picks
 * the cheapest one per base unit. Different base units (kg vs l) are never
 * compared with each other. Low-confidence guesses are only used when there is
 * nothing better for that unit.
 */
function cheapestPerUnit(observations) {
  const best = {};

  for (const observation of observations) {
    const info = observation.unit_info;
    if (!info) continue;

    const current = best[info.base_unit];
    const better = !current ||
      (current.unit_info.confidence === 'low' && info.confidence === 'high') ||
      (current.unit_info.confidence === info.confidence &&
        info.price_per_base_unit < current.unit_info.price_per_base_unit);

    if (better) best[info.base_unit] = observation;
  }

  return best;
}

module.exports = { parsePackSize, computeUnitPrice, cheapestPerUnit };
