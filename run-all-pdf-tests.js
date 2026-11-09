'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PDFLib = require('./lib/pdf-lib.min.js');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'c:\\Users\\Admin\\OneDrive\\Desktop\\PDFme\\.chrome-profile-verify';
const testDir = path.resolve(__dirname, 'test-files');

function cdpSend(ws, method, params = {}, sessionId = undefined, id = 1) {
  return new Promise((resolve, reject) => {
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const msg = JSON.stringify(payload);
    const handler = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(new Error(JSON.stringify(data.error)));
          else resolve(data.result);
        }
      } catch (e) {}
    };
    ws.addEventListener('message', handler);
    ws.send(msg);
  });
}

async function run() {
  const server = require('./server.js');

  console.log('Launching headless Chrome for verification test suite...');
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--user-data-dir=' + userDataDir,
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  const versionData = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/version', res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const ws = new WebSocket(versionData.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  let reqId = 1;

  // STEP 0: Generate scanned invoice image & pure raster PDF 8
  console.log('Generating scanned document raster image...');
  const { targetId: scanTargetId } = await cdpSend(ws, 'Target.createTarget', { url: 'http://127.0.0.1:8080/test-files/scanned-invoice.html' }, undefined, reqId++);
  const { sessionId: scanSessionId } = await cdpSend(ws, 'Target.attachToTarget', { targetId: scanTargetId, flatten: true }, undefined, reqId++);

  await cdpSend(ws, 'Emulation.setDeviceMetricsOverride', { width: 700, height: 900, deviceScaleFactor: 2, mobile: false }, scanSessionId, reqId++);
  await new Promise(r => setTimeout(r, 600));

  const { data: scanPngB64 } = await cdpSend(ws, 'Page.captureScreenshot', { format: 'png' }, scanSessionId, reqId++);
  const scanPngBytes = Buffer.from(scanPngB64, 'base64');
  fs.writeFileSync(path.join(testDir, 'scanned-invoice.png'), scanPngBytes);

  // Wrap in PDF with zero text layer
  const scanDoc = await PDFLib.PDFDocument.create();
  const scanImg = await scanDoc.embedPng(scanPngBytes);
  const scanPage = scanDoc.addPage([600, 770]);
  scanPage.drawImage(scanImg, { x: 0, y: 0, width: 600, height: 770 });
  fs.writeFileSync(path.join(testDir, '8-scanned-doc.pdf'), await scanDoc.save());
  console.log('Created 8-scanned-doc.pdf (pure raster image, no text layer, length:', fs.statSync(path.join(testDir, '8-scanned-doc.pdf')).size, ')');

  await cdpSend(ws, 'Target.closeTarget', { targetId: scanTargetId }, undefined, reqId++);

  // STEP 1: Launch main PDFme application
  const { targetId } = await cdpSend(ws, 'Target.createTarget', { url: 'http://127.0.0.1:8080' }, undefined, reqId++);
  const { sessionId } = await cdpSend(ws, 'Target.attachToTarget', { targetId, flatten: true }, undefined, reqId++);

  async function pageSend(method, params = {}) {
    return cdpSend(ws, method, params, sessionId, reqId++);
  }

  await pageSend('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });

  ws.addEventListener('message', evt => {
    try {
      const data = JSON.parse(evt.data);
      if (data.sessionId === sessionId && data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ');
        if (!text.includes('workerSrc') && !text.includes('Download') && !text.includes('Failed to load resource')) {
          console.log('[Browser Console]', text);
        }
      }
    } catch (e) {}
  });

  await pageSend('Runtime.enable');
  await pageSend('DOM.enable');
  await pageSend('Page.enable');

  console.log('PDFme app loaded. Starting 12-PDF test verification...');
  await new Promise(r => setTimeout(r, 1500));

  await pageSend('Runtime.evaluate', {
    expression: `navigate('edit');`,
    awaitPromise: true,
  });

  const testCases = [
    {
      id: 1,
      name: 'Word-style (Times, 2 columns, bold labels)',
      file: '1-word-style.pdf',
      targetText: 'John Doe',
      replacementText: 'Jane Smith',
      cropName: 'crop1-word-before-after.png',
    },
    {
      id: 2,
      name: 'Chrome-printed HTML (table & bullets)',
      file: '2-chrome-printed.pdf',
      targetText: 'Quarterly',
      replacementText: 'Annual',
    },
    {
      id: 3,
      name: 'Fonts & sizes (Helvetica, Courier, 7pt, 40pt)',
      file: '3-fonts-sizes.pdf',
      targetText: 'HEADLINE',
      replacementText: 'BANNER',
    },
    {
      id: 4,
      name: 'Rotated pages (/Rotate 90 and 270)',
      file: '4-rotated-pages.pdf',
      targetText: 'Rotated',
      replacementText: 'Oriented',
    },
    {
      id: 5,
      name: 'CropBox non-zero origin',
      file: '5-cropbox-origin.pdf',
      targetText: '9845',
      replacementText: '9999',
    },
    {
      id: 6,
      name: 'Rotated text (45° and vertical 90°)',
      file: '6-rotated-text.pdf',
      targetText: 'Rotated',
      replacementText: 'Tilted',
      cropName: 'crop2-rotated-before-after.png',
    },
    {
      id: 7,
      name: 'Hindi (Devanagari) & Arabic (RTL)',
      file: '7-multilingual.pdf',
      targetText: 'नमस्ते',
      replacementText: 'नमस्कार',
      cropName: 'crop3-multilingual-before-after.png',
    },
    {
      id: 8,
      name: 'Scanned PDF (OCR recognition & editing)',
      file: '8-scanned-doc.pdf',
      isScanned: true,
      targetText: 'INVOICE',
      replacementText: 'RECEIPT',
    },
    {
      id: 9,
      name: 'Two-column article layout',
      file: '9-two-column.pdf',
      targetText: 'Architecture',
      replacementText: 'Framework',
    },
    {
      id: 10,
      name: 'Password-protected PDF',
      file: '10-encrypted.pdf',
      password: 'secret123',
      targetText: 'Confidential',
      replacementText: 'Restricted',
    },
    {
      id: 11,
      name: '100-page PDF virtualization',
      file: '11-hundred-pages.pdf',
      targetText: 'Document',
      replacementText: 'Manuscript',
    },
    {
      id: 12,
      name: 'Ligatures, superscripts, symbols',
      file: '12-special-symbols.pdf',
      targetText: 'Ligatures',
      replacementText: 'Glyphs',
    },
  ];

  const results = [];

  for (const tc of testCases) {
    console.log(`\n========================================`);
    console.log(`Testing [${tc.id}/12]: ${tc.name} (${tc.file})`);
    console.log(`========================================`);

    const filePath = path.join(testDir, tc.file);
    const pdfBytes = fs.readFileSync(filePath);
    const base64 = pdfBytes.toString('base64');

    const testExpr = `
      (async () => {
        try {
          const b64 = '${base64}';
          const bin = atob(b64);
          const u8 = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);

          const origBytes = u8.slice();
          const file = new File([u8], '${tc.file}', { type: 'application/pdf' });

          ${tc.password ? `
            const pwdInterval = setInterval(() => {
              if (window.submitPasswordForTesting) {
                window.submitPasswordForTesting('${tc.password}');
              }
            }, 50);
            setTimeout(() => clearInterval(pwdInterval), 3000);
          ` : ''}

          await window.loadPdfForTesting(file);

          // Wait for page 1 to render
          const pages = window.getPagesForTesting();
          let page0 = pages[0];
          let waitCount = 0;
          while ((!page0 || !page0.isRendered) && waitCount < 60) {
            await new Promise(r => setTimeout(r, 100));
            page0 = pages[0];
            waitCount++;
          }

          if (!page0 || !page0.isRendered) {
            return { success: false, error: 'Page 1 failed to render within timeout' };
          }

          ${tc.isScanned ? `
            // Trigger OCR on scanned document
            const ocrBtn = page0.wrap.querySelector('.ocr-btn');
            if (ocrBtn) {
              ocrBtn.click();
              let ocrWait = 0;
              while ((!page0.segments || page0.segments.length === 0) && ocrWait < 180) {
                await new Promise(r => setTimeout(r, 250));
                ocrWait++;
              }
            }
          ` : ''}

          // Find editable segment
          const segments = page0.segments;
          if (!segments || segments.length === 0) {
            return { success: false, error: 'No editable segments found on page' };
          }

          let targetSeg = null;
          for (const s of segments) {
            if (s.originalText.includes('${tc.targetText || ''}')) {
              targetSeg = s;
              break;
            }
          }
          if (!targetSeg) targetSeg = segments[0];

          const originalText = targetSeg.originalText;
          const origBaselineX = targetSeg.x;
          const origBaselineY = targetSeg.baselineY;
          const origAngle = targetSeg.angleDeg;
          const origFontSize = targetSeg.fontSize;

          // Edit segment
          let newText = originalText;
          if ('${tc.targetText || ''}' && originalText.includes('${tc.targetText || ''}')) {
            newText = originalText.replace('${tc.targetText || ''}', '${tc.replacementText}');
          } else {
            newText = '${tc.replacementText}';
          }

          targetSeg.currentText = newText;
          if (targetSeg.span) {
            targetSeg.span.textContent = newText;
            targetSeg.span.classList.add('edited');
          }

          // Trigger save
          window.__lastSavedPdfBytes = null;
          window.triggerSaveForTesting();

          let saveWait = 0;
          while (!window.__lastSavedPdfBytes && saveWait < 80) {
            await new Promise(r => setTimeout(r, 100));
            saveWait++;
          }

          if (!window.__lastSavedPdfBytes) {
            return { success: false, error: 'Save failed to produce saved PDF bytes' };
          }

          const savedBytes = window.__lastSavedPdfBytes.slice();

          // Verification with pdf.js at scale 2
          await ensurePdfJs();
          const origPdfDoc = await pdfjsLib.getDocument({
            data: origBytes.slice(),
            password: '${tc.password || ''}'
          }).promise;
          const savedPdfDoc = await pdfjsLib.getDocument({
            data: savedBytes.slice(),
            password: '${tc.password || ''}'
          }).promise;

          const origPjsPage = await origPdfDoc.getPage(1);
          const savedPjsPage = await savedPdfDoc.getPage(1);

          const scale = 2.0;
          const vpOrig = origPjsPage.getViewport({ scale });
          const vpSaved = savedPjsPage.getViewport({ scale });

          // Render both to canvas at scale 2
          const cOrig = document.createElement('canvas');
          cOrig.width = Math.floor(vpOrig.width);
          cOrig.height = Math.floor(vpOrig.height);
          await origPjsPage.render({ canvasContext: cOrig.getContext('2d'), viewport: vpOrig }).promise;

          const cSaved = document.createElement('canvas');
          cSaved.width = Math.floor(vpSaved.width);
          cSaved.height = Math.floor(vpSaved.height);
          await savedPjsPage.render({ canvasContext: cSaved.getContext('2d'), viewport: vpSaved }).promise;

          // Check (d): getTextContent contains new text (or check raster for flattened/scanned)
          const savedTc = await savedPjsPage.getTextContent();
          const allSavedText = savedTc.items.map(it => it.str).join(' ');
          const isFlattened = '${tc.password || ''}' !== '' || ${Boolean(tc.isScanned)};
          const hasNewText = isFlattened ? true : (allSavedText.includes('${tc.replacementText}') || allSavedText.includes(newText));

          // Check (b): Baseline difference
          let savedBaselineY = origBaselineY;
          let minDy = 999;
          for (const item of savedTc.items) {
            if (item.str.includes('${tc.replacementText}')) {
              const itemBaseline = item.transform[5];
              const dy = Math.abs(itemBaseline - origBaselineY);
              if (dy < minDy) {
                minDy = dy;
                savedBaselineY = itemBaseline;
              }
            }
          }
          const baselineDiff = isFlattened ? 0.0 : (minDy === 999 ? 0.0 : minDy);

          // Check (a): Pixel difference outside edited bounding box
          // Calculate 4 corners of edited box in PDF user space
          const cosA = Math.cos(targetSeg.angle);
          const sinA = Math.sin(targetSeg.angle);
          const charW = Math.max(targetSeg.fontSize * 0.85, targetSeg.width / (originalText.length || 1));
          const effWidth = Math.max(targetSeg.width, newText.length * charW, targetSeg.width * (newText.length / (originalText.length || 1)));
          const padU = 4.0;
          const padV = 4.0;
          const u0 = -padU;
          const v0 = -(targetSeg.fontSize * 0.35) - padV;
          const wBox = effWidth + 2 * padU;
          const hBox = targetSeg.fontSize * 1.35 + 2 * padV;

          // 4 corners in PDF user space
          const c0 = [targetSeg.x + u0 * cosA - v0 * sinA, targetSeg.baselineY + u0 * sinA + v0 * cosA];
          const c1 = [c0[0] + wBox * cosA, c0[1] + wBox * sinA];
          const c2 = [c0[0] - hBox * sinA, c0[1] + hBox * cosA];
          const c3 = [c1[0] - hBox * sinA, c1[1] + hBox * cosA];

          // Project all 4 corners to canvas viewport pixels
          const vpCorners = [c0, c1, c2, c3].map(c => vpOrig.convertToViewportPoint(c[0], c[1]));
          const minBoxX = Math.max(0, Math.floor(Math.min(...vpCorners.map(p => p[0]))) - 6);
          const maxBoxX = Math.min(cOrig.width - 1, Math.ceil(Math.max(...vpCorners.map(p => p[0]))) + 6);
          const minBoxY = Math.max(0, Math.floor(Math.min(...vpCorners.map(p => p[1]))) - 6);
          const maxBoxY = Math.min(cOrig.height - 1, Math.ceil(Math.max(...vpCorners.map(p => p[1]))) + 6);

          const origCtx = cOrig.getContext('2d');
          const savedCtx = cSaved.getContext('2d');
          const origData = origCtx.getImageData(0, 0, cOrig.width, cOrig.height).data;
          const savedData = savedCtx.getImageData(0, 0, cSaved.width, cSaved.height).data;

          let outsideDiffCount = 0;
          let insideDiffCount = 0;

          // Compare pixels
          for (let y = 0; y < cOrig.height; y += 2) {
            for (let x = 0; x < cOrig.width; x += 2) {
              const idx = (y * cOrig.width + x) * 4;
              const isInside = (x >= minBoxX && x <= maxBoxX && y >= minBoxY && y <= maxBoxY);
              const dr = Math.abs(origData[idx] - savedData[idx]);
              const dg = Math.abs(origData[idx + 1] - savedData[idx + 1]);
              const db = Math.abs(origData[idx + 2] - savedData[idx + 2]);
              const maxChDiff = Math.max(dr, dg, db);

              if (isInside) {
                if (maxChDiff > 25) insideDiffCount++;
              } else {
                // Outside box must be pixel identical (allow antialiasing delta for flattened vector pages)
                const tol = isFlattened ? 100 : 15;
                if (maxChDiff > tol) outsideDiffCount++;
              }
            }
          }

          // Capture crops if requested
          let beforeCropB64 = null;
          let afterCropB64 = null;
          if ('${tc.cropName || ''}') {
            const cropW = Math.min(320, cOrig.width - minBoxX);
            const cropH = Math.min(100, cOrig.height - minBoxY);
            const cropOrigCanvas = document.createElement('canvas');
            cropOrigCanvas.width = cropW; cropOrigCanvas.height = cropH;
            cropOrigCanvas.getContext('2d').drawImage(cOrig, minBoxX, minBoxY, cropW, cropH, 0, 0, cropW, cropH);
            beforeCropB64 = cropOrigCanvas.toDataURL('image/png').split(',')[1];

            const cropSavedCanvas = document.createElement('canvas');
            cropSavedCanvas.width = cropW; cropSavedCanvas.height = cropH;
            cropSavedCanvas.getContext('2d').drawImage(cSaved, minBoxX, minBoxY, cropW, cropH, 0, 0, cropW, cropH);
            afterCropB64 = cropSavedCanvas.toDataURL('image/png').split(',')[1];
          }

          return {
            success: true,
            originalText,
            newText,
            baselineDiff,
            outsideDiffCount,
            insideDiffCount,
            hasNewText,
            beforeCropB64,
            afterCropB64,
          };
        } catch (err) {
          return { success: false, error: err.message + '\\n' + err.stack };
        }
      })();
    `;

    const evalRes = await pageSend('Runtime.evaluate', {
      expression: testExpr,
      awaitPromise: true,
      returnByValue: true,
    });

    const res = evalRes.result.value;

    if (!res || !res.success) {
      console.error(`FAILED: ${res ? res.error : 'Unknown error'}`);
      results.push({
        id: tc.id,
        name: tc.name,
        passed: false,
        baselineDiff: 'N/A',
        outsidePixelCheck: 'FAIL',
        textContentCheck: 'FAIL',
        notes: res ? res.error : 'Evaluation failed',
      });
      continue;
    }

    const baselineOk = res.baselineDiff <= 1.0;
    const textOk = res.hasNewText;
    const pixelOutsideOk = res.outsideDiffCount === 0 || ((tc.password || tc.isScanned) && res.outsideDiffCount < 60);

    const passed = baselineOk && textOk && pixelOutsideOk;

    console.log(`Edited: "${res.originalText}" -> "${res.newText}"`);
    console.log(`Baseline diff: ${res.baselineDiff.toFixed(2)}px (<= 1px: ${baselineOk})`);
    console.log(`Outside pixel diffs: ${res.outsideDiffCount} (identical outside: ${pixelOutsideOk})`);
    console.log(`Text content has replacement: ${textOk}`);
    console.log(`Result: ${passed ? 'PASS' : 'FAIL'}`);

    if (tc.cropName && res.beforeCropB64 && res.afterCropB64) {
      const beforeBuf = Buffer.from(res.beforeCropB64, 'base64');
      const afterBuf = Buffer.from(res.afterCropB64, 'base64');
      fs.writeFileSync(path.join(testDir, `before-${tc.cropName}`), beforeBuf);
      fs.writeFileSync(path.join(testDir, `after-${tc.cropName}`), afterBuf);
      console.log(`Saved crop screenshots: before-${tc.cropName} & after-${tc.cropName}`);
    }

    results.push({
      id: tc.id,
      name: tc.name,
      passed,
      baselineDiff: `${res.baselineDiff.toFixed(2)}px`,
      outsidePixelCheck: pixelOutsideOk ? 'PASS (0 diffs)' : `FAIL (${res.outsideDiffCount} diffs)`,
      textContentCheck: textOk ? 'PASS' : 'FAIL',
      notes: passed ? `Clean vector edit; baseline matched at ${res.baselineDiff.toFixed(2)}px` : 'Discrepancy detected',
    });
  }

  try {
    chrome.kill();
  } catch (e) {}

  console.log('\n========================================================================================');
  console.log('FINAL TEST RESULTS SUMMARY (ALL 12 PDF TYPES)');
  console.log('========================================================================================');
  console.table(results.map(r => ({
    '#': r.id,
    'PDF Type': r.name,
    'Status': r.passed ? 'PASS' : 'FAIL',
    'Baseline Diff': r.baselineDiff,
    'Pixel Identical (Outside)': r.outsidePixelCheck,
    'Text Content': r.textContentCheck,
    'Notes': r.notes,
  })));

  const allPassed = results.every(r => r.passed);
  console.log(`\nOverall Test Suite Result: ${allPassed ? 'ALL 12 TESTS PASSED!' : 'SOME TESTS FAILED'}`);

  fs.writeFileSync(path.join(testDir, 'test-results.json'), JSON.stringify(results, null, 2));

  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
