'use strict';
const fs = require('fs');
const path = require('path');

function getSiteUrl(req) {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/+$/, '');
  }
  const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:8080';
  const proto = req.headers['x-forwarded-proto'] || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`;
}

const PUBLIC_ROUTES = [
  '/',
  '/edit-pdf',
  '/merge-pdf',
  '/photos-to-pdf',
  '/marathi-pdf-editor',
  '/privacy',
  '/terms',
  '/refund',
  '/contact'
];

function getRobotsTxt(req) {
  const siteUrl = getSiteUrl(req);
  return `User-agent: *
Allow: /
Allow: /edit-pdf
Allow: /merge-pdf
Allow: /photos-to-pdf
Allow: /marathi-pdf-editor
Allow: /privacy
Allow: /terms
Allow: /refund
Allow: /contact
Disallow: /api/
Disallow: /health

Sitemap: ${siteUrl}/sitemap.xml
`;
}

function getSitemapXml(req) {
  const siteUrl = getSiteUrl(req);
  const now = new Date().toISOString().split('T')[0];

  const items = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/edit-pdf', priority: '0.9', changefreq: 'weekly' },
    { path: '/marathi-pdf-editor', priority: '0.95', changefreq: 'weekly', hreflang: true },
    { path: '/merge-pdf', priority: '0.8', changefreq: 'weekly' },
    { path: '/photos-to-pdf', priority: '0.8', changefreq: 'weekly' },
    { path: '/privacy', priority: '0.5', changefreq: 'monthly' },
    { path: '/terms', priority: '0.5', changefreq: 'monthly' },
    { path: '/refund', priority: '0.5', changefreq: 'monthly' },
    { path: '/contact', priority: '0.6', changefreq: 'monthly' }
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

  for (const item of items) {
    xml += `  <url>\n`;
    xml += `    <loc>${siteUrl}${item.path}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
    xml += `    <priority>${item.priority}</priority>\n`;
    if (item.hreflang) {
      xml += `    <xhtml:link rel="alternate" hreflang="mr" href="${siteUrl}/marathi-pdf-editor" />\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/edit-pdf" />\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/edit-pdf" />\n`;
    }
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  return xml;
}

const PAGE_METADATA = {
  '/': {
    title: 'Pdfme — In-Browser PDF Toolkit & Productivity Suite',
    description: 'Free client-side PDF tools (editor, merge, photos to PDF, Marathi editor) process files locally in your browser. Optional cloud workspace and AI features communicate securely via API.',
    h1: 'Complete In-Browser PDF Toolkit & Productivity Suite',
    category: 'home'
  },
  '/edit-pdf': {
    title: 'Free PDF Editor Online — Edit PDF Text Directly in Browser',
    description: 'Edit existing text in PDF files inline with true font matching. Free in-browser tool runs 100% locally on your device without uploading your document.',
    h1: 'Free Online PDF Text Editor — Edit Text in Browser',
    category: 'edit'
  },
  '/merge-pdf': {
    title: 'Merge PDF Online — Combine Multiple PDF Files Instantly',
    description: 'Combine multiple PDF files into one clean document entirely in your browser. Free client-side processing keeps your documents private on your device.',
    h1: 'Merge PDF Files Online — Combine Documents in Browser',
    category: 'merge'
  },
  '/photos-to-pdf': {
    title: 'Photos to PDF Converter — Convert JPG, PNG Images to PDF Online',
    description: 'Convert pictures, photos and receipts (JPG, PNG, WebP) into professional multi-page PDF documents entirely in your browser without uploads.',
    h1: 'Convert Photos and Images to PDF in Browser',
    category: 'photos'
  },
  '/marathi-pdf-editor': {
    title: 'मराठी पीडीएफ एडिटर — Marathi PDF Text Editor Online',
    description: 'मराठी पीडीएफ फाइल्समधील मजकूर थेट ब्राउझरमध्ये संपादित करा. Noto Sans Devanagari फॉन्ट्स, संयुक्त व्यंजने आणि फोनेटिक टायपिंगसह संपूर्ण मराठी संपादन. क्लायंट-साइड प्रोसेसिंग.',
    h1: 'मराठी पीडीएफ टेक्स्ट एडिटर — Marathi PDF Editor Online',
    lang: 'mr',
    category: 'edit'
  },
  '/privacy': {
    title: 'Privacy Policy — Transparent Data Protection | Pdfme',
    description: 'Learn how Pdfme protects your privacy. Free browser tools process documents strictly on your device. Cloud storage and AI features use secure transit and never share your data.',
    h1: 'Privacy Policy and Data Protection',
    category: 'privacy'
  },
  '/terms': {
    title: 'Terms of Service — Fair & Transparent Terms | Pdfme',
    description: 'Read the terms of service governing the use of Pdfme in-browser utilities and optional cloud subscription features.',
    h1: 'Terms of Service',
    category: 'terms'
  },
  '/refund': {
    title: 'Cancellation and Refund Policy | Pdfme',
    description: 'Review our transparent cancellation and refund terms for optional paid cloud workspace subscriptions.',
    h1: 'Cancellation and Refund Policy',
    category: 'refund'
  },
  '/contact': {
    title: 'Contact Support & Feedback | Pdfme',
    description: 'Get in touch with the Pdfme team for technical support, feature suggestions or enterprise inquiries.',
    h1: 'Contact Us & Customer Support',
    category: 'contact'
  }
};

let cachedIndexHtml = null;

function renderPage(req, routePath) {
  const meta = PAGE_METADATA[routePath] || PAGE_METADATA['/'];
  const siteUrl = getSiteUrl(req);
  const canonicalUrl = `${siteUrl}${routePath === '/' ? '' : routePath}`;
  const ogImageUrl = `${siteUrl}/icons/icon-512.png`;

  if (!cachedIndexHtml) {
    cachedIndexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  }

  let html = cachedIndexHtml;

  // 1. Replace Title & Meta Description
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${meta.title}</title>`);
  html = html.replace(/<meta name="description"[\s\S]*?>/i, `<meta name="description" content="${meta.description}">`);

  // 2. Add or update lang attribute
  if (meta.lang) {
    html = html.replace(/<html lang="[^"]*"/i, `<html lang="${meta.lang}"`);
  } else {
    html = html.replace(/<html lang="[^"]*"/i, `<html lang="en"`);
  }

  // 3. Inject Canonical, Open Graph, Twitter, and JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    'name': meta.title,
    'url': canonicalUrl,
    'description': meta.description,
    'applicationCategory': 'BusinessApplication',
    'operatingSystem': 'Any',
    'browserRequirements': 'Requires JavaScript. Requires HTML5.',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'USD'
    }
  };

  let headTags = `
  <!-- SEO & Canonical Tags -->
  <link rel="canonical" href="${canonicalUrl}">
  ${routePath === '/marathi-pdf-editor' ? `
  <link rel="alternate" hreflang="mr" href="${siteUrl}/marathi-pdf-editor">
  <link rel="alternate" hreflang="en" href="${siteUrl}/edit-pdf">
  <link rel="alternate" hreflang="x-default" href="${siteUrl}/edit-pdf">
  ` : ''}
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${meta.title}">
  <meta property="og:description" content="${meta.description}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:site_name" content="Pdfme">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${meta.title}">
  <meta name="twitter:description" content="${meta.description}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
  ${JSON.stringify(jsonLd, null, 2)}
  </script>
`;

  html = html.replace('</head>', `${headTags}\n</head>`);

  // 4. Update the primary H1 tag for exact page relevance (guarantee exactly ONE H1 per page)
  html = html.replace(/<h1 class="hero-headline"[^>]*>[\s\S]*?<\/h1>/i, `<h1 class="hero-headline" id="hero-headline" style="font-size: clamp(1.8rem, 4.5vw, 2.8rem); font-weight: 800; line-height: 1.15; max-width: 900px; margin: 0 auto 16px auto; letter-spacing: -0.03em;">${meta.h1}</h1>`);

  // 5. Pre-activate category script if specific tool route
  if (meta.category && meta.category !== 'home') {
    const initScript = `
    <script>
      window.addEventListener('DOMContentLoaded', () => {
        try {
          if (typeof switchCategory === 'function') {
            switchCategory('${meta.category}');
          }
        } catch(e) {}
      });
    </script>
    `;
    html = html.replace('</body>', `${initScript}\n</body>`);
  }

  return html;
}

module.exports = {
  PUBLIC_ROUTES,
  PAGE_METADATA,
  getRobotsTxt,
  getSitemapXml,
  renderPage,
  getSiteUrl
};
