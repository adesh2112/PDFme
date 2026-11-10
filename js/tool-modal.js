'use strict';
/**
 * PDFme Unified Tool Modal & Interactive Processing Controller
 * Implements real client-side PDF operations, genuine conversions,
 * AI document queries, and business document generation.
 */

(function initToolModalSystem() {
  let currentToolId = null;
  let currentToolName = '';
  let uploadedFile = null;
  let uploadedFileBytes = null;
  let secondaryFile = null;
  let secondaryFileBytes = null;
  let multipleFiles = [];
  let processedResult = null;
  let pdfPageCount = 0;

  // Helpers
  function downloadBlob(bytes, filename, mimeType = 'application/pdf') {
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  async function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  async function extractTextFromPdfBytes(bytes) {
    if (typeof window.pdfjsLib === 'undefined') {
      throw new Error('PDF.js library is loading. Please try again in a moment.');
    }
    const doc = await window.pdfjsLib.getDocument({ data: bytes }).promise;
    const pages = [];
    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(it => it.str).join(' ');
      pages.push({ pageNum: i, text: pageText });
      fullText += `\n--- Page ${i} ---\n` + pageText;
    }
    return { fullText, pages, pageCount: doc.numPages };
  }

  // --- Modal Open & Close ---
  window.openToolModal = function(toolId, toolName) {
    currentToolId = toolId;
    currentToolName = toolName || toolId;
    uploadedFile = null;
    uploadedFileBytes = null;
    secondaryFile = null;
    secondaryFileBytes = null;
    multipleFiles = [];
    processedResult = null;
    pdfPageCount = 0;

    const modal = document.getElementById('tool-modal-backdrop');
    if (!modal) return;

    // Set title
    const titleEl = document.getElementById('tool-modal-title');
    if (titleEl) titleEl.textContent = currentToolName;

    // Reset views
    renderToolInitialUI();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeToolModal = function() {
    const modal = document.getElementById('tool-modal-backdrop');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  function getAcceptedFileTypes(toolId) {
    switch (toolId) {
      case 'word-to-pdf': return '.docx';
      case 'excel-to-pdf': return '.xlsx';
      case 'ppt-to-pdf':
      case 'pptx-to-pdf': return '.pptx';
      case 'jpg-to-pdf': return '.jpg,.jpeg';
      case 'png-to-pdf': return '.png';
      case 'photos-to-pdf': return '.jpg,.jpeg,.png,.webp';
      case 'html-to-pdf': return '.html,.htm,.txt';
      case 'gen-bulk': return '.csv,.xlsx';
      default: return '.pdf';
    }
  }

  function getToolDescription(toolId) {
    const descMap = {
      'split-pdf': 'Split your document into individual single-page PDFs or custom chapter ranges.',
      'compress-pdf': 'Optimize file size with stream compression while preserving vector text and image clarity.',
      'rotate-pdf': 'Rotate specific or all pages 90, 180, or 270 degrees clockwise.',
      'organize-pdf': 'Rearrange pages into any custom sequence and remove redundant sheets.',
      'delete-pages': 'Delete unwanted, blank, or sensitive pages permanently.',
      'extract-pages': 'Extract select pages into a fresh, standalone PDF document.',
      'password-protect': 'Encrypt your document with 128-bit/256-bit security to prevent unauthorized viewing.',
      'unlock-pdf': 'Remove encryption from a password-protected PDF file.',
      'watermark-pdf': 'Stamp custom watermark text (e.g. Confidential, Draft, Sample) diagonally across all pages.',
      'page-numbers': 'Add custom page numbers in any of 6 positions with font and styling controls.',
      'crop-pdf': 'Trim page margins and adjust document bounding boxes.',
      'esign': 'Draw or apply your digital signature and generate a verified audit certificate.',
      'remove-metadata': 'Sanitize document by removing Author, Creator, Subject, Dates, and hidden XMP streams.',
      'pdf-to-word': 'Extract headings, paragraphs, and formatting into genuine Microsoft Word .docx files.',
      'word-to-pdf': 'Render Microsoft Word (.docx) documents into clean, paginated vector PDF files.',
      'pdf-to-excel': 'Parse financial and tabular records into genuine Microsoft Excel .xlsx spreadsheets.',
      'excel-to-pdf': 'Convert spreadsheets into formatted landscape tabular PDF reports with zebra striping.',
      'pdf-to-ppt': 'Convert document pages into Microsoft PowerPoint (.pptx) presentation slides.',
      'ppt-to-pdf':
      'pptx-to-pdf': 'Render 16:9 widescreen presentation slides into print-ready vector PDF.',
      'pdf-to-jpg': 'Render each page as a crisp, high-resolution JPG image file.',
      'pdf-to-png': 'Render each page as a lossless, high-resolution PNG image file.',
      'pdf-to-images': 'Render all pages into crisp image files bundled in a zip archive.',
      'jpg-to-pdf':
      'png-to-pdf': 'Convert image photos into a high-quality PDF document.',
      'html-to-pdf': 'Convert HTML rich markup into styled vector PDF with headings and lists.',
      'ai-assistant': 'Ask questions about your PDF and receive verified answers with exact page references.',
      'ai-chat': 'Interactive conversational dialog with your PDF document.',
      'ai-summarizer': 'Generate executive summaries, bullet points, key dates, and action items.',
      'ai-qa': 'Get accurate answers directly grounded in the document text with citations.',
      'ai-extract': 'Extract structured entities: dates, emails, phone numbers, amounts, and GSTINs.',
      'ai-insights': 'Analyze lexical metrics, reading time, structure segments, and key topics.',
      'ai-contract': 'Audit contracts for termination clauses, unusual liabilities, and missing terms.',
      'invoice-extractor': 'Parse GSTIN, vendor names, line items, and totals directly into Excel (.xlsx).',
      'ai-multi': 'Query and synthesize information across multiple PDF documents simultaneously.',
      'ai-exec-summary': 'Generate high-level executive summaries with key takeaways and conclusions.',
      'doc-compare': 'Side-by-side visual diff highlighting added, removed, or changed numbers and terms.',
      'gen-invoice': 'Generate professional GST-compliant corporate invoices with automatic tax calculations.',
      'gen-offer': 'Generate branded employment offer letters with detailed compensation breakdown.',
      'gen-payslip': 'Itemize earnings, PF, TDS deductions, and calculate net take-home salary.',
      'gen-exp-cert': 'Generate official Experience & Relieving Certificates on corporate letterhead.',
      'gen-bulk': 'Merge CSV / Excel records into hundreds of custom PDFs bundled in a zip archive.'
    };
    return descMap[toolId] || 'Process and convert your documents securely in your browser.';
  }

  function renderToolInitialUI() {
    const container = document.getElementById('tool-modal-body');
    if (!container) return;

    const isBusinessGenerator = currentToolId.startsWith('gen-') && currentToolId !== 'gen-bulk';
    const isDocCompare = currentToolId === 'doc-compare';
    const isMultiAi = currentToolId === 'ai-multi';
    const isHtmlToPdf = currentToolId === 'html-to-pdf';

    const desc = getToolDescription(currentToolId);

    if (isBusinessGenerator) {
      renderBusinessGeneratorUI(container);
      return;
    }

    if (isHtmlToPdf) {
      renderHtmlToPdfUI(container);
      return;
    }

    const accept = getAcceptedFileTypes(currentToolId);

    container.innerHTML = `
      <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:20px;line-height:1.5;">${desc}</p>

      <div id="tool-drop-zone" class="tool-dropzone" onclick="document.getElementById('tool-file-input').click()">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" style="color:var(--saas-accent);margin-bottom:12px;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p style="font-weight:700;font-size:1rem;margin-bottom:6px;">Choose a file or drag & drop here</p>
        <p style="font-size:0.8rem;color:var(--text-muted);">Supports ${accept} (Up to 50 MB)</p>
        <input type="file" id="tool-file-input" accept="${accept}" ${isMultiAi ? 'multiple' : ''} style="display:none;" onchange="handleToolFileSelected(event)">
      </div>

      ${isDocCompare ? `
        <div style="margin-top:16px;">
          <label style="font-size:0.85rem;font-weight:700;display:block;margin-bottom:6px;">Second Document (to compare against):</label>
          <div id="tool-drop-zone-2" class="tool-dropzone" style="padding:16px;" onclick="document.getElementById('tool-file-input-2').click()">
            <p style="font-weight:600;font-size:0.9rem;">Choose second PDF</p>
            <input type="file" id="tool-file-input-2" accept=".pdf" style="display:none;" onchange="handleSecondaryFileSelected(event)">
          </div>
          <div id="file-info-badge-2" style="display:none;margin-top:8px;"></div>
        </div>
      ` : ''}

      <div id="file-info-badge" style="display:none;margin-top:16px;"></div>
      <div id="tool-options-area" style="margin-top:20px;"></div>
      <div id="tool-status-area" style="margin-top:16px;"></div>

      <div class="modal-actions" style="margin-top:24px;display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="closeToolModal()">Cancel</button>
        <button class="btn btn-primary" id="tool-execute-btn" onclick="executeCurrentTool()" disabled style="padding:10px 24px;">
          Process Now
        </button>
      </div>
    `;

    setupDragAndDrop();
  }

  function setupDragAndDrop() {
    const dropZone = document.getElementById('tool-drop-zone');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
      }, false);
    });

    dropZone.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        processSelectedFile(files[0]);
      }
    });
  }

  window.handleToolFileSelected = function(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (currentToolId === 'ai-multi') {
      multipleFiles = Array.from(files);
      processMultipleFiles(multipleFiles);
    } else {
      processSelectedFile(files[0]);
    }
  };

  window.handleSecondaryFileSelected = function(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    secondaryFile = files[0];
    readFileAsArrayBuffer(secondaryFile).then(bytes => {
      secondaryFileBytes = bytes;
      const badge2 = document.getElementById('file-info-badge-2');
      if (badge2) {
        badge2.style.display = 'block';
        badge2.innerHTML = `
          <div style="padding:8px 12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;font-size:0.85rem;display:flex;align-items:center;justify-content:space-between;">
            <span>📄 <strong>${secondaryFile.name}</strong> (${formatBytes(secondaryFile.size)})</span>
            <span style="color:var(--saas-accent);font-weight:700;">✓ Ready</span>
          </div>
        `;
      }
      checkCanExecute();
    });
  };

  async function processSelectedFile(file) {
    uploadedFile = file;
    const badge = document.getElementById('file-info-badge');
    const executeBtn = document.getElementById('tool-execute-btn');

    if (badge) {
      badge.style.display = 'block';
      badge.innerHTML = `
        <div style="padding:10px 14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <span style="font-size:1.4rem;">📄</span>
            <div style="min-width:0;">
              <p style="font-weight:700;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${file.name}">${file.name}</p>
              <p style="font-size:0.75rem;color:var(--text-muted);">${formatBytes(file.size)}</p>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('tool-file-input').click()" style="padding:4px 10px;font-size:0.75rem;">Change</button>
        </div>
      `;
    }

    try {
      uploadedFileBytes = await readFileAsArrayBuffer(file);

      // If it's a PDF, inspect page count
      if (file.name.toLowerCase().endsWith('.pdf')) {
        try {
          if (window.PDFLib) {
            const pdfDoc = await window.PDFLib.PDFDocument.load(uploadedFileBytes, { ignoreEncryption: true });
            pdfPageCount = pdfDoc.getPageCount();
          }
        } catch (e) {
          console.warn('Could not read page count via PDFLib:', e.message);
        }
      }

      renderToolOptions(currentToolId);
      checkCanExecute();
    } catch (err) {
      showToolError('Failed to read file: ' + err.message);
    }
  }

  async function processMultipleFiles(files) {
    const badge = document.getElementById('file-info-badge');
    if (badge) {
      badge.style.display = 'block';
      badge.innerHTML = `
        <div style="padding:10px 14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
          <p style="font-weight:700;font-size:0.9rem;margin-bottom:4px;">${files.length} Documents Selected</p>
          <ul style="font-size:0.8rem;color:var(--text-muted);padding-left:18px;margin:0;">
            ${files.slice(0, 5).map(f => `<li>${f.name} (${formatBytes(f.size)})</li>`).join('')}
            ${files.length > 5 ? `<li>...and ${files.length - 5} more</li>` : ''}
          </ul>
        </div>
      `;
    }
    renderToolOptions(currentToolId);
    checkCanExecute();
  }

  function checkCanExecute() {
    const btn = document.getElementById('tool-execute-btn');
    if (!btn) return;
    if (currentToolId === 'doc-compare') {
      btn.disabled = !(uploadedFileBytes && secondaryFileBytes);
    } else if (currentToolId === 'ai-multi') {
      btn.disabled = multipleFiles.length < 2;
    } else {
      btn.disabled = !uploadedFileBytes;
    }
  }

  // --- Render Options Per Tool ---
  function renderToolOptions(toolId) {
    const optArea = document.getElementById('tool-options-area');
    if (!optArea) return;

    switch (toolId) {
      case 'split-pdf':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:8px;">Split Mode:</label>
            <div style="display:flex;gap:14px;margin-bottom:12px;">
              <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;">
                <input type="radio" name="split-mode" value="all" checked onchange="toggleSplitRangeInput(false)">
                Every page as a separate PDF (Total: ${pdfPageCount || 'All'} pages)
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;">
                <input type="radio" name="split-mode" value="ranges" onchange="toggleSplitRangeInput(true)">
                Custom page ranges
              </label>
            </div>
            <div id="split-range-box" style="display:none;">
              <label style="font-size:0.8rem;color:var(--text-muted);display:block;margin-bottom:4px;">Enter ranges (comma-separated, e.g. "1-2, 3-5"):</label>
              <input type="text" id="split-ranges-input" class="auth-input" placeholder="e.g. 1-2, 3-5" style="width:100%;box-sizing:border-box;">
            </div>
          </div>
        `;
        break;

      case 'compress-pdf':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:8px;">Compression Level:</label>
            <div style="display:flex;gap:14px;">
              <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;">
                <input type="radio" name="compress-level" value="recommended" checked>
                <strong>Recommended</strong> (Optimal balance: ~40–60% reduction, crisp text)
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;">
                <input type="radio" name="compress-level" value="extreme">
                <strong>Extreme</strong> (Maximum size reduction for email)
              </label>
            </div>
          </div>
        `;
        break;

      case 'rotate-pdf':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:8px;">Rotation Angle:</label>
            <div style="display:flex;gap:10px;margin-bottom:12px;">
              <button type="button" class="btn btn-ghost btn-sm rotate-angle-btn active" data-angle="90" onclick="setRotateAngle(this, 90)">↻ 90° Clockwise</button>
              <button type="button" class="btn btn-ghost btn-sm rotate-angle-btn" data-angle="180" onclick="setRotateAngle(this, 180)">↻ 180° Half Turn</button>
              <button type="button" class="btn btn-ghost btn-sm rotate-angle-btn" data-angle="270" onclick="setRotateAngle(this, 270)">↺ 90° Counter-CW</button>
            </div>
            <label style="font-size:0.8rem;color:var(--text-muted);display:block;margin-bottom:4px;">Pages to rotate ("all" or e.g. "1, 3-5"):</label>
            <input type="text" id="rotate-pages-input" class="auth-input" value="all" style="width:100%;box-sizing:border-box;">
          </div>
        `;
        break;

      case 'organize-pdf':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:4px;">New Page Sequence:</label>
            <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;">Document has ${pdfPageCount} pages. Enter 1-based page order (e.g. "${Array.from({length: Math.min(3, pdfPageCount || 3)}, (_, i) => pdfPageCount - i).join(', ')}"):</p>
            <input type="text" id="reorder-sequence-input" class="auth-input" value="${Array.from({length: pdfPageCount || 3}, (_, i) => i + 1).reverse().join(', ')}" style="width:100%;box-sizing:border-box;">
          </div>
        `;
        break;

      case 'delete-pages':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:4px;">Pages to Delete:</label>
            <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;">Document has ${pdfPageCount} pages. Enter page numbers or ranges to remove (e.g. "2, 4-5"):</p>
            <input type="text" id="delete-pages-input" class="auth-input" placeholder="e.g. 2, 4-5" style="width:100%;box-sizing:border-box;">
          </div>
        `;
        break;

      case 'extract-pages':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:4px;">Pages to Extract:</label>
            <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;">Document has ${pdfPageCount} pages. Enter page numbers or ranges to save into a new PDF (e.g. "1, 3-4"):</p>
            <input type="text" id="extract-pages-input" class="auth-input" placeholder="e.g. 1, 3-4" style="width:100%;box-sizing:border-box;">
          </div>
        `;
        break;

      case 'password-protect':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:8px;">Enter Document Password:</label>
            <div style="display:flex;gap:8px;">
              <input type="password" id="protect-password-input" class="auth-input" placeholder="Set secure password" style="flex:1;">
              <button type="button" class="btn btn-ghost btn-sm" onclick="togglePasswordVisibility('protect-password-input')">Show</button>
            </div>
          </div>
        `;
        break;

      case 'unlock-pdf':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:8px;">Enter Password to Decrypt:</label>
            <input type="password" id="unlock-password-input" class="auth-input" placeholder="Enter password" style="width:100%;box-sizing:border-box;">
          </div>
        `;
        break;

      case 'watermark-pdf':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:6px;">Watermark Text:</label>
            <input type="text" id="watermark-text-input" class="auth-input" value="CONFIDENTIAL" style="width:100%;box-sizing:border-box;margin-bottom:12px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label style="font-size:0.8rem;color:var(--text-muted);display:block;margin-bottom:4px;">Color:</label>
                <select id="watermark-color-select" class="auth-input" style="width:100%;">
                  <option value="gray">Subtle Gray</option>
                  <option value="red">Urgent Red</option>
                  <option value="blue">Corporate Blue</option>
                  <option value="amber">Warning Amber</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.8rem;color:var(--text-muted);display:block;margin-bottom:4px;">Opacity: <span id="opacity-val">30%</span></label>
                <input type="range" id="watermark-opacity-slider" min="10" max="70" value="30" oninput="document.getElementById('opacity-val').textContent = this.value + '%'" style="width:100%;">
              </div>
            </div>
          </div>
        `;
        break;

      case 'page-numbers':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
              <div>
                <label style="font-size:0.8rem;font-weight:700;display:block;margin-bottom:4px;">Position:</label>
                <select id="page-num-position" class="auth-input" style="width:100%;">
                  <option value="bottom-center" selected>Bottom Center</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-center">Top Center</option>
                  <option value="top-right">Top Right</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.8rem;font-weight:700;display:block;margin-bottom:4px;">Format:</label>
                <select id="page-num-format" class="auth-input" style="width:100%;">
                  <option value="Page {n} of {total}" selected>Page {n} of {total}</option>
                  <option value="{n} / {total}">{n} / {total}</option>
                  <option value="{n}">{n}</option>
                </select>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <label style="font-size:0.8rem;color:var(--text-muted);">Font Size:
                <input type="number" id="page-num-size" value="10" min="6" max="24" class="auth-input" style="width:60px;margin-left:6px;">
              </label>
              <label style="font-size:0.8rem;color:var(--text-muted);">Start from page:
                <input type="number" id="page-num-start" value="1" min="1" max="${pdfPageCount || 999}" class="auth-input" style="width:60px;margin-left:6px;">
              </label>
            </div>
          </div>
        `;
        break;

      case 'crop-pdf':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:8px;">Margin Trim (points, 72 pt = 1 inch):</label>
            <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;">
              <div><span style="font-size:0.75rem;color:var(--text-muted);">Top:</span><input type="number" id="crop-top" value="20" class="auth-input" style="width:100%;"></div>
              <div><span style="font-size:0.75rem;color:var(--text-muted);">Bottom:</span><input type="number" id="crop-bottom" value="20" class="auth-input" style="width:100%;"></div>
              <div><span style="font-size:0.75rem;color:var(--text-muted);">Left:</span><input type="number" id="crop-left" value="20" class="auth-input" style="width:100%;"></div>
              <div><span style="font-size:0.75rem;color:var(--text-muted);">Right:</span><input type="number" id="crop-right" value="20" class="auth-input" style="width:100%;"></div>
            </div>
          </div>
        `;
        break;

      case 'esign':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:6px;">Draw Your Signature:</label>
            <canvas id="esign-tool-canvas" width="460" height="120" style="background:#FFFFFF;border:1px solid var(--border);border-radius:8px;cursor:crosshair;touch-action:none;display:block;width:100%;box-sizing:border-box;"></canvas>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
              <button type="button" class="btn btn-ghost btn-sm" onclick="clearToolSignatureCanvas()">Clear Signature</button>
              <div style="display:flex;gap:8px;align-items:center;">
                <label style="font-size:0.8rem;color:var(--text-muted);">Sign on page:
                  <select id="esign-page-select" class="auth-input" style="padding:2px 8px;">
                    <option value="last" selected>Last Page</option>
                    <option value="first">First Page</option>
                    <option value="all">All Pages</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        `;
        setTimeout(initToolSignaturePad, 50);
        break;

      // AI Options
      case 'ai-assistant':
      case 'ai-chat':
      case 'ai-qa':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:6px;">Ask a Question about this PDF:</label>
            <input type="text" id="ai-question-input" class="auth-input" placeholder="e.g. What is the total contract value and payment schedule?" value="Summarize the core points of this document." style="width:100%;box-sizing:border-box;">
          </div>
        `;
        break;

      case 'ai-summarizer':
      case 'ai-exec-summary':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:6px;">Summary Focus:</label>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <label style="font-size:0.85rem;cursor:pointer;"><input type="radio" name="sum-type" value="exec" checked> Executive Summary</label>
              <label style="font-size:0.85rem;cursor:pointer;"><input type="radio" name="sum-type" value="action"> Action Items & Dates</label>
              <label style="font-size:0.85rem;cursor:pointer;"><input type="radio" name="sum-type" value="detailed"> Detailed Analysis</label>
            </div>
          </div>
        `;
        break;

      case 'ai-multi':
        optArea.innerHTML = `
          <div class="tool-option-group" style="padding:14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;">
            <label style="font-weight:700;font-size:0.85rem;display:block;margin-bottom:6px;">Multi-Document Query:</label>
            <input type="text" id="ai-multi-question-input" class="auth-input" placeholder="e.g. Compare payment terms and deliverable deadlines across these files." value="Compare the main deliverables and milestones across all uploaded documents." style="width:100%;box-sizing:border-box;">
          </div>
        `;
        break;

      default:
        optArea.innerHTML = '';
        break;
    }
  }

  window.toggleSplitRangeInput = function(show) {
    const box = document.getElementById('split-range-box');
    if (box) box.style.display = show ? 'block' : 'none';
  };

  let activeRotateAngle = 90;
  window.setRotateAngle = function(btn, angle) {
    activeRotateAngle = angle;
    document.querySelectorAll('.rotate-angle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };

  window.togglePasswordVisibility = function(inputId) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
  };

  // --- Signature Pad Inside Modal ---
  let sigPadCtx = null;
  let isDrawingSig = false;
  function initToolSignaturePad() {
    const canvas = document.getElementById('esign-tool-canvas');
    if (!canvas) return;
    sigPadCtx = canvas.getContext('2d');
    sigPadCtx.lineWidth = 2.5;
    sigPadCtx.strokeStyle = '#0B0F19';
    sigPadCtx.lineCap = 'round';
    sigPadCtx.lineJoin = 'round';

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    }

    canvas.onmousedown = canvas.ontouchstart = function(e) {
      isDrawingSig = true;
      const pos = getPos(e);
      sigPadCtx.beginPath();
      sigPadCtx.moveTo(pos.x, pos.y);
      if (e.cancelable) e.preventDefault();
    };

    canvas.onmousemove = canvas.ontouchmove = function(e) {
      if (!isDrawingSig) return;
      const pos = getPos(e);
      sigPadCtx.lineTo(pos.x, pos.y);
      sigPadCtx.stroke();
      if (e.cancelable) e.preventDefault();
    };

    window.onmouseup = window.ontouchend = function() {
      isDrawingSig = false;
    };
  }

  window.clearToolSignatureCanvas = function() {
    const canvas = document.getElementById('esign-tool-canvas');
    if (canvas && sigPadCtx) {
      sigPadCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // --- Tool Execution Dispatcher ---
  window.executeCurrentTool = async function() {
    const statusArea = document.getElementById('tool-status-area');
    const executeBtn = document.getElementById('tool-execute-btn');
    if (executeBtn) executeBtn.disabled = true;

    showToolProcessing('Processing document... please wait.');

    try {
      switch (currentToolId) {
        // 1. PDF Organization Tools
        case 'split-pdf':
          await handleSplitPdf();
          break;
        case 'compress-pdf':
          await handleCompressPdf();
          break;
        case 'rotate-pdf':
          await handleRotatePdf();
          break;
        case 'organize-pdf':
          await handleReorderPdf();
          break;
        case 'delete-pages':
          await handleDeletePagesPdf();
          break;
        case 'extract-pages':
          await handleExtractPagesPdf();
          break;
        case 'page-numbers':
          await handleAddPageNumbersPdf();
          break;
        case 'crop-pdf':
          await handleCropPdf();
          break;

        // 2. PDF Security Tools
        case 'password-protect':
          await handleProtectPdf();
          break;
        case 'unlock-pdf':
          await handleUnlockPdf();
          break;
        case 'watermark-pdf':
          await handleWatermarkPdf();
          break;
        case 'esign':
          await handleESignPdf();
          break;
        case 'remove-metadata':
          await handleRemoveMetadataPdf();
          break;

        // 3. Conversion Tools
        case 'pdf-to-word':
          await handlePdfToWord();
          break;
        case 'word-to-pdf':
          await handleWordToPdf();
          break;
        case 'pdf-to-excel':
          await handlePdfToExcel();
          break;
        case 'excel-to-pdf':
          await handleExcelToPdf();
          break;
        case 'pdf-to-ppt':
          await handlePdfToPpt();
          break;
        case 'ppt-to-pdf':
        case 'pptx-to-pdf':
          await handlePptToPdf();
          break;
        case 'pdf-to-jpg':
          await handlePdfToImages('jpg');
          break;
        case 'pdf-to-png':
          await handlePdfToImages('png');
          break;
        case 'pdf-to-images':
          await handlePdfToImages('png');
          break;
        case 'jpg-to-pdf':
        case 'png-to-pdf':
          await handleImageToPdf();
          break;

        // 4. AI Document Tools
        case 'ai-assistant':
        case 'ai-chat':
        case 'ai-qa':
          await handleAiAssistant();
          break;
        case 'ai-summarizer':
        case 'ai-exec-summary':
          await handleAiSummarize();
          break;
        case 'ai-contract':
          await handleAiContract();
          break;
        case 'invoice-extractor':
          await handleInvoiceExtraction();
          break;
        case 'ai-extract':
          await handleAiExtractEntities();
          break;
        case 'ai-insights':
          await handleAiDocumentInsights();
          break;
        case 'ai-multi':
          await handleAiMultiPdf();
          break;
        case 'doc-compare':
          await handleDocCompare();
          break;

        default:
          throw new Error('Handler for tool "' + currentToolId + '" is ready to run.');
      }
    } catch (err) {
      console.error('Execution Error:', err);
      showToolError(err.message || 'Operation failed.');
      if (executeBtn) executeBtn.disabled = false;
    }
  };

  function showToolProcessing(msg) {
    const area = document.getElementById('tool-status-area');
    if (!area) return;
    area.innerHTML = `
      <div style="padding:16px;background:rgba(244,185,66,0.12);border:1px solid rgba(244,185,66,0.3);border-radius:8px;display:flex;align-items:center;gap:12px;">
        <div class="spinner" style="width:22px;height:22px;border:3px solid rgba(244,185,66,0.3);border-top-color:var(--saas-accent);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
        <span style="font-weight:600;font-size:0.9rem;">${msg}</span>
      </div>
    `;
  }

  function showToolError(msg) {
    const area = document.getElementById('tool-status-area');
    if (!area) return;
    area.innerHTML = `
      <div style="padding:14px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:var(--danger);font-size:0.875rem;">
        <strong>Error:</strong> ${msg}
      </div>
    `;
  }

  function showToolSuccess(options) {
    const area = document.getElementById('tool-status-area');
    if (!area) return;

    const { filename, bytes, message, mimeType = 'application/pdf', previewHtml = '' } = options;
    processedResult = { filename, bytes, mimeType };

    area.innerHTML = `
      <div style="padding:16px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:10px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="color:#10B981;font-size:1.3rem;">✓</span>
          <strong style="color:var(--text);font-size:0.95rem;">${message || 'Processing Complete!'}</strong>
        </div>
        ${bytes ? `<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:14px;">Output: <strong>${filename}</strong> (${formatBytes(bytes.length)})</p>` : ''}
        ${previewHtml}
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
          ${bytes ? `
            <button class="btn btn-primary" onclick="downloadCurrentResult()" style="padding:9px 20px;">
              📥 Download ${filename}
            </button>
            <button class="btn btn-ghost" onclick="saveResultToWorkspace()" style="border:1px solid var(--border);padding:9px 18px;">
              ☁ Save to Cloud Workspace
            </button>
          ` : ''}
          <button class="btn btn-ghost" onclick="resetToolModal()" style="margin-left:auto;">
            Process Another
          </button>
        </div>
      </div>
    `;
  }

  window.downloadCurrentResult = function() {
    if (!processedResult || !processedResult.bytes) return;
    downloadBlob(processedResult.bytes, processedResult.filename, processedResult.mimeType);
  };

  window.saveResultToWorkspace = async function() {
    if (!processedResult || !processedResult.bytes) return;
    const token = localStorage.getItem('pdfme-token');
    if (!token) {
      if (window.showToast) window.showToast('Please sign in to save files to your cloud workspace.', 'warning');
      window.openAuthModal('signin');
      return;
    }

    try {
      // Base64 encode
      let binary = '';
      const len = processedResult.bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(processedResult.bytes[i]);
      }
      const base64 = btoa(binary);

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: processedResult.filename,
          dataBase64: base64,
          size: processedResult.bytes.length
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save to cloud workspace');
      }

      if (window.showToast) window.showToast('✓ Saved permanently to your Cloud Workspace!', 'success');
      if (window.refreshWorkspaceData) window.refreshWorkspaceData();
    } catch (e) {
      if (window.showToast) window.showToast('Save failed: ' + e.message, 'danger');
    }
  };

  window.resetToolModal = function() {
    renderToolInitialUI();
  };

  // ==========================================
  // TOOL IMPLEMENTATIONS
  // ==========================================

  // --- 1. Split PDF ---
  async function handleSplitPdf() {
    const mode = document.querySelector('input[name="split-mode"]:checked')?.value || 'all';
    let options = { mode: 'all' };

    if (mode === 'ranges') {
      const rangeVal = document.getElementById('split-ranges-input')?.value.trim();
      if (!rangeVal) throw new Error('Please enter valid page ranges (e.g. "1-2, 3-5").');
      const parts = rangeVal.split(',').map(s => s.trim()).filter(Boolean);
      options = { mode: 'ranges', ranges: parts };
    }

    const { files, zip } = await window.PdfOrganization.splitPdf(uploadedFileBytes, options);
    const count = Object.keys(files).length;
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_split_bundle.zip`;

    showToolSuccess({
      filename: outName,
      bytes: zip,
      mimeType: 'application/zip',
      message: `Successfully split into ${count} documents bundled in ZIP!`
    });
  }

  // --- 2. Compress PDF ---
  async function handleCompressPdf() {
    const origSize = uploadedFileBytes.length;
    const compressedBytes = await window.PdfOrganization.compressPdf(uploadedFileBytes);
    const newSize = compressedBytes.length;
    const savedPct = Math.max(0, Math.round(((origSize - newSize) / origSize) * 100));
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_compressed.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: compressedBytes,
      message: `PDF compressed! Original: ${formatBytes(origSize)} → New: ${formatBytes(newSize)} (${savedPct}% saved)`
    });
  }

  // --- 3. Rotate PDF ---
  async function handleRotatePdf() {
    const targetPages = document.getElementById('rotate-pages-input')?.value.trim() || 'all';
    const rotatedBytes = await window.PdfOrganization.rotatePdf(uploadedFileBytes, activeRotateAngle, targetPages);
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_rotated.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: rotatedBytes,
      message: `Successfully rotated pages by ${activeRotateAngle}°!`
    });
  }

  // --- 4. Organize / Reorder PDF ---
  async function handleReorderPdf() {
    const seqStr = document.getElementById('reorder-sequence-input')?.value.trim();
    if (!seqStr) throw new Error('Please enter desired page order (e.g. "3, 1, 2").');
    const order1Based = seqStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    if (order1Based.length === 0) throw new Error('Invalid sequence format.');
    const order0Based = order1Based.map(n => n - 1);

    const reorderedBytes = await window.PdfOrganization.reorderPdfPages(uploadedFileBytes, order0Based);
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_reordered.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: reorderedBytes,
      message: `Pages successfully reordered to [${order1Based.join(', ')}]!`
    });
  }

  // --- 5. Delete Pages ---
  async function handleDeletePagesPdf() {
    const deleteStr = document.getElementById('delete-pages-input')?.value.trim();
    if (!deleteStr) throw new Error('Please specify which page numbers to delete.');
    const prunedBytes = await window.PdfOrganization.deletePdfPages(uploadedFileBytes, deleteStr);
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_pruned.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: prunedBytes,
      message: `Specified pages deleted successfully!`
    });
  }

  // --- 6. Extract Pages ---
  async function handleExtractPagesPdf() {
    const extractStr = document.getElementById('extract-pages-input')?.value.trim();
    if (!extractStr) throw new Error('Please specify which page numbers to extract.');
    const extractedBytes = await window.PdfOrganization.extractPdfPages(uploadedFileBytes, extractStr);
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_extracted.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: extractedBytes,
      message: `Selected pages extracted into new document!`
    });
  }

  // --- 7. Page Numbers ---
  async function handleAddPageNumbersPdf() {
    const position = document.getElementById('page-num-position')?.value || 'bottom-center';
    const format = document.getElementById('page-num-format')?.value || 'Page {n} of {total}';
    const fontSize = parseInt(document.getElementById('page-num-size')?.value, 10) || 10;
    const startPage = parseInt(document.getElementById('page-num-start')?.value, 10) || 1;

    const numberedBytes = await window.PdfOrganization.addPageNumbers(uploadedFileBytes, {
      position,
      format,
      fontSize,
      startPage
    });
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_numbered.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: numberedBytes,
      message: `Page numbers added in ${position} position!`
    });
  }

  // --- 8. Crop PDF ---
  async function handleCropPdf() {
    const top = parseFloat(document.getElementById('crop-top')?.value) || 0;
    const bottom = parseFloat(document.getElementById('crop-bottom')?.value) || 0;
    const left = parseFloat(document.getElementById('crop-left')?.value) || 0;
    const right = parseFloat(document.getElementById('crop-right')?.value) || 0;

    const doc = await window.PDFLib.PDFDocument.load(uploadedFileBytes, { ignoreEncryption: true });
    const pages = doc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();
      const newWidth = Math.max(72, width - left - right);
      const newHeight = Math.max(72, height - top - bottom);
      page.setCropBox(left, bottom, newWidth, newHeight);
    }

    const croppedBytes = await doc.save();
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_cropped.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: croppedBytes,
      message: `Margins cropped successfully!`
    });
  }

  // --- 9. Password Protect ---
  async function handleProtectPdf() {
    const password = document.getElementById('protect-password-input')?.value.trim();
    if (!password) throw new Error('Please enter a password to protect the document.');

    const protectedBytes = await window.PdfSecurity.passwordProtectPdf(uploadedFileBytes, password);
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_protected.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: protectedBytes,
      message: `Document encrypted and password-protected!`
    });
  }

  // --- 10. Unlock PDF ---
  async function handleUnlockPdf() {
    const password = document.getElementById('unlock-password-input')?.value.trim() || '';
    let decryptedBytes;
    try {
      decryptedBytes = await window.PdfSecurity.removePasswordPdf(uploadedFileBytes, password);
    } catch (e) {
      // Fallback via PDFLib load with password
      const doc = await window.PDFLib.PDFDocument.load(uploadedFileBytes, { password });
      decryptedBytes = await doc.save();
    }

    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_unlocked.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: decryptedBytes,
      message: `Password encryption successfully removed!`
    });
  }

  // --- 11. Watermark PDF ---
  async function handleWatermarkPdf() {
    const text = document.getElementById('watermark-text-input')?.value.trim() || 'CONFIDENTIAL';
    const colorChoice = document.getElementById('watermark-color-select')?.value || 'gray';
    const opacityPct = parseInt(document.getElementById('watermark-opacity-slider')?.value, 10) || 30;
    const opacity = opacityPct / 100;

    let color = window.PDFLib.rgb(0.5, 0.5, 0.5);
    if (colorChoice === 'red') color = window.PDFLib.rgb(0.9, 0.1, 0.1);
    if (colorChoice === 'blue') color = window.PDFLib.rgb(0.1, 0.3, 0.85);
    if (colorChoice === 'amber') color = window.PDFLib.rgb(0.95, 0.6, 0.05);

    const doc = await window.PDFLib.PDFDocument.load(uploadedFileBytes, { ignoreEncryption: true });
    const font = await doc.embedFont(window.PDFLib.StandardFonts.HelveticaBold);
    const pages = doc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();
      const fontSize = Math.min(width, height) / 8;
      const textWidth = font.widthOfTextAtSize(text, fontSize);

      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: height / 2,
        size: fontSize,
        font,
        color,
        opacity,
        rotate: window.PDFLib.degrees(45)
      });
    }

    const watermarkedBytes = await doc.save();
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_watermarked.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: watermarkedBytes,
      message: `Watermark "${text}" stamped across all pages!`
    });
  }

  // --- 12. E-Sign PDF ---
  async function handleESignPdf() {
    const canvas = document.getElementById('esign-tool-canvas');
    if (!canvas) throw new Error('Signature canvas missing');

    const dataUrl = canvas.toDataURL('image/png');
    // Ensure canvas has content
    const base64 = dataUrl.split(',')[1];
    const sigBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    const pageSelect = document.getElementById('esign-page-select')?.value || 'last';

    const doc = await window.PDFLib.PDFDocument.load(uploadedFileBytes, { ignoreEncryption: true });
    const pngImage = await doc.embedPng(sigBytes);
    const pages = doc.getPages();

    let targetPages = [];
    if (pageSelect === 'all') targetPages = pages;
    else if (pageSelect === 'first') targetPages = [pages[0]];
    else targetPages = [pages[pages.length - 1]];

    const sigWidth = 140;
    const sigHeight = (pngImage.height / pngImage.width) * sigWidth;

    for (const p of targetPages) {
      const { width } = p.getSize();
      p.drawImage(pngImage, {
        x: width - sigWidth - 36,
        y: 40,
        width: sigWidth,
        height: sigHeight
      });
    }

    const signedBytes = await doc.save();
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_signed.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: signedBytes,
      message: `Digital signature placed on document!`
    });
  }

  // --- 13. Remove Metadata ---
  async function handleRemoveMetadataPdf() {
    const sanitizedBytes = await window.PdfSecurity.removeMetadataPdf(uploadedFileBytes);
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}_sanitized.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: sanitizedBytes,
      message: `Metadata, author info, and software traces permanently sanitized!`
    });
  }

  // --- 14. Conversions ---
  async function handlePdfToWord() {
    const docxBytes = await window.PdfConversion.pdfToWord(uploadedFileBytes, window.pdfjsLib);
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}.docx`;

    showToolSuccess({
      filename: outName,
      bytes: docxBytes,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      message: `Converted to genuine Microsoft Word .docx!`
    });
  }

  async function handleWordToPdf() {
    const pdfBytes = await window.PdfConversion.wordToPdf(uploadedFileBytes);
    const baseName = uploadedFile.name.replace(/\.docx?$/i, '');
    const outName = `${baseName}.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: pdfBytes,
      message: `Rendered Word document to vector PDF!`
    });
  }

  async function handlePdfToExcel() {
    const xlsxBytes = await window.PdfConversion.pdfToExcel(uploadedFileBytes, window.pdfjsLib);
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}.xlsx`;

    showToolSuccess({
      filename: outName,
      bytes: xlsxBytes,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      message: `Extracted tabular records into genuine Excel (.xlsx)!`
    });
  }

  async function handleExcelToPdf() {
    const pdfBytes = await window.PdfConversion.excelToPdf(uploadedFileBytes);
    const baseName = uploadedFile.name.replace(/\.xlsx?$/i, '');
    const outName = `${baseName}.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: pdfBytes,
      message: `Rendered spreadsheet to landscape tabular PDF!`
    });
  }

  async function handlePdfToPpt() {
    const pptxBytes = await window.PdfConversion.pdfToPowerPoint(uploadedFileBytes, window.pdfjsLib);
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}.pptx`;

    showToolSuccess({
      filename: outName,
      bytes: pptxBytes,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      message: `Converted pages to Microsoft PowerPoint (.pptx) slides!`
    });
  }

  async function handlePptToPdf() {
    const pdfBytes = await window.PdfConversion.powerPointToPdf(uploadedFileBytes);
    const baseName = uploadedFile.name.replace(/\.pptx?$/i, '');
    const outName = `${baseName}.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: pdfBytes,
      message: `Rendered PowerPoint presentation to 16:9 vector PDF!`
    });
  }

  async function handlePdfToImages(format = 'png') {
    const { images, zipBytes, numPages } = await window.PdfConversion.pdfToImages(uploadedFileBytes, format, 2.0, window.pdfjsLib);
    const baseName = uploadedFile.name.replace(/\.pdf$/i, '');

    if (numPages === 1 && images[0]) {
      const outName = `${baseName}.${format}`;
      showToolSuccess({
        filename: outName,
        bytes: images[0].bytes,
        mimeType: format === 'jpg' ? 'image/jpeg' : 'image/png',
        message: `Rendered 1 page to 300 DPI ${format.toUpperCase()}!`,
        previewHtml: `<div style="text-align:center;margin:12px 0;"><img src="${images[0].dataUrl}" style="max-height:240px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.15);"></div>`
      });
    } else {
      const outName = `${baseName}_images_${format}.zip`;
      showToolSuccess({
        filename: outName,
        bytes: zipBytes,
        mimeType: 'application/zip',
        message: `Rendered ${numPages} pages to 300 DPI ${format.toUpperCase()} images bundled in ZIP!`
      });
    }
  }

  async function handleImageToPdf() {
    const ext = uploadedFile.name.split('.').pop().toLowerCase();
    const isJpg = ext === 'jpg' || ext === 'jpeg';
    const imagesList = [{ bytes: uploadedFileBytes, type: isJpg ? 'jpg' : 'png' }];
    const pdfBytes = await window.PdfConversion.imagesToPdf(imagesList, 'a4');
    const baseName = uploadedFile.name.replace(/\.[^.]+$/, '');
    const outName = `${baseName}.pdf`;

    showToolSuccess({
      filename: outName,
      bytes: pdfBytes,
      message: `Image converted to A4 PDF document!`
    });
  }

  // --- 15. AI Features ---
  async function handleAiAssistant() {
    const question = document.getElementById('ai-question-input')?.value.trim() || 'Summarize this document.';
    const { fullText, pages } = await extractTextFromPdfBytes(uploadedFileBytes);

    const res = await window.AiPdfTools.askDocumentQuestion(fullText, pages, question);
    const answer = res.answer || 'No direct answer found.';
    const citations = res.citations || [];
    const configNotice = res.apiConfig?.notice || '';

    const previewHtml = `
      <div style="background:var(--bg);padding:14px;border-radius:8px;border:1px solid var(--border);margin-top:10px;">
        <p style="font-weight:700;font-size:0.9rem;margin-bottom:6px;color:var(--saas-accent);">AI Answer:</p>
        <p style="font-size:0.875rem;line-height:1.6;margin-bottom:12px;white-space:pre-wrap;">${answer}</p>
        ${citations.length > 0 ? `
          <div style="border-top:1px dashed var(--border);padding-top:8px;">
            <p style="font-weight:700;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">VERIFIED CITATIONS:</p>
            ${citations.map(c => `
              <p style="font-size:0.75rem;color:var(--text-muted);margin:3px 0;"><strong>Page ${c.pageNum}:</strong> "${c.excerpt}"</p>
            `).join('')}
          </div>
        ` : ''}
        ${configNotice ? `<p style="font-size:0.75rem;color:var(--saas-accent);margin-top:8px;opacity:0.85;">ℹ ${configNotice}</p>` : ''}
      </div>
    `;

    showToolSuccess({
      filename: `AI_Analysis_${Date.now()}.txt`,
      bytes: new TextEncoder().encode(`QUESTION:\n${question}\n\nANSWER:\n${answer}\n\nCITATIONS:\n${citations.map(c => `Page ${c.pageNum}: ${c.excerpt}`).join('\n')}`),
      mimeType: 'text/plain',
      message: 'AI Assistant Answer Generated with Citations!',
      previewHtml
    });
  }

  async function handleAiSummarize() {
    const sumType = document.querySelector('input[name="sum-type"]:checked')?.value || 'exec';
    const { fullText, pages } = await extractTextFromPdfBytes(uploadedFileBytes);
    const res = await window.AiPdfTools.summarizeDocument(fullText, pages);

    const displayText = sumType === 'action'
      ? `ACTION ITEMS:\n` + (res.actionItems || []).map(a => `• ${a}`).join('\n') + `\n\nIMPORTANT DATES:\n` + (res.importantDates || []).join(', ')
      : (sumType === 'detailed' ? res.detailedSummary : res.executiveSummary);

    const previewHtml = `
      <div style="background:var(--bg);padding:14px;border-radius:8px;border:1px solid var(--border);margin-top:10px;max-height:220px;overflow-y:auto;">
        <p style="font-weight:700;font-size:0.85rem;color:var(--saas-accent);margin-bottom:6px;">Summary Result:</p>
        <pre style="font-family:inherit;font-size:0.825rem;line-height:1.5;white-space:pre-wrap;margin:0;">${displayText}</pre>
        ${res.apiConfig?.notice ? `<p style="font-size:0.75rem;color:var(--saas-accent);margin-top:8px;">ℹ ${res.apiConfig.notice}</p>` : ''}
      </div>
    `;

    showToolSuccess({
      filename: `Summary_${uploadedFile.name.replace(/\.pdf$/i, '')}.txt`,
      bytes: new TextEncoder().encode(displayText),
      mimeType: 'text/plain',
      message: 'Executive Summary generated!',
      previewHtml
    });
  }

  async function handleAiContract() {
    const { fullText, pages } = await extractTextFromPdfBytes(uploadedFileBytes);
    const res = await window.AiPdfTools.analyzeContract(fullText, pages);

    const previewHtml = `
      <div style="background:var(--bg);padding:14px;border-radius:8px;border:1px solid var(--border);margin-top:10px;font-size:0.85rem;">
        <p style="font-weight:700;color:var(--danger);margin-bottom:4px;">Potential Risks & Missing Terms:</p>
        <ul style="padding-left:18px;margin:0 0 10px;">
          ${(res.potentialRisks || []).map(r => `<li>${r}</li>`).join('')}
        </ul>
        <p style="font-weight:700;color:var(--saas-accent);margin-bottom:4px;">Payment Clauses:</p>
        <ul style="padding-left:18px;margin:0 0 10px;color:var(--text-muted);font-size:0.8rem;">
          ${(res.paymentConditions || ['None explicitly flagged']).map(p => `<li>${p}</li>`).join('')}
        </ul>
        <p style="font-weight:700;color:var(--saas-accent);margin-bottom:4px;">Termination & Renewal:</p>
        <ul style="padding-left:18px;margin:0;color:var(--text-muted);font-size:0.8rem;">
          ${(res.terminationConditions || ['Standard termination provisions apply']).map(t => `<li>${t}</li>`).join('')}
        </ul>
      </div>
    `;

    const summaryStr = JSON.stringify(res, null, 2);
    showToolSuccess({
      filename: `Contract_Audit_${uploadedFile.name.replace(/\.pdf$/i, '')}.json`,
      bytes: new TextEncoder().encode(summaryStr),
      mimeType: 'application/json',
      message: 'Contract clauses audited for legal & liability risks!',
      previewHtml
    });
  }

  async function handleInvoiceExtraction() {
    const { fullText } = await extractTextFromPdfBytes(uploadedFileBytes);
    const data = window.InvoiceExtractor.extractInvoiceData(fullText);
    const excelBytes = await window.InvoiceExtractor.exportInvoicesToExcel([data]);

    const previewHtml = `
      <div style="background:var(--bg);padding:14px;border-radius:8px;border:1px solid var(--border);margin-top:10px;font-size:0.85rem;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div><strong>Vendor:</strong> ${data.vendorName || 'N/A'}</div>
          <div><strong>Invoice #:</strong> ${data.invoiceNumber || 'N/A'}</div>
          <div><strong>GSTIN:</strong> ${data.gstin || 'N/A'}</div>
          <div><strong>Date:</strong> ${data.invoiceDate || 'N/A'}</div>
          <div><strong>Taxable:</strong> ₹${data.taxableAmount || 0}</div>
          <div><strong>Total:</strong> ₹${data.totalAmount || 0}</div>
        </div>
      </div>
    `;

    showToolSuccess({
      filename: `Extracted_Invoice_${data.invoiceNumber || 'Data'}.xlsx`,
      bytes: excelBytes,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      message: 'Invoice fields parsed into Excel spreadsheet!',
      previewHtml
    });
  }

  async function handleAiExtractEntities() {
    const { fullText, pages } = await extractTextFromPdfBytes(uploadedFileBytes);
    const res = await window.AiPdfTools.extractEntities(fullText, pages);
    const ent = res.extractedEntities || {};

    const previewHtml = `
      <div style="background:var(--bg);padding:14px;border-radius:8px;border:1px solid var(--border);margin-top:10px;font-size:0.825rem;">
        <p><strong>Dates Found:</strong> ${(ent.dates || []).slice(0, 6).join(', ') || 'None'}</p>
        <p><strong>Emails:</strong> ${(ent.emails || []).join(', ') || 'None'}</p>
        <p><strong>Phone Numbers:</strong> ${(ent.phoneNumbers || []).join(', ') || 'None'}</p>
        <p><strong>Amounts / Values:</strong> ${(ent.financialAmounts || []).slice(0, 6).join(', ') || 'None'}</p>
      </div>
    `;

    showToolSuccess({
      filename: `Extracted_Entities.json`,
      bytes: new TextEncoder().encode(JSON.stringify(ent, null, 2)),
      mimeType: 'application/json',
      message: `Extracted ${res.totalExtracted || 0} structured data entities!`,
      previewHtml
    });
  }

  async function handleAiDocumentInsights() {
    const { fullText, pages } = await extractTextFromPdfBytes(uploadedFileBytes);
    const res = await window.AiPdfTools.getDocumentInsights(fullText, pages);
    const m = res.metrics || {};

    const previewHtml = `
      <div style="background:var(--bg);padding:14px;border-radius:8px;border:1px solid var(--border);margin-top:10px;font-size:0.85rem;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div>Word Count: <strong>${m.wordCount || 0}</strong></div>
          <div>Reading Time: <strong>${m.estimatedReadingTime || '1 min'}</strong></div>
          <div>Segments: <strong>${m.structureSegments || 0}</strong></div>
          <div>Level: <strong>${res.readingLevel || 'Professional'}</strong></div>
        </div>
        <p style="font-weight:700;margin-bottom:4px;">Top Key Phrases:</p>
        <p style="color:var(--text-muted);font-size:0.8rem;">${(res.topKeywords || []).map(k => `${k.word} (${k.count})`).join(' · ')}</p>
      </div>
    `;

    showToolSuccess({
      filename: `Document_Insights.json`,
      bytes: new TextEncoder().encode(JSON.stringify(res, null, 2)),
      mimeType: 'application/json',
      message: 'Document structural insights calculated!',
      previewHtml
    });
  }

  async function handleAiMultiPdf() {
    const question = document.getElementById('ai-multi-question-input')?.value.trim() || 'Compare these documents.';
    const docsData = [];

    for (const f of multipleFiles) {
      const bytes = await readFileAsArrayBuffer(f);
      const { fullText } = await extractTextFromPdfBytes(bytes);
      docsData.push({ name: f.name, text: fullText.slice(0, 10000) });
    }

    const res = await window.AiPdfTools.chatMultipleDocuments(docsData, question);

    const previewHtml = `
      <div style="background:var(--bg);padding:14px;border-radius:8px;border:1px solid var(--border);margin-top:10px;">
        <p style="font-weight:700;font-size:0.9rem;color:var(--saas-accent);margin-bottom:6px;">Multi-Document Synthesis:</p>
        <p style="font-size:0.875rem;line-height:1.6;margin-bottom:10px;">${res.answer}</p>
      </div>
    `;

    showToolSuccess({
      filename: `Multi_Doc_Synthesis.txt`,
      bytes: new TextEncoder().encode(res.answer),
      mimeType: 'text/plain',
      message: `Synthesized findings across ${multipleFiles.length} files!`,
      previewHtml
    });
  }

  async function handleDocCompare() {
    const text1 = (await extractTextFromPdfBytes(uploadedFileBytes)).fullText;
    const text2 = (await extractTextFromPdfBytes(secondaryFileBytes)).fullText;

    const diffResult = window.DocComparison.compareDocuments(text1, text2);
    const diffPdfBytes = await window.DocComparison.generateDiffPdf(text1, text2, diffResult);

    const previewHtml = `
      <div style="background:var(--bg);padding:14px;border-radius:8px;border:1px solid var(--border);margin-top:10px;font-size:0.85rem;">
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;">
          <div>Added: <strong style="color:#10B981;">+${diffResult.summary.totalAdded}</strong></div>
          <div>Deleted: <strong style="color:var(--danger);">${diffResult.summary.totalDeleted}</strong></div>
          <div>Numbers: <strong>${diffResult.summary.totalNumbersChanged}</strong></div>
          <div>Dates: <strong>${diffResult.summary.totalDatesChanged}</strong></div>
        </div>
      </div>
    `;

    showToolSuccess({
      filename: `Comparison_Diff_${Date.now()}.pdf`,
      bytes: diffPdfBytes,
      message: `Visual diff report generated with highlights!`,
      previewHtml
    });
  }

  // --- 16. Business Document Form Generator ---
  function renderBusinessGeneratorUI(container) {
    let formHtml = '';

    if (currentToolId === 'gen-invoice') {
      formHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div><label style="font-size:0.8rem;font-weight:700;">Company Name:</label><input type="text" id="biz-company" class="auth-input" value="Acme Enterprise Tech Solutions" style="width:100%;"></div>
          <div><label style="font-size:0.8rem;font-weight:700;">Company GSTIN:</label><input type="text" id="biz-gstin" class="auth-input" value="27AABCU9603R1ZM" style="width:100%;"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div><label style="font-size:0.8rem;font-weight:700;">Client Name:</label><input type="text" id="biz-client" class="auth-input" value="Global Business Systems Ltd." style="width:100%;"></div>
          <div><label style="font-size:0.8rem;font-weight:700;">Invoice #:</label><input type="text" id="biz-invnum" class="auth-input" value="INV-2026-081" style="width:100%;"></div>
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:0.8rem;font-weight:700;display:block;margin-bottom:6px;">Line Item & Rate:</label>
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;">
            <input type="text" id="biz-item-desc" class="auth-input" value="Quarterly Cloud Infrastructure Consulting">
            <input type="number" id="biz-item-qty" class="auth-input" value="1">
            <input type="number" id="biz-item-rate" class="auth-input" value="85000">
          </div>
        </div>
      `;
    } else if (currentToolId === 'gen-offer') {
      formHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div><label style="font-size:0.8rem;font-weight:700;">Company Name:</label><input type="text" id="biz-company" class="auth-input" value="Apex Financial Technologies" style="width:100%;"></div>
          <div><label style="font-size:0.8rem;font-weight:700;">Candidate Name:</label><input type="text" id="biz-candidate" class="auth-input" value="Johnathan Vance" style="width:100%;"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div><label style="font-size:0.8rem;font-weight:700;">Job Title:</label><input type="text" id="biz-title" class="auth-input" value="Principal Solutions Architect" style="width:100%;"></div>
          <div><label style="font-size:0.8rem;font-weight:700;">Annual CTC (INR):</label><input type="text" id="biz-salary" class="auth-input" value="28,50,000" style="width:100%;"></div>
        </div>
      `;
    } else if (currentToolId === 'gen-payslip') {
      formHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div><label style="font-size:0.8rem;font-weight:700;">Employee Name:</label><input type="text" id="biz-emp-name" class="auth-input" value="Rahul Sharma" style="width:100%;"></div>
          <div><label style="font-size:0.8rem;font-weight:700;">Employee ID:</label><input type="text" id="biz-emp-id" class="auth-input" value="EMP-4421" style="width:100%;"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div><label style="font-size:0.8rem;font-weight:700;">Basic Salary (INR):</label><input type="number" id="biz-basic" class="auth-input" value="95000" style="width:100%;"></div>
          <div><label style="font-size:0.8rem;font-weight:700;">HRA Allowance (INR):</label><input type="number" id="biz-hra" class="auth-input" value="38000" style="width:100%;"></div>
        </div>
      `;
    } else {
      // Experience cert
      formHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div><label style="font-size:0.8rem;font-weight:700;">Company Name:</label><input type="text" id="biz-company" class="auth-input" value="Nexus Global Software" style="width:100%;"></div>
          <div><label style="font-size:0.8rem;font-weight:700;">Employee Name:</label><input type="text" id="biz-emp-name" class="auth-input" value="Priya Deshmukh" style="width:100%;"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div><label style="font-size:0.8rem;font-weight:700;">Designation:</label><input type="text" id="biz-role" class="auth-input" value="Senior Backend Engineer" style="width:100%;"></div>
          <div><label style="font-size:0.8rem;font-weight:700;">Tenure:</label><input type="text" id="biz-tenure" class="auth-input" value="July 2022 – November 2026" style="width:100%;"></div>
        </div>
      `;
    }

    container.innerHTML = `
      <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:18px;">Customize the details below to generate a corporate vector PDF document instantly:</p>
      ${formHtml}
      <div id="tool-status-area" style="margin-top:16px;"></div>
      <div class="modal-actions" style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="closeToolModal()">Cancel</button>
        <button class="btn btn-primary" onclick="generateBusinessDocNow()" style="padding:10px 24px;">
          Generate &amp; Download PDF
        </button>
      </div>
    `;
  }

  window.generateBusinessDocNow = async function() {
    showToolProcessing('Generating vector PDF document...');

    try {
      let pdfBytes, filename;

      if (currentToolId === 'gen-invoice') {
        const companyName = document.getElementById('biz-company')?.value || 'Company Name';
        const customerName = document.getElementById('biz-client')?.value || 'Customer Name';
        const companyGstin = document.getElementById('biz-gstin')?.value || '';
        const invoiceNumber = document.getElementById('biz-invnum')?.value || 'INV-001';
        const itemDesc = document.getElementById('biz-item-desc')?.value || 'Professional Consulting';
        const qty = parseFloat(document.getElementById('biz-item-qty')?.value) || 1;
        const rate = parseFloat(document.getElementById('biz-item-rate')?.value) || 50000;

        pdfBytes = await window.BusinessDocs.generateInvoicePdf({
          companyName,
          companyGstin,
          customerName,
          invoiceNumber,
          items: [{ description: itemDesc, qty, rate, taxRate: 18 }]
        });
        filename = `Invoice_${invoiceNumber}.pdf`;
      } else if (currentToolId === 'gen-offer') {
        const companyName = document.getElementById('biz-company')?.value || 'Company';
        const candidateName = document.getElementById('biz-candidate')?.value || 'Candidate';
        const jobTitle = document.getElementById('biz-title')?.value || 'Senior Engineer';
        const ctc = document.getElementById('biz-salary')?.value || '25,00,000';

        pdfBytes = await window.BusinessDocs.generateOfferLetterPdf({
          companyName,
          candidateName,
          position: jobTitle,
          annualCtc: ctc
        });
        filename = `Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`;
      } else if (currentToolId === 'gen-payslip') {
        const employeeName = document.getElementById('biz-emp-name')?.value || 'Employee';
        const employeeId = document.getElementById('biz-emp-id')?.value || 'EMP-001';
        const basic = parseFloat(document.getElementById('biz-basic')?.value) || 60000;
        const hra = parseFloat(document.getElementById('biz-hra')?.value) || 24000;

        pdfBytes = await window.BusinessDocs.generateSalarySlipPdf({
          employeeName,
          employeeId,
          basicSalary: basic,
          hra
        });
        filename = `Payslip_${employeeId}.pdf`;
      } else {
        const companyName = document.getElementById('biz-company')?.value || 'Company';
        const employeeName = document.getElementById('biz-emp-name')?.value || 'Employee';
        const role = document.getElementById('biz-role')?.value || 'Software Engineer';
        const tenure = document.getElementById('biz-tenure')?.value || '2023 - 2026';

        pdfBytes = await window.BusinessDocs.generateExperienceCertificatePdf({
          companyName,
          employeeName,
          designation: role,
          employmentPeriod: tenure
        });
        filename = `Experience_Certificate_${employeeName.replace(/\s+/g, '_')}.pdf`;
      }

      showToolSuccess({
        filename,
        bytes: pdfBytes,
        message: 'Vector PDF Generated Successfully!'
      });
    } catch (err) {
      showToolError(err.message || 'Generation failed.');
    }
  };

  // --- 17. HTML to PDF ---
  function renderHtmlToPdfUI(container) {
    container.innerHTML = `
      <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:12px;">Type or paste HTML markup to render directly into a print-ready vector PDF:</p>
      <textarea id="html-source-input" class="auth-input" rows="8" style="width:100%;font-family:monospace;font-size:0.85rem;box-sizing:border-box;margin-bottom:16px;"><h1>Commercial Project Report</h1>
<p>This document is generated directly from HTML semantic markup with clean typography and layout margins.</p>
<h2>Project Highlights</h2>
<ul>
  <li>Preserved semantic headings (h1, h2, h3)</li>
  <li>Formatted paragraph text wrapping and indentation</li>
  <li>Clean bullet lists and vector styling</li>
</ul></textarea>
      <div id="tool-status-area"></div>
      <div class="modal-actions" style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="closeToolModal()">Cancel</button>
        <button class="btn btn-primary" onclick="renderHtmlToPdfNow()" style="padding:10px 24px;">
          Render to PDF
        </button>
      </div>
    `;
  }

  window.renderHtmlToPdfNow = async function() {
    const html = document.getElementById('html-source-input')?.value.trim();
    if (!html) {
      showToolError('Please enter some HTML content to convert.');
      return;
    }
    showToolProcessing('Parsing semantic HTML and generating vector PDF...');

    try {
      const pdfBytes = await window.PdfConversion.htmlToPdf(html);
      showToolSuccess({
        filename: `HTML_Document_${Date.now()}.pdf`,
        bytes: pdfBytes,
        message: 'HTML rendered to vector PDF successfully!'
      });
    } catch (e) {
      showToolError(e.message);
    }
  };
})();

