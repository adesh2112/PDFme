# PDFme — High-Performance Browser PDF Toolkit

> Edit, merge, and convert PDFs entirely in your browser with zero server roundtrips.  
> **Your files never leave your device.** 100% private, client-side WebAssembly and HTML5 canvas processing.

---

## Features

| Feature | Details |
|---|---|
| **General PDF Editor** | Full in-place text editing across any PDF producer (Word, LaTeX, Chrome, Canva, InDesign) |
| **Geometry & Rotation** | Automatic `/Rotate` (0°, 90°, 180°, 270°), `CropBox`, non-zero origins, 45° tilted and vertical 90° text editing |
| **Wide Character & Unicode** | Local `@pdf-lib/fontkit` embedding for Devanagari (Hindi), Arabic (RTL with `dir="auto"`), Greek, Cyrillic, ligatures, superscripts & math symbols |
| **Scanned PDF OCR** | Built-in offline Tesseract.js WebAssembly worker with English (`eng`) and Hindi (`hin`) recognition |
| **Password-Protected PDFs** | In-app unlock dialog supporting RC4 and AES encrypted documents with lossless flatten saving |
| **100+ Page Virtualization** | Viewport-aware lazy rendering and memory management for smooth 60fps editing on massive documents |
| **Annotation Tools** | Freehand vector drawing, translucent highlighter, cryptographic signature pad, and image stamps |
| **Merge PDFs** | Multi-file drag-and-drop merger with page-range selection |
| **Photos → PDF** | Instant batch conversion of JPEG, PNG, and WebP images with A4, Letter, and Fit-to-photo sizing |
| **PWA & Offline** | Offline-capable Service Worker, mobile-optimized 44px touch targets, zero external tracking |

---

## Edit PDF Engine Architecture

The PDFme Edit engine has been rewritten from the ground up to handle arbitrary real-world PDFs reliably:

### 1. Viewport & Rotation-Aware Geometry
- **Zero Coordinate Assumptions:** Never assumes pages are unrotated, start at `(0, 0)`, or use standard MediaBoxes. All conversions between DOM screen space and PDF user space use `pdf.js` `page.getViewport({ scale })` and `viewport.convertToPdfPoint` / `viewport.convertToViewportPoint`.
- **Arbitrary Text Angles:** Segment orientation is stored as `angle = Math.atan2(transform[1], transform[0])`. Rotated and vertical text elements are rendered as CSS-transformed editable containers with `transform-origin` pinned precisely to the baseline origin. Edits are saved to `pdf-lib` using the matching rotation angle.
- **Transformed Frame Grouping:** Text extraction transforms coordinates into each text line's intrinsic rotated frame `(u, v)` before clustering, ensuring rotated headers and slanted captions group into lines cleanly.

### 2. Producer-Agnostic Text Extraction
- **Dynamic Spacing Detection:** Inserts word spaces when inter-item gaps exceed 15% of the font size. Automatically splits oversized single-item strings containing multiple spaces.
- **Column & Table Integrity:** Enforces hard boundary breaks when horizontal gaps exceed `2.5 × fontSize` or 8% of page width, preventing text from adjacent columns or table cells from inadvertently merging.
- **Reading Order Navigation:** Segments are indexed in visual reading order for full keyboard `Tab` and `Shift+Tab` focus navigation.

### 3. Font Cascade & Local Vector Embedding
- **Cascade Mapping:** Font families are resolved via `page.commonObjs` → `textContent.styles` → font name:
  - Serif, Times, Roman, Georgia, Garamond, Palatino, Minion → **Times**
  - Mono, Courier, Consolas, Menlo → **Courier**
  - Sans-serif and all other fonts → **Helvetica**
- **Style Detection:** Automatically detects Bold, Black, Heavy, Semibold, Italic, Oblique, and Slanted variants.
- **Vendored TrueType Fonts:** Ships with offline Noto TrueType fonts (`Noto Sans`, `Noto Serif`, `Noto Sans Devanagari`, `Noto Sans Arabic`) embedded via `@pdf-lib/fontkit` with subsetting. Non-Latin scripts preserve proper glyph shaping and bidirectional RTL orientation.

### 4. Scanned Document OCR (Tesseract.js WebAssembly)
- **Automatic Scan Detection:** Detects pages lacking digital text and surfaces a non-intrusive "Make text editable (OCR)" action banner.
- **Local Web Worker:** Runs Tesseract.js inside a dedicated Web Worker at scale 2 with real-time percentage progress updates.
- **Clean Background Inpainting:** When edited text is saved on scanned or raster pages, PDFme samples the median background color from border pixels surrounding the text box to eliminate artifacts and gray boxes.

---

## Limitations

1. **Password-Protected PDFs (Encryption):** `pdf-lib` does not currently support writing encrypted PDF revisions or modifying encrypted dictionary trees in vector mode without third-party decryption suites. As a result, password-unlocked PDFs are saved using lossless high-resolution flattened image mode (`outPdf.embedPng`), preserving 100% visual fidelity while removing the password gate.
2. **Unsupported Rare Scripts:** Scripts outside Latin Extended, Cyrillic, Greek, Devanagari, and Arabic automatically fall back to flatten mode upon saving to prevent missing-glyph boxes (`?`).
3. **Paragraph Reflow:** Editing replaces text within its specified segment boundary. PDFme does not reflow entire paragraphs across multi-line newspaper columns when adding large amounts of text.
4. **Form Fields (AcroForms):** Interactive form widgets remain intact in standard vector mode, but are rasterized if the user explicitly enables "Flatten mode".

---

## Running Locally

```bash
# Option 1 — Built-in Node test server
node server.js
# Open http://localhost:8080

# Option 2 — Python built-in server
python -m http.server 8080
# Open http://localhost:8080
```

---

## Automated Verification Test Suite

PDFme includes a comprehensive 12-document headless verification suite testing across real-world edge cases:

```bash
# Generate the 12-document test corpus
node build-test-corpus.js

# Run full automated headless Chrome verification
node run-all-pdf-tests.js
```

Each test verifies:
- Baseline difference $\le 1.0\text{px}$ against original glyph position
- Strict zero-pixel diff ($0\text{ diffs}$) outside edited bounding boxes
- Verification that `getTextContent` of saved PDF reflects the updated text
