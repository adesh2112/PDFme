'use strict';
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = path.join(os.tmpdir(), 'chrome-e2e-' + Date.now());

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

async function runE2ETests() {
  console.log('--- Starting Comprehensive Tool Opening & Navigation E2E Test Suite ---');
  const server = require('./server.js');
  await new Promise(resolve => {
    server.listen(8080, '127.0.0.1', () => {
      console.log('✓ PDFme Test Server listening on http://127.0.0.1:8080');
      resolve();
    });
  });

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--user-data-dir=' + tmpDir,
    'about:blank'
  ]);

  let versionData = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      versionData = await new Promise((resolve, reject) => {
        const req = http.get('http://127.0.0.1:9222/json/version', res => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => resolve(JSON.parse(d)));
        });
        req.on('error', reject);
        req.setTimeout(500, () => { req.destroy(); reject(new Error('timeout')); });
      });
      if (versionData && versionData.webSocketDebuggerUrl) break;
    } catch (e) {}
  }

  if (!versionData || !versionData.webSocketDebuggerUrl) {
    throw new Error('Chrome remote debugging did not respond.');
  }

  const ws = new WebSocket(versionData.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  let reqId = 1;
  const { targetId } = await cdpSend(ws, 'Target.createTarget', { url: 'http://127.0.0.1:8080/' }, undefined, reqId++);
  const { sessionId } = await cdpSend(ws, 'Target.attachToTarget', { targetId, flatten: true }, undefined, reqId++);

  const uncaughtErrors = [];
  ws.addEventListener('message', evt => {
    try {
      const data = JSON.parse(evt.data);
      if (data.method === 'Runtime.exceptionThrown') {
        uncaughtErrors.push(data.params.exceptionDetails.text + ' ' + (data.params.exceptionDetails.exception?.description || ''));
      }
    } catch(e) {}
  });

  await cdpSend(ws, 'Runtime.enable', {}, sessionId, reqId++);
  await cdpSend(ws, 'Page.enable', {}, sessionId, reqId++);
  await cdpSend(ws, 'Page.navigate', { url: 'http://127.0.0.1:8080/' }, sessionId, reqId++);
  await new Promise(r => setTimeout(r, 2000));

  async function evaluate(fnStr) {
    const res = await cdpSend(ws, 'Runtime.evaluate', {
      expression: `(${fnStr})()`,
      returnByValue: true,
      awaitPromise: true
    }, sessionId, reqId++);
    return res.result?.value;
  }

  // 1. Check Initial Home Load
  const homeCheck = await evaluate(`() => {
    return {
      activeScreen: document.querySelector('.screen.active')?.id,
      title: document.title,
      registryLoaded: typeof window.PDFME_TOOLS !== 'undefined',
      toolsCount: window.PDFME_TOOLS ? window.PDFME_TOOLS.length : 0,
      openToolModalType: typeof window.openToolModal,
      navigateToToolType: typeof window.navigateToTool
    };
  }`);
  console.log('1. Homepage Load Check:', homeCheck);

  if (homeCheck.activeScreen !== 'screen-home') {
    throw new Error(`Expected activeScreen to be screen-home, got: ${homeCheck.activeScreen}`);
  }
  if (!homeCheck.registryLoaded || homeCheck.toolsCount < 20) {
    throw new Error(`Tool registry failed to load properly. Found: ${homeCheck.toolsCount}`);
  }

  // 2. Test Tool Opening for Each Category
  const testTools = [
    { id: 'pdf-to-word', expectedTitle: 'PDF to Word', expectedRoute: '/pdf-to-word' },
    { id: 'pdf-to-png', expectedTitle: 'PDF to PNG', expectedRoute: '/pdf-to-png' },
    { id: 'pdf-to-jpg', expectedTitle: 'PDF to JPG', expectedRoute: '/pdf-to-jpg' },
    { id: 'pdf-to-excel', expectedTitle: 'PDF to Excel', expectedRoute: '/pdf-to-excel' },
    { id: 'pdf-to-ppt', expectedTitle: 'PDF to PowerPoint', expectedRoute: '/pdf-to-ppt' },
    { id: 'word-to-pdf', expectedTitle: 'Word to PDF', expectedRoute: '/word-to-pdf' },
    { id: 'split-pdf', expectedTitle: 'Split PDF', expectedRoute: '/split-pdf' },
    { id: 'reorder-pdf', expectedTitle: 'Reorder Pages', expectedRoute: '/reorder-pdf' },
    { id: 'delete-pages', expectedTitle: 'Delete Pages', expectedRoute: '/delete-pages' },
    { id: 'rotate-pdf', expectedTitle: 'Rotate Pages', expectedRoute: '/rotate-pdf' },
    { id: 'compress-pdf', expectedTitle: 'Compress PDF', expectedRoute: '/compress-pdf' },
    { id: 'protect-pdf', expectedTitle: 'Protect PDF', expectedRoute: '/protect-pdf' },
    { id: 'unlock-pdf', expectedTitle: 'Unlock PDF', expectedRoute: '/unlock-pdf' },
    { id: 'ai-chat', expectedTitle: 'AI Chat with PDF', expectedRoute: '/ai-chat' },
    { id: 'ai-summarizer', expectedTitle: 'AI Document Summarizer', expectedRoute: '/ai-summarizer' },
    { id: 'ai-qa', expectedTitle: 'Ask PDF', expectedRoute: '/ai-qa' },
    { id: 'ai-insights', expectedTitle: 'Document Analysis', expectedRoute: '/ai-insights' },
    { id: 'ai-extract', expectedTitle: 'Information Extraction', expectedRoute: '/ai-extract' },
    { id: 'ai-contract', expectedTitle: 'Contract Risk Analyzer', expectedRoute: '/ai-contract' },
    { id: 'gen-invoice', expectedTitle: 'Invoice Generator', expectedRoute: '/gen-invoice' },
    { id: 'gen-offer', expectedTitle: 'Offer Letter Generator', expectedRoute: '/gen-offer' },
    { id: 'gen-payslip', expectedTitle: 'Salary Slip Generator', expectedRoute: '/gen-payslip' },
    { id: 'gen-bulk', expectedTitle: 'Bulk Document Generator', expectedRoute: '/gen-bulk' },
    { id: 'repair-pdf', expectedTitle: 'Repair Corrupted PDF', expectedRoute: '/repair-pdf' },
    { id: 'merge-pdf', expectedTitle: 'Merge PDFs', expectedRoute: '/merge-pdf', isCustomScreen: 'screen-merge' },
    { id: 'edit-pdf', expectedTitle: 'Edit PDF', expectedRoute: '/edit-pdf', isCustomScreen: 'screen-edit' },
    { id: 'photos-to-pdf', expectedTitle: 'Photos to PDF', expectedRoute: '/photos-to-pdf', isCustomScreen: 'screen-photos' }
  ];

  console.log(`\n--- Testing ${testTools.length} Tools for Click Navigation, UI Rendering, and URL Route ---`);

  const results = [];
  for (const t of testTools) {
    const navResult = await evaluate(`() => {
      window.navigateToTool('${t.id}', true);
      const activeScreen = document.querySelector('.screen.active')?.id;
      const title = document.title;
      const pathname = window.location.pathname;
      const toolTitle = document.getElementById('tool-screen-title')?.textContent?.trim();
      const hasDropzone = !!document.getElementById('tool-screen-dropzone');
      const hasGenerator = !!document.getElementById('tool-generator-container');
      const isVisible = activeScreen === '${t.isCustomScreen || 'screen-tool'}';
      
      return {
        activeScreen,
        title,
        pathname,
        toolTitle,
        hasDropzone,
        hasGenerator,
        isVisible
      };
    }`);

    const pass = navResult.isVisible && navResult.pathname === t.expectedRoute;
    results.push({
      id: t.id,
      expectedRoute: t.expectedRoute,
      actualRoute: navResult.pathname,
      activeScreen: navResult.activeScreen,
      toolTitle: navResult.toolTitle,
      pass
    });

    if (!pass) {
      console.error(`❌ FAIL: Tool ${t.id}`, navResult);
    } else {
      console.log(`✓ PASS: [${t.id}] -> Route: ${navResult.pathname} -> Screen: ${navResult.activeScreen}`);
    }
  }

  // 3. Test Direct URL Access & Page Refresh
  console.log('\n--- Testing Direct URL Access & Page Refresh on /pdf-to-word ---');
  await cdpSend(ws, 'Page.navigate', { url: 'http://127.0.0.1:8080/pdf-to-word' }, sessionId, reqId++);
  await new Promise(r => setTimeout(r, 2000));

  const directWordCheck = await evaluate(`() => {
    return {
      pathname: window.location.pathname,
      activeScreen: document.querySelector('.screen.active')?.id,
      title: document.title,
      toolTitle: document.getElementById('tool-screen-title')?.textContent?.trim(),
      hasDropzone: !!document.getElementById('tool-screen-dropzone')
    };
  }`);
  console.log('Direct URL /pdf-to-word Result:', directWordCheck);

  if (directWordCheck.activeScreen !== 'screen-tool' || !directWordCheck.toolTitle.includes('Word')) {
    throw new Error('Direct URL /pdf-to-word failed to load tool page correctly.');
  }

  // 4. Test Browser Back Button
  console.log('\n--- Testing Browser Back Navigation ---');
  await evaluate(`() => { window.history.back(); }`);
  await new Promise(r => setTimeout(r, 800));

  const backCheck = await evaluate(`() => {
    return {
      pathname: window.location.pathname,
      activeScreen: document.querySelector('.screen.active')?.id
    };
  }`);
  console.log('After Browser Back Check:', backCheck);

  console.log('\n--- Uncaught Exceptions Check ---');
  if (uncaughtErrors.length > 0) {
    console.error('Uncaught exceptions found:', uncaughtErrors);
  } else {
    console.log('✓ 0 Uncaught exceptions.');
  }

  chrome.kill();
  server.close();

  const totalPass = results.filter(r => r.pass).length;
  console.log(`\n========================================`);
  console.log(`TOTAL TOOLS TESTED: ${results.length}`);
  console.log(`PASSED: ${totalPass} / ${results.length}`);
  console.log(`========================================\n`);

  if (totalPass === results.length && uncaughtErrors.length === 0) {
    console.log('🎉 ALL TOOL NAVIGATION AND OPENING TESTS PASSED PERFECTLY!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runE2ETests().catch(err => {
  console.error('E2E Test Run Error:', err);
  process.exit(1);
});

