const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY ||= 'test-anon-key';

const { normalizeForOcr } = require('../src/services/ocr/local-tesseract');

test('normalizes a valid image into a clean JPEG buffer', async () => {
  const validPng = await sharp({
    create: { width: 20, height: 20, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();

  const result = await normalizeForOcr(validPng);
  const metadata = await sharp(result).metadata();

  assert.equal(metadata.format, 'jpeg');
});

test('falls back to the original buffer (not a crash) when sharp cannot decode the image', async () => {
  const garbageBuffer = Buffer.from('this is not an image, just plain text bytes');

  const result = await normalizeForOcr(garbageBuffer);

  assert.equal(Buffer.isBuffer(result), true);
  assert.equal(result.equals(garbageBuffer), true);
});