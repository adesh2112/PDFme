'use strict';
const fs = require('fs');
const path = require('path');
const PDFLib = require('./lib/pdf-lib.min.js');
const { readZip } = require('./lib/zip-util.js');

const {
  pdfToWord,
  pdfToExcel,
  pdfToPowerPoint,
  imagesToPdf
} = require('./lib/pdf-conversion-engine.js');

const {
  mergePdfs,
  splitPdf,
  rotatePdf,
  deletePdfPages,
  extractPdfPages,
  compressPdf,
  addPageNumbers
} = require('./lib/pdf-organization-engine.js');

const {
  passwordProtectPdf,
  removePasswordPdf,
  removeMetadataPdf,
  addWatermarkPdf
} = require('./lib/pdf-security-engine.js');

const {
  generateInvoicePdf,
  generateOfferLetterPdf,
  generateSalarySlipPdf,
  generateExperienceCertificatePdf,
  generateBulkDocuments,
  repairPdf,
  flattenPdf
} = require('./lib/business-docs-engine.js');

async function testAllProcessing() {
  console.log('=== REAL FUNCTIONAL PROCESSING VERIFICATION ===\n');

  const sample1Bytes = fs.readFileSync('test-files/sample-01.pdf');
  const sample2Bytes = fs.readFileSync('test-files/sample-02.pdf');
  const jpgBytes = fs.readFileSync('test-files/portrait.jpg');

  // 1. PDF to Word (DOCX)
  console.log('1. Testing PDF to Word (DOCX)...');
  const docxBytes = await pdfToWord(sample1Bytes);
  if (!docxBytes || docxBytes.length < 100) throw new Error('PDF to Word generated empty bytes');
  const docxZip = await readZip(docxBytes);
  if (!docxZip['word/document.xml']) throw new Error('Invalid DOCX: missing word/document.xml');
  console.log(`   ✓ Genuine DOCX generated (${docxBytes.length} bytes, contains word/document.xml)`);

  // 2. PDF to Excel (XLSX)
  console.log('2. Testing PDF to Excel (XLSX)...');
  const xlsxBytes = await pdfToExcel(sample1Bytes);
  if (!xlsxBytes || xlsxBytes.length < 100) throw new Error('PDF to Excel generated empty bytes');
  const xlsxZip = await readZip(xlsxBytes);
  if (!xlsxZip['xl/workbook.xml']) throw new Error('Invalid XLSX: missing xl/workbook.xml');
  console.log(`   ✓ Genuine XLSX generated (${xlsxBytes.length} bytes, contains xl/workbook.xml)`);

  // 3. PDF to PowerPoint (PPTX)
  console.log('3. Testing PDF to PowerPoint (PPTX)...');
  const pptxBytes = await pdfToPowerPoint(sample1Bytes);
  if (!pptxBytes || pptxBytes.length < 100) throw new Error('PDF to PowerPoint generated empty bytes');
  const pptxZip = await readZip(pptxBytes);
  if (!pptxZip['ppt/presentation.xml']) throw new Error('Invalid PPTX: missing ppt/presentation.xml');
  console.log(`   ✓ Genuine PPTX generated (${pptxBytes.length} bytes, contains ppt/presentation.xml)`);

  // 4. Images to PDF
  console.log('4. Testing Images to PDF...');
  const imgPdfBytes = await imagesToPdf([{ name: 'portrait.jpg', bytes: jpgBytes }]);
  const imgPdfDoc = await PDFLib.PDFDocument.load(imgPdfBytes);
  if (imgPdfDoc.getPageCount() !== 1) throw new Error('Images to PDF page count mismatch');
  console.log(`   ✓ Valid PDF generated from image (${imgPdfBytes.length} bytes, 1 page)`);

  // 5. Merge PDF
  console.log('5. Testing Merge PDF...');
  const mergedBytes = await mergePdfs([sample1Bytes, sample2Bytes]);
  const mergedDoc = await PDFLib.PDFDocument.load(mergedBytes);
  if (mergedDoc.getPageCount() < 2) throw new Error('Merge PDF page count invalid');
  console.log(`   ✓ Merged PDF generated (${mergedBytes.length} bytes, ${mergedDoc.getPageCount()} pages)`);

  // 6. Split PDF
  console.log('6. Testing Split PDF...');
  const splitRes = await splitPdf(mergedBytes, { mode: 'all' });
  const splitBytes = splitRes.zip || splitRes.bytes;
  if (!splitBytes || splitBytes.length < 100) throw new Error('Split PDF generated empty bytes');
  console.log(`   ✓ Split PDF ZIP archive generated (${splitBytes.length} bytes)`);

  // 7. Rotate PDF
  console.log('7. Testing Rotate PDF...');
  const rotatedBytes = await rotatePdf(sample1Bytes, 90);
  const rotatedDoc = await PDFLib.PDFDocument.load(rotatedBytes);
  const page0 = rotatedDoc.getPage(0);
  if (page0.getRotation().angle !== 90) throw new Error('Rotation angle mismatch');
  console.log(`   ✓ Rotated PDF generated (${rotatedBytes.length} bytes, rotation = 90°)`);

  // 8. Delete Pages
  console.log('8. Testing Delete Pages...');
  const delBytes = await deletePdfPages(mergedBytes, '1');
  const delDoc = await PDFLib.PDFDocument.load(delBytes);
  if (delDoc.getPageCount() !== mergedDoc.getPageCount() - 1) throw new Error('Delete pages failed');
  console.log(`   ✓ Delete Pages succeeded (pages reduced to ${delDoc.getPageCount()})`);

  // 9. Compress PDF
  console.log('9. Testing Compress PDF...');
  const compBytes = await compressPdf(sample1Bytes);
  const compDoc = await PDFLib.PDFDocument.load(compBytes);
  if (!compDoc) throw new Error('Compress PDF invalid');
  console.log(`   ✓ Compressed PDF generated (${compBytes.length} bytes)`);

  // 10. Password Protect PDF
  console.log('10. Testing Password Protect PDF...');
  const protectedBytes = await passwordProtectPdf(sample1Bytes, 'SecretPass123');
  const protectedStr = Buffer.from(protectedBytes).toString('binary');
  if (!protectedStr.includes('/Encrypt')) throw new Error('PDF is missing /Encrypt dictionary');
  console.log(`   ✓ Genuine Encrypted PDF generated (${protectedBytes.length} bytes, contains /Encrypt)`);

  // 11. Unlock PDF
  console.log('11. Testing Unlock PDF...');
  const unlockedBytes = await removePasswordPdf(protectedBytes, 'SecretPass123');
  const unlockedDoc = await PDFLib.PDFDocument.load(unlockedBytes);
  if (!unlockedDoc) throw new Error('Failed to unlock PDF');
  console.log(`   ✓ Unlocked PDF generated successfully (${unlockedBytes.length} bytes)`);

  // 12. Watermark PDF
  console.log('12. Testing Watermark PDF...');
  const watermarkedBytes = await addWatermarkPdf(sample1Bytes, 'CONFIDENTIAL');
  const watermarkedDoc = await PDFLib.PDFDocument.load(watermarkedBytes);
  if (!watermarkedDoc) throw new Error('Watermarked PDF invalid');
  console.log(`   ✓ Watermarked PDF generated (${watermarkedBytes.length} bytes)`);

  // 13. Remove Metadata
  console.log('13. Testing Sanitize Metadata...');
  const sanitizedBytes = await removeMetadataPdf(sample1Bytes);
  const sanitizedDoc = await PDFLib.PDFDocument.load(sanitizedBytes);
  if (sanitizedDoc.getTitle() || sanitizedDoc.getAuthor()) throw new Error('Metadata not stripped');
  console.log(`   ✓ Metadata stripped cleanly (${sanitizedBytes.length} bytes)`);

  // 14. Business Tools: Invoice Generator
  console.log('14. Testing Invoice Generator...');
  const invBytes = await generateInvoicePdf({
    invoiceNumber: 'INV-2026-001',
    customerName: 'Acme Corp',
    items: [{ desc: 'Cloud Consulting', qty: 10, rate: 1500 }]
  });
  const invDoc = await PDFLib.PDFDocument.load(invBytes);
  if (!invDoc) throw new Error('Invoice PDF invalid');
  console.log(`   ✓ Corporate GST Invoice PDF generated (${invBytes.length} bytes)`);

  // 15. Business Tools: Offer Letter Generator
  console.log('15. Testing Offer Letter Generator...');
  const offerBytes = await generateOfferLetterPdf({
    candidateName: 'Priya Sharma',
    position: 'Lead Architect',
    ctc: 2400000
  });
  const offerDoc = await PDFLib.PDFDocument.load(offerBytes);
  if (!offerDoc) throw new Error('Offer letter PDF invalid');
  console.log(`   ✓ Offer Letter PDF generated (${offerBytes.length} bytes)`);

  // 16. Business Tools: Salary Slip Generator
  console.log('16. Testing Salary Slip Generator...');
  const slipBytes = await generateSalarySlipPdf({
    employeeName: 'Rahul Verma',
    month: 'November 2026',
    basic: 80000
  });
  const slipDoc = await PDFLib.PDFDocument.load(slipBytes);
  if (!slipDoc) throw new Error('Salary slip PDF invalid');
  console.log(`   ✓ Salary Slip PDF generated (${slipBytes.length} bytes)`);

  // 17. Business Tools: Bulk Document Generator
  console.log('17. Testing Bulk Document Generator...');
  const bulkRes = await generateBulkDocuments('offer-letter', [
    { name: 'Alice Smith', position: 'Developer', ctc: 1200000 },
    { name: 'Bob Jones', position: 'Designer', ctc: 1100000 }
  ]);
  const bulkZipBytes = bulkRes.zip || bulkRes;
  const bulkZip = await readZip(bulkZipBytes);
  const zipFileNames = Object.keys(bulkZip);
  if (zipFileNames.length < 2) throw new Error('Bulk ZIP missing generated documents');
  console.log(`   ✓ Bulk Document ZIP generated (${bulkZipBytes.length} bytes, ${zipFileNames.length} files)`);

  console.log('\n======================================================');
  console.log('🎉 ALL 17 FUNCTIONAL PROCESSING CHECKS PASSED!');
  console.log('======================================================\n');
}

testAllProcessing().catch(err => {
  console.error('Processing Test Failed:', err);
  process.exit(1);
});
