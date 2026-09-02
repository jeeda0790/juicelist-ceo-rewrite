const supabase = require('../../config/supabase');

const RECEIPT_IMAGES_BUCKET = 'receipt-images';

/**
 * Uploads a receipt image buffer to Supabase Storage and returns its public
 * URL. Replaces the previous placeholder behaviour, which generated a fake
 * `local://filename.jpg` string and never actually stored the image
 * anywhere.
 *
 * @param {Buffer} imageBuffer - the raw image bytes from the upload.
 * @param {string} mimetype - e.g. 'image/jpeg'.
 * @returns {Promise<{ path: string, publicUrl: string }>}
 */
async function uploadReceiptImage(imageBuffer, mimetype) {
  const extension = mimetype === 'image/png' ? 'png' : mimetype === 'image/webp' ? 'webp' : 'jpg';
  const path = `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(RECEIPT_IMAGES_BUCKET)
    .upload(path, imageBuffer, { contentType: mimetype, upsert: false });

  if (uploadError) {
    const error = new Error(`Failed to upload receipt image: ${uploadError.message}`);
    error.statusCode = 502;
    error.code = 'IMAGE_UPLOAD_FAILED';
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from(RECEIPT_IMAGES_BUCKET)
    .getPublicUrl(path);

  return { path, publicUrl: publicUrlData.publicUrl };
}

module.exports = { uploadReceiptImage, RECEIPT_IMAGES_BUCKET };