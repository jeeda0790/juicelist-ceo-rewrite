const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// Prefer the service role key: the backend is a trusted server, and it now
// enforces access control itself (see middleware/require-auth.js) rather
// than relying on Supabase Row Level Security + a client's own auth token.
// Falls back to the anon key so existing local/.env setups keep working
// until SUPABASE_SERVICE_ROLE_KEY is added.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = supabase;