const fs = require('fs');
const os = require('os');
const path = require('path');
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

async function runRecognition(imageBuffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageBuffer);
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

module.exports = { recognizeReceipt };
