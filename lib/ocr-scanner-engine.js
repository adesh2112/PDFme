'use strict';
/**
 * OCR Scanner Engine
 * Runs offline OCR on images and scanned PDFs.
 * Generates searchable PDFs (invisible text layer over raster image) and plain text exports.
 */

const PDFLib = typeof require !== 'undefined' ? require('./pdf-lib.min.js') : window.PDFLib;

/**
 * Perform OCR on an image element, canvas, or ImageData using Tesseract.js
 */
async function recognizeImage(imageSource, lang = 'eng', onProgress, tesseractInstance) {
  const T = tesseractInstance || (typeof window !== 'undefined' ? window.Tesseract : null);
  if (!T) throw new Error('Tesseract.js is required for OCR scanning');

  const worker = await T.createWorker({
    workerPath: '/lib/tesseract/worker.min.js',
    corePath: '/lib/tesseract/tesseract-core-simd-lstm.wasm.js',
    logger: m => {
      if (m && m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    }
  });

  await worker.loadLanguage(lang);
  await worker.initialize(lang);

  const res = await worker.recognize(imageSource);
  await worker.terminate();

  return {
    text: res.data.text,
    confidence: res.data.confidence,
    words: (res.data.words || []).map(w => ({
      text: w.text,
      bbox: w.bbox,
      confidence: w.confidence
    })),
    lines: (res.data.lines || []).map(l => ({
      text: l.text,
      bbox: l.bbox,
      confidence: l.confidence
    }))
  };
}

/**
 * Generate Searchable PDF from page image bytes and OCR words bounding boxes
 * Overlays an invisible selectable text layer exactly over the underlying image
 */
async function createSearchablePdf(pageImagesWithOcr) {
  // pageImagesWithOcr: Array of { imageBytes, type: 'png'|'jpg', width, height, words: [{ text, bbox: { x0, y0, x1, y1 } }] }
  const pdfDoc = await PDFLib.PDFDocument.create();
  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

  for (const pageData of pageImagesWithOcr) {
    let embeddedImg;
    if (pageData.type === 'jpg' || pageData.type === 'jpeg') {
      embeddedImg = await pdfDoc.embedJpg(pageData.imageBytes);
    } else {
      embeddedImg = await pdfDoc.embedPng(pageData.imageBytes);
    }

    const pageWidth = pageData.width || embeddedImg.width;
    const pageHeight = pageData.height || embeddedImg.height;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // 1. Draw raster page image
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight
    });

    // 2. Draw invisible selectable text layer on top
    // In PDF specification, TextRenderingMode 3 is invisible text (neither filled nor stroked)
    // Or in PDF-Lib, drawing text with opacity: 0 makes it invisible while remaining 100% selectable!
    if (Array.isArray(pageData.words)) {
      for (const word of pageData.words) {
        const text = word.text ? word.text.trim() : '';
        if (!text || !word.bbox) continue;

        const box = word.bbox;
        const boxWidth = Math.max(1, box.x1 - box.x0);
        const boxHeight = Math.max(1, box.y1 - box.y0);

        // Convert Tesseract coordinate system (top-left 0,0) to PDF coordinate system (bottom-left 0,0)
        const pdfX = box.x0;
        const pdfY = pageHeight - box.y1;
        const fontSize = Math.max(6, Math.min(72, boxHeight));

        try {
          page.drawText(text, {
            x: pdfX,
            y: pdfY,
            size: fontSize,
            font,
            opacity: 0.0, // Invisible selectable text
            color: PDFLib.rgb(0, 0, 0)
          });
        } catch (e) {
          // Skip rare unsupported characters in Standard Helvetica
        }
      }
    }
  }

  return await pdfDoc.save();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    recognizeImage,
    createSearchablePdf
  };
}
if (typeof window !== 'undefined') {
  window.OcrScanner = {
    recognizeImage,
    createSearchablePdf
  };
}

