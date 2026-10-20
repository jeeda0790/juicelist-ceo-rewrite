const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

process.env.SESSION_TOKEN_SECRET ||= 'test-secret-do-not-use-in-production';

// A tiny in-memory stand-in for the Supabase client, supporting only the calls
// the /my-items route makes. It lets us prove one user cannot see another
// user's items without needing a real database.
const db = {
  receipts: [
    { id: 'r1', user_id: 'user-a', created_at: '2026-10-01' },
    { id: 'r2', user_id: 'user-b', created_at: '2026-10-02' },
    { id: 'r3', user_id: 'user-a', created_at: '2026-10-03' },
  ],
  receipt_items: [
    { id: 'i1', receipt_id: 'r1', raw_name: 'MILK', created_at: '2026-10-01' },
    { id: 'i2', receipt_id: 'r2', raw_name: 'OTHER USERS BREAD', created_at: '2026-10-02' },
    { id: 'i3', receipt_id: 'r3', raw_name: 'EGGS', created_at: '2026-10-03' },
  ],
};

function fakeSupabase() {
  return {
    from(table) {
      let rows = [...db[table]];
      const query = {
        select() { return query; },
        eq(column, value) { rows = rows.filter(r => r[column] === value); return query; },
        in(column, values) { rows = rows.filter(r => values.includes(r[column])); return query; },
        order(column, { ascending }) {
          rows.sort((a, b) => (a[column] < b[column] ? -1 : 1) * (ascending ? 1 : -1));
          return query;
        },
        limit(n) { rows = rows.slice(0, n); return query; },
        then(resolve) { resolve({ data: rows, error: null }); },
      };
      return query;
    },
  };
}

// Replace the real Supabase client before the route file loads it.
const supabasePath = require.resolve('../src/config/supabase');
require.cache[supabasePath] = {
  id: supabasePath,
  filename: supabasePath,
  loaded: true,
  exports: fakeSupabase(),
};

const express = require('express');
const receiptsRouter = require('../src/routes/receipts');
const { issueSessionToken } = require('../src/services/auth/tokens');

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/receipts', receiptsRouter);
  return new Promise(resolve => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function get(server, token) {
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/receipts/my-items`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, body: await response.json() };
}

test('my-items requires a signed-in user', async () => {
  const server = await startServer();
  try {
    const { status, body } = await get(server, null);
    assert.equal(status, 401);
    assert.equal(body.code, 'AUTH_REQUIRED');
  } finally {
    server.close();
  }
});

test('my-items returns only the signed-in user\'s own items', async () => {
  const server = await startServer();
  try {
    const { status, body } = await get(server, issueSessionToken('user-a'));
    assert.equal(status, 200);
    assert.deepEqual(body.items.map(i => i.id), ['i3', 'i1']);
    assert.ok(!body.items.some(i => i.raw_name === 'OTHER USERS BREAD'));
  } finally {
    server.close();
  }
});

test('my-items returns an empty list for a user with no receipts', async () => {
  const server = await startServer();
  try {
    const { status, body } = await get(server, issueSessionToken('user-nobody'));
    assert.equal(status, 200);
    assert.deepEqual(body.items, []);
  } finally {
    server.close();
  }
});
