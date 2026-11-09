'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const PDFLib = require('./lib/pdf-lib.min.js');
const fontkit = require('./lib/fontkit.umd.min.js');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const testDir = path.resolve(__dirname, 'test-files');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

// Standard RC4 encryption for PDF 10: password-protected PDF
const PAD = Buffer.from([
  0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41,
  0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
  0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
  0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A
]);

function padPassword(pwd) {
  const buf = Buffer.alloc(32);
  const pBuf = Buffer.from(pwd, 'latin1');
  pBuf.copy(buf, 0, 0, Math.min(pBuf.length, 32));
  if (pBuf.length < 32) PAD.copy(buf, pBuf.length, 0, 32 - pBuf.length);
  return buf;
}

function rc4(key, data) {
  const s = [];
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
  }
  let i = 0; j = 0;
  const out = Buffer.alloc(data.length);
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
    out[k] = data[k] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

function makeEncryptedPdf(userPassword) {
  const docId = crypto.createHash('md5').update('docId1234567890').digest();
  const P = -44;
  const pBuf = Buffer.alloc(4);
  pBuf.writeInt32LE(P, 0);

  const ownerPad = padPassword(userPassword);
  const ownerHash = crypto.createHash('md5').update(ownerPad).digest().slice(0, 5);
  const userPad = padPassword(userPassword);
  const O = rc4(ownerHash, userPad);

  const fileHash = crypto.createHash('md5')
    .update(userPad)
    .update(O)
    .update(pBuf)
    .update(docId)
    .digest();
  const fileKey = fileHash.slice(0, 5);
  const U = rc4(fileKey, PAD);

  function encryptObj(objNum, genNum, data) {
    const oBuf = Buffer.alloc(5);
    oBuf.writeUIntLE(objNum, 0, 3);
    oBuf.writeUIntLE(genNum, 3, 2);
    const objKey = crypto.createHash('md5').update(Buffer.concat([fileKey, oBuf])).digest().slice(0, 10);
    return rc4(objKey, data);
  }

  const objs = [];
  function add(id, str) { objs.push({ id, buf: Buffer.from(str, 'latin1') }); }

  add(1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const contentStream = 'BT /F1 20 Tf 60 720 Td (Confidential Unlocked Document) Tj ET\nBT /F1 12 Tf 60 680 Td (Password security verified: secret123) Tj ET';
  const encStream = encryptObj(2, 0, Buffer.from(contentStream, 'latin1'));
  add(2, '<< /Length ' + encStream.length + ' >>\nstream\n' + encStream.toString('latin1') + '\nendstream');
  add(3, '<< /Type /Page /Parent 4 0 R /MediaBox [0 0 600 800] /Contents 2 0 R /Resources << /Font << /F1 1 0 R >> >> >>');
  add(4, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  add(5, '<< /Type /Catalog /Pages 4 0 R >>');
  add(6, '<< /Filter /Standard /V 1 /R 2 /O <' + O.toString('hex') + '> /U <' + U.toString('hex') + '> /P ' + P + ' >>');

  const header = '%PDF-1.4\n';
  let body = '';
  const offsets = {};
  for (const obj of objs) {
    offsets[obj.id] = header.length + body.length;
    body += obj.id + ' 0 obj\n' + obj.buf.toString('latin1') + '\nendobj\n';
  }
  const xrefOffset = header.length + body.length;
  let xref = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
  for (const obj of objs) {
    xref += String(offsets[obj.id]).padStart(10, '0') + ' 00000 n \n';
  }
  const idHex = docId.toString('hex');
  const trailer = 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 5 0 R /Encrypt 6 0 R /ID [<' + idHex + '><' + idHex + '>] >>\nstartxref\n' + xrefOffset + '\n%%EOF\n';
  return Buffer.from(header + body + xref + trailer, 'latin1');
}

async function generateAll() {
  console.log('Generating 12 test PDFs in test-files/ ...');

  // ========================================================
  // 1. Word-style: Times, a header with two columns, bold labels
  // ========================================================
  {
    const doc = await PDFLib.PDFDocument.create();
    const times = await doc.embedFont(PDFLib.StandardFonts.TimesRoman);
    const timesBold = await doc.embedFont(PDFLib.StandardFonts.TimesRomanBold);
    const page = doc.addPage([612, 792]);

    page.drawText('Don Bosco University Assignment', { x: 50, y: 730, size: 20, font: timesBold });
    page.drawText('Department of Computer Applications', { x: 50, y: 705, size: 13, font: times });

    // Left Column
    page.drawText('Student Name:', { x: 50, y: 650, size: 12, font: timesBold });
    page.drawText('John Doe', { x: 140, y: 650, size: 12, font: times });
    page.drawText('Course Code:', { x: 50, y: 625, size: 12, font: timesBold });
    page.drawText('CS-502', { x: 140, y: 625, size: 12, font: times });

    // Right Column
    page.drawText('Roll Number:', { x: 330, y: 650, size: 12, font: timesBold });
    page.drawText('DBU-2026-981', { x: 420, y: 650, size: 12, font: times });
    page.drawText('Submission Date:', { x: 330, y: 625, size: 12, font: timesBold });
    page.drawText('November 5, 2026', { x: 435, y: 625, size: 12, font: times });

    page.drawText('Assignment Description:', { x: 50, y: 570, size: 14, font: timesBold });
    page.drawText('This assignment requires implementation of high performance vector editing across varied PDF layouts.', { x: 50, y: 545, size: 11, font: times });

    const bytes = await doc.save();
    fs.writeFileSync(path.join(testDir, '1-word-style.pdf'), bytes);
    console.log('1. Generated 1-word-style.pdf');
  }

  // ========================================================
  // 2. Chrome-printed HTML page with web fonts, table, bullet list
  // ========================================================
  {
    const htmlPath = path.join(testDir, 'chrome-temp.html');
    const pdfPath = path.join(testDir, '2-chrome-printed.pdf');
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Chrome Printed Document</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #222; }
    h1 { color: #0f172a; border-bottom: 2px solid #38bdf8; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    ul { line-height: 1.8; }
  </style>
</head>
<body>
  <h1>Quarterly Engineering Report</h1>
  <p>Performance benchmarks across enterprise web client modules:</p>
  <table>
    <thead>
      <tr><th>Module</th><th>Latency</th><th>Throughput</th><th>Status</th></tr>
    </thead>
    <tbody>
      <tr><td>Vector Renderer</td><td>12 ms</td><td>850 ops/sec</td><td>Verified</td></tr>
      <tr><td>Font Subset Engine</td><td>18 ms</td><td>620 ops/sec</td><td>Active</td></tr>
      <tr><td>OCR Extraction</td><td>145 ms</td><td>95 ops/sec</td><td>Operational</td></tr>
    </tbody>
  </table>
  <h3>Key Achievements:</h3>
  <ul>
    <li>Engineered zero-server PDF client architecture</li>
    <li>Integrated full Unicode vector font embedding</li>
    <li>Achieved 60fps virtualization across 100 pages</li>
  </ul>
</body>
</html>`;
    fs.writeFileSync(htmlPath, html, 'utf8');
    spawnSync(chromePath, [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      `--user-data-dir=${path.resolve('.chrome-profile-print')}`,
      `--print-to-pdf=${pdfPath}`,
      `file:///${htmlPath.replace(/\\/g, '/')}`
    ]);
    console.log('2. Generated 2-chrome-printed.pdf');
  }

  // ========================================================
  // 3. Helvetica and Courier text, tiny 7pt footnotes, 40pt title
  // ========================================================
  {
    const doc = await PDFLib.PDFDocument.create();
    const helv = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const helvBold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const courier = await doc.embedFont(PDFLib.StandardFonts.Courier);
    const page = doc.addPage([600, 800]);

    page.drawText('BIG HEADLINE', { x: 50, y: 720, size: 40, font: helvBold });
    page.drawText('Standard Helvetica body paragraph explaining precision typography scales.', { x: 50, y: 670, size: 12, font: helv });

    page.drawText('Code Implementation:', { x: 50, y: 620, size: 14, font: helvBold });
    page.drawText('const result = computeExactBaseline(x, y);', { x: 60, y: 590, size: 12, font: courier });
    page.drawText('return Math.abs(result.baseline - target) <= 1.0;', { x: 60, y: 570, size: 12, font: courier });

    page.drawText('Footnote 1: Verified under strict 7pt boundary rules.', { x: 50, y: 60, size: 7, font: helv });

    const bytes = await doc.save();
    fs.writeFileSync(path.join(testDir, '3-fonts-sizes.pdf'), bytes);
    console.log('3. Generated 3-fonts-sizes.pdf');
  }

  // ========================================================
  // 4. Page /Rotate 90 and another with /Rotate 270
  // ========================================================
  {
    const doc = await PDFLib.PDFDocument.create();
    const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);

    // Page 1 rotated 90
    const page1 = doc.addPage([600, 400]);
    page1.setRotation(PDFLib.degrees(90));
    page1.drawText('Landscape Page Rotated 90 Degrees', { x: 80, y: 200, size: 22, font });

    // Page 2 rotated 270
    const page2 = doc.addPage([600, 400]);
    page2.setRotation(PDFLib.degrees(270));
    page2.drawText('Landscape Page Rotated 270 Degrees', { x: 80, y: 200, size: 22, font });

    const bytes = await doc.save();
    fs.writeFileSync(path.join(testDir, '4-rotated-pages.pdf'), bytes);
    console.log('4. Generated 4-rotated-pages.pdf');
  }

  // ========================================================
  // 5. CropBox with a non-zero origin
  // ========================================================
  {
    const doc = await PDFLib.PDFDocument.create();
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const page = doc.addPage([600, 800]);

    // CropBox offset by (50, 60) with dimensions 500x700
    page.setCropBox(50, 60, 500, 700);
    page.drawText('Non-Zero Origin CropBox Document', { x: 100, y: 700, size: 20, font: fontBold });
    page.drawText('Active user space is translated by CropBox [50, 60, 550, 760].', { x: 100, y: 660, size: 12, font });
    page.drawText('Target Edit Box: Numeric Value 9845', { x: 100, y: 600, size: 14, font });

    const bytes = await doc.save();
    fs.writeFileSync(path.join(testDir, '5-cropbox-origin.pdf'), bytes);
    console.log('5. Generated 5-cropbox-origin.pdf');
  }

  // ========================================================
  // 6. Rotated text at 45 degrees and vertical text
  // ========================================================
  {
    const doc = await PDFLib.PDFDocument.create();
    const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const fontReg = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const page = doc.addPage([600, 600]);

    page.drawText('Horizontal Header Reference', { x: 50, y: 540, size: 16, font: fontReg });

    // 45 degrees rotated text
    page.drawText('Rotated 45 Degrees Text Box', {
      x: 120,
      y: 280,
      size: 20,
      font,
      rotate: PDFLib.degrees(45),
      color: PDFLib.rgb(0.08, 0.4, 0.75)
    });

    // Vertical text (90 degrees)
    page.drawText('Vertical 90 Degrees Segment', {
      x: 480,
      y: 150,
      size: 18,
      font,
      rotate: PDFLib.degrees(90),
      color: PDFLib.rgb(0.8, 0.2, 0.1)
    });

    const bytes = await doc.save();
    fs.writeFileSync(path.join(testDir, '6-rotated-text.pdf'), bytes);
    console.log('6. Generated 6-rotated-text.pdf');
  }

  // ========================================================
  // 7. Hindi (Devanagari) text and Arabic (RTL) text
  // ========================================================
  {
    const doc = await PDFLib.PDFDocument.create();
    doc.registerFontkit(fontkit);

    const devFontBytes = fs.readFileSync(path.join(__dirname, 'fonts', 'NotoSansDevanagari-Regular.ttf'));
    const arabFontBytes = fs.readFileSync(path.join(__dirname, 'fonts', 'NotoSansArabic-Regular.ttf'));
    const helv = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);

    const devFont = await doc.embedFont(devFontBytes, { subset: true });
    const arabFont = await doc.embedFont(arabFontBytes, { subset: true });

    const page = doc.addPage([600, 700]);
    page.drawText('Multilingual Wide Character Document', { x: 50, y: 640, size: 20, font: helv });

    page.drawText('Devanagari (Hindi):', { x: 50, y: 580, size: 14, font: helv });
    page.drawText('नमस्ते दुनिया यह एक परीक्षण दस्तावेज़ है', { x: 50, y: 545, size: 18, font: devFont });

    page.drawText('Arabic (RTL):', { x: 50, y: 470, size: 14, font: helv });
    page.drawText('مرحبا بكم في محرر المستندات العربي', { x: 50, y: 435, size: 18, font: arabFont });

    const bytes = await doc.save();
    fs.writeFileSync(path.join(testDir, '7-multilingual.pdf'), bytes);
    console.log('7. Generated 7-multilingual.pdf');
  }

  // ========================================================
  // 8. Scanned PDF (render a page to PNG and wrap it in a PDF with no text layer)
  // ========================================================
  {
    const zlib = require('zlib');
    function crc32(buf) {
      let c = 0xffffffff;
      for (let i = 0; i < buf.length; i++) {
        c ^= buf[i];
        for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
      }
      return (c ^ 0xffffffff) >>> 0;
    }
    function makeChunk(type, data) {
      const typeBuf = Buffer.from(type);
      const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
      const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
      return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
    }
    function makeRasterPng(w, h) {
      const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
      ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
      const raw = Buffer.alloc(h * (1 + w * 3));
      for (let y = 0; y < h; y++) {
        const rowOffset = y * (1 + w * 3);
        raw[rowOffset] = 0;
        for (let x = 0; x < w; x++) {
          const px = rowOffset + 1 + x * 3;
          raw[px] = 252; raw[px + 1] = 252; raw[px + 2] = 250;
        }
      }
      function drawRect(rx, ry, rw, rh) {
        for (let y = ry; y < ry + rh && y < h; y++) {
          const rowOffset = y * (1 + w * 3);
          for (let x = rx; x < rx + rw && x < w; x++) {
            const px = rowOffset + 1 + x * 3;
            raw[px] = 25; raw[px + 1] = 25; raw[px + 2] = 25;
          }
        }
      }
      // Draw headline block & line rows
      drawRect(50, 60, 280, 26);
      for (let i = 0; i < 7; i++) {
        drawRect(50, 140 + i * 42, 190, 16);
        drawRect(280, 140 + i * 42, 130, 16);
      }
      const idat = zlib.deflateSync(raw);
      return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', idat), makeChunk('IEND', Buffer.alloc(0))]);
    }

    const pngBytes = makeRasterPng(600, 800);
    const doc = await PDFLib.PDFDocument.create();
    const pdfImg = await doc.embedPng(pngBytes);
    const page = doc.addPage([600, 800]);
    page.drawImage(pdfImg, { x: 0, y: 0, width: 600, height: 800 });

    const bytes = await doc.save();
    fs.writeFileSync(path.join(testDir, '8-scanned-doc.pdf'), bytes);
    console.log('8. Generated 8-scanned-doc.pdf');
  }

  // ========================================================
  // 9. A two-column article layout
  // ========================================================
  {
    const doc = await PDFLib.PDFDocument.create();
    const font = await doc.embedFont(PDFLib.StandardFonts.TimesRoman);
    const fontBold = await doc.embedFont(PDFLib.StandardFonts.TimesRomanBold);
    const page = doc.addPage([600, 800]);

    page.drawText('Parallel Multi-Column Article Layout', { x: 50, y: 730, size: 22, font: fontBold });

    // Column 1 (Left: x=50 to 270)
    page.drawText('Section 1: Architecture', { x: 50, y: 680, size: 14, font: fontBold });
    page.drawText('Modern web engines utilize dedicated raster threads', { x: 50, y: 655, size: 10.5, font });
    page.drawText('and offscreen framebuffers to ensure consistent throughput.', { x: 50, y: 640, size: 10.5, font });
    page.drawText('Segments are isolated into distinct column boundaries.', { x: 50, y: 625, size: 10.5, font });

    // Column 2 (Right: x=320 to 550, gap=50pt > 8% page width)
    page.drawText('Section 2: Verification', { x: 330, y: 680, size: 14, font: fontBold });
    page.drawText('Independent text extraction guarantees column integrity', { x: 330, y: 655, size: 10.5, font });
    page.drawText('without cross-merging between horizontal neighbors.', { x: 330, y: 640, size: 10.5, font });
    page.drawText('Edits on column two remain isolated and precise.', { x: 330, y: 625, size: 10.5, font });

    const bytes = await doc.save();
    fs.writeFileSync(path.join(testDir, '9-two-column.pdf'), bytes);
    console.log('9. Generated 9-two-column.pdf');
  }

  // ========================================================
  // 10. A password-protected PDF
  // ========================================================
  {
    const encBytes = makeEncryptedPdf('secret123');
    fs.writeFileSync(path.join(testDir, '10-encrypted.pdf'), encBytes);
    console.log('10. Generated 10-encrypted.pdf (Password: secret123)');
  }

  // ========================================================
  // 11. A 100-page PDF
  // ========================================================
  {
    if (fs.existsSync(path.join(testDir, 'test-100pages.pdf'))) {
      fs.copyFileSync(path.join(testDir, 'test-100pages.pdf'), path.join(testDir, '11-hundred-pages.pdf'));
    } else {
      const doc = await PDFLib.PDFDocument.create();
      const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      for (let i = 1; i <= 100; i++) {
        const p = doc.addPage([595, 842]);
        p.drawText(`Document Page ${i} of 100`, { x: 50, y: 780, size: 18, font });
        p.drawText(`Virtualization test benchmark body paragraph on page ${i}.`, { x: 50, y: 740, size: 12, font });
      }
      fs.writeFileSync(path.join(testDir, '11-hundred-pages.pdf'), await doc.save());
    }
    console.log('11. Generated 11-hundred-pages.pdf');
  }

  // ========================================================
  // 12. Text with ligatures, superscripts and special symbols
  // ========================================================
  {
    const doc = await PDFLib.PDFDocument.create();
    doc.registerFontkit(fontkit);

    const notoBytes = fs.readFileSync(path.join(__dirname, 'fonts', 'NotoSans-Regular.ttf'));
    const notoFont = await doc.embedFont(notoBytes, { subset: true });
    const helv = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);

    const page = doc.addPage([600, 750]);

    page.drawText('Ligatures, Superscripts & Symbols', { x: 50, y: 680, size: 20, font: helv });
    page.drawText('Ligatures: office, afflict, fjord, first, flying', { x: 50, y: 630, size: 14, font: notoFont });
    page.drawText('Superscripts & Subscripts: E = mc², H₂O, x³ + y³ = z³', { x: 50, y: 580, size: 14, font: notoFont });
    page.drawText('Symbols: • Bullet points → Arrows ↔ Indicators ± Tolerance ≤ Limits', { x: 50, y: 530, size: 13, font: notoFont });

    const bytes = await doc.save();
    fs.writeFileSync(path.join(testDir, '12-special-symbols.pdf'), bytes);
    console.log('12. Generated 12-special-symbols.pdf');
  }

  console.log('Corpus generation finished successfully!');
}

generateAll().catch(e => {
  console.error(e);
  process.exit(1);
});
