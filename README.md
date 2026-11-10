# PDFme — Commercial PDF Productivity & Business Platform

> Complete browser-first PDF platform: high-fidelity client-side editing, conversions, organization, and security, combined with a secure Node.js backend for user accounts, PostgreSQL cloud persistence, AI document intelligence, and Razorpay standard checkout.

---

## Architecture & Privacy Model

PDFme follows an honest, dual-tier privacy model:

1. **Client-Side Browser Processing (100% Private, Zero Server Uploads):**
   - General PDF text editing, annotations, freehand drawing, and signatures
   - PDF merging, splitting, rotating, reordering, deleting, and page numbering
   - Image conversion (Photos to PDF) and client-side OpenXML conversion (Word, Excel, PPT)
   - Password encryption, metadata sanitization, and permanent solid redactions
   - Document generators (Invoices, Receipts, NDAs, Quotations, Certificates) and visual diff comparison
   - *Your documents in these tools never leave your browser.*

2. **Backend Services (Processed Securely via Node.js API):**
   - **User Accounts & Authentication:** Bcrypt password hashing, HMAC-SHA256 signed session tokens, and httpOnly cookies.
   - **Cloud Workspace & Sync:** Multi-tenant document and folder storage backed by PostgreSQL.
   - **AI PDF Intelligence:** Transient in-memory text parsing for Q&A citations, summaries, and contract analysis. Files and text are never written to disk, never logged, and never used for model training.
   - **Monetization & Checkout:** Server-side Razorpay order creation, timing-safe HMAC-SHA256 signature verification, and automated webhooks.

---

## Platform Features

| Category | Features | Execution | Data Storage |
|---|---|---|---|
| **1. PDF Editor** | In-place text editing, font cascade, floating formatting toolbar (font, size, color, bold, italic, underline, alignment, line spacing), vector signature pad, password unlock | In-Browser (Wasm & Canvas) | Browser memory |
| **2. PDF Conversion** | Word to PDF (DOCX), Excel to PDF (XLSX), PPT to PDF (PPTX), PDF to Word, PDF to Images, HTML to PDF | In-Browser (OpenXML / pdf.js) | Browser memory |
| **3. PDF Organization** | Merge multi-page PDFs, split pages, rotate 90°/180°/270°, reorder, delete, extract, duplicate, compress, page numbers | In-Browser (`pdf-lib`) | Browser memory |
| **4. AI Intelligence** | AI PDF Assistant, Multi-PDF Chat, Document Summarizer, Contract Analyzer, Document Translator | Node.js Backend API | Transient RAM only |
| **5. PDF Security** | AES/RC4 password protection, metadata stripping, permanent black-out redaction, custom watermarks, secure share tokens | In-Browser (`pdf-lib`) | Browser memory |
| **6. Business Tools** | Invoice, Receipt, NDA, Quotation, and Certificate generators; E-Sign audit trail certificate; Document visual comparison; GSTIN Invoice Extractor | In-Browser | Browser memory |
| **7. Corporate Workspace** | Multi-tenant organization accounts, cloud document persistence, document approvals, version history, audit trail | Node.js Backend API | PostgreSQL Database |
| **8. Monetization** | Free, Pro (₹799/mo), Enterprise (₹2,499/mo) plans; Razorpay standard checkout, webhook listener | Node.js Backend API | PostgreSQL Database |

---

## Environment Variables

Configure these variables on your server or in your `.env` file for local development:

| Variable | Required | Description |
|---|---|---|
| `PORT` | Optional | Port on which the Node server listens (default: `8080`, Render: `10000`). |
| `SITE_URL` | Recommended | Canonical production domain URL (e.g. `https://pdfme.com`). Used for canonical links, Open Graph `og:url` / `og:image`, Twitter tags, `sitemap.xml`, and `robots.txt`. If omitted, dynamically infers from request host. |
| `NODE_ENV` | Optional | `production` or `development`. Enables secure cookie attributes in production. |
| `DATABASE_URL` | Recommended | PostgreSQL connection URI (e.g. Neon, Supabase, or Render PostgreSQL). If omitted, falls back to persistent JSON storage in `data/workspace-data.json`. |
| `SESSION_SECRET` | Recommended | Random secret string used to sign HMAC-SHA256 authentication cookies. |
| `RAZORPAY_KEY_ID` | Optional | Razorpay key ID (`rzp_test_...` or `rzp_live_...`). Required for checkout. |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay key secret for verifying payment signatures. **Keep secret.** |
| `RAZORPAY_WEBHOOK_SECRET` | Optional | Secret key configured in Razorpay dashboard for webhook HMAC verification. |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for AI assistant. If omitted, uses built-in semantic analyzer. |
| `DEBUG` | Optional | Set to `true` to display the ₹10 developer test checkout button on the pricing page. |
| `ALLOWED_ORIGINS` | Optional | Comma-separated list of allowed CORS domains beyond `localhost:51002`, `localhost:8080`, and `*.onrender.com`. |

---

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run backend and serve application
npm start
# Server listens on http://localhost:8080

# 3. Run automated regression test suite
npm test
```

---

## Deploying to Render

PDFme includes a validated `render.yaml` Infrastructure Blueprint configured for single-service deployment with an attached managed database.

### Blueprint Resources (Exactly 2 Resources)

1. **Managed PostgreSQL Database (`pdfme-db`):**
   - **Database Name:** `pdfme`
   - **User:** `pdfme_user`
   - **Plan:** `free`

2. **Unified Node.js Web Service (`pdfme`):**
   - **Runtime:** `node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - **Architecture:** Serves the frontend static client and the backend `/api/*` routes from a single unified server instance. The frontend interacts with backend endpoints via relative URLs on the same origin, removing any need for external CORS or base URL configurations in production.
   - **PORT:** The server automatically binds to the `PORT` assigned by Render's environment (`process.env.PORT`).

### Environment Variable Management

All environment variables in `render.yaml` are zero-leak by design:
- `DATABASE_URL`: Automatically populated via `fromDatabase` (`pdfme-db` connectionString).
- `SESSION_SECRET`: Automatically generated cryptographically secure secret via `generateValue: true`.
- `RAZORPAY_KEY_ID`: Declared by name with `sync: false` (Render prompts for value in dashboard).
- `RAZORPAY_KEY_SECRET`: Declared by name with `sync: false` (Render prompts for value in dashboard).
- `RAZORPAY_WEBHOOK_SECRET`: Declared by name with `sync: false` (Render prompts for value in dashboard).
- `GEMINI_API_KEY`: Declared by name with `sync: false` (Render prompts for value in dashboard).
- `SITE_URL`: Declared by name with `sync: false` (Set to your custom domain, e.g. `https://pdfme.com`).

---

## Public Routes & Google Indexable Pages

PDFme provides server-rendered, crawlable HTML pages for all core public tools and legal compliance pages. Each route includes a unique title, meta description, canonical link tag, exactly one `<h1>` heading, Open Graph (`og:*`), Twitter Card tags, and structured JSON-LD (`WebApplication`):

| Route | Purpose & Description | Language | Indexed |
|---|---|---|---|
| `/` | Complete In-Browser PDF Toolkit & Productivity Suite | `en` | Yes |
| `/edit-pdf` | Free Online PDF Text Editor (Client-Side) | `en` | Yes |
| `/merge-pdf` | Merge PDF Files Online (Client-Side) | `en` | Yes |
| `/photos-to-pdf` | Photos and Images to PDF Converter | `en` | Yes |
| `/marathi-pdf-editor` | मराठी पीडीएफ टेक्स्ट एडिटर (Marathi Inline Editor) | `mr` / `en` | Yes |
| `/privacy` | Privacy Policy and Data Protection | `en` | Yes |
| `/terms` | Terms of Service | `en` | Yes |
| `/refund` | Cancellation and Refund Policy | `en` | Yes |
| `/contact` | Contact Us & Customer Support | `en` | Yes |
| `/sitemap.xml` | XML Sitemap with `hreflang` alternates | XML | Yes |
| `/robots.txt` | Crawler directives allowing public routes & disallowing `/api/` | Text | Yes |

---

## Marathi (Devanagari) Inline PDF Text Editor

PDFme includes specialized inline editing for Marathi Devanagari text documents:

- **Vendored Typography:** Includes Google Noto Sans Devanagari and Noto Serif Devanagari (Regular and Bold, `.woff2` and `.ttf`, OFL license). Fonts are dynamically loaded via `@font-face` with unicode-range (`U+0900-097F`, `U+1CD0-1CFF`, `U+A8E0-A8FF`) only when Devanagari text is detected.
- **Smart Grapheme Cluster Editing:** Segments are rendered as inline `contenteditable` elements with `lang="mr"`, taller line-height (1.45) for conjuncts and stacked matras, and Backspace deletions powered by `Intl.Segmenter('mr', { granularity: 'grapheme' })` to safely remove combined grapheme clusters.
- **No Popups or Magnifier Zoom:** Native inline editing with zero `prompt()` or modal popups. On iOS, elements scale with CSS transforms to prevent Safari's automatic zoom while allowing full user pinch zoom.
- **Phonetic Typing Toggle:** Optional "Marathi (phonetic)" toggle converts Roman keystrokes to Devanagari on the fly (e.g., `namaskar` -> `नमस्कार`) using a vendored MIT-licensed transliteration engine, while native Windows Marathi keyboards and Gboard work automatically.
- **Dual-Mode Vector & Fallback Saving:** Vector mode embeds subsetted Noto fonts via `@pdf-lib/fontkit`. The saved document is verified via PDF.js; if complex conjunct shaping cannot be verified, the segment is rendered losslessly via canvas at 4x with a transparent background and placed at the exact position as a crisp PNG, accompanied by an informative toast.
- **In-Browser OCR:** Scanned documents and legacy font PDFs can be transcribed locally with Tesseract.js using vendored Marathi (`mar`), Hindi (`hin`), and English (`eng`) models.

---

## Progressive Web App (PWA) & Chrome Install

PDFme is a full Progressive Web App installable directly in Google Chrome on desktop and mobile:
- **Manifest:** Includes 192x192 and 512x512 icons in both standard and maskable formats.
- **Service Worker (`sw.js`):** Offline-first caching of all application shell scripts, Devanagari fonts, and tool bundles.
- **Full Offline Operation:** In-browser tools (Edit, Merge, Photos-to-PDF, Marathi Editor) function without an active internet connection.
- **Install Button:** Native `#pwa-install-btn` in the header hooks into `beforeinstallprompt` to give users a one-click install flow.

---

## What You Must Do Manually

Once you deploy PDFme to your hosting provider (Render, Vercel, AWS, or VPS), complete these two manual steps:

1. **Configure Your Custom Domain & DNS:**
   - Add an `A` record pointing `@` to your host's IP address, or a `CNAME` record pointing `www` to your host's URL.
   - In your hosting dashboard, add the custom domain and verify SSL/TLS certification.
   - Set the `SITE_URL` environment variable to your full domain (e.g., `SITE_URL=https://pdfme.com`).

2. **Submit Sitemap to Google Search Console:**
   - Open [Google Search Console](https://search.google.com/search-console).
   - Add your domain as a URL prefix property (e.g. `https://pdfme.com`).
   - Verify ownership using the HTML tag or DNS TXT record.
   - Navigate to **Sitemaps** in the left sidebar, enter `sitemap.xml`, and click **Submit**. Google will crawl all 9 public routes and index them with language alternates.

---

## Operational Limits & Honest Technical Boundaries

1. **Legacy 8-Bit Marathi Fonts:** Documents generated with non-Unicode legacy Marathi fonts (e.g., Kruti Dev, Shree-Lipi, Walkman, DVB, APS, Agra, Chanakya) use ASCII code points mapped to font-specific glyph tables rather than true Devanagari Unicode. PDFme automatically identifies these legacy font signatures, alerts the user with a warning banner, and directs them to the built-in OCR feature instead of presenting corrupted gibberish.
2. **Complex OpenType Shaping Fallback:** Certain PDF readers lack full HarfBuzz OpenType layout tables for Devanagari conjuncts. PDFme performs verification of rendered glyph baselines; when vector subset embedding cannot guarantee identical visual shaping across all external readers, PDFme transparently renders the affected run as a 4x high-resolution transparent PNG.
3. **Document Upload Limit:** Maximum 10MB per upload for backend AI processing and PostgreSQL cloud document storage. Free in-browser tools (Editor, Merge, Photos, Marathi) operate entirely in client memory and can handle files up to browser memory limits.
4. **AI Rate Limits:** Free tier users are limited to 10 queries per day; Pro tier provides 500 queries per day.
5. **Password-Protected PDFs:** Encrypted PDFs are unlocked in the browser using the document password. Saving an unlocked file flattens the image layer losslessly to remove the password restriction.
