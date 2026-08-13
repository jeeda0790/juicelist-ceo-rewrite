# Architecture

## Runtime boundaries

- The mobile app captures a receipt and submits it to the API.
- The API owns authentication, storage, parsing orchestration, validation, and database writes.
- An OCR adapter turns an image into provider-neutral text/layout output.
- A pure receipt parser handles Arabic/English normalization and structured extraction.

## Target receipt ingestion flow

Receipt ingestion should be asynchronous in production. The phone must not write
receipt items or price observations directly to Supabase.

1. The authenticated app uploads the image to the API, or to private object storage
   through a short-lived signed upload URL.
2. The API creates a `scan_jobs` row with a `pending` status and returns
   `202 Accepted` with the job ID.
3. A worker claims the job, runs OCR and the provider-neutral receipt parser, then
   validates totals, currency, store, and product candidates.
4. The worker saves the receipt and its items in one database transaction. Ambiguous
   rows remain provisional and are marked `needs_review`; they must not silently
   become trusted market prices.
5. The worker marks the job `completed`, `needs_review`, or `failed` and records a
   safe error code for the client.
6. The app observes that status through Supabase Realtime or polls
   `GET /api/scan-jobs/:id`. A normal refresh is a fallback, not the primary contract.
7. After any required user correction, finalization creates idempotent price
   observations so retries cannot duplicate market data.

The browser receipt workbench deliberately stops after step 3. It exercises the same
OCR and parsing code without persisting uploads or extracted data.

## OCR language decision

The production API does not need to use the same language as the OCR runtime.

PaddleOCR and most document-model training and inference tooling are Python-first. Reimplementing those libraries in Go would add ONNX/CGo integration work, reduce access to upstream tooling, and make model upgrades harder. If PaddleOCR wins the benchmark, it should run behind a small private HTTP or queue-based service. The API can call that service without exposing Python to the mobile client.

Go may be appropriate later for a high-throughput API or ingestion worker, but only after profiling establishes a real Node.js bottleneck. Rewriting deterministic receipt rules in Go does not improve OCR accuracy by itself.

## Provider contract

An OCR provider should return:

```json
{
  "text": "raw provider text",
  "lines": [
    {
      "text": "حليب كامل الدسم",
      "confidence": 0.94,
      "box": [[20, 100], [410, 100], [410, 135], [20, 135]]
    }
  ]
}
```

The parser must never depend on provider-specific response objects.

## License note

AMuRD's repository license is Creative Commons Attribution-NonCommercial 4.0 and its README restricts the dataset to non-commercial research. Do not copy AMuRD code, data, or trained artifacts into a commercial build without separate permission. CORU/ReceiptSense declares an MIT license, but provenance and intended use must still be reviewed before training or redistribution.
