const path = require('path');
const multer = require('multer');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function isAcceptableReceiptImage(file) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  return ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(extension);
}

const storage = multer.memoryStorage();
const receiptUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!isAcceptableReceiptImage(file)) {
      const error = new Error('Only JPEG, PNG, and WebP receipt images are supported');
      error.statusCode = 415;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

module.exports = { receiptUpload, isAcceptableReceiptImage };