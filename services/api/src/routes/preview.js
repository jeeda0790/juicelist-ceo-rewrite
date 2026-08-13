const express = require('express');
const { receiptUpload } = require('../middleware/receipt-upload');
const { scanReceipt: defaultScanReceipt } = require('../services/receipts/scan-receipt');

function createPreviewRouter({ scanReceipt = defaultScanReceipt } = {}) {
  const router = express.Router();

  router.post('/', receiptUpload.single('image'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Receipt image is required' });
      }

      const startedAt = Date.now();
      const result = await scanReceipt(req.file.buffer);

      return res.json({
        success: true,
        duration_ms: Date.now() - startedAt,
        receipt: {
          store: result.store,
          items: result.items,
          raw_text: result.raw_text,
          ocr_provider: result.ocr_provider,
          ocr_lines: result.ocr_lines,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createPreviewRouter };
