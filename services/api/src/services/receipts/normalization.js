const ARABIC_INDIC_ZERO = '٠'.charCodeAt(0);
const EASTERN_ARABIC_ZERO = '۰'.charCodeAt(0);

function normalizeDigits(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - EASTERN_ARABIC_ZERO));
}

function normalizeNumericCharacters(value) {
  return normalizeDigits(value)
    .normalize('NFKC')
    .replace(/[−–—]/g, '-')
    .replace(/٫/g, '.')
    .replace(/٬/g, '');
}

function parseDecimal(value) {
  let normalized = normalizeNumericCharacters(value)
    .replace(/(?:JOD|JD|د\.?\s*أ|دينار)/gi, '')
    .trim();

  if (normalized.includes('.') && normalized.includes(',')) {
    normalized = normalized.replace(/,/g, '');
  } else if (normalized.includes(',')) {
    normalized = /,\d{1,3}$/.test(normalized)
      ? normalized.replace(',', '.')
      : normalized.replace(/,/g, '');
  }

  normalized = normalized.replace(/[^0-9.+-]/g, '');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return null;

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function stripBidiControls(value) {
  return String(value ?? '').replace(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
}

function sanitizeText(value) {
  if (value == null) return null;

  const sanitized = stripBidiControls(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();

  return sanitized || null;
}

function normalizeArabicForSearch(value) {
  return normalizeNumericCharacters(stripBidiControls(value))
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

function normalizeSearchText(value) {
  return normalizeArabicForSearch(value)
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasArabic(value) {
  return /\p{Script=Arabic}/u.test(String(value ?? ''));
}

function hasLatin(value) {
  return /\p{Script=Latin}/u.test(String(value ?? ''));
}

module.exports = {
  hasArabic,
  hasLatin,
  normalizeDigits,
  normalizeNumericCharacters,
  normalizeSearchText,
  parseDecimal,
  sanitizeText,
  stripBidiControls,
};
