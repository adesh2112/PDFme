'use strict';
/**
 * Business Document Generators Engine
 * High-performance vector PDF generators for:
 * 1. Invoice (with GST calculations)
 * 2. Offer Letter
 * 3. Salary Slip
 * 4. Experience Certificate
 * 5. Purchase Order
 * 6. Quotation
 * 7. Bulk Document Generator (CSV/Excel batch processing with Zip bundle)
 */

var PDFLib = typeof require !== 'undefined' ? require('./pdf-lib.min.js') : (typeof window !== 'undefined' ? window.PDFLib : null);
var createZip = typeof require !== 'undefined' ? require('./zip-util.js').createZip : (typeof window !== 'undefined' && window.ZipUtil ? window.ZipUtil.createZip : null);

/**
 * 1. INVOICE GENERATOR
 */
async function generateInvoicePdf(data) {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const primaryColor = PDFLib.rgb(0.09, 0.44, 0.85); // Professional blue
  const textColor = PDFLib.rgb(0.15, 0.15, 0.2);
  const grayColor = PDFLib.rgb(0.4, 0.4, 0.45);

  // Top header banner
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH,
    height: 8,
    color: primaryColor
  });

  // Company Name & Invoice Title
  const companyName = data.companyName || 'COMPANY NAME';
  page.drawText(companyName, { x: 40, y: PAGE_HEIGHT - 50, size: 20, font: bold, color: primaryColor });
  page.drawText(data.companyAddress || '123 Business Boulevard, Financial District', { x: 40, y: PAGE_HEIGHT - 66, size: 9, font, color: grayColor });
  if (data.companyGstin) {
    page.drawText(`GSTIN: ${data.companyGstin}`, { x: 40, y: PAGE_HEIGHT - 78, size: 9, font: bold, color: textColor });
  }

  // Invoice label & metadata box
  page.drawText('TAX INVOICE', { x: PAGE_WIDTH - 160, y: PAGE_HEIGHT - 50, size: 18, font: bold, color: textColor });
  page.drawText(`Invoice #: ${data.invoiceNumber || 'INV-001'}`, { x: PAGE_WIDTH - 160, y: PAGE_HEIGHT - 66, size: 9, font: bold, color: textColor });
  page.drawText(`Date: ${data.invoiceDate || new Date().toISOString().slice(0, 10)}`, { x: PAGE_WIDTH - 160, y: PAGE_HEIGHT - 78, size: 9, font, color: grayColor });
  page.drawText(`Due Date: ${data.dueDate || 'Upon Receipt'}`, { x: PAGE_WIDTH - 160, y: PAGE_HEIGHT - 90, size: 9, font, color: grayColor });

  // Bill To box
  let y = PAGE_HEIGHT - 120;
  page.drawRectangle({
    x: 40,
    y: y - 55,
    width: PAGE_WIDTH - 80,
    height: 55,
    color: PDFLib.rgb(0.97, 0.98, 0.99),
    borderColor: PDFLib.rgb(0.88, 0.9, 0.94),
    borderWidth: 1
  });
  page.drawText('BILLED TO:', { x: 50, y: y - 16, size: 8, font: bold, color: primaryColor });
  page.drawText(data.customerName || 'Customer Name / Entity', { x: 50, y: y - 28, size: 10, font: bold, color: textColor });
  page.drawText(data.customerAddress || 'Client Address, City, State, ZIP', { x: 50, y: y - 40, size: 8, font, color: grayColor });
  if (data.customerGstin) {
    page.drawText(`Customer GSTIN: ${data.customerGstin}`, { x: 260, y: y - 40, size: 8, font: bold, color: textColor });
  }

  // Table Headers
  y -= 75;
  const tableTop = y;
  page.drawRectangle({
    x: 40,
    y: y - 20,
    width: PAGE_WIDTH - 80,
    height: 20,
    color: primaryColor
  });

  page.drawText('ITEM DESCRIPTION', { x: 48, y: y - 14, size: 8, font: bold, color: PDFLib.rgb(1, 1, 1) });
  page.drawText('QTY', { x: 290, y: y - 14, size: 8, font: bold, color: PDFLib.rgb(1, 1, 1) });
  page.drawText('RATE', { x: 340, y: y - 14, size: 8, font: bold, color: PDFLib.rgb(1, 1, 1) });
  page.drawText('TAX (%)', { x: 410, y: y - 14, size: 8, font: bold, color: PDFLib.rgb(1, 1, 1) });
  page.drawText('AMOUNT', { x: 480, y: y - 14, size: 8, font: bold, color: PDFLib.rgb(1, 1, 1) });

  // Line items
  const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : [
    { description: 'Professional Services', qty: 1, rate: 5000, taxRate: 18 }
  ];

  let subtotal = 0;
  let totalTax = 0;
  y -= 20;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const qty = parseFloat(it.qty) || 1;
    const rate = parseFloat(it.rate) || 0;
    const taxRate = parseFloat(it.taxRate) || 0;
    const lineTotal = qty * rate;
    const lineTax = lineTotal * (taxRate / 100);

    subtotal += lineTotal;
    totalTax += lineTax;

    const rowBg = i % 2 === 1 ? PDFLib.rgb(0.98, 0.98, 0.99) : PDFLib.rgb(1, 1, 1);
    page.drawRectangle({
      x: 40,
      y: y - 18,
      width: PAGE_WIDTH - 80,
      height: 18,
      color: rowBg,
      borderColor: PDFLib.rgb(0.92, 0.92, 0.94),
      borderWidth: 0.5
    });

    page.drawText(it.description || 'Item Description', { x: 48, y: y - 13, size: 8, font, color: textColor });
    page.drawText(String(qty), { x: 295, y: y - 13, size: 8, font, color: textColor });
    page.drawText(rate.toFixed(2), { x: 340, y: y - 13, size: 8, font, color: textColor });
    page.drawText(`${taxRate}%`, { x: 415, y: y - 13, size: 8, font, color: textColor });
    page.drawText(lineTotal.toFixed(2), { x: 480, y: y - 13, size: 8, font: bold, color: textColor });

    y -= 18;
  }

  // Summary Totals Box
  const discount = parseFloat(data.discount) || 0;
  const finalTotal = subtotal - discount + totalTax;

  y -= 15;
  const totalsX = PAGE_WIDTH - 220;
  page.drawText('Subtotal:', { x: totalsX, y, size: 9, font, color: grayColor });
  page.drawText(subtotal.toFixed(2), { x: PAGE_WIDTH - 80, y, size: 9, font, color: textColor });

  if (discount > 0) {
    y -= 14;
    page.drawText('Discount:', { x: totalsX, y, size: 9, font, color: grayColor });
    page.drawText(`-${discount.toFixed(2)}`, { x: PAGE_WIDTH - 80, y, size: 9, font, color: textColor });
  }

  y -= 14;
  page.drawText('Total GST / Tax:', { x: totalsX, y, size: 9, font, color: grayColor });
  page.drawText(totalTax.toFixed(2), { x: PAGE_WIDTH - 80, y, size: 9, font, color: textColor });

  y -= 18;
  page.drawRectangle({
    x: totalsX - 8,
    y: y - 6,
    width: 220 - 32,
    height: 22,
    color: PDFLib.rgb(0.93, 0.96, 1)
  });
  page.drawText('TOTAL DUE:', { x: totalsX, y, size: 10, font: bold, color: primaryColor });
  page.drawText(finalTotal.toFixed(2), { x: PAGE_WIDTH - 80, y, size: 11, font: bold, color: primaryColor });

  // Bank details & Signature block at bottom
  page.drawText('Bank Details:', { x: 40, y: 80, size: 8, font: bold, color: textColor });
  page.drawText(`Bank: ${data.bankName || 'HDFC Bank'} | A/C: ${data.bankAccount || '50200012345678'} | IFSC: ${data.bankIfsc || 'HDFC0001234'}`, { x: 40, y: 68, size: 8, font, color: grayColor });
  page.drawText('Authorized Signatory', { x: PAGE_WIDTH - 150, y: 60, size: 8, font: bold, color: textColor });
  page.drawLine({
    start: { x: PAGE_WIDTH - 150, y: 75 },
    end: { x: PAGE_WIDTH - 40, y: 75 },
    thickness: 1,
    color: grayColor
  });

  return await doc.save();
}

/**
 * 2. OFFER LETTER GENERATOR
 */
async function generateOfferLetterPdf(data) {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const primaryColor = PDFLib.rgb(0.08, 0.35, 0.7);
  const textColor = PDFLib.rgb(0.15, 0.15, 0.2);

  // Letterhead
  page.drawText(data.companyName || 'TECHCORP SOLUTIONS INC.', { x: 50, y: PAGE_HEIGHT - 60, size: 18, font: bold, color: primaryColor });
  page.drawText('Official Employment Offer Letter', { x: 50, y: PAGE_HEIGHT - 76, size: 10, font, color: PDFLib.rgb(0.4, 0.4, 0.4) });
  page.drawLine({ start: { x: 50, y: PAGE_HEIGHT - 85 }, end: { x: PAGE_WIDTH - 50, y: PAGE_HEIGHT - 85 }, thickness: 1.5, color: primaryColor });

  let y = PAGE_HEIGHT - 110;
  page.drawText(`Date: ${data.date || new Date().toISOString().slice(0, 10)}`, { x: 50, y, size: 9, font, color: textColor });
  y -= 20;

  page.drawText(`To,`, { x: 50, y, size: 9, font, color: textColor });
  y -= 14;
  page.drawText(data.candidateName || 'Candidate Name', { x: 50, y, size: 11, font: bold, color: textColor });
  y -= 14;
  page.drawText(data.candidateAddress || 'Candidate Address', { x: 50, y, size: 9, font, color: textColor });
  y -= 30;

  page.drawText(`Dear ${data.candidateName || 'Candidate'},`, { x: 50, y, size: 10, font: bold, color: textColor });
  y -= 20;

  const body1 = `We are pleased to offer you the position of ${data.position || 'Software Engineer'} in our ${data.department || 'Engineering'} Department at ${data.companyName || 'our company'}. We believe your skills and experience will be an ideal fit for our team.`;
  page.drawText(body1, { x: 50, y, size: 9, font, color: textColor, maxWidth: PAGE_WIDTH - 100, lineHeight: 14 });
  y -= 40;

  page.drawText('Key Terms of Employment:', { x: 50, y, size: 10, font: bold, color: primaryColor });
  y -= 18;

  const terms = [
    `• Position: ${data.position || 'Software Engineer'}`,
    `• Start Date: ${data.startDate || 'Immediate'}`,
    `• Annual Compensation (CTC): ${data.ctc || 'Rs. 12,00,000 per annum'}`,
    `• Reporting Manager: ${data.reportingTo || 'Engineering Director'}`,
    `• Work Location: ${data.location || 'Headquarters / Hybrid'}`,
    `• Probation Period: ${data.probation || '3 months'}`
  ];

  for (const t of terms) {
    page.drawText(t, { x: 60, y, size: 9, font, color: textColor });
    y -= 16;
  }

  y -= 15;
  const body2 = 'Please sign and return the duplicate copy of this letter within 5 business days to confirm your acceptance of this offer.';
  page.drawText(body2, { x: 50, y, size: 9, font, color: textColor, maxWidth: PAGE_WIDTH - 100, lineHeight: 14 });

  // Signatures
  y = 120;
  page.drawText('Sincerely,', { x: 50, y, size: 9, font, color: textColor });
  page.drawText(`For ${data.companyName || 'Company Name'}`, { x: 50, y: y - 14, size: 9, font: bold, color: textColor });
  page.drawText('Authorized Signatory', { x: 50, y: y - 55, size: 8, font, color: textColor });

  page.drawText('Candidate Acceptance:', { x: PAGE_WIDTH - 200, y, size: 9, font: bold, color: textColor });
  page.drawText('Signature: __________________', { x: PAGE_WIDTH - 200, y: y - 35, size: 8, font, color: textColor });
  page.drawText('Date: ________________________', { x: PAGE_WIDTH - 200, y: y - 55, size: 8, font, color: textColor });

  return await doc.save();
}

/**
 * 3. SALARY SLIP GENERATOR
 */
async function generateSalarySlipPdf(data) {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const primaryColor = PDFLib.rgb(0.1, 0.45, 0.75);
  const textColor = PDFLib.rgb(0.15, 0.15, 0.2);

  // Header
  page.drawText(data.companyName || 'ENTERPRISE TECH CORP', { x: 50, y: PAGE_HEIGHT - 55, size: 16, font: bold, color: primaryColor });
  page.drawText(`Payslip for the Month of ${data.monthYear || 'April 2026'}`, { x: 50, y: PAGE_HEIGHT - 72, size: 10, font: bold, color: textColor });

  // Employee details card
  let y = PAGE_HEIGHT - 95;
  page.drawRectangle({
    x: 40,
    y: y - 45,
    width: PAGE_WIDTH - 80,
    height: 45,
    color: PDFLib.rgb(0.97, 0.98, 0.99),
    borderColor: PDFLib.rgb(0.88, 0.9, 0.94),
    borderWidth: 1
  });

  page.drawText(`Employee Name: ${data.employeeName || 'John Doe'}`, { x: 50, y: y - 16, size: 8.5, font: bold, color: textColor });
  page.drawText(`Designation: ${data.designation || 'Senior Developer'}`, { x: 50, y: y - 32, size: 8.5, font, color: textColor });
  page.drawText(`Employee ID: ${data.employeeId || 'EMP-1042'}`, { x: 300, y: y - 16, size: 8.5, font: bold, color: textColor });
  page.drawText(`Working Days: ${data.workingDays || '30'}`, { x: 300, y: y - 32, size: 8.5, font, color: textColor });

  // Earnings & Deductions Tables (Side by side)
  y -= 65;
  const colWidth = (PAGE_WIDTH - 90) / 2;

  // Earnings Header
  page.drawRectangle({ x: 40, y: y - 18, width: colWidth, height: 18, color: primaryColor });
  page.drawText('EARNINGS', { x: 48, y: y - 13, size: 8, font: bold, color: PDFLib.rgb(1, 1, 1) });
  page.drawText('AMOUNT', { x: 40 + colWidth - 55, y: y - 13, size: 8, font: bold, color: PDFLib.rgb(1, 1, 1) });

  // Deductions Header
  page.drawRectangle({ x: 50 + colWidth, y: y - 18, width: colWidth, height: 18, color: PDFLib.rgb(0.8, 0.25, 0.25) });
  page.drawText('DEDUCTIONS', { x: 58 + colWidth, y: y - 13, size: 8, font: bold, color: PDFLib.rgb(1, 1, 1) });
  page.drawText('AMOUNT', { x: 50 + colWidth * 2 - 55, y: y - 13, size: 8, font: bold, color: PDFLib.rgb(1, 1, 1) });

  const earnings = data.earnings || [
    { label: 'Basic Salary', amount: 50000 },
    { label: 'HRA (House Rent)', amount: 20000 },
    { label: 'Special Allowance', amount: 15000 },
    { label: 'Conveyance', amount: 3000 }
  ];

  const deductions = data.deductions || [
    { label: 'Provident Fund (PF)', amount: 6000 },
    { label: 'Professional Tax', amount: 200 },
    { label: 'Income Tax (TDS)', amount: 5000 }
  ];

  const maxRows = Math.max(earnings.length, deductions.length);
  y -= 18;
  let totalEarn = 0;
  let totalDed = 0;

  for (let i = 0; i < maxRows; i++) {
    const e = earnings[i];
    const d = deductions[i];

    if (e) {
      totalEarn += parseFloat(e.amount) || 0;
      page.drawText(e.label, { x: 48, y: y - 12, size: 8, font, color: textColor });
      page.drawText(Number(e.amount).toFixed(2), { x: 40 + colWidth - 55, y: y - 12, size: 8, font, color: textColor });
    }
    if (d) {
      totalDed += parseFloat(d.amount) || 0;
      page.drawText(d.label, { x: 58 + colWidth, y: y - 12, size: 8, font, color: textColor });
      page.drawText(Number(d.amount).toFixed(2), { x: 50 + colWidth * 2 - 55, y: y - 12, size: 8, font, color: textColor });
    }
    y -= 16;
  }

  // Subtotals
  y -= 10;
  page.drawText(`Total Earnings: ${totalEarn.toFixed(2)}`, { x: 48, y, size: 9, font: bold, color: primaryColor });
  page.drawText(`Total Deductions: ${totalDed.toFixed(2)}`, { x: 58 + colWidth, y, size: 9, font: bold, color: PDFLib.rgb(0.8, 0.25, 0.25) });

  // Net Salary Highlight Box
  const netSalary = totalEarn - totalDed;
  y -= 30;
  page.drawRectangle({
    x: 40,
    y: y - 15,
    width: PAGE_WIDTH - 80,
    height: 30,
    color: PDFLib.rgb(0.92, 0.96, 1),
    borderColor: primaryColor,
    borderWidth: 1
  });
  page.drawText('NET TAKE-HOME SALARY:', { x: 55, y: y - 5, size: 10, font: bold, color: primaryColor });
  page.drawText(netSalary.toFixed(2), { x: PAGE_WIDTH - 150, y: y - 5, size: 12, font: bold, color: primaryColor });

  return await doc.save();
}

/**
 * 4. EXPERIENCE CERTIFICATE GENERATOR
 */
async function generateExperienceCertificatePdf(data) {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const primaryColor = PDFLib.rgb(0.12, 0.3, 0.55);

  page.drawText(data.companyName || 'GLOBAL CORP PRIVATE LIMITED', { x: 50, y: PAGE_HEIGHT - 65, size: 18, font: bold, color: primaryColor });
  page.drawLine({ start: { x: 50, y: PAGE_HEIGHT - 80 }, end: { x: PAGE_WIDTH - 50, y: PAGE_HEIGHT - 80 }, thickness: 2, color: primaryColor });

  let y = PAGE_HEIGHT - 120;
  page.drawText(`Date: ${data.date || new Date().toISOString().slice(0, 10)}`, { x: PAGE_WIDTH - 150, y, size: 9, font });

  y -= 40;
  page.drawText('TO WHOMSOEVER IT MAY CONCERN', { x: 160, y, size: 13, font: bold, color: primaryColor });

  y -= 40;
  const text = `This is to certify that ${data.employeeName || 'Employee Name'} was employed with ${data.companyName || 'our company'} from ${data.startDate || '01 Jan 2023'} to ${data.endDate || '31 Dec 2025'} as ${data.designation || 'Software Engineer'}.\n\nDuring their tenure, we found ${data.employeeName || 'them'} to be hardworking, dedicated, and sincere. Their conduct and performance were exemplary.\n\nWe wish them all the success in their future endeavors.`;
  page.drawText(text, { x: 50, y, size: 10, font, maxWidth: PAGE_WIDTH - 100, lineHeight: 18 });

  y = 120;
  page.drawText('Sincerely,', { x: 50, y, size: 9, font });
  page.drawText(`For ${data.companyName || 'Company Name'}`, { x: 50, y: y - 16, size: 9, font: bold });
  page.drawText('HR Director / Authorized Signatory', { x: 50, y: y - 55, size: 8, font });

  return await doc.save();
}

/**
 * 5. PURCHASE ORDER GENERATOR
 */
async function generatePurchaseOrderPdf(data) {
  // Reuses structured table layout
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  const primaryColor = PDFLib.rgb(0.18, 0.45, 0.35); // Forest green

  page.drawText('PURCHASE ORDER', { x: 40, y: 780, size: 20, font: bold, color: primaryColor });
  page.drawText(`PO #: ${data.poNumber || 'PO-2026-001'}`, { x: 40, y: 760, size: 10, font: bold });
  page.drawText(`Vendor: ${data.vendorName || 'Vendor Co'}`, { x: 40, y: 730, size: 10, font });
  page.drawText(`Delivery Date: ${data.deliveryDate || 'Within 14 Days'}`, { x: 40, y: 715, size: 9, font });

  page.drawText(`Total Order Value: ${data.totalValue || '$12,500.00'}`, { x: 40, y: 650, size: 12, font: bold, color: primaryColor });
  page.drawText('Authorized Signature: _______________________', { x: 40, y: 100, size: 9, font });

  return await doc.save();
}

/**
 * 6. QUOTATION GENERATOR
 */
async function generateQuotationPdf(data) {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  const primaryColor = PDFLib.rgb(0.5, 0.2, 0.65); // Purple accent

  page.drawText('PRICE QUOTATION', { x: 40, y: 780, size: 20, font: bold, color: primaryColor });
  page.drawText(`Quote #: ${data.quoteNumber || 'QTN-8801'}`, { x: 40, y: 760, size: 10, font: bold });
  page.drawText(`Valid Until: ${data.validUntil || '30 Days from Issue'}`, { x: 40, y: 745, size: 9, font });
  page.drawText(`Prepared For: ${data.clientName || 'Valued Client'}`, { x: 40, y: 720, size: 10, font });

  page.drawText(`Estimated Price: ${data.estimatedPrice || '$8,500.00'}`, { x: 40, y: 650, size: 12, font: bold, color: primaryColor });

  return await doc.save();
}

/**
 * 7. BULK DOCUMENT GENERATOR
 * Generates multiple personalized PDFs from CSV/Excel spreadsheet records without freezing the UI.
 * Returns zip bundle of all generated PDFs.
 */
async function generateBulkDocuments(templateType, rows, onProgress) {
  const generatedFiles = {};
  const total = rows.length;

  for (let i = 0; i < total; i++) {
    const row = rows[i];
    let pdfBytes;

    if (templateType === 'offer-letter') {
      pdfBytes = await generateOfferLetterPdf({
        candidateName: row.name || row.candidateName,
        position: row.position || row.designation,
        department: row.department,
        ctc: row.ctc || row.salary,
        startDate: row.startDate,
        companyName: row.companyName
      });
    } else if (templateType === 'salary-slip') {
      pdfBytes = await generateSalarySlipPdf({
        employeeName: row.name || row.employeeName,
        employeeId: row.employeeId || row.id,
        designation: row.designation || row.position,
        monthYear: row.month || row.monthYear,
        earnings: [
          { label: 'Basic Salary', amount: row.basic || 50000 },
          { label: 'Allowances', amount: row.allowances || 15000 }
        ],
        deductions: [
          { label: 'PF & Taxes', amount: row.deductions || 5000 }
        ]
      });
    } else if (templateType === 'experience-certificate') {
      pdfBytes = await generateExperienceCertificatePdf({
        employeeName: row.name,
        designation: row.designation,
        startDate: row.startDate,
        endDate: row.endDate,
        companyName: row.companyName
      });
    } else {
      // Default to invoice
      pdfBytes = await generateInvoicePdf({
        customerName: row.name || row.customerName,
        invoiceNumber: row.invoiceNumber || `INV-${String(i + 1).padStart(4, '0')}`,
        items: [{ description: row.description || 'Professional Services', qty: row.qty || 1, rate: row.amount || 1000 }]
      });
    }

    const safeName = (row.name || `doc-${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    generatedFiles[`${safeName}-${i + 1}.pdf`] = pdfBytes;

    if (onProgress) {
      onProgress({
        index: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100)
      });
    }
  }

  const zipBytes = createZip(generatedFiles);
  return { files: generatedFiles, zip: zipBytes, count: total };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateInvoicePdf,
    generateOfferLetterPdf,
    generateSalarySlipPdf,
    generateExperienceCertificatePdf,
    generatePurchaseOrderPdf,
    generateQuotationPdf,
    generateBulkDocuments
  };
}
if (typeof window !== 'undefined') {
  window.BusinessDocs = {
    generateInvoicePdf,
    generateOfferLetterPdf,
    generateSalarySlipPdf,
    generateExperienceCertificatePdf,
    generatePurchaseOrderPdf,
    generateQuotationPdf,
    generateBulkDocuments
  };
  Object.assign(window, window.BusinessDocs);
}

