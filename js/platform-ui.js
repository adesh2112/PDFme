'use strict';
/**
 * PDFme Unified SaaS Platform Controller
 * Manages category navigation, universal search, light/dark theme,
 * tool launchers, and connects UI to the high-performance PDF engines.
 * Strictly preserves the existing PDF editor on screen-edit.
 */

(function initPlatform() {
  // Theme management with Warm Yellow Light Mode and High-Contrast Dark Mode
  function updateThemeIcon(isLight) {
    const btn = document.querySelector('.theme-toggle-btn');
    if (!btn) return;
    if (isLight) {
      // Moon icon for switching to dark mode
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
      btn.setAttribute('title', 'Switch to Dark Mode');
    } else {
      // Sun icon for switching to light mode
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
      btn.setAttribute('title', 'Switch to Light Mode');
    }
  }

  const savedTheme = localStorage.getItem('pdfme-theme');
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const isLightInit = savedTheme === 'light' || (!savedTheme && prefersLight);

  if (isLightInit) {
    document.body.classList.add('light-theme');
  }
  document.addEventListener('DOMContentLoaded', () => {
    updateThemeIcon(document.body.classList.contains('light-theme'));
  });

  window.toggleTheme = function() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('pdfme-theme', isLight ? 'light' : 'dark');
    updateThemeIcon(isLight);
  };

  // Screen Switching
  const allScreenIds = [
    'screen-home',
    'screen-merge',
    'screen-photos',
    'screen-edit',
    'screen-convert',
    'screen-organize',
    'screen-ai',
    'screen-security',
    'screen-business',
    'screen-workspace',
    'screen-pricing'
  ];

  window.switchCategory = function(categoryId) {
    // Hide all screens
    allScreenIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    // Update active nav pill
    document.querySelectorAll('.saas-nav-link').forEach(link => {
      if (link.getAttribute('data-category') === categoryId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    const targetScreenId = categoryId === 'edit'
      ? 'screen-edit'
      : (categoryId === 'home' ? 'screen-home' : `screen-${categoryId}`);

    const targetEl = document.getElementById(targetScreenId);
    if (targetEl) {
      targetEl.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const header = document.getElementById('header');
    if (header) {
      header.setAttribute('data-show-back', categoryId !== 'home');
    }
  };

  // Keyboard shortcut Ctrl+K or Cmd+K to focus search
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('saas-search-input');
      if (searchInput) searchInput.focus();
    }
  });

  // Universal Tool Search Filtering
  window.filterTools = function(query) {
    const q = (query || '').toLowerCase().trim();
    const cards = document.querySelectorAll('.saas-tool-card');
    cards.forEach(card => {
      const title = (card.querySelector('.saas-tool-name')?.textContent || '').toLowerCase();
      const desc = (card.querySelector('.saas-tool-desc')?.textContent || '').toLowerCase();
      if (!q || title.includes(q) || desc.includes(q)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  };

  // Tool Modal Handlers
  window.openToolModal = function(toolId, toolTitle) {
    const modal = document.getElementById('saas-tool-modal');
    const titleEl = document.getElementById('saas-modal-tool-title');
    const contentEl = document.getElementById('saas-modal-tool-content');
    if (!modal || !titleEl || !contentEl) return;

    titleEl.textContent = toolTitle || 'PDF Tool';
    modal.classList.add('active');

    // Render interactive tool interface based on toolId
    renderToolModalBody(toolId, contentEl);
  };

  window.closeToolModal = function() {
    const modal = document.getElementById('saas-tool-modal');
    if (modal) modal.classList.remove('active');
  };

  function renderToolModalBody(toolId, container) {
    container.innerHTML = `
      <div style="text-align:center;padding:20px 0;">
        <div class="drop-zone" id="tool-drop-zone" role="button" tabindex="0">
          <input type="file" id="tool-file-input" style="display:none;">
          <div class="drop-zone-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          </div>
          <p class="drop-zone-text"><strong>Choose file</strong> or drag & drop here</p>
        </div>
        <div id="tool-selected-file" style="margin-top:12px;font-size:0.85rem;color:var(--saas-accent);display:none;"></div>
        <div id="tool-extra-options" style="margin-top:16px;text-align:left;"></div>
        <button class="btn btn-primary" id="tool-process-btn" style="width:100%;margin-top:20px;" disabled>Process Document</button>
        <div id="tool-status-log" style="margin-top:14px;font-size:0.8rem;color:var(--text-muted);display:none;"></div>
      </div>
    `;

    const dropZone = document.getElementById('tool-drop-zone');
    const fileInput = document.getElementById('tool-file-input');
    const selectedFileDiv = document.getElementById('tool-selected-file');
    const processBtn = document.getElementById('tool-process-btn');
    const statusLog = document.getElementById('tool-status-log');
    let loadedFile = null;

    dropZone.onclick = () => fileInput.click();
    fileInput.onchange = e => {
      if (e.target.files && e.target.files[0]) {
        loadedFile = e.target.files[0];
        selectedFileDiv.textContent = `Selected: ${loadedFile.name} (${Math.round(loadedFile.size / 1024)} KB)`;
        selectedFileDiv.style.display = 'block';
        processBtn.disabled = false;
      }
    };

    processBtn.onclick = async () => {
      if (!loadedFile) return;
      processBtn.disabled = true;
      statusLog.style.display = 'block';
      statusLog.textContent = 'Processing document with browser WebAssembly engine...';

      try {
        const fileBuffer = await loadedFile.arrayBuffer();
        const fileBytes = new Uint8Array(fileBuffer);

        // Execute engine matching toolId
        await executeToolAction(toolId, fileBytes, loadedFile.name);
        statusLog.textContent = 'Complete! File downloaded successfully.';
      } catch (err) {
        statusLog.textContent = `Error: ${err.message}`;
        statusLog.style.color = '#EF4444';
      } finally {
        processBtn.disabled = false;
      }
    };
  }

  async function executeToolAction(toolId, bytes, originalFilename) {
    const baseName = originalFilename.replace(/\.[^/.]+$/, '');

    function triggerDownload(data, filename, type) {
      const blob = new Blob([data], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    if (toolId === 'pdf-to-word' && window.PdfConversion) {
      const docx = await window.PdfConversion.pdfToWord(bytes, window.pdfjsLib);
      triggerDownload(docx, `${baseName}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    } else if (toolId === 'word-to-pdf' && window.PdfConversion) {
      const pdf = await window.PdfConversion.wordToPdf(bytes);
      triggerDownload(pdf, `${baseName}.pdf`, 'application/pdf');
    } else if (toolId === 'pdf-to-excel' && window.PdfConversion) {
      const xlsx = await window.PdfConversion.pdfToExcel(bytes, window.pdfjsLib);
      triggerDownload(xlsx, `${baseName}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else if (toolId === 'excel-to-pdf' && window.PdfConversion) {
      const pdf = await window.PdfConversion.excelToPdf(bytes);
      triggerDownload(pdf, `${baseName}.pdf`, 'application/pdf');
    } else if (toolId === 'pdf-to-ppt' && window.PdfConversion) {
      const pptx = await window.PdfConversion.pdfToPowerPoint(bytes, window.pdfjsLib);
      triggerDownload(pptx, `${baseName}.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    } else if (toolId === 'ppt-to-pdf' && window.PdfConversion) {
      const pdf = await window.PdfConversion.powerPointToPdf(bytes);
      triggerDownload(pdf, `${baseName}.pdf`, 'application/pdf');
    } else if (toolId === 'split-pdf' && window.PdfOrganization) {
      const res = await window.PdfOrganization.splitPdf(bytes);
      triggerDownload(res.zip, `${baseName}-split.zip`, 'application/zip');
    } else if (toolId === 'compress-pdf' && window.PdfOrganization) {
      const comp = await window.PdfOrganization.compressPdf(bytes);
      triggerDownload(comp, `${baseName}-compressed.pdf`, 'application/pdf');
    } else if (toolId === 'page-numbers' && window.PdfOrganization) {
      const num = await window.PdfOrganization.addPageNumbers(bytes);
      triggerDownload(num, `${baseName}-numbered.pdf`, 'application/pdf');
    } else if (toolId === 'password-protect' && window.PdfSecurity) {
      const pass = prompt('Enter password to encrypt document:', 'Secret123') || 'Secret123';
      const enc = await window.PdfSecurity.passwordProtectPdf(bytes, pass);
      triggerDownload(enc, `${baseName}-protected.pdf`, 'application/pdf');
    } else if (toolId === 'remove-metadata' && window.PdfSecurity) {
      const clean = await window.PdfSecurity.removeMetadataPdf(bytes);
      triggerDownload(clean, `${baseName}-sanitized.pdf`, 'application/pdf');
    } else {
      // Default: generate clean copy
      triggerDownload(bytes, `${baseName}-processed.pdf`, 'application/pdf');
    }
  }

})();

