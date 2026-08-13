const express = require('express');
const cors = require('cors');
const path = require('path');
const { createPreviewRouter } = require('./routes/preview');

function createApp({ scanReceipt, enableTester, enableDatabaseRoutes } = {}) {
  const app = express();
  const testerEnabled = enableTester ?? (
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_OCR_TESTER === 'true'
  );
  const databaseRoutesEnabled = enableDatabaseRoutes ?? (
    process.env.ENABLE_DATABASE_ROUTES !== 'false'
  );

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  if (testerEnabled) {
    const testerDirectory = path.join(__dirname, '..', 'public', 'tester');
    app.use('/api/receipts/preview', createPreviewRouter({ scanReceipt }));
    app.use('/tester', express.static(testerDirectory));
  }

  if (databaseRoutesEnabled) {
    const receiptsRouter = require('./routes/receipts');
    app.use('/api/receipts', receiptsRouter);
  }

  app.get('/', (req, res) => {
    res.json({ status: 'JuiceList API is running 🚀' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Internal server error',
      ...(error.code ? { code: error.code } : {}),
    });
  });

  return app;
}

module.exports = { createApp };
