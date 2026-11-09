'use strict';
const fs = require('fs');
const path = require('path');

function createPdf(pageCount, titlePrefix = 'Doc') {
  const objs = [];
  function addObj(id, content) {
    objs.push({ id, content, offset: 0 });
  }

  // Font
  addObj(1, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  addObj(2, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);

  const pageObjIds = [];
  let nextId = 3;

  for (let p = 1; p <= pageCount; p++) {
    const textLines = [
      'BT',
      '/FB 18 Tf',
      '50 780 Td',
      `(${titlePrefix} - Page ${p} of ${pageCount}) Tj`,
      'ET',
      'BT',
      '/F 12 Tf',
      '50 740 Td',
      `(${titlePrefix} body paragraph on page ${p}. Performance verification file.) Tj`,
      'ET'
    ];
    const stream = textLines.join('\n');
    const streamBuf = Buffer.from(stream, 'latin1');
    const contentId = nextId++;
    addObj(contentId, `<< /Length ${streamBuf.length} >>\nstream\n${stream}\nendstream`);

    const pageId = nextId++;
    pageObjIds.push(pageId);
    // parent will be pagesId
  }

  const pagesId = nextId++;
  const catalogId = nextId++;

  for (let i = 0; i < pageCount; i++) {
    const pageId = pageObjIds[i];
    const contentId = 3 + i * 2;
    addObj(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F 1 0 R /FB 2 0 R >> >> >>`);
  }

  const kidsStr = pageObjIds.map(id => `${id} 0 R`).join(' ');
  addObj(pagesId, `<< /Type /Pages /Kids [${kidsStr}] /Count ${pageCount} >>`);
  addObj(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  // Build binary
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

  const trailer = `trailer\n<< /Size ${xrefCount} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(header + body + xref + trailer, 'latin1');
}

const testDir = path.join(__dirname, 'test-files');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

// 1. Generate 25 small PDFs
let totalPages = 0;
const manifest = [];
for (let i = 1; i <= 25; i++) {
  // varying page counts: 1, 2, or 3 pages
  const pages = (i % 3) + 1;
  totalPages += pages;
  const fileName = `sample-${String(i).padStart(2, '0')}.pdf`;
  const pdfBytes = createPdf(pages, `Sample ${i}`);
  fs.writeFileSync(path.join(testDir, fileName), pdfBytes);
  manifest.push({ fileName, pages, bytes: pdfBytes.length });
}
console.log(`Generated 25 test PDFs in ${testDir}. Total pages: ${totalPages}`);

// 2. Generate 100-page PDF
console.log('Generating 100-page PDF...');
const hundredBytes = createPdf(100, 'Big100');
fs.writeFileSync(path.join(testDir, 'test-100pages.pdf'), hundredBytes);
console.log(`Generated test-100pages.pdf (${hundredBytes.length} bytes, 100 pages).`);

fs.writeFileSync(path.join(testDir, 'manifest.json'), JSON.stringify({ totalPages, files: manifest }, null, 2));

