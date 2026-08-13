const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY ||= 'test-anon-key';

const { createApp } = require('../src/app');

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('serves the local receipt workbench when enabled', async () => {
  const app = createApp({
    enableTester: true,
    enableDatabaseRoutes: false,
    scanReceipt: async () => ({}),
  });

  await withServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/tester/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Receipt Lab/);
    assert.match(html, /Local-only mode/);
    assert.match(html, /not written to Supabase/);
  });
});

test('returns a non-persistent mocked scan through the preview endpoint', async () => {
  const scanReceipt = async imageBuffer => {
    assert.ok(Buffer.isBuffer(imageBuffer));
    assert.ok(imageBuffer.length > 0);
    return {
      store: 'COZMO',
      items: [{
        raw_name: 'MILK 1L',
        raw_name_ar: 'حليب ١ لتر',
        quantity: 1,
        unit_price: 1.25,
        total_price: 1.25,
        needs_review: false,
      }],
      raw_text: 'MILK 1L 1.250',
      ocr_provider: 'test-provider',
      ocr_lines: [],
    };
  };
  const app = createApp({ enableTester: true, enableDatabaseRoutes: false, scanReceipt });

  await withServer(app, async baseUrl => {
    const form = new FormData();
    form.append('image', new Blob(['fake-image'], { type: 'image/jpeg' }), 'receipt.jpg');
    const response = await fetch(`${baseUrl}/api/receipts/preview`, {
      method: 'POST',
      body: form,
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.receipt.store, 'COZMO');
    assert.equal(body.receipt.items[0].raw_name_ar, 'حليب ١ لتر');
  });
});

test('does not expose the workbench when explicitly disabled', async () => {
  const app = createApp({ enableTester: false });

  await withServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/tester/`);
    assert.equal(response.status, 404);
  });
});
