const multer = require('multer');

const storage = multer.memoryStorage();
const receiptUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.mimetype)) {
      const error = new Error('Only JPEG, PNG, and WebP receipt images are supported');
      error.statusCode = 415;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

module.exports = { receiptUpload };
