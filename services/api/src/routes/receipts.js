const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { scanReceipt } = require('../services/receipts/scan-receipt');
const { hasArabic, sanitizeText } = require('../services/receipts/normalization');
const { receiptUpload } = require('../middleware/receipt-upload');
const { getOrCreateStoreId } = require('../services/receipts/store-lookup');
const { uploadReceiptImage } = require('../services/receipts/image-storage');

function sanitize(text) {
  return sanitizeText(text);
}

async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch (e) {
    return null;
  }
}

router.post('/scan', receiptUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Receipt image is required' });
    }

    const user = await getUserFromRequest(req);
    const imageBuffer = req.file.buffer;
    const { store, items, raw_text, ocr_provider } = await scanReceipt(imageBuffer);

    const cleanText = sanitize(raw_text) || '';
    const cleanStore = sanitize(store) || 'GENERIC';

    const [{ publicUrl: imageUrl }, storeId] = await Promise.all([
      uploadReceiptImage(imageBuffer, req.file.mimetype),
      getOrCreateStoreId(cleanStore),
    ]);

    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        store_id: storeId,
        store_name: cleanStore,
        image_url: imageUrl,
        raw_ocr_text: cleanText,
        status: 'pending',
        user_id: user ? user.id : null,
      })
      .select()
      .single();

    if (receiptError) throw receiptError;

    const itemsToInsert = items.map(item => ({
      receipt_id: receipt.id,
      raw_name: sanitize(item.raw_name),
      raw_name_ar: sanitize(item.raw_name_ar),
      quantity: item.quantity || 1,
      unit_price: item.unit_price ?? 0,
      total_price: item.total_price ?? 0,
      ocr_confidence: item.ocr_confidence ?? 0.5,
      needs_review: item.needs_review ?? true,
    }));

    let insertedItems = [];
    if (itemsToInsert.length > 0) {
      const { data, error: itemsError } = await supabase
        .from('receipt_items')
        .insert(itemsToInsert)
        .select();

      if (itemsError) throw itemsError;
      insertedItems = data;
    }

    res.json({
      success: true,
      receipt_id: receipt.id,
      store: cleanStore,
      ocr_provider,
      items: insertedItems,
      needs_review_count: insertedItems.filter(i => i.needs_review).length
    });
  } catch (err) {
    console.error('FULL ERROR:', err);
    console.error('ERROR RESPONSE:', err.response?.data);
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
  }
});

router.patch('/:receiptId/items/:itemId', async (req, res) => {
  try {
    const { receiptId, itemId } = req.params;
    const { raw_name, raw_name_ar, quantity, unit_price } = req.body;
    const parsedQuantity = Number(quantity);
    const parsedUnitPrice = Number(unit_price);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0 ||
        !Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0) {
      return res.status(400).json({
        success: false,
        error: 'quantity and unit_price must be valid non-negative numbers',
      });
    }

    const { data, error } = await supabase
      .from('receipt_items')
      .update({
        raw_name: sanitize(raw_name),
        raw_name_ar: sanitize(raw_name_ar),
        quantity: parsedQuantity,
        unit_price: parsedUnitPrice,
        total_price: parsedQuantity * parsedUnitPrice,
        needs_review: false
      })
      .eq('id', itemId)
      .eq('receipt_id', receiptId)
      .select()
      .single();

    if (error) throw error;

    if (raw_name) {
      await supabase.from('product_aliases').upsert({
        raw_text: sanitize(raw_name),
        source: 'user_correction'
      });
    }

    res.json({ success: true, item: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:receiptId/finalize', async (req, res) => {
  try {
    const { receiptId } = req.params;

    const { data: items, error: itemsError } = await supabase
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', receiptId);

    if (itemsError) throw itemsError;

    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (receiptError) throw receiptError;

    const observations = items
      .filter(item => !item.needs_review)
      .map(item => ({
        receipt_id: receiptId,
        store_id: receipt.store_id,
        store_name: sanitize(receipt.store_name),
        raw_name: sanitize(item.raw_name),
        raw_name_ar: sanitize(item.raw_name_ar),
        unit_price: item.unit_price,
        quantity: item.quantity,
        observed_at: new Date().toISOString()
      }));

    if (observations.length > 0) {
      const { error: obsError } = await supabase
        .from('price_observations')
        .insert(observations);

      if (obsError) throw obsError;
    }

    await supabase
      .from('receipts')
      .update({ status: 'complete' })
      .eq('id', receiptId);

    res.json({
      success: true,
      observations_saved: observations.length,
      message: 'Receipt finalized successfully'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/prices/:productName', async (req, res) => {
  try {
    const { productName } = req.params;
    const cleanProductName = sanitize(productName);
    if (!cleanProductName || cleanProductName.length > 120) {
      return res.status(400).json({ success: false, error: 'Invalid product name' });
    }

    const searchColumn = hasArabic(cleanProductName) ? 'raw_name_ar' : 'raw_name';
    const { data, error } = await supabase
      .from('price_observations')
      .select('*')
      .ilike(searchColumn, `%${cleanProductName}%`)
      .order('observed_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    res.json({ success: true, prices: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;