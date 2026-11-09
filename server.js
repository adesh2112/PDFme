'use strict';
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleAiRequest } = require('./api/ai-router.js');
const { handleWorkspaceRequest } = require('./api/workspace-router.js');
const { handleRazorpayRequest } = require('./api/razorpay-router.js');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
};

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = req.url.split('?')[0];
  const reqPath = decodeURIComponent(parsedUrl);

  // 1. API Route Handlers
  if (reqPath.startsWith('/api/')) {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
      // Max 10MB payload limit
      if (bodyData.length > 10 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large (10MB limit).' }));
        req.destroy();
      }
    });

    req.on('end', () => {
      let parsed = {};
      try {
        if (bodyData) parsed = JSON.parse(bodyData);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload.' }));
        return;
      }

      if (reqPath.startsWith('/api/ai/')) {
        handleAiRequest(req, res, reqPath, parsed);
      } else if (
        reqPath === '/api/create-order' ||
        reqPath === '/api/verify-payment' ||
        reqPath === '/api/payment-config' ||
        reqPath.startsWith('/api/razorpay/') ||
        reqPath.startsWith('/api/billing/') ||
        reqPath.startsWith('/api/admin/payments')
      ) {
        handleRazorpayRequest(req, res, reqPath, parsed);
      } else {
        handleWorkspaceRequest(req, res, reqPath, parsed);
      }
    });
    return;
  }

  // 2. Static File Serving
  let filePath = path.join(ROOT, reqPath === '/' ? '/index.html' : reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use, reusing running server.`);
  } else {
    throw err;
  }
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PDFme Server listening on http://0.0.0.0:${PORT}`);
  });
}

module.exports = server;
