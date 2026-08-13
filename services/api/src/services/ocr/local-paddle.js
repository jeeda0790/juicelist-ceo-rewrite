const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const DEFAULT_PYTHON = path.join(
  PROJECT_ROOT,
  '.venv-ocr',
  'Scripts',
  process.platform === 'win32' ? 'python.exe' : 'python'
);
const WORKER_SCRIPT = path.join(__dirname, 'paddle_worker.py');

let workerState;

function startWorker() {
  const python = process.env.PADDLE_PYTHON_PATH || DEFAULT_PYTHON;
  const child = spawn(python, ['-u', WORKER_SCRIPT], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True',
      PYTHONIOENCODING: 'utf-8',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const pending = new Map();
  let stderr = '';
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const startupTimer = setTimeout(() => {
    readyReject(new Error('Local PaddleOCR worker did not initialize within 120 seconds'));
    child.kill();
  }, 120000);

  readline.createInterface({ input: child.stdout }).on('line', line => {
    if (line.includes('JUICELIST_READY')) {
      clearTimeout(startupTimer);
      readyResolve();
      return;
    }

    const marker = line.indexOf('JUICELIST_JSON:');
    if (marker < 0) return;

    try {
      const message = JSON.parse(line.slice(marker + 'JUICELIST_JSON:'.length));
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.success) request.resolve(message.result);
      else request.reject(new Error(message.error || 'Local PaddleOCR failed'));
    } catch (error) {
      stderr = `${stderr}\n${error.message}`.slice(-8000);
    }
  });

  child.stderr.on('data', chunk => {
    stderr = `${stderr}${chunk.toString('utf8')}`.slice(-8000);
  });

  child.on('error', error => {
    clearTimeout(startupTimer);
    readyReject(new Error(
      `Unable to start local PaddleOCR. Run the OCR setup commands first. ${error.message}`
    ));
  });

  child.on('exit', code => {
    clearTimeout(startupTimer);
    const error = new Error(`Local PaddleOCR exited with code ${code}. ${stderr}`.trim());
    readyReject(error);
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
    workerState = undefined;
  });

  workerState = { child, pending, ready };
  return workerState;
}

async function recognizeReceipt(imageBuffer) {
  const state = workerState || startWorker();
  await state.ready;
  const id = randomUUID();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      state.pending.delete(id);
      reject(new Error('Local PaddleOCR scan timed out after 120 seconds'));
    }, 120000);

    state.pending.set(id, { resolve, reject, timer });
    state.child.stdin.write(`${JSON.stringify({
      id,
      image: imageBuffer.toString('base64'),
    })}\n`);
  });
}

module.exports = { recognizeReceipt };
