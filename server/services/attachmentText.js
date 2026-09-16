// Extract readable text from a note's attachments so AI features (summarize,
// and later quiz/chat) can work on PDF- or image-backed notes that carry little
// or no markdown content.
//
// - PDFs: read the text layer with pdfjs-dist (legacy ESM build, loaded via
//   dynamic import since the server is CommonJS).
// - Images: OCR with tesseract.js, lang files fetched at first use from
//   jsDelivr (same outbound HTTPS egress the Groq API already uses).
//
// Extraction is deliberately defensive: a file that can't be read is logged and
// skipped, never an error — the caller decides whether enough meaningful text
// actually came through.

const { createWorker } = require('tesseract.js');

const MAX_OCR_IMAGES = 5; // bound free-tier OCR latency per call
const OCR_LANG_PATH = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int';

const toBuffer = (b64) => Buffer.from(b64, 'base64');

// pdfjs-dist v4 ships ESM-only, so use a lazy dynamic import from CJS.
let pdfjsPromise = null;
const getPdfjs = () => {
  if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
};

// Extract the text layer of a PDF buffer, one line per page.
async function extractPdfText(buf) {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  try {
    const parts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      parts.push(tc.items.map((it) => it.str).join(' '));
      page.cleanup && page.cleanup();
    }
    return parts.join('\n');
  } finally {
    await doc.destroy();
  }
}

// A single tesseract worker is reused across requests — spawning one and
// fetching the traineddata is expensive. Re-created lazily on failure.
let ocrWorkerPromise = null;
const getOcrWorker = () => {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('eng', 1, {
      langPath: OCR_LANG_PATH,
      gzip: true,
      logger: () => {}, // silence per-tile progress logs
      // A corrupt image bytes would otherwise fire an uncaught error on the
      // worker thread and crash the whole server, not just this request.
      errorHandler: (err) => console.warn(`[attachmentText] OCR worker error: ${err}`)
    }).catch(() => {
      ocrWorkerPromise = null; // allow a fresh worker next time
      throw new Error('Failed to start OCR worker');
    });
  }
  return ocrWorkerPromise;
};

async function ocrImage(buf) {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(new Uint8Array(buf));
  return (data && data.text) || '';
}

const isPdf = (a) => a.type === 'application/pdf' || /\.pdf$/i.test(a.name || '');

// Turn a note's attachments into a block of meaningful text. Only real content
// is returned (nothing for unreadable/blank files) so placeholder text never
// fools the summarizer's "is there something to work with" check.
async function extractAttachmentsText(note) {
  const parts = [];
  let imageCount = 0;

  for (const a of note.attachments || []) {
    if (!a.data) continue;
    const label = a.name || 'attachment';
    try {
      if (isPdf(a)) {
        const text = (await extractPdfText(toBuffer(a.data))).trim();
        if (text) parts.push(`[PDF: ${label}]\n${text}`);
      } else if (a.type && a.type.startsWith('image/')) {
        if (imageCount >= MAX_OCR_IMAGES) {
          console.log(`[attachmentText] skipping OCR of "${label}": cap of ${MAX_OCR_IMAGES} reached`);
          continue;
        }
        imageCount += 1;
        const text = (await ocrImage(toBuffer(a.data))).trim();
        if (text) parts.push(`[Image: ${label}]\n${text}`);
      }
      // Other file types aren't readable by a text model — skipped.
    } catch (err) {
      console.warn(`[attachmentText] failed to extract "${label}": ${err.message}`);
    }
  }

  return parts.join('\n\n');
}

module.exports = { extractAttachmentsText };