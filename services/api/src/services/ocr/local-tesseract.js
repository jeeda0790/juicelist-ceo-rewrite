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

/**
 * Re-encodes the incoming image into a clean, standard JPEG before handing
 * it to Tesseract's native decoder (Leptonica). Real-world photos (WhatsApp
 * exports, HEIC-as-JPEG, unusual EXIF orientation/color profiles, etc.) can
 * carry encoding quirks that Leptonica fails to read with an opaque
 * "Unknown format: no pix returned" error. That failure occurs inside
 * Tesseract's background worker as an unlistened 'error' event, which
 * crashes the entire Node process rather than just this request — sharp
 * (already a project dependency) is a much more tolerant decoder, so
 * normalizing through it first prevents that class of crash outright.
 */
async function normalizeForOcr(imageBuffer) {
  try {
    return await sharp(imageBuffer)
      .rotate() // apply EXIF orientation instead of leaving it as metadata
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch (error) {
    console.error('SHARP NORMALIZATION FAILED — underlying error:', error);
    const normalizationError = new Error(`Could not read the uploaded image — it may be corrupted or in an unsupported format (${error.message})`);
    normalizationError.statusCode = 422;
    normalizationError.code = 'UNREADABLE_IMAGE';
    throw normalizationError;
  }
}

async function runRecognition(imageBuffer) {
  const normalizedBuffer = await normalizeForOcr(imageBuffer);
  const worker = await getWorker();
  const { data } = await worker.recognize(normalizedBuffer);
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
  // Keep the queue alive even if this recognition fails, and make sure a
  // failure here is a normal rejected promise our route's try/catch can
  // handle — never an uncaught exception that takes the whole server down.
  recognitionQueue = recognition.catch(() => undefined);
  return recognition;
}

module.exports = { recognizeReceipt, normalizeForOcr };