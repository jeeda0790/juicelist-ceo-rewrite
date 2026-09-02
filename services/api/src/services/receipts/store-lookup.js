const supabase = require('../../config/supabase');

/**
 * Looks up a store by name (case-insensitive) and returns its id, creating a
 * new row in the `stores` table if one doesn't exist yet. This is what
 * actually connects a scanned receipt to the `stores` table, instead of only
 * storing the store name as a disconnected text field on the receipt.
 *
 * Returns null for the 'GENERIC' fallback store, since that isn't a real
 * store — creating a "GENERIC" row would pollute the stores table with a
 * placeholder that doesn't correspond to any real supermarket.
 *
 * @param {string} storeName - store id/name as returned by the parser
 *   (e.g. "COZMO", "C-TOWN", "GENERIC").
 * @returns {Promise<number|null>} the store's id, or null if storeName is
 *   the generic fallback.
 */
async function getOrCreateStoreId(storeName) {
  if (!storeName || storeName === 'GENERIC') {
    return null;
  }

  const { data: existing, error: lookupError } = await supabase
    .from('stores')
    .select('id')
    .ilike('name', storeName)
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from('stores')
    .insert({ name: storeName })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return created.id;
}

module.exports = { getOrCreateStoreId };