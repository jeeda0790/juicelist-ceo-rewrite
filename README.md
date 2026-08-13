# JuiceList

JuiceList is a Jordan-focused receipt scanning and grocery price comparison application.

## Repository layout

```text
apps/mobile/      Expo and React Native client
services/api/     HTTP API, OCR adapter, receipt parsing, and tests
docs/             Architecture decisions and audit notes
```

OCR and receipt parsing are intentionally separate. OCR providers return text and layout data; the receipt parser converts that provider-neutral output into store and item records. This makes Google Vision and PaddleOCR directly benchmarkable against the same fixtures.

## API setup

```powershell
Copy-Item services/api/.env.example services/api/.env
npm install --workspace @juicelist/api
npm test
npm run start:api
```

Required secrets are documented in `services/api/.env.example`.

### Browser receipt workbench

With the API running in development, open:

```text
http://localhost:3000/tester/
```

The workbench accepts JPEG, PNG, or WebP images up to 10 MB and returns structured items, raw OCR text, and the complete JSON response. Its default `local-tesseract` provider processes Arabic and English on the local computer. It does **not** upload receipt images to an OCR API or create receipts, items, or price observations in Supabase.

Set `ENABLE_DATABASE_ROUTES=false` for this standalone mode. Google Vision remains available by setting `OCR_PROVIDER=google-vision` and supplying `GOOGLE_VISION_API_KEY`, but it is not required for local testing.

For the higher-accuracy local PaddleOCR provider used by the receipt acceptance set:

```powershell
py -3.11 -m venv .venv-ocr
.\.venv-ocr\Scripts\python.exe -m pip install paddlepaddle==3.2.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
.\.venv-ocr\Scripts\python.exe -m pip install -r services/api/requirements-ocr.txt
```

Then set `OCR_PROVIDER=local-paddle`. The first run downloads the official Arabic/English recognition models; receipt images and results remain local. `local-tesseract` remains available as the lightweight fallback.

The tester is disabled automatically when `NODE_ENV=production`. Set `ENABLE_OCR_TESTER=true` only when deliberately exposing it in a protected environment.

## Mobile setup

```powershell
npm install --workspace @juicelist/mobile
$env:EXPO_PUBLIC_API_URL='http://YOUR-LAN-IP:3000'
npm run start:mobile
```

The current mobile client is an early prototype. Authentication, a real shopping-list model, and production Supabase row-level security remain required before release.

## OCR development

Pure receipt parsing lives under `services/api/src/services/receipts`. Add anonymized OCR fixtures and regression tests before changing parsing rules. Never commit real receipts or unredacted OCR output.
