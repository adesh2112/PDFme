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

const ALL_TOOL_ROUTES = [
  { path: '/pdf-to-word', title: 'PDF to Word Converter Online — Free & Genuine DOCX | PDFme', desc: 'Convert PDF to editable Microsoft Word DOCX documents with preserved formatting, headings and tables.', h1: 'PDF to Word Converter Online', toolId: 'pdf-to-word' },
  { path: '/pdf-to-excel', title: 'PDF to Excel Converter Online — XLSX Spreadsheets | PDFme', desc: 'Extract tables, financial data, and structured records from PDF into Microsoft Excel XLSX.', h1: 'PDF to Excel Converter Online', toolId: 'pdf-to-excel' },
  { path: '/pdf-to-ppt', title: 'PDF to PowerPoint Converter Online — PPTX Slides | PDFme', desc: 'Convert PDF pages into editable Microsoft PowerPoint presentation slides.', h1: 'PDF to PowerPoint Converter Online', toolId: 'pdf-to-ppt' },
  { path: '/pdf-to-powerpoint', title: 'PDF to PowerPoint Converter Online — PPTX Slides | PDFme', desc: 'Convert PDF pages into editable Microsoft PowerPoint presentation slides.', h1: 'PDF to PowerPoint Converter Online', toolId: 'pdf-to-ppt' },
  { path: '/pdf-to-jpg', title: 'PDF to JPG Converter Online — High-Resolution Images | PDFme', desc: 'Convert document pages into crisp, high-resolution JPG images with instant download.', h1: 'PDF to JPG Converter Online', toolId: 'pdf-to-jpg' },
  { path: '/pdf-to-png', title: 'PDF to PNG Converter Online — Lossless Images | PDFme', desc: 'Convert PDF pages into high-resolution transparent PNG images.', h1: 'PDF to PNG Converter Online', toolId: 'pdf-to-png' },
  { path: '/pdf-to-images', title: 'PDF to Images Online — ZIP Bundle | PDFme', desc: 'Render all pages into crisp image files bundled into a zip archive.', h1: 'PDF to Images (ZIP Bundle)', toolId: 'pdf-to-images' },
  { path: '/word-to-pdf', title: 'Word to PDF Converter Online — DOCX to Vector PDF | PDFme', desc: 'Convert Word DOCX documents into clean, paginated vector PDF files.', h1: 'Word to PDF Converter Online', toolId: 'word-to-pdf' },
  { path: '/excel-to-pdf', title: 'Excel to PDF Converter Online — XLSX to PDF | PDFme', desc: 'Turn spreadsheets into formatted landscape tabular PDF reports with borders.', h1: 'Excel to PDF Converter Online', toolId: 'excel-to-pdf' },
  { path: '/pptx-to-pdf', title: 'PowerPoint to PDF Converter Online — PPTX to PDF | PDFme', desc: 'Render presentation slides into print-ready vector PDF files.', h1: 'PowerPoint to PDF Converter Online', toolId: 'pptx-to-pdf' },
  { path: '/powerpoint-to-pdf', title: 'PowerPoint to PDF Converter Online — PPTX to PDF | PDFme', desc: 'Render presentation slides into print-ready vector PDF files.', h1: 'PowerPoint to PDF Converter Online', toolId: 'pptx-to-pdf' },
  { path: '/ppt-to-pdf', title: 'PowerPoint to PDF Converter Online — PPTX to PDF | PDFme', desc: 'Render presentation slides into print-ready vector PDF files.', h1: 'PowerPoint to PDF Converter Online', toolId: 'pptx-to-pdf' },
  { path: '/jpg-to-pdf', title: 'JPG to PDF Converter Online — Free Photo to PDF | PDFme', desc: 'Convert JPG images into clean, multi-page vector PDF documents.', h1: 'JPG to PDF Converter Online', toolId: 'jpg-to-pdf' },
  { path: '/png-to-pdf', title: 'PNG to PDF Converter Online — Images to PDF | PDFme', desc: 'Convert PNG images and graphics into professional PDF documents.', h1: 'PNG to PDF Converter Online', toolId: 'png-to-pdf' },
  { path: '/html-to-pdf', title: 'HTML to PDF Converter Online | PDFme', desc: 'Convert HTML code and CSS into styled vector PDF documents.', h1: 'HTML to PDF Converter Online', toolId: 'html-to-pdf' },
  { path: '/split-pdf', title: 'Split PDF Online — Extract Pages & Chapters | PDFme', desc: 'Split documents into individual pages or custom chapter ranges.', h1: 'Split PDF Online', toolId: 'split-pdf' },
  { path: '/reorder-pdf', title: 'Reorder PDF Pages Online — Sort & Organize | PDFme', desc: 'Rearrange and reorder pages in any sequence in your browser.', h1: 'Reorder PDF Pages Online', toolId: 'reorder-pdf' },
  { path: '/organize-pdf', title: 'Organize PDF Pages Online — Sequence & Reorder | PDFme', desc: 'Rearrange and reorder pages in any sequence in your browser.', h1: 'Organize PDF Pages Online', toolId: 'reorder-pdf' },
  { path: '/delete-pages', title: 'Delete PDF Pages Online — Remove Unwanted Pages | PDFme', desc: 'Remove unwanted, blank, or sensitive pages permanently.', h1: 'Delete PDF Pages Online', toolId: 'delete-pages' },
  { path: '/extract-pages', title: 'Extract PDF Pages Online — Standalone Documents | PDFme', desc: 'Extract select pages into a fresh, standalone PDF document.', h1: 'Extract PDF Pages Online', toolId: 'extract-pages' },
  { path: '/rotate-pdf', title: 'Rotate PDF Online — 90, 180, 270 Degrees | PDFme', desc: 'Rotate specific or all pages clockwise or counter-clockwise.', h1: 'Rotate PDF Online', toolId: 'rotate-pdf' },
  { path: '/compress-pdf', title: 'Compress PDF Online — Reduce PDF Size | PDFme', desc: 'Optimize PDF file size while preserving text clarity and image quality.', h1: 'Compress PDF Online', toolId: 'compress-pdf' },
  { path: '/page-numbers', title: 'Add Page Numbers to PDF Online | PDFme', desc: 'Insert customizable page numbers in 6 positions with styling controls.', h1: 'Add Page Numbers to PDF', toolId: 'page-numbers' },
  { path: '/crop-pdf', title: 'Crop PDF Online — Trim Margins | PDFme', desc: 'Trim page margins and adjust visible boundary boxes across all pages.', h1: 'Crop PDF Online', toolId: 'crop-pdf' },
  { path: '/protect-pdf', title: 'Protect PDF Online — Password Encryption | PDFme', desc: 'Encrypt document with 128/256-bit security to prevent unauthorized access.', h1: 'Protect PDF with Password', toolId: 'protect-pdf' },
  { path: '/password-protect', title: 'Protect PDF Online — Password Encryption | PDFme', desc: 'Encrypt document with 128/256-bit security to prevent unauthorized access.', h1: 'Protect PDF with Password', toolId: 'protect-pdf' },
  { path: '/unlock-pdf', title: 'Unlock PDF Online — Remove Password | PDFme', desc: 'Remove password protection and viewing restrictions from PDF files.', h1: 'Unlock PDF Online', toolId: 'unlock-pdf' },
  { path: '/watermark-pdf', title: 'Watermark PDF Online — Add Stamp | PDFme', desc: 'Stamp custom watermark text diagonally across all document pages.', h1: 'Watermark PDF Online', toolId: 'watermark-pdf' },
  { path: '/esign', title: 'E-Signature Workflow Online | PDFme', desc: 'Draw and place verified digital signatures with audit certificate.', h1: 'E-Signature Workflow Online', toolId: 'esign' },
  { path: '/remove-metadata', title: 'Sanitize PDF Metadata Online | PDFme', desc: 'Strip author, software, GPS and revision history from documents.', h1: 'Sanitize PDF Metadata', toolId: 'remove-metadata' },
  { path: '/ai-chat', title: 'AI Chat with PDF Online | PDFme', desc: 'Conversational chat dialog grounded directly in your PDF documents.', h1: 'AI Chat with PDF', toolId: 'ai-chat' },
  { path: '/ai-summarizer', title: 'AI Document Summarizer Online | PDFme', desc: 'Generate executive summaries, key bullet points, and actionable items.', h1: 'AI Document Summarizer', toolId: 'ai-summarizer' },
  { path: '/ai-qa', title: 'Ask PDF Online — AI Questions & Citations | PDFme', desc: 'Ask questions about lengthy documents and receive verified answers with page citations.', h1: 'Ask PDF (Q&A with Citations)', toolId: 'ai-qa' },
  { path: '/ai-assistant', title: 'AI PDF Assistant Online | PDFme', desc: 'Interactive chat copilot for document analysis, citations, and guidance.', h1: 'AI PDF Assistant Online', toolId: 'ai-qa' },
  { path: '/ask-pdf', title: 'Ask PDF Online — Instant Answers | PDFme', desc: 'Get accurate answers directly grounded in the document text with citations.', h1: 'Ask PDF Online', toolId: 'ai-qa' },
  { path: '/ai-insights', title: 'Document Analysis & Insights | PDFme', desc: 'Analyze lexical metrics, reading time, structure segments, and key topics.', h1: 'Document Analysis & Insights', toolId: 'ai-insights' },
  { path: '/document-analysis', title: 'Document Analysis & Insights | PDFme', desc: 'Analyze lexical metrics, reading time, structure segments, and key topics.', h1: 'Document Analysis & Insights', toolId: 'ai-insights' },
  { path: '/ai-extract', title: 'Information Extraction Online | PDFme', desc: 'Auto-extract dates, emails, phone numbers, monetary amounts, and GSTINs.', h1: 'Information Extraction Online', toolId: 'ai-extract' },
  { path: '/information-extraction', title: 'Information Extraction Online | PDFme', desc: 'Auto-extract dates, emails, phone numbers, monetary amounts, and GSTINs.', h1: 'Information Extraction Online', toolId: 'ai-extract' },
  { path: '/ai-contract', title: 'Contract Risk Analyzer Online | PDFme', desc: 'Audit contracts for termination clauses, indemnities, and unusual liabilities.', h1: 'Contract Risk Analyzer Online', toolId: 'ai-contract' },
  { path: '/doc-compare', title: 'Document Comparison Online — Visual Diff | PDFme', desc: 'Side-by-side visual diff highlighting added, modified, or removed figures.', h1: 'Document Comparison Online', toolId: 'doc-compare' },
  { path: '/invoice-extractor', title: 'Invoice Data Extractor Online | PDFme', desc: 'Parse GSTIN, vendor names, line items, and totals into Excel spreadsheets.', h1: 'Invoice Data Extractor Online', toolId: 'invoice-extractor' },
  { path: '/ai-multi', title: 'Multi-PDF Document Analysis Online | PDFme', desc: 'Query and synthesize findings across multiple PDF files simultaneously.', h1: 'Multi-PDF Document Analysis', toolId: 'ai-multi' },
  { path: '/ai-exec-summary', title: 'Executive Summary Generator Online | PDFme', desc: 'High-level briefing with strategic takeaways and milestone dates.', h1: 'Executive Summary Generator', toolId: 'ai-exec-summary' },
  { path: '/ai-translator', title: 'AI PDF Translator Online | PDFme', desc: 'Translate document contents across 20+ languages while preserving layout.', h1: 'AI PDF Translator Online', toolId: 'ai-translator' },
  { path: '/ocr-pdf', title: 'OCR & Searchable PDF Online | PDFme', desc: 'Extract optical text from scanned documents with multi-language OCR.', h1: 'OCR & Searchable PDF Online', toolId: 'ocr-pdf' },
  { path: '/gen-invoice', title: 'GST Invoice Generator Online | PDFme', desc: 'Create professional GST-compliant invoices with automatic tax calculations.', h1: 'GST Invoice Generator Online', toolId: 'gen-invoice' },
  { path: '/invoice-generator', title: 'GST Invoice Generator Online | PDFme', desc: 'Create professional GST-compliant invoices with automatic tax calculations.', h1: 'GST Invoice Generator Online', toolId: 'gen-invoice' },
  { path: '/gen-offer', title: 'Offer Letter Generator Online | PDFme', desc: 'Generate executive employee offer letters with detailed compensation breakdown.', h1: 'Offer Letter Generator Online', toolId: 'gen-offer' },
  { path: '/offer-letter-generator', title: 'Offer Letter Generator Online | PDFme', desc: 'Generate executive employee offer letters with detailed compensation breakdown.', h1: 'Offer Letter Generator Online', toolId: 'gen-offer' },
  { path: '/gen-payslip', title: 'Salary Slip Generator Online | PDFme', desc: 'Itemize employee earnings, PF, TDS deductions, and calculate net take-home salary.', h1: 'Salary Slip Generator Online', toolId: 'gen-payslip' },
  { path: '/salary-slip-generator', title: 'Salary Slip Generator Online | PDFme', desc: 'Itemize employee earnings, PF, TDS deductions, and calculate net take-home salary.', h1: 'Salary Slip Generator Online', toolId: 'gen-payslip' },
  { path: '/gen-exp-cert', title: 'Experience Certificate Generator Online | PDFme', desc: 'Generate official employment verification and conduct certificates on company letterhead.', h1: 'Experience Certificate Generator', toolId: 'gen-exp-cert' },
  { path: '/experience-certificate', title: 'Experience Certificate Generator Online | PDFme', desc: 'Generate official employment verification and conduct certificates on company letterhead.', h1: 'Experience Certificate Generator', toolId: 'gen-exp-cert' },
  { path: '/gen-bulk', title: 'Bulk Document Generator Online | PDFme', desc: 'Merge CSV/Excel records into hundreds of customized certificates or invoices in batch.', h1: 'Bulk Document Generator Online', toolId: 'gen-bulk' },
  { path: '/bulk-document-generator', title: 'Bulk Document Generator Online | PDFme', desc: 'Merge CSV/Excel records into hundreds of customized certificates or invoices in batch.', h1: 'Bulk Document Generator Online', toolId: 'gen-bulk' },
  { path: '/repair-pdf', title: 'Repair Corrupted PDF Online | PDFme', desc: 'Rebuild damaged cross-reference tables and recover salvageable PDF contents.', h1: 'Repair Corrupted PDF Online', toolId: 'repair-pdf' },
  { path: '/flatten-pdf', title: 'Flatten PDF Online — Lock Annotations | PDFme', desc: 'Flatten interactive form fields and signatures into permanent page graphics.', h1: 'Flatten PDF Online', toolId: 'flatten-pdf' },
  { path: '/convert', title: 'Convert PDF — High-Fidelity Office & Image Converters | PDFme', desc: 'Convert between PDF and Microsoft Office (Word, Excel, PowerPoint), JPG, PNG, and HTML.', h1: 'Convert PDF Online', category: 'convert' },
  { path: '/organize', title: 'Organise PDF — Merge, Split, Rotate, Compress | PDFme', desc: 'Rearrange, split, merge, compress, and number multi-page PDF documents.', h1: 'Organise PDF Documents Online', category: 'organize' },
  { path: '/ai', title: 'AI PDF Tools — Document Intelligence & Citations | PDFme', desc: 'State-of-the-art document intelligence powered by AI: Q&A with citations, contract risk analysis.', h1: 'AI Document Intelligence Suite', category: 'ai' },
  { path: '/security', title: 'PDF Security — Encrypt, Sanitize, Sign | PDFme', desc: 'Protect confidential business documents with encryption, permanent redaction, and metadata sanitization.', h1: 'PDF Security Suite', category: 'security' },
  { path: '/business', title: 'Business Document Tools — Invoice, HR, Bulk | PDFme', desc: 'Generate professional, branded corporate documents with tax calculations and bulk generation.', h1: 'Business Document Suite', category: 'business' },
  { path: '/workspace', title: 'Corporate Cloud Workspace | PDFme', desc: 'Multi-tenant team collaboration, document approval workflows, version history, and cloud file persistence.', h1: 'Corporate Cloud Workspace', category: 'workspace' },
  { path: '/pricing', title: 'Simple, Transparent Pricing | PDFme', desc: 'Unlock advanced PDF automation, OCR, AI Assistant, and team workspace collaboration powered by Razorpay.', h1: 'Simple, Transparent Pricing', category: 'pricing' }
];

const PUBLIC_ROUTES = [
  '/',
  '/edit-pdf',
  '/merge-pdf',
  '/photos-to-pdf',
  '/marathi-pdf-editor',
  '/privacy',
  '/terms',
  '/refund',
  '/contact',
  ...ALL_TOOL_ROUTES.map(r => r.path)
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
    title: 'Contact Support & Feedback | PDFme',
    description: 'Get in touch with the PDFme team for technical support, feature suggestions or enterprise inquiries.',
    h1: 'Contact Us & Customer Support',
    category: 'contact'
  }
};

// Populate tool routes metadata
ALL_TOOL_ROUTES.forEach(item => {
  PAGE_METADATA[item.path] = {
    title: item.title,
    description: item.desc,
    h1: item.h1,
    toolId: item.toolId,
    category: item.category || 'tool'
  };
});

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

  // 5. Pre-activate tool or category script if specific route
  if (meta.toolId) {
    const initScript = `
    <script>
      window.addEventListener('DOMContentLoaded', () => {
        try {
          if (typeof navigateToTool === 'function') {
            navigateToTool('${meta.toolId}', false);
          }
        } catch(e) {}
      });
    </script>
    `;
    html = html.replace('</body>', `${initScript}\n</body>`);
  } else if (meta.category && meta.category !== 'home') {
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
