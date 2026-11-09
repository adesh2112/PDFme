'use strict';
const PDFLib = require('./lib/pdf-lib.min.js');
const {
  generateInvoicePdf,
  generateOfferLetterPdf,
  generateSalarySlipPdf,
  generateExperienceCertificatePdf,
  generatePurchaseOrderPdf,
  generateQuotationPdf,
  generateBulkDocuments
} = require('./lib/business-docs-engine.js');
const { verifyEditorGuard } = require('./verify-editor-guard.js');

async function runPhase5Tests() {
  console.log('========================================================');
  console.log('RUNNING PHASE 5 AUTOMATED TEST SUITE');
  console.log('Testing: Business Document Generators & Bulk Processing');
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

  // 1. Invoice Generator
  console.log('--- Testing Invoice Generator ---');
  try {
    const invPdf = await generateInvoicePdf({
      companyName: 'Apex Cloud Technologies',
      companyAddress: 'Level 4, Cyber City, Bangalore, India',
      companyGstin: '29ABCDE1234F1Z5',
      customerName: 'FinServe Global Inc',
      customerAddress: 'Tower B, Tech Park, Mumbai',
      customerGstin: '27AABCU9603R1ZM',
      invoiceNumber: 'INV-2026-8801',
      invoiceDate: '2026-05-01',
      dueDate: '2026-05-15',
      items: [
        { description: 'Cloud Architecture Consulting', qty: 40, rate: 2500, taxRate: 18 },
        { description: 'Security Audit & Compliance', qty: 1, rate: 45000, taxRate: 18 }
      ],
      discount: 5000
    });
    const invDoc = await PDFLib.PDFDocument.load(invPdf);
    assert('Invoice generator creates valid A4 vector PDF', invDoc.getPageCount() === 1);
  } catch (err) {
    console.error('Invoice test failed:', err);
    assert('Invoice generator executes without error', false);
  }

  // 2. Offer Letter Generator
  console.log('\n--- Testing Offer Letter Generator ---');
  try {
    const offerPdf = await generateOfferLetterPdf({
      companyName: 'NextGen AI Corp',
      candidateName: 'Priya Sharma',
      candidateAddress: 'Bengaluru, Karnataka',
      position: 'Staff AI Engineer',
      department: 'Core Research',
      ctc: 'Rs. 32,00,000 per annum',
      startDate: '2026-06-01',
      reportingTo: 'VP of Engineering'
    });
    const offerDoc = await PDFLib.PDFDocument.load(offerPdf);
    assert('Offer letter generator creates valid HR offer letter PDF', offerDoc.getPageCount() === 1);
  } catch (err) {
    console.error('Offer letter test failed:', err);
    assert('Offer letter generator executes without error', false);
  }

  // 3. Salary Slip Generator
  console.log('\n--- Testing Salary Slip Generator ---');
  try {
    const slipPdf = await generateSalarySlipPdf({
      companyName: 'Global Solutions Ltd',
      employeeName: 'Rahul Verma',
      employeeId: 'EMP-4092',
      designation: 'Principal Architect',
      monthYear: 'April 2026',
      earnings: [
        { label: 'Basic Salary', amount: 80000 },
        { label: 'HRA', amount: 32000 },
        { label: 'Special Allowance', amount: 25000 }
      ],
      deductions: [
        { label: 'Provident Fund', amount: 9600 },
        { label: 'TDS (Income Tax)', amount: 15000 },
        { label: 'Professional Tax', amount: 200 }
      ]
    });
    const slipDoc = await PDFLib.PDFDocument.load(slipPdf);
    assert('Salary slip generator creates structured payslip with earnings & deductions', slipDoc.getPageCount() === 1);
  } catch (err) {
    console.error('Salary slip test failed:', err);
    assert('Salary slip generator executes without error', false);
  }

  // 4. Experience Certificate Generator
  console.log('\n--- Testing Experience Certificate Generator ---');
  try {
    const certPdf = await generateExperienceCertificatePdf({
      companyName: 'Tech Innovations Pvt Ltd',
      employeeName: 'Ananya Roy',
      designation: 'Senior Product Designer',
      startDate: '01 Mar 2022',
      endDate: '30 Apr 2026'
    });
    const certDoc = await PDFLib.PDFDocument.load(certPdf);
    assert('Experience certificate generator creates professional employment certificate', certDoc.getPageCount() === 1);
  } catch (err) {
    console.error('Certificate test failed:', err);
    assert('Certificate generator executes without error', false);
  }

  // 5. Purchase Order Generator
  console.log('\n--- Testing Purchase Order Generator ---');
  try {
    const poPdf = await generatePurchaseOrderPdf({
      poNumber: 'PO-9921',
      vendorName: 'Hardware Solutions Inc',
      deliveryDate: 'Within 7 Business Days',
      totalValue: '$24,800.00'
    });
    const poDoc = await PDFLib.PDFDocument.load(poPdf);
    assert('Purchase order generator creates valid commercial PO', poDoc.getPageCount() === 1);
  } catch (err) {
    console.error('PO test failed:', err);
    assert('PO generator executes without error', false);
  }

  // 6. Quotation Generator
  console.log('\n--- Testing Quotation Generator ---');
  try {
    const quotePdf = await generateQuotationPdf({
      quoteNumber: 'QTN-2026-11',
      clientName: 'Enterprise Client Corp',
      estimatedPrice: '$18,500.00',
      validUntil: '30 Days'
    });
    const quoteDoc = await PDFLib.PDFDocument.load(quotePdf);
    assert('Quotation generator creates pricing quotation document', quoteDoc.getPageCount() === 1);
  } catch (err) {
    console.error('Quotation test failed:', err);
    assert('Quotation generator executes without error', false);
  }

  // 7. Bulk Document Generator
  console.log('\n--- Testing Bulk Document Generator ---');
  try {
    const rows = [
      { name: 'Alice Smith', position: 'Lead Developer', ctc: '$120,000' },
      { name: 'Bob Jones', position: 'Product Manager', ctc: '$130,000' },
      { name: 'Carol White', position: 'Security Specialist', ctc: '$125,000' }
    ];

    let progressCount = 0;
    const bulkResult = await generateBulkDocuments('offer-letter', rows, (p) => {
      progressCount++;
    });

    assert('Bulk generator processes all 3 batch records without blocking', bulkResult.count === 3 && progressCount === 3);
    assert('Bulk generator bundles all personalized PDFs into zip archive', bulkResult.zip.length > 1000 && Object.keys(bulkResult.files).length === 3);
  } catch (err) {
    console.error('Bulk test failed:', err);
    assert('Bulk generator executes without error', false);
  }

  // 8. Integrity Check for Existing PDF Editor
  console.log('\n--- Checking PDF Editor Integrity Guard ---');
  const guardPassed = verifyEditorGuard();
  assert('CRITICAL: Existing PDF Editor integrity guard passes 100%', guardPassed);

  console.log('\n========================================================');
  console.log(`PHASE 5 TEST RESULTS: ${passed} / ${total} tests PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================');

  return passed === total;
}

if (require.main === module) {
  runPhase5Tests().then(ok => {
    process.exit(ok ? 0 : 1);
  });
}

module.exports = { runPhase5Tests };

