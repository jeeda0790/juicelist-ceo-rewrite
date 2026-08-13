const { parseReceiptText } = require('./parser');
const { looksLikeReceipt } = require('./receipt-detector');

function getOcrAdapter(provider) {
  if (provider === 'local-tesseract') {
    return require('../ocr/local-tesseract');
  }

  if (provider === 'local-paddle') {
    return require('../ocr/local-paddle');
  }

  if (provider === 'google-vision') {
    return require('../ocr/google-vision');
  }

  throw new Error(`Unsupported OCR_PROVIDER: ${provider}`);
}

function getConfiguredProvider() {
  return process.env.OCR_PROVIDER || (
    process.env.NODE_ENV === 'production' ? 'google-vision' : 'local-tesseract'
  );
}

function getPrefilterProvider() {
  // The pre-filter always runs on a free/local provider, regardless of which
  // provider is configured for the real scan. This is what makes it a genuine
  // cost-saving gate in front of google-vision rather than just an alias for it.
  return process.env.OCR_PREFILTER_PROVIDER || 'local-tesseract';
}

class NotAReceiptError extends Error {
  constructor(detectorResult) {
    super('The uploaded image does not appear to be a receipt');
    this.statusCode = 422;
    this.code = 'NOT_A_RECEIPT';
    this.detector = detectorResult;
  }
}

/**
 * Scans a receipt image, running a cheap local OCR pass first to confirm the
 * image actually looks like a receipt before spending a paid Google Vision
 * call on it. If the configured provider is already a free/local one, the
 * pre-filter check reuses that same OCR pass instead of running OCR twice.
 */
async function scanReceipt(imageBuffer, { skipPrefilter = false } = {}) {
  const configuredProvider = getConfiguredProvider();
  const prefilterProvider = getPrefilterProvider();
  const prefilterIsRedundant = prefilterProvider === configuredProvider;

  let prefilterOcr = null;
  let detectorResult = null;

  if (!skipPrefilter) {
    const { recognizeReceipt: recognizeForPrefilter } = getOcrAdapter(prefilterProvider);
    prefilterOcr = await recognizeForPrefilter(imageBuffer);
    detectorResult = looksLikeReceipt(prefilterOcr);

    if (!detectorResult.isReceipt) {
      throw new NotAReceiptError(detectorResult);
    }
  }

  // Reuse the pre-filter's OCR result instead of scanning twice when the
  // configured provider is the same one used for the pre-filter check.
  const { recognizeReceipt } = getOcrAdapter(configuredProvider);
  const ocr = prefilterIsRedundant && prefilterOcr
    ? prefilterOcr
    : await recognizeReceipt(imageBuffer);

  return {
    ...parseReceiptText(ocr.text),
    ocr_provider: ocr.provider,
    ocr_lines: ocr.lines,
    prefilter: detectorResult,
  };
}

module.exports = { scanReceipt, NotAReceiptError, looksLikeReceipt };
