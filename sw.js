/* Pdfme Service Worker v5 — offline-first shell & high performance caching */
const CACHE_NAME = 'pdfme-v6-marathi';

const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/css/saas-platform.css',
  '/app.js',
  '/js/platform-ui.js',
  '/js/tools-ai.js',
  '/js/marathi-transliterate.js',
  '/lib/sanscript.js',
  '/merge-worker.js',
  '/manifest.json',
  '/fonts/fonts.css',
  '/fonts/devanagari-fonts.css',
  '/fonts/space-grotesk-400.woff2',
  '/fonts/space-grotesk-600.woff2',
  '/fonts/NotoSansDevanagari-Regular.woff2',
  '/fonts/NotoSansDevanagari-Bold.woff2',
  '/fonts/NotoSerifDevanagari-Regular.woff2',
  '/fonts/NotoSerifDevanagari-Bold.woff2',
  '/lib/pdf-lib.min.js',
  '/lib/fontkit.umd.min.js',
  '/lib/pdf.min.js',
  '/lib/pdf.worker.min.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/apple-touch-icon.png',
  '/edit-pdf',
  '/merge-pdf',
  '/photos-to-pdf',
  '/marathi-pdf-editor'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        APP_SHELL.map((url) => cache.add(url).catch((err) => console.warn('[SW] Cache add failed for', url, err)))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Only handle same-origin or GET requests
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;
  // Never intercept API routes or healthchecks with service worker caching
  if (pathname.startsWith('/api/') || pathname === '/health') return;

  const isHtmlOrJs =
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    pathname.endsWith('.html') ||
    pathname === '/' ||
    (pathname.endsWith('.js') && !pathname.startsWith('/lib/'));

  if (isHtmlOrJs) {
    // Network-first for HTML and JS
    e.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            return cached || (req.mode === 'navigate' ? caches.match('/') : Response.error());
          });
        })
    );
  } else {
    // Stale-while-revalidate for CSS, fonts, /lib, images, etc.
    e.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return networkRes;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
  }
});
