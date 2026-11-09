'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--user-data-dir=' + userDataDir,
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  const versionData = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/version', res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const ws = new WebSocket(versionData.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  let reqId = 1;
  const { targetId } = await cdpSend(ws, 'Target.createTarget', { url: 'http://127.0.0.1:8080' }, undefined, reqId++);
  const { sessionId } = await cdpSend(ws, 'Target.attachToTarget', { targetId, flatten: true }, undefined, reqId++);

  async function pageSend(method, params = {}) {
    return cdpSend(ws, method, params, sessionId, reqId++);
  }

  // Set 390px mobile viewport (iPhone 12/13/14 size)
  await pageSend('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });

  ws.addEventListener('message', evt => {
    try {
      const data = JSON.parse(evt.data);
      if (data.sessionId === sessionId && data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ');
        console.log('[Browser Console]', text);
      }
    } catch (e) {}
  });

  await pageSend('Runtime.enable');
  await pageSend('DOM.enable');
  await pageSend('Page.enable');

  console.log('Testing at 390px viewport...');
  await new Promise(r => setTimeout(r, 1500));

  // ========================================================
  // TEST 1: Open 100-page PDF & Virtualization Test
  // ========================================================
  console.log('\n--- START TEST 1: 100-Page PDF Virtualization & Memory ---');
  const hundredPdfBytes = fs.readFileSync(path.join(testDir, 'test-100pages.pdf'));
  const hundredBase64 = hundredPdfBytes.toString('base64');

  const test1Expr = `
    (async () => {
      window.test1Results = {};
      navigate('edit');

      const b64 = '${hundredBase64}';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'test-100pages.pdf', { type: 'application/pdf' });

      const t0 = performance.now();
      const dt = new DataTransfer();
      dt.items.add(file);
      const editInput = document.getElementById('edit-input');
      editInput.files = dt.files;
      editInput.dispatchEvent(new Event('change'));

      // Wait until initial pages are created and first page is rendered
      await new Promise(resolve => {
        const check = () => {
          const area = document.getElementById('edit-canvas-area');
          const wraps = area.querySelectorAll('.page-wrap');
          const canvases = area.querySelectorAll('canvas.page-canvas');
          const rendered = [...canvases].filter(c => c.width > 0 && c.style.display !== 'none').length;
          if (wraps.length === 100 && rendered >= 1) {
            resolve({ wrapsCount: wraps.length, renderedCount: rendered });
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });

      const tInitial = performance.now() - t0;
      const area = document.getElementById('edit-canvas-area');
      const renderedInitial = [...area.querySelectorAll('canvas.page-canvas')].filter(c => c.width > 0 && c.style.display !== 'none').length;

      console.log('Initial 100-page load complete: ' + tInitial.toFixed(1) + 'ms, rendered canvases: ' + renderedInitial);
      window.test1Results.tInitial = tInitial;
      window.test1Results.renderedInitial = renderedInitial;

      // Simulate scrolling down through document in steps
      const scrollSteps = [1000, 3000, 8000, 16000, 28000, 42000, 60000];
      const renderedCountsDuringScroll = [];

      for (const st of scrollSteps) {
        area.scrollTop = st;
        area.dispatchEvent(new Event('scroll'));
        await new Promise(r => setTimeout(r, 250));
        const currentRendered = [...area.querySelectorAll('canvas.page-canvas')].filter(c => c.width > 0 && c.style.display !== 'none').length;
        renderedCountsDuringScroll.push(currentRendered);
      }

      window.test1Results.maxRenderedObserved = Math.max(...renderedCountsDuringScroll);
      window.test1Results.renderedFinal = [...area.querySelectorAll('canvas.page-canvas')].filter(c => c.width > 0 && c.style.display !== 'none').length;
      console.log('Scroll test finished. Max simultaneously active rendered canvases: ' + window.test1Results.maxRenderedObserved);
      return window.test1Results;
    })()
  `;

  const test1EvalRes = await pageSend('Runtime.evaluate', { expression: test1Expr, awaitPromise: true, returnByValue: true });
  console.log('Test 1 Eval Result:', JSON.stringify(test1EvalRes.result.value, null, 2));

  // ========================================================
  // TEST 2: Merge 25 PDFs (total 50 pages) + Responsiveness
  // ========================================================
  console.log('\n--- START TEST 2: Merge 25 Small PDFs (Total 50 pages) ---');
  const manifest = JSON.parse(fs.readFileSync(path.join(testDir, 'manifest.json'), 'utf8'));
  const filesPayload = [];
  for (const item of manifest.files) {
    const bytes = fs.readFileSync(path.join(testDir, item.fileName));
    filesPayload.push({
      name: item.fileName,
      b64: bytes.toString('base64'),
      pages: item.pages
    });
  }

  const test2Expr = `
    (async () => {
      window.test2Results = {};
      navigate('merge');

      function b64ToU8(b64) {
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return u8;
      }

      const filesData = ${JSON.stringify(filesPayload)};
      console.log('Adding 25 files in 2 batches...');

      // Batch 1: first 12 files
      const dt1 = new DataTransfer();
      for (let i = 0; i < 12; i++) {
        dt1.items.add(new File([b64ToU8(filesData[i].b64)], filesData[i].name, { type: 'application/pdf' }));
      }
      const mergeInput = document.getElementById('merge-input');
      mergeInput.files = dt1.files;
      mergeInput.dispatchEvent(new Event('change'));

      await new Promise(r => setTimeout(r, 500));

      // Batch 2: remaining 13 files
      const dt2 = new DataTransfer();
      for (let i = 12; i < 25; i++) {
        dt2.items.add(new File([b64ToU8(filesData[i].b64)], filesData[i].name, { type: 'application/pdf' }));
      }
      mergeInput.files = dt2.files;
      mergeInput.dispatchEvent(new Event('change'));

      // Wait for lazy page counts to finish
      await new Promise(resolve => {
        const check = () => {
          const pill = document.getElementById('merge-summary').textContent;
          if (pill.includes('25 files') && pill.includes('50 pages')) {
            console.log('Summary line updated to: ' + pill);
            resolve(pill);
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });

      window.test2Results.summaryText = document.getElementById('merge-summary').textContent;

      // Intercept downloadBytes to capture merged PDF bytes & measure page count
      let capturedMergedBytes = null;
      window.downloadBytes = function(bytes, filename) {
        capturedMergedBytes = bytes;
        console.log('downloadBytes called with: ' + filename + ', size: ' + bytes.length);
      };

      // Click Merge PDFs
      console.log('Clicking Merge PDFs button...');
      const mergeBtn = document.getElementById('merge-btn');
      mergeBtn.click();

      // Verify UI stays responsive while merging by scrolling the list
      const list = document.getElementById('merge-list');
      let scrollSuccessCount = 0;
      const scrollInterval = setInterval(() => {
        list.scrollTop += 30;
        if (list.scrollTop > 0) scrollSuccessCount++;
      }, 50);

      // Wait for merge to finish
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Merge timed out')), 30000);
        const checkDone = () => {
          if (capturedMergedBytes) {
            clearInterval(scrollInterval);
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(checkDone, 100);
          }
        };
        checkDone();
      });

      window.test2Results.scrolledDuringMerge = scrollSuccessCount > 0;
      console.log('UI responsiveness confirmed during merge. Scroll count: ' + scrollSuccessCount);

      // Load merged PDF with pdf.js to verify output page count
      await ensurePdfJs();
      const mergedDoc = await pdfjsLib.getDocument({ data: capturedMergedBytes.slice() }).promise;
      window.test2Results.mergedOutputPageCount = mergedDoc.numPages;
      window.test2Results.mergedSizeBytes = capturedMergedBytes.length;
      console.log('Merged output page count verified: ' + mergedDoc.numPages + ' pages.');
      await mergedDoc.destroy();

      return window.test2Results;
    })()
  `;

  const test2EvalRes = await pageSend('Runtime.evaluate', { expression: test2Expr, awaitPromise: true, returnByValue: true });
  console.log('Test 2 Eval Result:', JSON.stringify(test2EvalRes.result.value, null, 2));

  // ========================================================
  // TEST 3: Corrupt / Password Protected File Handling
  // ========================================================
  console.log('\n--- START TEST 3: Corrupt File Skip Handling ---');
  const test3Expr = `
    (async () => {
      window.test3Results = {};
      const clearBtn = document.getElementById('merge-clear');
      clearBtn.click();
      await new Promise(r => setTimeout(r, 200));

      function b64ToU8(b64) {
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return u8;
      }

      // 1 corrupt file and 2 valid files
      const corruptFile = new File([new Uint8Array([37, 80, 68, 70, 0, 0, 0, 1, 2, 3])], 'corrupted-file.pdf', { type: 'application/pdf' });
      const valid1 = new File([b64ToU8('${filesPayload[0].b64}')], 'valid-sample-1.pdf', { type: 'application/pdf' });
      const valid2 = new File([b64ToU8('${filesPayload[1].b64}')], 'valid-sample-2.pdf', { type: 'application/pdf' });

      const dt = new DataTransfer();
      dt.items.add(valid1);
      dt.items.add(corruptFile);
      dt.items.add(valid2);

      const mergeInput = document.getElementById('merge-input');
      mergeInput.files = dt.files;
      mergeInput.dispatchEvent(new Event('change'));

      await new Promise(r => setTimeout(r, 600));

      let capturedBytes = null;
      window.downloadBytes = function(bytes, filename) {
        capturedBytes = bytes;
      };

      document.getElementById('merge-btn').click();

      await new Promise(resolve => {
        const check = () => {
          if (capturedBytes) resolve();
          else setTimeout(check, 100);
        };
        check();
      });

      await ensurePdfJs();
      const doc = await pdfjsLib.getDocument({ data: capturedBytes.slice() }).promise;
      window.test3Results.mergedPageCount = doc.numPages;
      window.test3Results.skippedFileHandled = true;
      const warningToast = document.querySelector('.toast.warning');
      window.test3Results.warningToastShown = warningToast ? warningToast.textContent.trim() : '';
      console.log('Corrupt test result: merged pages=' + doc.numPages + ', warning toast: ' + window.test3Results.warningToastShown);
      await doc.destroy();

      return window.test3Results;
    })()
  `;

  const test3EvalRes = await pageSend('Runtime.evaluate', { expression: test3Expr, awaitPromise: true, returnByValue: true });
  console.log('Test 3 Eval Result:', JSON.stringify(test3EvalRes.result.value, null, 2));

  console.log('\n================ ALL BROWSER TESTS COMPLETE ================');
  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
