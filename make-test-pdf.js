/**
 * make-test-pdf.js
 * Creates test.pdf using pdf-lib (Node.js).
 * Run: node make-test-pdf.js
 * Uses the pdf-lib CDN bundle via dynamic import or falls back to inline PDF bytes.
 * Since pdf-lib may not be installed, we build a minimal valid PDF manually.
 */

'use strict';
const fs = require('fs');

// Build a minimal PDF manually using raw PDF syntax
// This avoids needing any npm package
function buildPdf() {
  const lines = [];
  const objs = [];
  
  function addObj(id, content) {
    objs.push({ id, content, offset: 0 });
  }

  // Font (Helvetica)
  addObj(1, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  // Font Bold
  addObj(2, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);

  // Page content stream
  const contentLines = [];
  
  function pdfStr(s) {
    // Encode string as PDF literal
    return '(' + s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)') + ')';
  }

  function textAt(x, y, text, fontSize, fontName) {
    contentLines.push('BT');
    contentLines.push(`/${fontName} ${fontSize} Tf`);
    contentLines.push(`${x} ${y} Td`);
    contentLines.push(`${pdfStr(text)} Tj`);
    contentLines.push('ET');
  }

  // Set text colour to black
  contentLines.push('0 0 0 rg');

  const L = 60;
  let y = 750;

  // Header fields
  textAt(L, y, 'Name:', 14, 'FB');
  textAt(L + 90, y, 'Rahul Sharma', 14, 'F');
  y -= 28;
  textAt(L, y, 'Roll No:', 14, 'FB');
  textAt(L + 90, y, '21045', 14, 'F');
  y -= 28;
  textAt(L, y, 'Class:', 14, 'FB');
  textAt(L + 90, y, '10-B', 14, 'F');

  y -= 40;

  // Paragraph
  const paraLines = [
    'This assignment covers the topics discussed in Chapter 5.',
    'Students are expected to show all working in their answers.',
    'Late submissions will not be accepted.',
  ];
  for (const line of paraLines) {
    textAt(L, y, line, 12, 'F');
    y -= 22;
  }

  const streamContent = contentLines.join('\n');
  const streamBytes = Buffer.from(streamContent, 'latin1');

  addObj(3, `<< /Length ${streamBytes.length} >>\nstream\n` + streamContent + `\nendstream`);

  // Page
  addObj(4, `<< /Type /Page /Parent 5 0 R /MediaBox [0 0 595 842] /Contents 3 0 R /Resources << /Font << /F 1 0 R /FB 2 0 R >> >> >>`);

  // Pages
  addObj(5, `<< /Type /Pages /Kids [4 0 R] /Count 1 >>`);

  // Catalog
  addObj(6, `<< /Type /Catalog /Pages 5 0 R >>`);

  // Build PDF binary
  const header = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  let body = '';
  const offsets = {};

  for (const obj of objs) {
    offsets[obj.id] = header.length + body.length;
    body += `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
  }

  const xrefOffset = header.length + body.length;
  const xrefCount = objs.length + 1;

  let xref = `xref\n0 ${xrefCount}\n0000000000 65535 f \n`;
  for (const obj of objs) {
    xref += String(offsets[obj.id]).padStart(10, '0') + ' 00000 n \n';
  }

  const trailer = `trailer\n<< /Size ${xrefCount} /Root 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(header + body + xref + trailer, 'latin1');
}

const pdfBytes = buildPdf();
fs.writeFileSync('test.pdf', pdfBytes);
console.log('test.pdf created successfully (' + pdfBytes.length + ' bytes).');
