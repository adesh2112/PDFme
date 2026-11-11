'use strict';
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDir = path.join(os.tmpdir(), 'chrome-resp-' + Date.now());

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

async function runResponsivenessTests() {
  console.log('--- Starting Viewport Responsiveness E2E Test Suite ---');
  const server = require('./server.js');
  await new Promise(resolve => {
    server.listen(8081, '127.0.0.1', () => {
      console.log('✓ PDFme Test Server listening on http://127.0.0.1:8081');
      resolve();
    });
  });

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
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
        const req = http.get('http://127.0.0.1:9223/json/version', res => {
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
  const { targetId } = await cdpSend(ws, 'Target.createTarget', { url: 'http://127.0.0.1:8081/' }, undefined, reqId++);
  const { sessionId } = await cdpSend(ws, 'Target.attachToTarget', { targetId, flatten: true }, undefined, reqId++);

  await cdpSend(ws, 'Runtime.enable', {}, sessionId, reqId++);
  await cdpSend(ws, 'Page.enable', {}, sessionId, reqId++);
  await cdpSend(ws, 'Emulation.setFocusEmulationEnabled', { enabled: true }, sessionId, reqId++);

  const viewports = [320, 360, 375, 390, 414, 430, 768, 1024, 1440];
  const pagesToTest = ['/', '/pdf-to-word', '/split-pdf', '/protect-pdf'];

  let allPassed = true;

  for (const width of viewports) {
    const height = 850;
    console.log(`\nTesting Viewport: ${width}x${height}px`);

    await cdpSend(ws, 'Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 1024
    }, sessionId, reqId++);

    for (const urlPath of pagesToTest) {
      await cdpSend(ws, 'Page.navigate', { url: `http://127.0.0.1:8081${urlPath}` }, sessionId, reqId++);
      await new Promise(r => setTimeout(r, 600));

      const overflowCheck = await cdpSend(ws, 'Runtime.evaluate', {
        expression: `(() => {
          const docW = document.documentElement.scrollWidth;
          const winW = window.innerWidth;
          const bodyW = document.body.scrollWidth;
          const hasHScroll = docW > winW + 1; // 1px tolerance for subpixel rounding

          let overflowingElements = [];
          if (hasHScroll) {
            document.querySelectorAll('*').forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.right > winW + 2) {
                overflowingElements.push({
                  tag: el.tagName,
                  id: el.id,
                  cls: el.className,
                  right: Math.round(rect.right),
                  winW
                });
              }
            });
          }

          return {
            urlPath: window.location.pathname,
            docW,
            winW,
            bodyW,
            hasHScroll,
            overflowCount: overflowingElements.length,
            overflowSamples: overflowingElements.slice(0, 3)
          };
        })()`,
        returnByValue: true,
        awaitPromise: true
      }, sessionId, reqId++);

      const res = overflowCheck.result?.value;
      if (res.hasHScroll) {
        console.error(`  ❌ OVERFLOW at ${width}px on ${urlPath}: docWidth=${res.docW} > winWidth=${res.winW}`);
        console.error('     Elements:', res.overflowSamples);
        allPassed = false;
      } else {
        console.log(`  ✓ ${urlPath} at ${width}px: no horizontal overflow (width: ${res.docW}px <= ${res.winW}px)`);
      }
    }
  }

  chrome.kill();
  server.close();

  if (allPassed) {
    console.log('\n🎉 ALL VIEWPORTS (320px - 1440px) PASSED WITH ZERO HORIZONTAL OVERFLOW!');
    process.exit(0);
  } else {
    console.error('\n❌ SOME VIEWPORTS FAILED RESPONSIVENESS CHECKS.');
    process.exit(1);
  }
}

runResponsivenessTests().catch(err => {
  console.error('Responsiveness test error:', err);
  process.exit(1);
});

