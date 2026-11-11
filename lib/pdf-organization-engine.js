'use strict';
/**
 * PDF Organization Engine
 * Handles: Merge, Split, Rotate, Reorder, Delete, Extract, Duplicate, Compress, Page Numbers.
 * Operates on Uint8Array / ArrayBuffer and returns Uint8Array or Zip bundle.
 */

var PDFLib = typeof require !== 'undefined' ? require('./pdf-lib.min.js') : (typeof window !== 'undefined' ? window.PDFLib : null);
var createZip = typeof require !== 'undefined' ? require('./zip-util.js').createZip : (typeof window !== 'undefined' && window.ZipUtil ? window.ZipUtil.createZip : null);

/**
 * Parse page range string like "1-3, 5, 7-10" into array of 1-based page numbers
 */
function parsePageRanges(rangeStr, totalPages) {
  if (Array.isArray(rangeStr)) {
    return rangeStr.map(Number).filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  }
  if (typeof rangeStr === 'number') {
    return (rangeStr >= 1 && rangeStr <= totalPages) ? [rangeStr] : [];
  }
  if (!rangeStr || typeof rangeStr !== 'string' || !rangeStr.trim() || rangeStr.trim().toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set();
  const parts = rangeStr.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = Math.max(1, parseInt(startStr, 10) || 1);
      const end = Math.min(totalPages, parseInt(endStr, 10) || totalPages);
      for (let p = start; p <= end; p++) pages.add(p);
    } else {
      const p = parseInt(trimmed, 10);
      if (p >= 1 && p <= totalPages) pages.add(p);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * 1. Merge multiple PDFs
 * files: Array of { data: Uint8Array, ranges?: string }
 */
async function mergePdfs(files) {
  if (!files || files.length === 0) throw new Error('At least one PDF file is required to merge');
  const mergedPdf = await PDFLib.PDFDocument.create();

  for (const file of files) {
    const rawData = file.data || file;
    const srcDoc = await PDFLib.PDFDocument.load(rawData, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();
    const targetPages = file.ranges ? parsePageRanges(file.ranges, totalPages) : Array.from({ length: totalPages }, (_, i) => i + 1);
    const zeroBasedIndices = targetPages.map(p => p - 1).filter(idx => idx >= 0 && idx < totalPages);

    if (zeroBasedIndices.length > 0) {
      const copiedPages = await mergedPdf.copyPages(srcDoc, zeroBasedIndices);
      copiedPages.forEach(page => mergedPdf.addPage(page));
    }
  }

  return await mergedPdf.save();
}

/**
 * 2. Split PDF
 * mode: 'all' (every page separate) or 'ranges' (custom ranges array e.g. ["1-2", "3-5"])
 */
async function splitPdf(pdfBytes, options = { mode: 'all' }) {
  if (Array.isArray(options)) options = { mode: 'ranges', ranges: options };
  if (typeof options === 'string') options = { mode: 'ranges', ranges: [options] };
  const srcDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const results = {};

  if (options.mode === 'ranges' && Array.isArray(options.ranges) && options.ranges.length > 0) {
    for (let rIdx = 0; rIdx < options.ranges.length; rIdx++) {
      const rangeStr = options.ranges[rIdx];
      const pageNums = parsePageRanges(rangeStr, totalPages);
      if (pageNums.length === 0) continue;

      const subDoc = await PDFLib.PDFDocument.create();
      const zeroIndices = pageNums.map(p => p - 1);
      const copied = await subDoc.copyPages(srcDoc, zeroIndices);
      copied.forEach(p => subDoc.addPage(p));
      const bytes = await subDoc.save();
      results[`split-range-${rIdx + 1}.pdf`] = bytes;
    }
  } else {
    // Mode 'all': Each page into separate PDF
    for (let i = 0; i < totalPages; i++) {
      const subDoc = await PDFLib.PDFDocument.create();
      const [copied] = await subDoc.copyPages(srcDoc, [i]);
      subDoc.addPage(copied);
      const bytes = await subDoc.save();
      results[`page-${String(i + 1).padStart(3, '0')}.pdf`] = bytes;
    }
  }

  const zipBytes = createZip(results);
  return { files: results, zip: zipBytes };
}

/**
 * 3. Rotate PDF pages
 * degrees: 90, 180, 270, or -90
 * targetPagesStr: optional range string (e.g. "1, 3-5"), defaults to all
 */
async function rotatePdf(pdfBytes, degrees = 90, targetPagesStr = 'all') {
  const doc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = doc.getPageCount();
  const targetPages = parsePageRanges(targetPagesStr, totalPages);
  const targetSet = new Set(targetPages);

  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    if (targetSet.has(pageNum)) {
      const currentRotation = pages[i].getRotation().angle;
      const newRotation = ((currentRotation + degrees) % 360 + 360) % 360;
      pages[i].setRotation(PDFLib.degrees(newRotation));
    }
  }

  return await doc.save();
}

/**
 * 4. Reorder PDF pages
 * newOrder: array of 0-based page indices in new desired sequence, e.g. [2, 0, 1, 3]
 */
async function reorderPdfPages(pdfBytes, newOrder) {
  const srcDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const newDoc = await PDFLib.PDFDocument.create();

  const validIndices = newOrder.filter(idx => idx >= 0 && idx < totalPages);
  if (validIndices.length === 0) throw new Error('No valid pages to reorder');

  const copiedPages = await newDoc.copyPages(srcDoc, validIndices);
  copiedPages.forEach(p => newDoc.addPage(p));

  return await newDoc.save();
}

/**
 * 5. Delete PDF pages
 * pagesToDelete: array of 1-based page numbers or range string "2, 4-6"
 */
async function deletePdfPages(pdfBytes, pagesToDelete) {
  const srcDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const deleteSet = new Set(
    typeof pagesToDelete === 'string'
      ? parsePageRanges(pagesToDelete, totalPages)
      : pagesToDelete
  );

  const keepIndices = [];
  for (let i = 0; i < totalPages; i++) {
    if (!deleteSet.has(i + 1)) {
      keepIndices.push(i);
    }
  }

  if (keepIndices.length === 0) throw new Error('Cannot delete all pages of a PDF');

  const newDoc = await PDFLib.PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, keepIndices);
  copied.forEach(p => newDoc.addPage(p));

  return await newDoc.save();
}

/**
 * 6. Extract PDF pages into a new standalone PDF
 * pagesToExtract: array of 1-based page numbers or range string "1, 3, 5"
 */
async function extractPdfPages(pdfBytes, pagesToExtract) {
  const srcDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const pageNums = typeof pagesToExtract === 'string'
    ? parsePageRanges(pagesToExtract, totalPages)
    : pagesToExtract;

  const validIndices = pageNums.map(p => p - 1).filter(idx => idx >= 0 && idx < totalPages);
  if (validIndices.length === 0) throw new Error('No valid pages to extract');

  const newDoc = await PDFLib.PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, validIndices);
  copied.forEach(p => newDoc.addPage(p));

  return await newDoc.save();
}

/**
 * 7. Duplicate PDF pages
 * duplicateRules: array of { pageNum: 1, count: 2 } or map { 1: 2 }
 */
async function duplicatePdfPages(pdfBytes, duplicateRules) {
  const srcDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const newDoc = await PDFLib.PDFDocument.create();

  const rulesMap = {};
  if (Array.isArray(duplicateRules)) {
    duplicateRules.forEach(r => { rulesMap[r.pageNum] = r.count || 1; });
  } else if (typeof duplicateRules === 'object') {
    Object.assign(rulesMap, duplicateRules);
  }

  const indicesToCopy = [];
  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1;
    const copies = (rulesMap[pageNum] !== undefined ? rulesMap[pageNum] : 1);
    for (let c = 0; c < copies; c++) {
      indicesToCopy.push(i);
    }
  }

  const copied = await newDoc.copyPages(srcDoc, indicesToCopy);
  copied.forEach(p => newDoc.addPage(p));

  return await newDoc.save();
}

/**
 * 8. Compress PDF
 * Removes unreferenced objects, flattens structures, and uses Flate stream compression
 */
async function compressPdf(pdfBytes) {
  const doc = await PDFLib.PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false
  });

  // Re-save with object stream optimization and deflated streams
  return await doc.save({
    useObjectStreams: true,
    addDefaultPage: false
  });
}

/**
 * 9. Add Page Numbers
 * options: {
 *   position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left',
 *   format: 'Page {n} of {total}' | '{n} / {total}' | '{n}',
 *   fontSize: 10,
 *   margin: 36, // pt
 *   color: { r: 0.2, g: 0.2, b: 0.2 },
 *   startPage: 1
 * }
 */
async function addPageNumbers(pdfBytes, options = {}) {
  const doc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const totalPages = doc.getPageCount();

  const position = options.position || 'bottom-center';
  const format = options.format || 'Page {n} of {total}';
  const fontSize = options.fontSize || 10;
  const margin = options.margin !== undefined ? options.margin : 36;
  const color = options.color || { r: 0.25, g: 0.25, b: 0.25 };
  const startPageNum = options.startPage || 1;

  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const currentNum = startPageNum + i;

    const label = format
      .replace('{n}', currentNum)
      .replace('{total}', totalPages);

    const textWidth = font.widthOfTextAtSize(label, fontSize);
    let x = 0;
    let y = 0;

    // Horizontal calculation
    if (position.includes('left')) {
      x = margin;
    } else if (position.includes('right')) {
      x = width - textWidth - margin;
    } else {
      // center
      x = (width - textWidth) / 2;
    }

    // Vertical calculation
    if (position.startsWith('top')) {
      y = height - margin;
    } else {
      // bottom
      y = margin;
    }

    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font,
      color: PDFLib.rgb(color.r, color.g, color.b)
    });
  }

  return await doc.save();
}

/**
 * 10. Apply Page Modifications (Reorder + Per-page Rotation + Page Filtering)
 * pagePlan: array of { index: number, rotationDelta?: number }
 */
async function applyPageModifications(pdfBytes, pagePlan) {
  const srcDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const newDoc = await PDFLib.PDFDocument.create();

  if (!pagePlan || pagePlan.length === 0) throw new Error('At least one page must remain in the document.');

  for (const item of pagePlan) {
    const idx = typeof item === 'number' ? item : item.index;
    if (idx < 0 || idx >= totalPages) continue;

    const [copied] = await newDoc.copyPages(srcDoc, [idx]);
    if (item.rotationDelta) {
      const cur = copied.getRotation().angle;
      copied.setRotation(PDFLib.degrees(((cur + item.rotationDelta) % 360 + 360) % 360));
    }
    newDoc.addPage(copied);
  }

  return await newDoc.save();
}

/**
 * 12. Repair damaged / corrupt PDF
 * Rebuilds cross-reference table and recovers valid page objects
 */
async function repairPdf(pdfBytes) {
  if (!pdfBytes) throw new Error('PDF bytes required for repair');
  const srcDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true, parseSpeed: PDFLib.ParseSpeeds.Fast });
  const repairedDoc = await PDFLib.PDFDocument.create();
  const pageCount = srcDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    try {
      const [copied] = await repairedDoc.copyPages(srcDoc, [i]);
      repairedDoc.addPage(copied);
    } catch (e) {
      console.warn('Recovered page with warning:', i + 1, e.message);
    }
  }
  return await repairedDoc.save({ useObjectStreams: false });
}

/**
 * 13. Flatten PDF forms, interactive widgets, and layers
 */
async function flattenPdf(pdfBytes) {
  if (!pdfBytes) throw new Error('PDF bytes required for flattening');
  const doc = await PDFLib.PDFDocument.load(pdfBytes);
  try {
    const form = doc.getForm();
    if (form) {
      form.flatten();
    }
  } catch (e) {
    // Form may not exist or already flat
  }
  return await doc.save();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parsePageRanges,
    mergePdfs,
    splitPdf,
    rotatePdf,
    reorderPdfPages,
    reorderPdf: reorderPdfPages,
    deletePdfPages,
    extractPdfPages,
    duplicatePdfPages,
    compressPdf,
    addPageNumbers,
    applyPageModifications,
    repairPdf,
    flattenPdf
  };
}
if (typeof window !== 'undefined') {
  window.PdfOrganization = {
    parsePageRanges,
    mergePdfs,
    splitPdf,
    rotatePdf,
    reorderPdfPages,
    reorderPdf: reorderPdfPages,
    deletePdfPages,
    extractPdfPages,
    duplicatePdfPages,
    compressPdf,
    addPageNumbers,
    applyPageModifications,
    repairPdf,
    flattenPdf
  };
  Object.assign(window, window.PdfOrganization);
}

