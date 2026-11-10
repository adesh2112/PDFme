'use strict';
const fs = require('fs');
const path = require('path');
const PDFLib = require('./lib/pdf-lib.min.js');

const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792]
};

async function generatePdfFromImages(items, pageSize = 'a4') {
  const { PDFDocument } = PDFLib;
  const pdf = await PDFDocument.create();

  for (const item of items) {
    let embedded;
    if (item.type === 'jpg' || item.type === 'jpeg') {
      embedded = await pdf.embedJpg(item.bytes);
    } else if (item.type === 'png') {
      embedded = await pdf.embedPng(item.bytes);
    } else {
      throw new Error(`Unsupported image type: ${item.type}`);
    }

    const imgW = embedded.width;
    const imgH = embedded.height;

    let pgW, pgH;
    let dx, dy, dW, dH;

    if (pageSize === 'fit') {
      pgW = imgW * 0.75;
      pgH = imgH * 0.75;
      dW = pgW;
      dH = pgH;
      dx = 0;
      dy = 0;
    } else {
      [pgW, pgH] = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
      if (imgW > imgH && pgW < pgH) {
        [pgW, pgH] = [pgH, pgW];
      } else if (imgW < imgH && pgW > pgH) {
        [pgW, pgH] = [pgH, pgW];
      }

      const MARGIN = 36;
      const avW = pgW - MARGIN * 2;
      const avH = pgH - MARGIN * 2;
      const scale = Math.min(avW / imgW, avH / imgH);
      dW = imgW * scale;
      dH = imgH * scale;
      dx = MARGIN + (avW - dW) / 2;
      dy = MARGIN + (avH - dH) / 2;
    }

    const page = pdf.addPage([pgW, pgH]);
    page.drawImage(embedded, { x: dx, y: dy, width: dW, height: dH });
  }

  const pdfBytes = await pdf.save({ useObjectStreams: true });
  return pdfBytes;
}

async function runTests() {
  console.log('========================================================');
  console.log('PHOTO TO PDF ENGINE VERIFICATION SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let total = 8;

  const portraitJpgBytes = fs.readFileSync('test-files/portrait.jpg');
  const landscapeJpgBytes = fs.readFileSync('test-files/landscape.jpg');
  const portraitPngBytes = fs.readFileSync('test-files/portrait.png');
  const landscapePngBytes = fs.readFileSync('test-files/landscape.png');

  // TEST 1: One JPG to PDF
  try {
    const bytes = await generatePdfFromImages([
      { name: 'portrait.jpg', bytes: portraitJpgBytes, type: 'jpg' }
    ], 'a4');
    const doc = await PDFLib.PDFDocument.load(bytes);
    if (doc.getPageCount() !== 1) throw new Error('Expected 1 page');
    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    if (width >= height) throw new Error('Expected portrait page for portrait JPG');
    console.log('[PASS] Test 1: One JPG to PDF generated valid 1-page PDF');
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 1: One JPG to PDF:', e.stack);
  }

  // TEST 2: One PNG to PDF
  try {
    const bytes = await generatePdfFromImages([
      { name: 'portrait.png', bytes: portraitPngBytes, type: 'png' }
    ], 'a4');
    const doc = await PDFLib.PDFDocument.load(bytes);
    if (doc.getPageCount() !== 1) throw new Error('Expected 1 page');
    console.log('[PASS] Test 2: One PNG to PDF generated valid 1-page PDF');
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 2: One PNG to PDF:', e.message);
  }

  // TEST 3: Multiple images to PDF
  try {
    const bytes = await generatePdfFromImages([
      { name: 'p.jpg', bytes: portraitJpgBytes, type: 'jpg' },
      { name: 'l.png', bytes: landscapePngBytes, type: 'png' },
      { name: 'p.png', bytes: portraitPngBytes, type: 'png' }
    ], 'a4');
    const doc = await PDFLib.PDFDocument.load(bytes);
    if (doc.getPageCount() !== 3) throw new Error(`Expected 3 pages, got ${doc.getPageCount()}`);
    console.log('[PASS] Test 3: Multiple images to PDF generated 3-page PDF');
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 3: Multiple images to PDF:', e.message);
  }

  // TEST 4: Portrait and landscape images
  try {
    const bytes = await generatePdfFromImages([
      { name: 'portrait.jpg', bytes: portraitJpgBytes, type: 'jpg' },
      { name: 'landscape.jpg', bytes: landscapeJpgBytes, type: 'jpg' }
    ], 'a4');
    const doc = await PDFLib.PDFDocument.load(bytes);
    const p1 = doc.getPage(0);
    const p2 = doc.getPage(1);
    if (p1.getWidth() >= p1.getHeight()) throw new Error('Page 1 should be portrait');
    if (p2.getWidth() <= p2.getHeight()) throw new Error('Page 2 should be landscape');
    console.log('[PASS] Test 4: Portrait and landscape images correctly oriented');
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 4: Portrait and landscape images:', e.message);
  }

  // TEST 5: Rearranging image order
  try {
    const list = [
      { id: 'A', name: 'p.jpg', bytes: portraitJpgBytes, type: 'jpg' },
      { id: 'B', name: 'l.png', bytes: landscapePngBytes, type: 'png' },
      { id: 'C', name: 'p.png', bytes: portraitPngBytes, type: 'png' }
    ];
    // Reorder: [C, A, B]
    const reordered = [list[2], list[0], list[1]];
    const bytes = await generatePdfFromImages(reordered, 'fit');
    const doc = await PDFLib.PDFDocument.load(bytes);
    // Page 0 should match C (portrait.png: 100x300 at 0.75 ratio -> 75x225)
    const p0 = doc.getPage(0);
    if (Math.round(p0.getWidth()) !== 75 || Math.round(p0.getHeight()) !== 225) {
      throw new Error(`Page 0 dimensions do not match C: got ${p0.getWidth()}x${p0.getHeight()}`);
    }
    // Page 1 should match A (portrait.jpg: 120x240 at 0.75 ratio -> 90x180)
    const p1 = doc.getPage(1);
    if (Math.round(p1.getWidth()) !== 90 || Math.round(p1.getHeight()) !== 180) {
      throw new Error(`Page 1 dimensions do not match A: got ${p1.getWidth()}x${p1.getHeight()}`);
    }
    console.log('[PASS] Test 5: Rearranging image order preserves new sequence');
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 5: Rearranging image order:', e.message);
  }

  // TEST 6: Removing an image
  try {
    const list = [
      { id: 'A', name: 'p.jpg', bytes: portraitJpgBytes, type: 'jpg' },
      { id: 'B', name: 'l.png', bytes: landscapePngBytes, type: 'png' },
      { id: 'C', name: 'p.png', bytes: portraitPngBytes, type: 'png' }
    ];
    // Remove item at index 1 (B)
    list.splice(1, 1);
    const bytes = await generatePdfFromImages(list, 'a4');
    const doc = await PDFLib.PDFDocument.load(bytes);
    if (doc.getPageCount() !== 2) throw new Error(`Expected 2 pages, got ${doc.getPageCount()}`);
    console.log('[PASS] Test 6: Removing an image updates output to 2 pages');
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 6: Removing an image:', e.message);
  }

  // TEST 7: Downloading the generated PDF (downloadBytes mock)
  try {
    let downloadedBlob = null;
    let downloadedName = null;
    function mockDownloadBytes(bytes, filename) {
      if (!bytes || bytes.length === 0) throw new Error('Empty PDF bytes');
      if (!filename.endsWith('.pdf')) throw new Error('Invalid filename');
      downloadedBlob = bytes;
      downloadedName = filename;
    }
    const pdfBytes = await generatePdfFromImages([
      { name: 'photo1.jpg', bytes: portraitJpgBytes, type: 'jpg' }
    ], 'a4');
    mockDownloadBytes(pdfBytes, 'photo1.pdf');
    if (!downloadedBlob || downloadedName !== 'photo1.pdf') throw new Error('Download failed');
    console.log(`[PASS] Test 7: Downloading generated PDF succeeded (${downloadedBlob.length} bytes -> "${downloadedName}")`);
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 7: Downloading generated PDF:', e.message);
  }

  // TEST 8: Opening the downloaded PDF to verify it is valid
  try {
    const pdfBytes = await generatePdfFromImages([
      { name: 'photo1.jpg', bytes: portraitJpgBytes, type: 'jpg' },
      { name: 'photo2.png', bytes: landscapePngBytes, type: 'png' }
    ], 'fit');
    fs.writeFileSync('test-files/output-test.pdf', pdfBytes);
    // Read from disk and open
    const readBytes = fs.readFileSync('test-files/output-test.pdf');
    const loadedDoc = await PDFLib.PDFDocument.load(readBytes);
    if (!loadedDoc) throw new Error('Could not parse PDF');
    if (loadedDoc.getPageCount() !== 2) throw new Error('Corrupted or incorrect page count');
    console.log('[PASS] Test 8: Opening downloaded PDF verified valid PDF structure and 2 pages');
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 8: Opening downloaded PDF:', e.message);
  }

  console.log('\n========================================================');
  console.log(`RESULTS: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================\n');

  if (passed !== total) process.exit(1);
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
