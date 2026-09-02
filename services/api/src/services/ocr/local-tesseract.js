const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { createWorker, OEM } = require('tesseract.js');
const arabicLanguage = require('@tesseract.js-data/ara');
const englishLanguage = require('@tesseract.js-data/eng');

const LOCAL_MODEL_DIRECTORY = path.join(os.tmpdir(), 'juicelist-tesseract-v1');

let workerPromise;
let recognitionQueue = Promise.resolve();

function prepareLocalLanguageData() {
  fs.mkdirSync(LOCAL_MODEL_DIRECTORY, { recursive: true });

  for (const language of [arabicLanguage, englishLanguage]) {
    const fileName = `${language.code}.traineddata.gz`;
    const source = path.join(language.langPath, fileName);
    const destination = path.join(LOCAL_MODEL_DIRECTORY, fileName);

    if (!fs.existsSync(destination)) {
      fs.copyFileSync(source, destination);
    }
  }

  return LOCAL_MODEL_DIRECTORY;
}

function getWorker() {
  if (!workerPromise) {
    const langPath = prepareLocalLanguageData();
    workerPromise = createWorker(['ara', 'eng'], OEM.LSTM_ONLY, {
      langPath,
      gzip: true,
    }).catch(error => {
      workerPromise = undefined;
      throw error;
    });
  }

  return workerPromise;
}

async function normalizeForOcr(imageBuffer) {
  // First, confirm sharp can actually read this as an image at all. If it
  // can't, the buffer is corrupt or an unsupported format (e.g. a HEIC file
  // renamed to .jpeg). In that case we must NOT hand it to Tesseract — a
  // broken buffer crashes the Tesseract worker at a level that bypasses our
  // try/catch entirely (an uncaught process-level exception), which is what
  // was producing the empty 500 errors.
  let metadata;
  try {
    metadata = await sharp(imageBuffer).metadata();
  } catch (error) {
    const unsupportedError = new Error(
      'Unsupported or corrupted image file. Please upload a JPEG or PNG photo (not HEIC/WebP/screenshot format).'
    );
    unsupportedError.statusCode = 400;
    unsupportedError.code = 'UNSUPPORTED_IMAGE_FORMAT';
    throw unsupportedError;
  }

  try {
    return await sharp(imageBuffer)
      .rotate()
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch (error) {
    console.warn('Image normalization skipped, using original buffer:', error.message, metadata);
    return imageBuffer;
  }
}

const RECOGNITION_TIMEOUT_MS = 30_000;

async function runRecognition(imageBuffer) {
  const normalizedBuffer = await normalizeForOcr(imageBuffer);
  const worker = await getWorker();

  const recognition = worker.recognize(normalizedBuffer);
  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      const timeoutError = new Error('OCR timed out while reading the image');
      timeoutError.statusCode = 504;
      timeoutError.code = 'OCR_TIMEOUT';
      reject(timeoutError);
    }, RECOGNITION_TIMEOUT_MS);
  });

  const { data } = await Promise.race([recognition, timeout]);
  const text = data.text || '';

  return {
    provider: 'local-tesseract-ara+eng',
    text,
    lines: text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => ({ text: line, confidence: null, box: null })),
  };
}

function recognizeReceipt(imageBuffer) {
  const recognition = recognitionQueue.then(() => runRecognition(imageBuffer));
  recognitionQueue = recognition.catch(() => undefined);
  return recognition;
}

module.exports = { recognizeReceipt, normalizeForOcr };