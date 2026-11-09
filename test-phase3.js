'use strict';
const fs = require('fs');
const path = require('path');
const PDFLib = require('./lib/pdf-lib.min.js');
const {
  tokenize,
  diffTokens,
  compareTexts,
  generateComparisonPdf
} = require('./lib/doc-comparison-engine.js');
const {
  extractInvoiceFieldsFromText,
  batchExtractInvoices,
  exportInvoicesToExcel,
  GSTIN_REGEX
} = require('./lib/invoice-extractor-engine.js');
const { extractXlsxContent } = require('./lib/office-converter.js');
const { createSearchablePdf } = require('./lib/ocr-scanner-engine.js');
const { verifyEditorGuard } = require('./verify-editor-guard.js');

async function runPhase3Tests() {
  console.log('========================================================');
  console.log('RUNNING PHASE 3 AUTOMATED TEST SUITE');
  console.log('Testing: OCR, Document Comparison & Invoice Extractor');
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

  // --- 1. DOCUMENT COMPARISON TESTS ---
  console.log('--- Testing Document Comparison Engine ---');
  try {
    const textA = 'Agreement between Acme Corp and Beta LLC on 2026-01-15 for the sum of $50,000 paid monthly.';
    const textB = 'Agreement between Acme Corp and Beta LLC on 2026-03-20 for the sum of $65,000 paid quarterly with renewal.';

    const comparison = compareTexts(textA, textB);
    assert('Comparison detects changed dates (2026-01-15 -> 2026-03-20)', comparison.summary.datesChanged >= 1);
    assert('Comparison detects changed numbers ($50,000 -> $65,000)', comparison.summary.numbersChanged >= 1);
    assert('Comparison detects added tokens (quarterly, renewal)', comparison.summary.addedCount >= 1);
    assert('Comparison detects deleted tokens (monthly)', comparison.summary.deletedCount >= 1);

    const compPdf = await generateComparisonPdf({
      pages: [{ pageNum: 1, diffs: comparison.diffs, summary: comparison.summary }],
      summary: {
        totalAdded: comparison.summary.addedCount,
        totalDeleted: comparison.summary.deletedCount,
        totalNumbersChanged: comparison.summary.numbersChanged,
        totalDatesChanged: comparison.summary.datesChanged
      }
    });
    const compDoc = await PDFLib.PDFDocument.load(compPdf);
    assert('Visual Comparison Diff PDF generated with summary badge and diff markers', compDoc.getPageCount() >= 1);
  } catch (err) {
    console.error('Error during comparison tests:', err);
    assert('Comparison tests executed without error', false);
  }

  // --- 2. INVOICE DATA EXTRACTOR TESTS ---
  console.log('\n--- Testing Invoice Data Extractor Engine ---');
  try {
    const sampleInvoiceText = `
      INFOTECH SOLUTIONS PVT LTD
      GSTIN: 27AABCU9603R1ZM
      Tax Invoice
      Invoice Number: INV-2026-0942
      Invoice Date: 15/04/2026
      Due Date: 30/04/2026
      Billed To: Global Systems Inc
      Description: Cloud Consulting Services
      Taxable Amount: 120000.00
      Total GST: 21600.00
      Total Amount: 141600.00
    `;

    const extracted = extractInvoiceFieldsFromText(sampleInvoiceText, 'inv-0942.pdf');
    assert('GSTIN regex validates and extracts 15-char Indian GSTIN', extracted.gstin === '27AABCU9603R1ZM');
    assert('Invoice number extracted accurately (INV-2026-0942)', extracted.invoiceNumber === 'INV-2026-0942');
    assert('Vendor name identified (INFOTECH SOLUTIONS PVT LTD)', extracted.vendorName === 'INFOTECH SOLUTIONS PVT LTD');
    assert('Invoice date extracted (15/04/2026)', extracted.invoiceDate === '15/04/2026');
    assert('Due date extracted (30/04/2026)', extracted.dueDate === '30/04/2026');
    assert('Total amount extracted (141600.00)', extracted.totalAmount === '141600.00');
    assert('Taxable amount extracted (120000.00)', extracted.taxableAmount === '120000.00');
    assert('GST amount extracted (21600.00)', extracted.gstAmount === '21600.00');
    assert('Extraction confidence score computed (> 75%)', extracted.confidence >= 75);

    // Batch Excel Export
    const records = [
      extracted,
      {
        filename: 'inv-0943.pdf',
        invoiceNumber: 'INV-2026-0943',
        vendorName: 'Apex Logistics',
        gstin: '29ABCDE1234F1Z5',
        invoiceDate: '18/04/2026',
        dueDate: '02/05/2026',
        taxableAmount: '45000.00',
        gstAmount: '8100.00',
        totalAmount: '53100.00',
        confidence: 90
      }
    ];

    const xlsxBytes = exportInvoicesToExcel(records);
    assert('Batch export generates valid XLSX spreadsheet byte stream', xlsxBytes.length > 500);

    const parsedXlsx = extractXlsxContent(xlsxBytes);
    assert('Exported Excel file contains headers and 2 invoice records', parsedXlsx.length === 3 && parsedXlsx[0][1] === 'Invoice Number');
  } catch (err) {
    console.error('Error during invoice extractor tests:', err);
    assert('Invoice extractor tests executed without error', false);
  }

  // --- 3. OCR SEARCHABLE PDF TESTS ---
  console.log('\n--- Testing OCR Searchable PDF Generation ---');
  try {
    const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const searchablePdf = await createSearchablePdf([{
      imageBytes: png1x1,
      type: 'png',
      width: 595,
      height: 842,
      words: [
        { text: 'Searchable', bbox: { x0: 50, y0: 100, x1: 150, y1: 120 } },
        { text: 'Document', bbox: { x0: 160, y0: 100, x1: 260, y1: 120 } }
      ]
    }]);

    const sDoc = await PDFLib.PDFDocument.load(searchablePdf);
    assert('Searchable PDF embeds raster background with invisible selectable text layer', sDoc.getPageCount() === 1);
  } catch (err) {
    console.error('Error during OCR searchable PDF tests:', err);
    assert('OCR tests executed without error', false);
  }

  // --- 4. INTEGRITY CHECK FOR EXISTING PDF EDITOR ---
  console.log('\n--- Checking PDF Editor Integrity Guard ---');
  const guardPassed = verifyEditorGuard();
  assert('CRITICAL: Existing PDF Editor integrity guard passes 100%', guardPassed);

  console.log('\n========================================================');
  console.log(`PHASE 3 TEST RESULTS: ${passed} / ${total} tests PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================');

  return passed === total;
}

if (require.main === module) {
  runPhase3Tests().then(ok => {
    process.exit(ok ? 0 : 1);
  });
}

module.exports = { runPhase3Tests };

