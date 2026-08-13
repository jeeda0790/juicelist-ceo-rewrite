const OCR_NAME_CORRECTIONS = [
  { pattern: /\b(?:Preelook|Froclook)\b/gi, replacement: 'Freelook' },
  { pattern: /\[air\b/gi, replacement: 'Hair' },
  { pattern: /\bMoga\b/gi, replacement: 'Mega' },
  { pattern: /§/g, replacement: 'S' },
  { pattern: /^1(?=\p{Script=Arabic})/u, replacement: '' },
  { pattern: /(^|\s)صساج(?=\s|$)/gu, replacement: '$1مساج' },
  { pattern: /^اداة(?=\s|$)/u, replacement: 'أداة' },
  { pattern: /(^|\s)الراس(?=\s|$)/gu, replacement: '$1الرأس' },
  { pattern: /(^|\s)(?:نبانت|تبانات)(?=\s|$)/gu, replacement: '$1نباتات' },
  { pattern: /(^|\s)(?:بانك|دبانة)(?=\s|$)/gu, replacement: '$1بطاقة' },
  { pattern: /(^|\s)بيتوس(?=\s|$)/gu, replacement: '$1بيتموس' },
];

function applyOcrNameCorrections(value) {
  return OCR_NAME_CORRECTIONS.reduce(
    (name, correction) => name.replace(correction.pattern, correction.replacement),
    value
  );
}

module.exports = { applyOcrNameCorrections };
