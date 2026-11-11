const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SESSION_TOKEN_SECRET ||= 'test-secret-do-not-use-in-production';

// Stand-in for the Supabase client: only what GET /prices/:productName calls.
const observations = [
  { id: 'o1', store_name: 'COZMO', raw_name: 'MILK 1L', raw_name_ar: null, quantity: 1, unit_price: 1.5, observed_at: '2026-10-03' },
  { id: 'o2', store_name: 'C-TOWN', raw_name: 'MILK 2L', raw_name_ar: null, quantity: 1, unit_price: 2.6, observed_at: '2026-10-02' },
  { id: 'o3', store_name: 'ALKARMEL', raw_name: 'MILK', raw_name_ar: null, quantity: 1, unit_price: 1.4, observed_at: '2026-10-01' },
];

const supabasePath = require.resolve('../src/config/supabase');
require.cache[supabasePath] = {
  id: supabasePath, filename: supabasePath, loaded: true,
  exports: {
    from() {
      const query = {
        select() { return query; },
        ilike() { return query; },
        order() { return query; },
        limit() { return query; },
        then(resolve) { resolve({ data: observations, error: null }); },
      };
      return query;
    },
  },
};

const express = require('express');
const receiptsRouter = require('../src/routes/receipts');

test('price search adds price per litre and names the cheapest per unit', async () => {
  const app = express();
  app.use('/api/receipts', receiptsRouter);
  const server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/receipts/prices/milk`);
    const body = await response.json();

    assert.equal(response.status, 200);
    const byId = Object.fromEntries(body.prices.map(p => [p.id, p]));
    assert.equal(byId.o1.unit_info.price_per_base_unit, 1.5);
    assert.equal(byId.o2.unit_info.price_per_base_unit, 1.3);
    assert.equal(byId.o3.unit_info, null);
    assert.equal(body.cheapest_per_unit.l.store_name, 'C-TOWN');
  } finally {
    server.close();
  }
});
