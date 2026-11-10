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

---

## Operational Limits & Known Behaviors

1. **Document Upload Limit:** Maximum 10MB per upload for AI processing and cloud document storage.
2. **AI Rate Limits:** Free tier users are limited to 10 queries per day; Pro tier provides 500 queries per day.
3. **Password-Protected PDFs:** Encrypted PDFs are unlocked in the browser using the document password. Saving an unlocked file flattens the image layer losslessly to remove the password restriction.
4. **Text Editing Boundaries:** In-place text editing replaces text within its extracted line/block frame with automated background inpainting. Arbitrary cross-column paragraph reflow is in active development.
