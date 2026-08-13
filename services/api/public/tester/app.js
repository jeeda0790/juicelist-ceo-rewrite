const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const elements = {
  chooseButton: document.querySelector('#choose-button'),
  clearButton: document.querySelector('#clear-button'),
  dropZone: document.querySelector('#drop-zone'),
  emptyPreview: document.querySelector('#empty-preview'),
  errorMessage: document.querySelector('#error-message'),
  fileInput: document.querySelector('#receipt-input'),
  fileSummary: document.querySelector('#file-summary'),
  imagePreview: document.querySelector('#image-preview'),
  itemCount: document.querySelector('#item-count-value'),
  itemsBody: document.querySelector('#items-body'),
  itemsEmpty: document.querySelector('#items-empty'),
  itemsTableWrap: document.querySelector('#items-table-wrap'),
  jsonOutput: document.querySelector('#json-output'),
  provider: document.querySelector('#provider-value'),
  rawOutput: document.querySelector('#raw-output'),
  receiptImage: document.querySelector('#receipt-image'),
  resultsContent: document.querySelector('#results-content'),
  resultsEmpty: document.querySelector('#results-empty'),
  resultsPanel: document.querySelector('#results-panel'),
  resultsTitle: document.querySelector('#results-title'),
  reviewCount: document.querySelector('#review-count-value'),
  scanButton: document.querySelector('#scan-button'),
  statusMessage: document.querySelector('#status-message'),
  store: document.querySelector('#store-value'),
  duration: document.querySelector('#duration-value'),
};

let selectedFile = null;
let previewUrl = null;
let activeRequest = null;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(value) {
  if (!Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-JO', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(Number(value));
}

function setError(message = '') {
  elements.errorMessage.textContent = message;
  elements.errorMessage.hidden = !message;
}

function setStatus(message = '') {
  elements.statusMessage.textContent = message;
}

function setLoading(loading) {
  elements.resultsPanel.setAttribute('aria-busy', String(loading));
  elements.imagePreview.classList.toggle('is-scanning', loading);
  elements.scanButton.disabled = loading || !selectedFile;
  elements.chooseButton.disabled = loading;
  elements.clearButton.disabled = loading || !selectedFile;
  elements.scanButton.querySelector('.button-idle').hidden = loading;
  elements.scanButton.querySelector('.button-loading').hidden = !loading;
}

function resetResults() {
  elements.resultsEmpty.hidden = false;
  elements.resultsContent.hidden = true;
  elements.itemsBody.replaceChildren();
  elements.rawOutput.textContent = '';
  elements.jsonOutput.textContent = '';
}

function clearSelection() {
  activeRequest?.abort();
  activeRequest = null;
  selectedFile = null;
  elements.fileInput.value = '';
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  elements.receiptImage.removeAttribute('src');
  elements.emptyPreview.hidden = false;
  elements.imagePreview.hidden = true;
  elements.fileSummary.textContent = '';
  setError();
  setStatus('Receipt cleared.');
  setLoading(false);
  resetResults();
  elements.chooseButton.focus();
}

function selectFile(file) {
  setError();
  if (!file) return;

  if (!ACCEPTED_TYPES.has(file.type)) {
    setError('Choose a JPEG, PNG or WebP image.');
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    setError('The image is larger than 10 MB. Choose a smaller file.');
    return;
  }

  if (previewUrl) URL.revokeObjectURL(previewUrl);
  selectedFile = file;
  previewUrl = URL.createObjectURL(file);
  elements.receiptImage.src = previewUrl;
  elements.receiptImage.alt = `Preview of ${file.name}`;
  elements.fileSummary.textContent = `${file.name} · ${formatBytes(file.size)}`;
  elements.emptyPreview.hidden = true;
  elements.imagePreview.hidden = false;
  elements.clearButton.disabled = false;
  elements.scanButton.disabled = false;
  setStatus('Receipt ready to scan.');
  resetResults();
}

function appendCell(row, text, className, direction) {
  const cell = document.createElement('td');
  cell.textContent = text;
  if (className) cell.className = className;
  if (direction) cell.dir = direction;
  row.append(cell);
}

function renderItems(items) {
  elements.itemsBody.replaceChildren();
  elements.itemsEmpty.hidden = items.length > 0;
  elements.itemsTableWrap.hidden = items.length === 0;

  for (const item of items) {
    const row = document.createElement('tr');
    appendCell(row, item.raw_name || '—', '', 'auto');
    appendCell(row, item.raw_name_ar || '—', '', 'auto');
    appendCell(row, formatNumber(item.quantity), 'numeric');
    appendCell(row, `${formatNumber(item.unit_price)} JOD`, 'numeric');
    appendCell(row, `${formatNumber(item.total_price)} JOD`, 'numeric');

    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = item.needs_review ? 'review-badge' : 'confirmed-badge';
    badge.textContent = item.needs_review ? 'Review' : 'Parsed';
    statusCell.append(badge);
    row.append(statusCell);
    elements.itemsBody.append(row);
  }
}

function renderResults(data) {
  const receipt = data.receipt || {};
  const items = Array.isArray(receipt.items) ? receipt.items : [];
  const reviewCount = items.filter(item => item.needs_review).length;

  elements.store.textContent = receipt.store || 'GENERIC';
  elements.itemCount.textContent = String(items.length);
  elements.reviewCount.textContent = String(reviewCount);
  elements.provider.textContent = receipt.ocr_provider || 'unknown';
  elements.duration.textContent = `${data.duration_ms ?? 0} ms`;
  elements.rawOutput.textContent = receipt.raw_text || 'No OCR text returned.';
  elements.jsonOutput.textContent = JSON.stringify(data, null, 2);
  renderItems(items);

  elements.resultsEmpty.hidden = true;
  elements.resultsContent.hidden = false;
  elements.resultsTitle.focus();
  setStatus(`Scan complete. ${items.length} items detected; ${reviewCount} need review.`);
}

async function runScan() {
  if (!selectedFile) return;

  setError();
  setStatus('Scanning receipt. This may take several seconds.');
  setLoading(true);
  activeRequest = new AbortController();

  try {
    const formData = new FormData();
    formData.append('image', selectedFile, selectedFile.name);
    const response = await fetch('/api/receipts/preview', {
      method: 'POST',
      body: formData,
      signal: activeRequest.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { error: await response.text() };

    if (!response.ok) throw new Error(data.error || `Scan failed with status ${response.status}`);
    renderResults(data);
  } catch (error) {
    if (error.name !== 'AbortError') {
      setError(error.message || 'The receipt could not be scanned.');
      setStatus('Scan failed.');
    }
  } finally {
    activeRequest = null;
    setLoading(false);
  }
}

elements.chooseButton.addEventListener('click', () => elements.fileInput.click());
elements.fileInput.addEventListener('change', event => selectFile(event.target.files?.[0]));
elements.clearButton.addEventListener('click', clearSelection);
elements.scanButton.addEventListener('click', runScan);

for (const eventName of ['dragenter', 'dragover']) {
  elements.dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    elements.dropZone.classList.add('is-dragging');
  });
}

for (const eventName of ['dragleave', 'drop']) {
  elements.dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    elements.dropZone.classList.remove('is-dragging');
  });
}

elements.dropZone.addEventListener('drop', event => selectFile(event.dataTransfer.files?.[0]));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && activeRequest) {
    activeRequest.abort();
    setStatus('Scan cancelled.');
  }
});
