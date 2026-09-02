const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY ||= 'test-anon-key';

const { isAcceptableReceiptImage } = require('../src/middleware/receipt-upload');

test('accepts a file with a correct image mimetype', () => {
  assert.equal(isAcceptableReceiptImage({ mimetype: 'image/jpeg', originalname: 'receipt.jpg' }), true);
  assert.equal(isAcceptableReceiptImage({ mimetype: 'image/png', originalname: 'receipt.png' }), true);
  assert.equal(isAcceptableReceiptImage({ mimetype: 'image/webp', originalname: 'receipt.webp' }), true);
});

test('accepts a .jpeg/.jpg/.png/.webp file even when mimetype is generic (real-world client quirk)', () => {
  assert.equal(
    isAcceptableReceiptImage({ mimetype: 'application/octet-stream', originalname: 'WhatsApp Image 2026-06-01.jpeg' }),
    true
  );
  assert.equal(
    isAcceptableReceiptImage({ mimetype: 'application/octet-stream', originalname: 'photo.jpg' }),
    true
  );
});

test('rejects a genuinely non-image file (wrong mimetype AND wrong extension)', () => {
  assert.equal(
    isAcceptableReceiptImage({ mimetype: 'application/pdf', originalname: 'document.pdf' }),
    false
  );
  assert.equal(
    isAcceptableReceiptImage({ mimetype: 'application/octet-stream', originalname: 'file.exe' }),
    false
  );
});

test('extension check is case-insensitive', () => {
  assert.equal(
    isAcceptableReceiptImage({ mimetype: 'application/octet-stream', originalname: 'RECEIPT.JPG' }),
    true
  );
});