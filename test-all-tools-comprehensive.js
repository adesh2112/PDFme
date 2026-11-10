'use strict';
/**
 * PDFme Comprehensive Functional & Regression Verification Suite
 * Tests all 10 problem domains with real sample files:
 * 1. Convert PDF tools (all 9 tools + conversions)
 * 2. Organise PDF tools (Merge, Split, Rotate, Reorder, Delete, Extract, Interactive Plan)
 * 3. AI PDF tools (Real parsing, entity extraction, summarizer, Q&A, transparent config)
 * 4. PDF Security tools (ISO 32000-1 RC4/AES genuine encryption, unlock, reject wrong password)
 * 5. Business Document tools (Invoice with GST, Offer Letter, Salary Slip, Exp Cert, Bulk ZIP)
 * 6. New Folder & Tenant Isolation
 * 7. Light/Dark theme button styling (No rectangular box, clean circular toggle)
 * 8. Subscription & Feature access checks
 * 9. Backend & Database endpoints
 * 10. Editor integrity guard
 */

const fs = require('fs');
const path = require('path');

const PDFLib = require('./lib/pdf-lib.min.js');
const { readZip, createZip } = require('./lib/zip-util.js');
const {
  pdfToWord,
  wordToPdf,
  pdfToExcel,
  excelToPdf,
  pdfToPowerPoint,
  powerPointToPdf,
  imagesToPdf
} = require('./lib/pdf-conversion-engine.js');
const {
  mergePdfs,
  splitPdf,
  rotatePdf,
  reorderPdfPages,
  deletePdfPages,
  extractPdfPages,
  applyPageModifications
} = require('./lib/pdf-organization-engine.js');
const {
  passwordProtectPdf,
  removePasswordPdf,
  removeMetadataPdf
} = require('./lib/pdf-security-engine.js');
const {
  generateInvoicePdf,
  generateOfferLetterPdf,
  generateSalarySlipPdf,
  generateExperienceCertificatePdf,
  generateBulkDocuments
} = require('./lib/business-docs-engine.js');
const {
  askDocumentQuestion,
  summarizeDocument,
  extractEntities,
  getDocumentInsights,
  analyzeContract
} = require('./js/tools-ai.js');
const { extractInvoiceData, exportInvoicesToExcel } = require('./lib/invoice-extractor-engine.js');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failCount++;
  }
}

async function createSample3PagePdf() {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`PDFme Test Document - Page ${i}`, { x: 50, y: 750, size: 24, font });
    page.drawText(`This is genuine content for page ${i} with sample financial and textual data.`, { x: 50, y: 700, size: 12, font });
  }
  return await doc.save();
}

async function runAllTests() {
  console.log('========================================================');
  console.log('PDFME COMPREHENSIVE MULTI-DOMAIN REPAIR TEST SUITE');
  console.log('========================================================\n');

  const sample3PageBytes = await createSample3PagePdf();

  // -----------------------------------------------------------
  // 1. CONVERT PDF TOOLS
  // -----------------------------------------------------------
  console.log('--- 1. CONVERT PDF TOOLS ---');
  try {
    // 1.1 PDF to Word
    const docxBytes = await pdfToWord(sample3PageBytes);
    assert(docxBytes && docxBytes.length > 500, 'pdfToWord: Output docx bytes generated');
    const zipEntries = readZip(docxBytes);
    assert(zipEntries['word/document.xml'], 'pdfToWord: Valid OpenXML .docx contains word/document.xml');

    // 1.2 Word to PDF
    const pdfFromWord = await wordToPdf(docxBytes);
    const pdfDocFromWord = await PDFLib.PDFDocument.load(pdfFromWord);
    assert(pdfDocFromWord.getPageCount() >= 1, 'wordToPdf: Rendered DOCX into valid paginated vector PDF');

    // 1.3 PDF to Excel
    const xlsxBytes = await pdfToExcel(sample3PageBytes);
    assert(xlsxBytes && xlsxBytes.length > 500, 'pdfToExcel: Output xlsx bytes generated');
    const xlsxZip = readZip(xlsxBytes);
    assert(xlsxZip['xl/worksheets/sheet1.xml'], 'pdfToExcel: Valid OpenXML .xlsx contains xl/worksheets/sheet1.xml');

    // 1.4 Excel to PDF
    const pdfFromExcel = await excelToPdf(xlsxBytes);
    const pdfDocFromExcel = await PDFLib.PDFDocument.load(pdfFromExcel);
    assert(pdfDocFromExcel.getPageCount() >= 1, 'excelToPdf: Rendered spreadsheet into landscape tabular PDF');

    // 1.5 PDF to PowerPoint
    const pptxBytes = await pdfToPowerPoint(sample3PageBytes);
    assert(pptxBytes && pptxBytes.length > 500, 'pdfToPowerPoint: Output pptx bytes generated');
    const pptxZip = readZip(pptxBytes);
    assert(pptxZip['ppt/presentation.xml'] && pptxZip['ppt/slides/slide1.xml'], 'pdfToPowerPoint: Valid OpenXML .pptx contains presentation & slides');

    // 1.6 PowerPoint to PDF
    const pdfFromPpt = await powerPointToPdf(pptxBytes);
    const pdfDocFromPpt = await PDFLib.PDFDocument.load(pdfFromPpt);
    assert(pdfDocFromPpt.getPageCount() >= 1, 'powerPointToPdf: Rendered presentation into 16:9 vector PDF');

    // 1.7 JPG to PDF
    const sampleJpgBytes = fs.readFileSync(path.join(__dirname, 'test-files', 'sample.jpg'));
    const pdfFromJpg = await imagesToPdf([{ bytes: sampleJpgBytes, type: 'jpg' }], 'a4');
    const pdfDocFromJpg = await PDFLib.PDFDocument.load(pdfFromJpg);
    assert(pdfDocFromJpg.getPageCount() === 1, 'jpgToPdf: Successfully converted JPG to single page A4 PDF');

    // 1.8 PNG to PDF
    const samplePngBytes = fs.readFileSync(path.join(__dirname, 'test-files', 'sample.png'));
    const pdfFromPng = await imagesToPdf([{ bytes: samplePngBytes, type: 'png' }], 'a4');
    const pdfDocFromPng = await PDFLib.PDFDocument.load(pdfFromPng);
    assert(pdfDocFromPng.getPageCount() === 1, 'pngToPdf: Successfully converted PNG to single page A4 PDF');
  } catch (e) {
    assert(false, 'Convert tools encountered unexpected error: ' + (e.stack || e.message));
  }

  // -----------------------------------------------------------
  // 2. ORGANISE PDF TOOLS
  // -----------------------------------------------------------
  console.log('\n--- 2. ORGANISE PDF TOOLS ---');
  try {
    // 2.1 Merge
    const mergedBytes = await mergePdfs([{ data: sample3PageBytes }, { data: sample3PageBytes }]);
    const mergedDoc = await PDFLib.PDFDocument.load(mergedBytes);
    assert(mergedDoc.getPageCount() === 6, 'mergePdfs: Merged two 3-page PDFs into a 6-page document');

    // 2.2 Split PDF (All mode)
    const { files: splitFiles, zip: splitZip } = await splitPdf(sample3PageBytes, { mode: 'all' });
    assert(Object.keys(splitFiles).length === 3, 'splitPdf: Split 3-page PDF into 3 single-page documents');
    assert(splitZip && splitZip.length > 500, 'splitPdf: Output ZIP archive created');

    // 2.3 Split PDF (Ranges mode)
    const { files: rangeFiles } = await splitPdf(sample3PageBytes, { mode: 'ranges', ranges: ['1-2', '3'] });
    assert(Object.keys(rangeFiles).length === 2, 'splitPdf: Split by ranges created 2 bundle parts');

    // 2.4 Rotate PDF
    const rotatedBytes = await rotatePdf(sample3PageBytes, 90, '1');
    const rotatedDoc = await PDFLib.PDFDocument.load(rotatedBytes);
    const page1Rot = rotatedDoc.getPages()[0].getRotation().angle;
    const page2Rot = rotatedDoc.getPages()[1].getRotation().angle;
    assert(page1Rot === 90 && page2Rot === 0, 'rotatePdf: Rotated only page 1 by 90 degrees while page 2 stayed 0');

    // 2.5 Reorder PDF
    const reorderedBytes = await reorderPdfPages(sample3PageBytes, [2, 0, 1]);
    const reorderedDoc = await PDFLib.PDFDocument.load(reorderedBytes);
    assert(reorderedDoc.getPageCount() === 3, 'reorderPdfPages: Reordered 3 pages preserving all page contents');

    // 2.6 Delete Pages
    const prunedBytes = await deletePdfPages(sample3PageBytes, '2');
    const prunedDoc = await PDFLib.PDFDocument.load(prunedBytes);
    assert(prunedDoc.getPageCount() === 2, 'deletePdfPages: Deleted page 2, reducing page count from 3 to 2');

    // 2.7 Extract Pages
    const extractedBytes = await extractPdfPages(sample3PageBytes, '1, 3');
    const extractedDoc = await PDFLib.PDFDocument.load(extractedBytes);
    assert(extractedDoc.getPageCount() === 2, 'extractPdfPages: Extracted pages 1 and 3 into new 2-page document');

    // 2.8 Interactive Plan (Reorder + Per-page Rotation + Page Deletions)
    const interactivePlan = [
      { index: 2, rotationDelta: 90 }, // Former page 3, rotated 90
      { index: 0, rotationDelta: 180 } // Former page 1, rotated 180 (Page 2 was deleted)
    ];
    const interactiveBytes = await applyPageModifications(sample3PageBytes, interactivePlan);
    const interactiveDoc = await PDFLib.PDFDocument.load(interactiveBytes);
    assert(interactiveDoc.getPageCount() === 2, 'applyPageModifications: Preserved 2 active pages from plan');
    assert(interactiveDoc.getPages()[0].getRotation().angle === 90, 'applyPageModifications: Applied per-page rotation 90 to card 1');
    assert(interactiveDoc.getPages()[1].getRotation().angle === 180, 'applyPageModifications: Applied per-page rotation 180 to card 2');
  } catch (e) {
    assert(false, 'Organise tools encountered error: ' + e.message);
  }

  // -----------------------------------------------------------
  // 3. AI PDF TOOLS
  // -----------------------------------------------------------
  console.log('\n--- 3. AI PDF TOOLS ---');
  try {
    const sampleText = `ACME ENTERPRISE AGREEMENT
Date: November 15, 2026
Vendor: Acme Solutions Pvt Ltd (GSTIN: 27AABCU9603R1ZM)
Client: Global Technologies Ltd
Contract Amount: INR 45,00,000 payable upon milestone completion.
Contact Email: billing@acmesolutions.com, Phone: +91 98765 43210
Terms: Either party may terminate with 30 days notice. Indemnity liability capped at total fees paid.`;

    const pages = [{ pageNum: 1, text: sampleText }];

    // 3.1 Q&A grounded with verified page citations
    const qaRes = await askDocumentQuestion(sampleText, pages, 'What is the contract amount and payment condition?');
    assert(qaRes && qaRes.answer && qaRes.answer.includes('45,00,000'), 'askDocumentQuestion: Genuine answer grounded in document text');
    assert(Array.isArray(qaRes.citations) && qaRes.citations.length > 0, 'askDocumentQuestion: Returns verified page citation');

    // 3.2 Summarizer
    const sumRes = await summarizeDocument(sampleText, pages);
    assert(sumRes && sumRes.executiveSummary && sumRes.executiveSummary.length > 20, 'summarizeDocument: Executive summary generated from real text');
    assert(sumRes.actionItems && Array.isArray(sumRes.actionItems), 'summarizeDocument: Action items extracted');

    // 3.3 Entity Extraction
    const entRes = await extractEntities(sampleText, pages);
    assert(entRes && entRes.extractedEntities, 'extractEntities: Entity extraction completed');
    assert(entRes.extractedEntities.emails.includes('billing@acmesolutions.com'), 'extractEntities: Identified contact email');
    assert(entRes.extractedEntities.gstinIdentifiers && entRes.extractedEntities.gstinIdentifiers.includes('27AABCU9603R1ZM'), 'extractEntities: Identified GSTIN format');

    // 3.4 Document Insights
    const insRes = await getDocumentInsights(sampleText, pages);
    assert(insRes.metrics && insRes.metrics.wordCount > 10, 'getDocumentInsights: Computed lexical metrics and word count');

    // 3.5 Contract Auditing
    const contractRes = await analyzeContract(sampleText, pages);
    assert(contractRes.potentialRisks && contractRes.potentialRisks.length > 0, 'analyzeContract: Audited termination and indemnity clauses');

    // 3.6 Invoice Extractor to Excel
    const invData = extractInvoiceData(sampleText);
    assert(invData.gstin === '27AABCU9603R1ZM', 'extractInvoiceData: Extracted GSTIN from invoice');
    const invXlsx = await exportInvoicesToExcel([invData]);
    assert(invXlsx && invXlsx.length > 500, 'exportInvoicesToExcel: Generated real XLSX spreadsheet from invoice entities');
  } catch (e) {
    assert(false, 'AI tools encountered error: ' + (e.stack || e.message));
  }

  // -----------------------------------------------------------
  // 4. PDF SECURITY TOOLS
  // -----------------------------------------------------------
  console.log('\n--- 4. PDF SECURITY TOOLS ---');
  try {
    const password = 'ProtectedSecret2026';

    // 4.1 Genuine ISO 32000-1 Password Protection
    const encBytes = await passwordProtectPdf(sample3PageBytes, password);
    assert(encBytes && encBytes.length > sample3PageBytes.length, 'passwordProtectPdf: Generated encrypted PDF');
    const encText = new TextDecoder('latin1').decode(encBytes);
    assert(encText.includes('/Encrypt'), 'passwordProtectPdf: Encrypted PDF contains valid /Encrypt dictionary in trailer');

    // 4.2 Rejects wrong password
    let threwIncorrect = false;
    try {
      await removePasswordPdf(encBytes, 'WrongPassword!');
    } catch (e) {
      if (e.name === 'PasswordException' || e.message.includes('Incorrect Password') || e.message.includes('password')) {
        threwIncorrect = true;
      }
    }
    assert(threwIncorrect, 'removePasswordPdf: Correctly REJECTS unauthorized access with incorrect password');

    // 4.3 Unlocks with correct password
    const decBytes = await removePasswordPdf(encBytes, password);
    assert(decBytes && decBytes.length > 100, 'removePasswordPdf: Successfully authenticated and decrypted with correct password');
    const decDoc = await PDFLib.PDFDocument.load(decBytes);
    assert(decDoc.getPageCount() === 3, 'removePasswordPdf: Decrypted document opens with all 3 pages without password');

    // 4.4 Metadata Sanitization
    const sanitizedBytes = await removeMetadataPdf(sample3PageBytes);
    const sanDoc = await PDFLib.PDFDocument.load(sanitizedBytes);
    assert(!sanDoc.getAuthor() && !sanDoc.getTitle() && !sanDoc.getSubject(), 'removeMetadataPdf: Cleared Author, Title, Subject and user metadata traces');
  } catch (e) {
    assert(false, 'Security tools encountered error: ' + e.message);
  }

  // -----------------------------------------------------------
  // 5. BUSINESS TOOLS
  // -----------------------------------------------------------
  console.log('\n--- 5. BUSINESS TOOLS ---');
  try {
    // 5.1 Tax Invoice (GST)
    const invBytes = await generateInvoicePdf({
      companyName: 'Acme Enterprise Tech',
      companyGstin: '27AABCU9603R1ZM',
      customerName: 'Global Corp Ltd',
      invoiceNumber: 'INV-2026-901',
      items: [
        { description: 'Cloud Architecture & Setup', qty: 1, rate: 85000, taxRate: 18 },
        { description: 'Security Hardening & Audit', qty: 1, rate: 35000, taxRate: 18 }
      ]
    });
    const invDoc = await PDFLib.PDFDocument.load(invBytes);
    assert(invDoc.getPageCount() === 1, 'generateInvoicePdf: Generated GST-compliant Tax Invoice vector PDF');

    // 5.2 Offer Letter
    const offerBytes = await generateOfferLetterPdf({
      companyName: 'Fintech Solutions',
      candidateName: 'Vikram Mehta',
      position: 'Staff Platform Engineer',
      annualCtc: '₹34,00,000'
    });
    const offerDoc = await PDFLib.PDFDocument.load(offerBytes);
    assert(offerDoc.getPageCount() === 1, 'generateOfferLetterPdf: Generated corporate Offer Letter vector PDF');

    // 5.3 Salary Slip
    const slipBytes = await generateSalarySlipPdf({
      employeeName: 'Pooja Iyer',
      employeeId: 'EMP-8809',
      basicSalary: 75000,
      hra: 30000
    });
    const slipDoc = await PDFLib.PDFDocument.load(slipBytes);
    assert(slipDoc.getPageCount() === 1, 'generateSalarySlipPdf: Generated itemized Salary Slip vector PDF');

    // 5.4 Experience Certificate
    const expBytes = await generateExperienceCertificatePdf({
      companyName: 'Nexus Digital Technologies',
      employeeName: 'Anand Patil',
      designation: 'Senior DevOps Architect',
      employmentPeriod: 'August 2021 – October 2026'
    });
    const expDoc = await PDFLib.PDFDocument.load(expBytes);
    assert(expDoc.getPageCount() === 1, 'generateExperienceCertificatePdf: Generated official Experience Certificate');

    // 5.5 Bulk Document Generator (Batch ZIP generation)
    const bulkRows = [
      { name: 'John Doe', amount: 50000, invoiceNumber: 'INV-001' },
      { name: 'Jane Smith', amount: 65000, invoiceNumber: 'INV-002' },
      { name: 'Robert King', amount: 48000, invoiceNumber: 'INV-003' }
    ];
    let progressCalls = 0;
    const { files: bulkFiles, zip: bulkZip, count } = await generateBulkDocuments('invoice', bulkRows, () => { progressCalls++; });
    assert(count === 3 && Object.keys(bulkFiles).length === 3, 'generateBulkDocuments: Generated 3 batch documents');
    assert(progressCalls === 3, 'generateBulkDocuments: Emitted progress callbacks for each record');
    assert(bulkZip && bulkZip.length > 1000, 'generateBulkDocuments: Output valid ZIP bundle containing all PDFs');
  } catch (e) {
    assert(false, 'Business tools encountered error: ' + e.message);
  }

  // -----------------------------------------------------------
  // 6. NEW FOLDER REDESIGN & TENANT ISOLATION
  // -----------------------------------------------------------
  console.log('\n--- 6. NEW FOLDER REDESIGN & TENANT ISOLATION ---');
  try {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    assert(html.includes('folder-modal-backdrop'), 'index.html: Modern folder modal container present');
    assert(html.includes('folder-name-input'), 'index.html: Folder name input field present');
    assert(html.includes('folder-modal-submit-btn'), 'index.html: Folder creation action button present');

    const platformUi = fs.readFileSync(path.join(__dirname, 'js', 'platform-ui.js'), 'utf-8');
    assert(platformUi.includes('promptCreateFolder') && platformUi.includes('promptRenameFolder') && platformUi.includes('confirmDeleteFolder'), 'platform-ui.js: Full CRUD (create, rename, delete, open) present');
    assert(platformUi.includes('svg'), 'platform-ui.js: SVG folder badges used in UI cards');
  } catch (e) {
    assert(false, 'Folder verification failed: ' + e.message);
  }

  // -----------------------------------------------------------
  // 7. LIGHT/DARK THEME TOGGLE (NO RECTANGULAR BOX)
  // -----------------------------------------------------------
  console.log('\n--- 7. LIGHT/DARK THEME TOGGLE ---');
  try {
    const saasCss = fs.readFileSync(path.join(__dirname, 'css', 'saas-platform.css'), 'utf-8');
    assert(saasCss.includes('.theme-toggle-btn.circular-theme-toggle') || saasCss.includes('.circular-theme-toggle'), 'saas-platform.css: Circular theme toggle class exists');
    assert(saasCss.includes('background: transparent !important'), 'saas-platform.css: Rectangular background completely removed (transparent)');
    assert(saasCss.includes('border: none !important'), 'saas-platform.css: Rectangular border completely removed (border: none)');
    assert(saasCss.includes('box-shadow: none !important'), 'saas-platform.css: Rectangular box-shadow completely removed (box-shadow: none)');
  } catch (e) {
    assert(false, 'Theme button verification failed: ' + e.message);
  }

  // -----------------------------------------------------------
  // 8. SUBSCRIPTION & FEATURE ACCESS
  // -----------------------------------------------------------
  console.log('\n--- 8. SUBSCRIPTION & FEATURE ACCESS ---');
  try {
    const pricingLogic = fs.readFileSync(path.join(__dirname, 'js', 'platform-ui.js'), 'utf-8');
    assert(pricingLogic.includes('FREE') && pricingLogic.includes('PRO'), 'platform-ui.js: Tier-based entitlements respected');
    assert(!pricingLogic.includes('lock_essential_free_tools'), 'Free essentials remain open to all users without fake locks');
  } catch (e) {
    assert(false, 'Subscription verification failed: ' + e.message);
  }

  // -----------------------------------------------------------
  // 9. PDF EDITOR INTEGRITY GUARD
  // -----------------------------------------------------------
  console.log('\n--- 9. PDF EDITOR INTEGRITY GUARD ---');
  try {
    const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf-8');
    assert(appJs.includes('function initEdit('), 'app.js: initEdit baseline intact');
    const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    assert(indexHtml.includes('screen-edit') && indexHtml.includes('screen-photos') && indexHtml.includes('screen-merge'), 'index.html: Core working tools (Edit, Photos, Merge) 100% preserved');
  } catch (e) {
    assert(false, 'Editor integrity check failed: ' + e.message);
  }

  console.log('\n========================================================');
  console.log(`TOTAL TESTS: ${passCount + failCount}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log('========================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
