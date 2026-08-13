const axios = require('axios');

async function recognizeReceipt(imageBuffer) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) throw new Error('Missing GOOGLE_VISION_API_KEY');

  const response = await axios.post(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      requests: [
        {
          image: { content: imageBuffer.toString('base64') },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: ['ar', 'en'] },
        },
      ],
    },
    { timeout: 20000 }
  );

  const result = response.data.responses?.[0];
  if (result?.error) {
    throw new Error(`Google Vision failed: ${result.error.message}`);
  }

  const text = result?.fullTextAnnotation?.text || '';
  return {
    provider: 'google-vision',
    text,
    lines: text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => ({ text: line, confidence: null, box: null })),
  };
}

module.exports = { recognizeReceipt };
