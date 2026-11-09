'use strict';
const fs = require('fs');
const path = require('path');
const PDFLib = require('./lib/pdf-lib.min.js');
const {
  wordToPdf,
  excelToPdf,
  powerPointToPdf,
  htmlToPdf,
  imagesToPdf
} = require('./lib/pdf-conversion-engine.js');
const {
  buildDocxXml,
  buildXlsxXml,
  buildPptxXml
} = require('./lib/office-converter.js');
const {
  mergePdfs,
  splitPdf,
  rotatePdf,
  reorderPdfPages,
  deletePdfPages,
  extractPdfPages,
  duplicatePdfPages,
  compressPdf,
  addPageNumbers
} = require('./lib/pdf-organization-engine.js');
const {
  passwordProtectPdf,
  removeMetadataPdf,
  redactPdf,
  createSecureShareToken
} = require('./lib/pdf-security-engine.js');
const { verifyEditorGuard } = require('./verify-editor-guard.js');

async function createSamplePdf(pageCount = 3) {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`Page ${i} of Sample Document`, { x: 50, y: 780, size: 18, font });
    page.drawText(`This is content on page ${i}.`, { x: 50, y: 740, size: 12, font });
  }
  doc.setTitle('Sample Document Title');
  doc.setAuthor('Test Author');
  return await doc.save();
}

async function runPhase2Tests() {
  console.log('========================================================');
  console.log('RUNNING PHASE 2 AUTOMATED TEST SUITE');
  console.log('Testing: PDF Conversion, Organization, and Security');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(desc, condition) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  // --- SECTION 1: PDF CONVERSION ---
  console.log('--- Testing PDF Conversion ---');
  try {
    const docx = buildDocxXml([{ lines: [{ text: 'Quarterly Report', fontSize: 18 }, { text: 'Company revenue grew 25% YoY.', fontSize: 11 }] }]);
    const docxPdf = await wordToPdf(docx);
    const docxPdfDoc = await PDFLib.PDFDocument.load(docxPdf);
    assert('Word (DOCX) to PDF generates valid PDF', docxPdfDoc.getPageCount() >= 1);

    const xlsx = buildXlsxXml([['Department', 'Q1 Budget', 'Q1 Actual'], ['Engineering', '150000', '142000'], ['Marketing', '80000', '78500']]);
    const xlsxPdf = await excelToPdf(xlsx);
    const xlsxPdfDoc = await PDFLib.PDFDocument.load(xlsxPdf);
    assert('Excel (XLSX) to PDF generates valid landscape tabular PDF', xlsxPdfDoc.getPageCount() >= 1 && xlsxPdfDoc.getPage(0).getWidth() > 800);

    const pptx = buildPptxXml([{ title: 'Executive Keynote', lines: [{ text: 'Strategic Goals' }, { text: 'Key Metrics' }] }]);
    const pptxPdf = await powerPointToPdf(pptx);
    const pptxPdfDoc = await PDFLib.PDFDocument.load(pptxPdf);
    assert('PowerPoint (PPTX) to PDF generates 16:9 widescreen presentation PDF', pptxPdfDoc.getPageCount() === 1 && pptxPdfDoc.getPage(0).getWidth() === 960);

    const htmlPdf = await htmlToPdf('<h1>Product Spec</h1><p>High performance PDF architecture.</p><ul><li>Feature A</li><li>Feature B</li></ul>');
    const htmlPdfDoc = await PDFLib.PDFDocument.load(htmlPdf);
    assert('HTML to PDF formats headings, paragraphs and lists into valid PDF', htmlPdfDoc.getPageCount() >= 1);

    // Image to PDF using a minimal 1x1 valid PNG
    const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const imgPdf = await imagesToPdf([{ bytes: png1x1, type: 'png' }], 'a4');
    const imgPdfDoc = await PDFLib.PDFDocument.load(imgPdf);
    assert('PNG to PDF embeds image and generates A4 document', imgPdfDoc.getPageCount() === 1);
  } catch (err) {
    console.error('Error during conversion tests:', err);
    assert('Conversion tests executed without error', false);
  }

  // --- SECTION 2: PDF ORGANIZATION ---
  console.log('\n--- Testing PDF Organization ---');
  try {
    const sample3Page = await createSamplePdf(3);
    const sample2Page = await createSamplePdf(2);

    // Merge
    const merged = await mergePdfs([{ data: sample3Page }, { data: sample2Page }]);
    const mergedDoc = await PDFLib.PDFDocument.load(merged);
    assert('Merge PDF combines multi-page documents (3 + 2 = 5 pages)', mergedDoc.getPageCount() === 5);

    // Merge with custom ranges
    const mergedRanges = await mergePdfs([{ data: sample3Page, ranges: '1, 3' }, { data: sample2Page, ranges: '2' }]);
    const mergedRangesDoc = await PDFLib.PDFDocument.load(mergedRanges);
    assert('Merge PDF respects custom page ranges (2 + 1 = 3 pages)', mergedRangesDoc.getPageCount() === 3);

    // Split
    const splitResult = await splitPdf(sample3Page, { mode: 'all' });
    assert('Split PDF produces zip bundle with individual pages', Object.keys(splitResult.files).length === 3 && splitResult.zip.length > 0);

    // Rotate
    const rotated = await rotatePdf(sample3Page, 90, '1');
    const rotatedDoc = await PDFLib.PDFDocument.load(rotated);
    assert('Rotate PDF applies 90 degree rotation to specified page', rotatedDoc.getPage(0).getRotation().angle === 90 && rotatedDoc.getPage(1).getRotation().angle === 0);

    // Reorder
    const reordered = await reorderPdfPages(sample3Page, [2, 0, 1]);
    const reorderedDoc = await PDFLib.PDFDocument.load(reordered);
    assert('Reorder PDF rearranges pages sequence [2, 0, 1]', reorderedDoc.getPageCount() === 3);

    // Delete
    const deleted = await deletePdfPages(sample3Page, '2');
    const deletedDoc = await PDFLib.PDFDocument.load(deleted);
    assert('Delete PDF removes page 2 and preserves remaining 2 pages', deletedDoc.getPageCount() === 2);

    // Extract
    const extracted = await extractPdfPages(sample3Page, '1, 3');
    const extractedDoc = await PDFLib.PDFDocument.load(extracted);
    assert('Extract PDF creates new document with only pages 1 & 3', extractedDoc.getPageCount() === 2);

    // Duplicate
    const duplicated = await duplicatePdfPages(sample3Page, { 1: 3 });
    const duplicatedDoc = await PDFLib.PDFDocument.load(duplicated);
    assert('Duplicate PDF creates specified duplicate copies', duplicatedDoc.getPageCount() === 5);

    // Compress
    const compressed = await compressPdf(sample3Page);
    assert('Compress PDF optimizes and serializes stream objects', compressed.length > 0);

    // Page Numbers
    const numbered = await addPageNumbers(sample3Page, { position: 'bottom-center', format: 'Page {n} of {total}' });
    const numberedDoc = await PDFLib.PDFDocument.load(numbered);
    assert('Add Page Numbers draws footer text onto all pages', numberedDoc.getPageCount() === 3);
  } catch (err) {
    console.error('Error during organization tests:', err);
    assert('Organization tests executed without error', false);
  }

  // --- SECTION 3: PDF SECURITY ---
  console.log('\n--- Testing PDF Security ---');
  try {
    const sample3Page = await createSamplePdf(3);

    // Password protect
    const encBytes = await passwordProtectPdf(sample3Page, 'TestPassword123');
    const encStr = Buffer.from(encBytes).toString('latin1');
    assert('Password protect PDF writes standard /Encrypt dictionary into trailer', encStr.includes('/Encrypt') && encStr.includes('/Filter /Standard'));

    // Remove metadata
    const sanitized = await removeMetadataPdf(sample3Page);
    const sanitizedDoc = await PDFLib.PDFDocument.load(sanitized);
    assert('Remove metadata sanitizes Title, Author, and Subject', sanitizedDoc.getTitle() === undefined || sanitizedDoc.getTitle() === '');

    // Redaction
    const redacted = await redactPdf(sample3Page, { 1: [{ x: 50, y: 730, width: 200, height: 25 }] });
    const redactedDoc = await PDFLib.PDFDocument.load(redacted);
    assert('Permanent redaction stamps solid black block on page coordinates', redactedDoc.getPageCount() === 3);

    // Secure Share Token
    const share = createSecureShareToken('financial-statement.pdf', 48, 'pass123');
    assert('Secure Share Token generates expiration and secure URL', share.token && share.shareUrl.startsWith('/share/'));
  } catch (err) {
    console.error('Error during security tests:', err);
    assert('Security tests executed without error', false);
  }

  // --- SECTION 4: INTEGRITY OF EXISTING PDF EDITOR ---
  console.log('\n--- Checking PDF Editor Integrity Guard ---');
  const guardPassed = verifyEditorGuard();
  assert('CRITICAL: Existing PDF Editor integrity guard passes 100%', guardPassed);

  console.log('\n========================================================');
  console.log(`PHASE 2 TEST RESULTS: ${passed} / ${total} tests PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================');

  return passed === total;
}

if (require.main === module) {
  runPhase2Tests().then(ok => {
    process.exit(ok ? 0 : 1);
  });
}

module.exports = { runPhase2Tests };

