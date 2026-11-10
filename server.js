'use strict';
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleAiRequest } = require('./api/ai-router.js');
const { handleWorkspaceRequest } = require('./api/workspace-router.js');
const { handleRazorpayRequest } = require('./api/razorpay-router.js');
const {
  PUBLIC_ROUTES,
  PAGE_METADATA,
  getRobotsTxt,
  getSitemapXml,
  renderPage
} = require('./api/seo-router.js');

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
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
};

function isAllowedOrigin(origin, hostHeader) {
  if (!origin) return true; // same-origin, curl, server-to-server
  try {
    const url = new URL(origin);
    const host = url.hostname;
    const port = url.port;

    // Allow same-origin requests matching request Host header
    if (hostHeader) {
      const cleanHost = hostHeader.split(':')[0].toLowerCase();
      if (host.toLowerCase() === cleanHost) {
        return true;
      }
    }

    // Allow local development on ports 51002 and 8080
    if ((host === 'localhost' || host === '127.0.0.1') && (port === '51002' || port === '8080')) {
      return true;
    }

    // Allow all Render domains (*.onrender.com)
    if (host.endsWith('.onrender.com')) {
      return true;
    }

    // Allow custom production domains if configured
    const custom = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL;
    if (custom) {
      const list = custom.split(',').map(s => s.trim().toLowerCase());
      if (list.includes(origin.toLowerCase()) || list.includes(host.toLowerCase())) {
        return true;
      }
    }

    return false;
  } catch (e) {
    return false;
  }
}

const server = http.createServer((req, res) => {
  const origin = req.headers['origin'];
  const hostHeader = req.headers['x-forwarded-host'] || req.headers['host'];
  const allowed = isAllowedOrigin(origin, hostHeader);

  if (allowed) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(allowed ? 204 : 403);
    res.end();
    return;
  }

  const parsedUrl = req.url.split('?')[0];
  const reqPath = decodeURIComponent(parsedUrl);
  const normalizedPath = (reqPath.length > 1 && reqPath.endsWith('/')) ? reqPath.slice(0, -1) : reqPath;

  // 1. API & Health Route Handlers
  if (normalizedPath.startsWith('/api/') || normalizedPath === '/health') {
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

      if (normalizedPath.startsWith('/api/ai/')) {
        handleAiRequest(req, res, normalizedPath, parsed);
      } else if (
        normalizedPath === '/api/create-order' ||
        normalizedPath === '/api/verify-payment' ||
        normalizedPath === '/api/payment-config' ||
        normalizedPath.startsWith('/api/razorpay/') ||
        normalizedPath.startsWith('/api/subscription/') ||
        normalizedPath.startsWith('/api/billing/') ||
        normalizedPath.startsWith('/api/admin/payments')
      ) {
        handleRazorpayRequest(req, res, normalizedPath, parsed);
      } else {
        handleWorkspaceRequest(req, res, normalizedPath, parsed);
      }
    });
    return;
  }

  // 2. SEO, Sitemap, Robots & Public Server-Rendered Routes
  if (normalizedPath === '/robots.txt') {
    const body = getRobotsTxt(req);
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    });
    res.end(body);
    return;
  }

  if (normalizedPath === '/sitemap.xml') {
    const body = getSitemapXml(req);
    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    });
    res.end(body);
    return;
  }

  if (PAGE_METADATA[normalizedPath]) {
    const html = renderPage(req, normalizedPath);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(html);
    return;
  }

  // 3. Static File Serving
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
