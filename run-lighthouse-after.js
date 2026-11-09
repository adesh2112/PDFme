const { spawn } = require('child_process');
const fs = require('fs');

const server = require('./server.js');

setTimeout(() => {
  console.log('Running Lighthouse on http://127.0.0.1:8080 (AFTER)...');
  const lh = spawn('npx.cmd', [
    'lighthouse',
    'http://127.0.0.1:8080',
    '--output=json',
    '--output-path=./lh-report-after.json',
    '--chrome-flags="--headless=new --no-sandbox"',
    '--form-factor=mobile',
    '--screenEmulation.width=390',
    '--screenEmulation.height=844',
    '--screenEmulation.deviceScaleFactor=3',
    '--throttling-method=simulate',
    '--only-categories=performance'
  ], { shell: true });

  lh.stdout.on('data', d => process.stdout.write(d));
  lh.stderr.on('data', d => process.stderr.write(d));

  lh.on('close', (code) => {
    console.log('Lighthouse finished with code:', code);
    try {
      const data = JSON.parse(fs.readFileSync('./lh-report-after.json', 'utf8'));
      const perf = data.categories.performance.score * 100;
      const lcp = data.audits['largest-contentful-paint'].numericValue;
      const fcp = data.audits['first-contentful-paint'].numericValue;
      const tbt = data.audits['total-blocking-time'].numericValue;
      const cls = data.audits['cumulative-layout-shift'].numericValue;
      const speedIndex = data.audits['speed-index'].numericValue;

      console.log('\n=== LIGHTHOUSE AFTER RESULTS ===');
      console.log(`Performance Score: ${perf.toFixed(0)} / 100`);
      console.log(`Largest Contentful Paint (LCP): ${(lcp / 1000).toFixed(2)} s`);
      console.log(`First Contentful Paint (FCP): ${(fcp / 1000).toFixed(2)} s`);
      console.log(`Total Blocking Time (TBT): ${tbt.toFixed(0)} ms`);
      console.log(`Speed Index: ${(speedIndex / 1000).toFixed(2)} s`);
      console.log(`Cumulative Layout Shift (CLS): ${cls.toFixed(3)}`);

      let totalJs = 0;
      const requests = data.audits['network-requests']?.details?.items || [];
      console.log('\nInitial Network Requests:');
      requests.forEach(r => {
        if (r.resourceType === 'Script') totalJs += r.transferSize || 0;
        console.log(`  ${r.resourceType}: ${(r.transferSize / 1024).toFixed(1)} KB - ${r.url.slice(0, 80)}`);
      });
      console.log(`Total JS Transfer Size on Home Screen: ${(totalJs / 1024).toFixed(1)} KB`);
    } catch (e) {
      console.error('Failed to parse report:', e.message);
    }
    process.exit(0);
  });
}, 1000);

