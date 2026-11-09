'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} -> ${dest}`);
    const file = fs.createWriteStream(dest);
    const get = (targetUrl) => {
      https.get(targetUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = new URL(res.headers.location, targetUrl).toString();
          return get(nextUrl);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed ${targetUrl} status ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            console.log(`Saved ${dest} (${fs.statSync(dest).size} bytes)`);
            resolve();
          });
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    get(url);
  });
}

async function main() {
  const libDir = path.join(__dirname, 'lib');
  const fontsDir = path.join(__dirname, 'fonts');
  const tessDir = path.join(libDir, 'tesseract');

  if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
  if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
  if (!fs.existsSync(tessDir)) fs.mkdirSync(tessDir, { recursive: true });

  const tasks = [
    // 1. fontkit
    {
      url: 'https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js',
      dest: path.join(libDir, 'fontkit.umd.min.js')
    },
    // 2. Noto Fonts (TTF from Google Fonts / GitHub raw)
    {
      url: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
      dest: path.join(fontsDir, 'NotoSans-Regular.ttf')
    },
    {
      url: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSerif/NotoSerif-Regular.ttf',
      dest: path.join(fontsDir, 'NotoSerif-Regular.ttf')
    },
    {
      url: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf',
      dest: path.join(fontsDir, 'NotoSansDevanagari-Regular.ttf')
    },
    {
      url: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf',
      dest: path.join(fontsDir, 'NotoSansArabic-Regular.ttf')
    },
    // 3. Tesseract.js bundle and worker
    {
      url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
      dest: path.join(libDir, 'tesseract.min.js')
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
      dest: path.join(tessDir, 'worker.min.js')
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/tesseract-core-simd-lstm.wasm.js',
      dest: path.join(tessDir, 'tesseract-core-simd-lstm.wasm.js')
    },
    {
      url: 'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz',
      dest: path.join(tessDir, 'eng.traineddata.gz')
    },
    {
      url: 'https://tessdata.projectnaptha.com/4.0.0/hin.traineddata.gz',
      dest: path.join(tessDir, 'hin.traineddata.gz')
    }
  ];

  for (const t of tasks) {
    if (fs.existsSync(t.dest) && fs.statSync(t.dest).size > 1000) {
      console.log(`Skipping existing ${t.dest}`);
      continue;
    }
    await download(t.url, t.dest);
  }

  console.log('All vendor libraries and fonts downloaded successfully.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

