'use strict';
/**
 * Invoice Data Extractor Engine
 * Extracts: Invoice Number, Vendor Name, GSTIN, Invoice Date, Due Date, Taxable Amount, GST Amount, Total Amount.
 * Supports batch processing and direct export to Excel (.xlsx).
 */

var buildXlsxXml = typeof require !== 'undefined' ? require('./office-converter.js').buildXlsxXml : (typeof window !== 'undefined' && window.OfficeConverter ? window.OfficeConverter.buildXlsxXml : null);

// Indian GSTIN standard format: 2 digit state code + 10 char PAN + 1 char entity + Z + 1 char check digit
const GSTIN_REGEX = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i;

// Invoice number regex patterns
const INVOICE_NUM_PATTERNS = [
  /\b(?:invoice|bill)\s*(?:number|num\.?|no\.?|#)\s*[:\-]?\s*([A-Za-z0-9\/\-_]{3,30})/i,
  /\b(?:inv|bill)\s*#\s*[:\-]?\s*([A-Za-z0-9\/\-_]{3,30})/i,
  /\b(INV[-_/][0-9]{3,10}[A-Za-z0-9\-_]*)\b/i
];

// Date regex patterns
const DATE_PATTERNS = [
  /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/,
  /\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/,
  /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{2,4})\b/i
];

// Amount regex patterns (Currency symbol optional)
const AMOUNT_PATTERNS = {
  total: /(?:total\s*(?:amount|due|payable)?|grand\s*total|net\s*payable|amount\s*due)\s*[:\-]?\s*(?:[₹$€£]|INR|USD)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
  taxable: /(?:taxable\s*(?:amount|value)|sub\s*total|subtotal)\s*[:\-]?\s*(?:[₹$€£]|INR|USD)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
  gst: /(?:total\s*gst|gst\s*amount|cgst\s*\+\s*sgst|tax\s*amount|vat)\s*[:\-]?\s*(?:[₹$€£]|INR|USD)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
};

/**
 * Extracts structured fields from raw text string
 */
function extractInvoiceFieldsFromText(text, filename = 'document.pdf') {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = {
    filename,
    invoiceNumber: '',
    vendorName: '',
    gstin: '',
    invoiceDate: '',
    dueDate: '',
    taxableAmount: '',
    gstAmount: '',
    totalAmount: '',
    confidence: 0
  };

  let confidenceScore = 0;

  // 1. GSTIN
  const gstinMatch = text.match(GSTIN_REGEX);
  if (gstinMatch) {
    result.gstin = gstinMatch[1].toUpperCase();
    confidenceScore += 25;
  }

  // 2. Invoice Number
  for (const pat of INVOICE_NUM_PATTERNS) {
    const match = text.match(pat);
    if (match) {
      result.invoiceNumber = match[1].trim();
      confidenceScore += 25;
      break;
    }
  }

  // 3. Vendor Name (Typically first prominent non-empty line or line before GSTIN)
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i];
    if (
      !line.match(/invoice|tax|bill|date|gstin|phone|email/i) &&
      line.length >= 3 &&
      line.length <= 60
    ) {
      result.vendorName = line;
      confidenceScore += 15;
      break;
    }
  }

  // 4. Invoice Date and Due Date
  const invDateMatch = text.match(/(?:invoice\s*date|date\s*of\s*issue|bill\s*date)\s*[:\-]?\s*([A-Za-z0-9\/\-\. ,]{6,25})/i);
  if (invDateMatch) {
    result.invoiceDate = invDateMatch[1].trim();
    confidenceScore += 10;
  } else {
    // Fallback first date match
    const firstDate = text.match(DATE_PATTERNS[0]);
    if (firstDate) {
      result.invoiceDate = firstDate[1];
      confidenceScore += 5;
    }
  }

  const dueDateMatch = text.match(/(?:due\s*date|payment\s*due)\s*[:\-]?\s*([A-Za-z0-9\/\-\. ,]{6,25})/i);
  if (dueDateMatch) {
    result.dueDate = dueDateMatch[1].trim();
    confidenceScore += 5;
  }

  // 5. Total, Taxable, and GST Amounts
  const totalMatch = text.match(AMOUNT_PATTERNS.total);
  if (totalMatch) {
    result.totalAmount = totalMatch[1].replace(/,/g, '');
    confidenceScore += 20;
  }

  const taxableMatch = text.match(AMOUNT_PATTERNS.taxable);
  if (taxableMatch) {
    result.taxableAmount = taxableMatch[1].replace(/,/g, '');
  }

  const gstMatch = text.match(AMOUNT_PATTERNS.gst);
  if (gstMatch) {
    result.gstAmount = gstMatch[1].replace(/,/g, '');
  } else if (result.totalAmount && result.taxableAmount) {
    // Calculate difference if both present
    const diff = parseFloat(result.totalAmount) - parseFloat(result.taxableAmount);
    if (diff > 0) result.gstAmount = diff.toFixed(2);
  }

  result.confidence = Math.min(100, confidenceScore);
  return result;
}

/**
 * Extract data from a PDF document
 */
async function extractInvoiceFromPdf(pdfBytes, filename = 'invoice.pdf', pdfjsLib) {
  if (!pdfjsLib) {
    if (typeof window !== 'undefined' && window.pdfjsLib) pdfjsLib = window.pdfjsLib;
    else {
      const textDecoder = new TextDecoder('latin1');
      const raw = textDecoder.decode(pdfBytes);
      return extractInvoiceFieldsFromText(raw, filename);
    }
  }

  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  let fullText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(it => it.str).join(' ');
    fullText += pageText + '\n';
  }

  return extractInvoiceFieldsFromText(fullText, filename);
}

/**
 * Batch extract data from multiple PDF invoices
 * invoices: Array of { data: Uint8Array, filename: string }
 */
async function batchExtractInvoices(invoices, onProgress, pdfjsLib) {
  const results = [];
  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    const data = await extractInvoiceFromPdf(inv.data, inv.filename, pdfjsLib);
    results.push(data);
    if (onProgress) {
      onProgress({
        index: i + 1,
        total: invoices.length,
        currentFile: inv.filename,
        percent: Math.round(((i + 1) / invoices.length) * 100)
      });
    }
  }
  return results;
}

/**
 * Export extracted invoice records to Excel spreadsheet (.xlsx)
 */
function exportInvoicesToExcel(records) {
  const headers = [
    'Filename',
    'Invoice Number',
    'Vendor Name',
    'GSTIN',
    'Invoice Date',
    'Due Date',
    'Taxable Amount',
    'GST Amount',
    'Total Amount',
    'Confidence (%)'
  ];

  const rows = [headers];
  for (const r of records) {
    rows.push([
      r.filename || '',
      r.invoiceNumber || '',
      r.vendorName || '',
      r.gstin || '',
      r.invoiceDate || '',
      r.dueDate || '',
      r.taxableAmount || '',
      r.gstAmount || '',
      r.totalAmount || '',
      String(r.confidence || 0)
    ]);
  }

  return buildXlsxXml(rows);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GSTIN_REGEX,
    extractInvoiceFieldsFromText,
    extractInvoiceData: extractInvoiceFieldsFromText,
    extractInvoiceFromPdf,
    batchExtractInvoices,
    exportInvoicesToExcel
  };
}
if (typeof window !== 'undefined') {
  window.InvoiceExtractor = {
    GSTIN_REGEX,
    extractInvoiceFieldsFromText,
    extractInvoiceData: extractInvoiceFieldsFromText,
    extractInvoiceFromPdf,
    batchExtractInvoices,
    exportInvoicesToExcel
  };
  Object.assign(window, window.InvoiceExtractor);
}
