/* ============================================================
   Pdfme — app.js  v4.0 (High Performance Edition)
   100% in-browser PDF toolkit. No backend, no uploads.
   ============================================================ */
'use strict';

/* ── App config ── */
const APP_NAME = 'Pdfme';

/* ── Performance & low-end device detection ── */
if (
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
  (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
) {
  document.body.classList.add('low-perf');
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    document.body.classList.add('anim-paused');
  } else {
    document.body.classList.remove('anim-paused');
  }
}, { passive: true });

/* ════════════════════════════════════════════════════════════
   DYNAMIC SCRIPT LOADER (On-Demand)
   ════════════════════════════════════════════════════════════ */
let pdfJsPromise = null;
function ensurePdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/lib/pdf.min.js';
    s.defer = true;
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/lib/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    s.onerror = (err) => {
      pdfJsPromise = null;
      reject(err);
    };
    document.head.appendChild(s);
  });
  return pdfJsPromise;
}

let pdfLibPromise = null;
function ensurePdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (pdfLibPromise) return pdfLibPromise;
  pdfLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/lib/pdf-lib.min.js';
    s.defer = true;
    s.onload = () => resolve(window.PDFLib);
    s.onerror = (err) => {
      pdfLibPromise = null;
      reject(err);
    };
    document.head.appendChild(s);
  });
  return pdfLibPromise;
}

let fontkitPromise = null;
function ensureFontkit() {
  if (window.fontkit) return Promise.resolve(window.fontkit);
  if (fontkitPromise) return fontkitPromise;
  fontkitPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/lib/fontkit.umd.min.js';
    s.defer = true;
    s.onload = () => resolve(window.fontkit);
    s.onerror = (err) => {
      fontkitPromise = null;
      reject(err);
    };
    document.head.appendChild(s);
  });
  return fontkitPromise;
}

let tesseractPromise = null;
function ensureTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractPromise) return tesseractPromise;
  tesseractPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/lib/tesseract.min.js';
    s.defer = true;
    s.onload = () => resolve(window.Tesseract);
    s.onerror = (err) => {
      tesseractPromise = null;
      reject(err);
    };
    document.head.appendChild(s);
  });
  return tesseractPromise;
}

/* ════════════════════════════════════════════════════════════
   UTILITIES
   ════════════════════════════════════════════════════════════ */

/* ── Toast ── */
function toast(msg, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');

  const icons = {
    error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  el.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${msg}</span>
  `;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => dismissToast(el), duration);
  return el;
}

function dismissToast(el) {
  el.classList.remove('in');
  el.classList.add('out');
  setTimeout(() => el.remove(), 250);
}

/* ── Download ── */
function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* ── Format bytes ── */
function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/* ── Text helpers ── */
function needsFlatten(str) {
  return /[^\x00-\xFF]/.test(str);
}

function sanitiseForPdf(str) {
  return str;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/* ════════════════════════════════════════════════════════════
   NAVIGATION
   ════════════════════════════════════════════════════════════ */
const screens = {
  home: document.getElementById('screen-home'),
  merge: document.getElementById('screen-merge'),
  photos: document.getElementById('screen-photos'),
  edit: document.getElementById('screen-edit'),
};
const header = document.getElementById('header');
let currentScreen = 'home';

function navigate(id, reverse = false) {
  if (currentScreen === id) return;
  const from = screens[currentScreen];
  const to = screens[id];
  currentScreen = id;

  from.classList.remove('active');
  to.classList.add('active');
  header.setAttribute('data-show-back', id !== 'home' ? 'true' : 'false');
  document.title = id === 'home'
    ? `${APP_NAME} — Browser PDF Toolkit`
    : `${APP_NAME} — ${to.querySelector('h2')?.textContent || id}`;

  if (id === 'edit') {
    document.getElementById('toolbar').classList.add('visible');
    ensurePdfJs().catch(err => console.warn('Preload pdf.js error', err));
  } else {
    document.getElementById('toolbar').classList.remove('visible');
  }

  if (id === 'merge') {
    ensurePdfJs().catch(err => console.warn('Preload pdf.js error', err));
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.getElementById('back-btn').addEventListener('click', () => navigate('home', true));
document.getElementById('logo-btn').addEventListener('click', (e) => { e.preventDefault(); navigate('home', true); });

document.getElementById('tile-edit').addEventListener('click', () => navigate('edit'));
document.getElementById('tile-merge').addEventListener('click', () => navigate('merge'));
document.getElementById('tile-photos').addEventListener('click', () => navigate('photos'));

['tile-edit', 'tile-merge', 'tile-photos'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') el.click(); });
});

/* ════════════════════════════════════════════════════════════
   SORTABLE LIST (Drag-and-Drop)
   ════════════════════════════════════════════════════════════ */
function makeSortable(list, getItems, onReorder) {
  let dragSrc = null;

  list.addEventListener('dragstart', e => {
    dragSrc = e.target.closest('.file-item');
    if (!dragSrc) return;
    dragSrc.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragend', () => {
    list.querySelectorAll('.file-item.dragging, .file-item.drag-over-indicator').forEach(el => {
      el.classList.remove('dragging', 'drag-over-indicator');
    });
    dragSrc = null;
  });

  list.addEventListener('dragover', e => {
    e.preventDefault();
    const target = e.target.closest('.file-item');
    if (!target || target === dragSrc) return;
    list.querySelectorAll('.file-item.drag-over-indicator').forEach(el => el.classList.remove('drag-over-indicator'));
    target.classList.add('drag-over-indicator');
  });

  list.addEventListener('drop', e => {
    e.preventDefault();
    const target = e.target.closest('.file-item');
    if (!target || target === dragSrc || !dragSrc) return;
    const items = getItems();
    const srcIdx = [...list.children].indexOf(dragSrc);
    const tgtIdx = [...list.children].indexOf(target);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const tmp = items[srcIdx];
    items[srcIdx] = items[tgtIdx];
    items[tgtIdx] = tmp;
    onReorder(items, srcIdx, tgtIdx);
  });
}

/* ════════════════════════════════════════════════════════════
   JOB 1: MERGE SCREEN (Supports 20+ to 50+ files)
   ════════════════════════════════════════════════════════════ */
(function initMerge() {
  const list = document.getElementById('merge-list');
  const btn = document.getElementById('merge-btn');
  const clearBtn = document.getElementById('merge-clear');
  const progress = document.getElementById('merge-progress');
  const progressBar = document.getElementById('merge-progress-bar');
  const progressLbl = document.getElementById('merge-progress-label');
  const cancelBtn = document.getElementById('merge-cancel-btn');
  const empty = document.getElementById('merge-empty');
  const input = document.getElementById('merge-input');
  const drop = document.getElementById('merge-drop');
  const summaryPill = document.getElementById('merge-summary');

  let files = [];
  let activeWorker = null;
  let pageCountQueue = [];
  let isCountingPages = false;

  function updateSummary() {
    const totalFiles = files.length;
    let totalPages = 0;
    let hasPendingPages = false;
    let totalBytes = 0;

    for (const item of files) {
      totalBytes += item.file.size;
      if (typeof item.pageCount === 'number') {
        totalPages += item.pageCount;
      } else {
        hasPendingPages = true;
      }
    }

    const pagesText = hasPendingPages
      ? `${totalPages}+ pages`
      : `${totalPages} page${totalPages === 1 ? '' : 's'}`;

    summaryPill.textContent = `${totalFiles} file${totalFiles === 1 ? '' : 's'} · ${pagesText} · ${fmtBytes(totalBytes)}`;
  }

  function render() {
    list.innerHTML = '';
    if (files.length === 0) {
      empty.style.display = 'block';
      btn.disabled = true;
      clearBtn.disabled = true;
      updateSummary();
      return;
    }
    empty.style.display = 'none';
    btn.disabled = files.length < 2;
    clearBtn.disabled = false;
    updateSummary();

    files.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'file-item';
      el.draggable = true;
      el.setAttribute('role', 'listitem');
      el.setAttribute('aria-label', `${item.file.name}, ${fmtBytes(item.file.size)}`);

      const pageStr = typeof item.pageCount === 'number'
        ? `${item.pageCount} pg${item.pageCount === 1 ? '' : 's'}`
        : 'Counting…';

      el.innerHTML = `
        <span class="file-drag-handle" title="Drag to reorder" aria-label="Drag handle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
        </span>
        <div class="file-item-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <span class="file-item-name" title="${item.file.name}">${item.file.name}</span>
        <span class="file-item-pages" data-page-badge="${i}">${pageStr}</span>
        <span class="file-item-size">${fmtBytes(item.file.size)}</span>
        <div class="file-item-controls">
          <button class="icon-btn" data-action="up" aria-label="Move ${item.file.name} up" title="Move up">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="icon-btn" data-action="down" aria-label="Move ${item.file.name} down" title="Move down">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="icon-btn danger" data-action="remove" aria-label="Remove ${item.file.name}" title="Remove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;

      el.querySelector('[data-action="up"]').addEventListener('click', () => moveFile(i, i - 1));
      el.querySelector('[data-action="down"]').addEventListener('click', () => moveFile(i, i + 1));
      el.querySelector('[data-action="remove"]').addEventListener('click', () => removeFile(i));

      if (i === 0) el.querySelector('[data-action="up"]').disabled = true;
      if (i === files.length - 1) el.querySelector('[data-action="down"]').disabled = true;

      list.appendChild(el);
    });
  }

  function moveFile(from, to) {
    if (to < 0 || to >= files.length) return;
    const tmp = files[from];
    files[from] = files[to];
    files[to] = tmp;
    render();
  }

  function removeFile(i) {
    files.splice(i, 1);
    render();
  }

  /* ── Lazy page counting: one file at a time, doc.destroy() immediately ── */
  async function processPageCountQueue() {
    if (isCountingPages) return;
    isCountingPages = true;

    while (pageCountQueue.length > 0) {
      const item = pageCountQueue.shift();
      if (!files.includes(item)) continue; // file was removed

      try {
        await ensurePdfJs();
        const buffer = await item.file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: buffer,
          disableFontFace: true,
          nativeImageDecoderSupport: 'none'
        });
        const doc = await loadingTask.promise;
        item.pageCount = doc.numPages;
        // Release memory immediately
        await doc.destroy();
      } catch (err) {
        console.warn('Could not read page count for', item.file.name, err);
        item.pageCount = '?';
      }

      // Update UI badge for this file
      const idx = files.indexOf(item);
      if (idx !== -1) {
        const badge = list.querySelector(`[data-page-badge="${idx}"]`);
        if (badge) {
          badge.textContent = typeof item.pageCount === 'number'
            ? `${item.pageCount} pg${item.pageCount === 1 ? '' : 's'}`
            : item.pageCount;
        }
        updateSummary();
      }
    }

    isCountingPages = false;
  }

  function addFiles(newFiles) {
    for (const f of newFiles) {
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        const item = { file: f, pageCount: null };
        files.push(item);
        pageCountQueue.push(item);
      } else {
        toast(`"${f.name}" is not a PDF file.`, 'error');
      }
    }
    render();
    processPageCountQueue();
  }

  input.addEventListener('change', () => {
    addFiles([...input.files]);
    input.value = '';
  });

  // Drop zone events
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('drag-over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('drag-over');
    if (e.dataTransfer && e.dataTransfer.files) {
      addFiles([...e.dataTransfer.files]);
    }
  });
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') input.click();
  });

  // Global drag-and-drop onto the page
  window.addEventListener('dragover', (e) => {
    if (currentScreen === 'merge') {
      e.preventDefault();
      drop.classList.add('drag-over');
    }
  });
  window.addEventListener('dragleave', (e) => {
    if (currentScreen === 'merge' && e.clientX <= 0 && e.clientY <= 0) {
      drop.classList.remove('drag-over');
    }
  });
  window.addEventListener('drop', (e) => {
    if (currentScreen === 'merge') {
      e.preventDefault();
      drop.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        addFiles([...e.dataTransfer.files]);
      }
    }
  });

  clearBtn.addEventListener('click', () => {
    if (activeWorker) {
      activeWorker.terminate();
      activeWorker = null;
    }
    files = [];
    pageCountQueue = [];
    progress.classList.remove('visible');
    render();
  });

  makeSortable(list, () => files, (sorted) => {
    files = sorted;
    render();
  });

  cancelBtn.addEventListener('click', () => {
    if (activeWorker) {
      activeWorker.postMessage({ type: 'cancel' });
      activeWorker.terminate();
      activeWorker = null;
    }
    progress.classList.remove('visible');
    btn.disabled = files.length < 2;
    clearBtn.disabled = false;
    toast('Merge cancelled.', 'info');
  });

  /* ── Merge using Web Worker ── */
  btn.addEventListener('click', async () => {
    if (files.length < 2) return;

    btn.disabled = true;
    clearBtn.disabled = true;
    progress.classList.add('visible');
    progressBar.style.width = '0%';
    progressLbl.textContent = `Merging 1 of ${files.length}…`;

    try {
      if (activeWorker) activeWorker.terminate();
      activeWorker = new Worker('/merge-worker.js');

      // Read each file's ArrayBuffer and send as transferable
      const filePayload = [];
      const transferables = [];

      for (let i = 0; i < files.length; i++) {
        progressLbl.textContent = `Preparing file ${i + 1} of ${files.length}…`;
        const buf = await files[i].file.arrayBuffer();
        filePayload.push({ name: files[i].file.name, buffer: buf });
        transferables.push(buf);
      }

      activeWorker.onmessage = (e) => {
        const msg = e.data;
        if (!msg) return;

        if (msg.type === 'progress') {
          const pct = Math.round((msg.current / msg.total) * 100);
          progressBar.style.width = `${pct}%`;
          progressLbl.textContent = `Merging ${msg.current} of ${msg.total} (${msg.fileName})`;
        } else if (msg.type === 'done') {
          progress.classList.remove('visible');
          btn.disabled = false;
          clearBtn.disabled = false;
          activeWorker.terminate();
          activeWorker = null;

          downloadBytes(new Uint8Array(msg.buffer), 'merged.pdf');

          if (msg.skipped && msg.skipped.length > 0) {
            toast(
              `Merged ${msg.pageCount} pages. Skipped ${msg.skipped.length} file(s): ${msg.skipped.join(', ')}`,
              'warning',
              8000
            );
          } else {
            toast(`Merged ${files.length} files (${msg.pageCount} pages) successfully!`, 'success');
          }
        } else if (msg.type === 'cancelled') {
          progress.classList.remove('visible');
          btn.disabled = files.length < 2;
          clearBtn.disabled = false;
          activeWorker.terminate();
          activeWorker = null;
        } else if (msg.type === 'error') {
          progress.classList.remove('visible');
          btn.disabled = false;
          clearBtn.disabled = false;
          toast(`Merge error: ${msg.message}`, 'error');
          activeWorker.terminate();
          activeWorker = null;
        }
      };

      activeWorker.onerror = (err) => {
        progress.classList.remove('visible');
        btn.disabled = false;
        clearBtn.disabled = false;
        toast(`Worker error: ${err.message}`, 'error');
        if (activeWorker) activeWorker.terminate();
        activeWorker = null;
      };

      activeWorker.postMessage(
        { type: 'merge', files: filePayload, libUrl: '/lib/pdf-lib.min.js' },
        transferables
      );

    } catch (err) {
      progress.classList.remove('visible');
      btn.disabled = false;
      clearBtn.disabled = false;
      toast(`Failed to start merge: ${err.message}`, 'error');
      console.error(err);
    }
  });

  render();
})();

/* ════════════════════════════════════════════════════════════
   PHOTOS TO PDF SCREEN
   ════════════════════════════════════════════════════════════ */
(function initPhotos() {
  const list = document.getElementById('photos-list');
  const btn = document.getElementById('photos-btn');
  const clearBtn = document.getElementById('photos-clear');
  const progress = document.getElementById('photos-progress');
  const input = document.getElementById('photos-input');
  const drop = document.getElementById('photos-drop');

  let items = [];

  function render() {
    list.innerHTML = '';
    btn.disabled = items.length === 0;
    clearBtn.disabled = items.length === 0;

    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'file-item';
      el.draggable = true;
      el.setAttribute('role', 'listitem');
      el.setAttribute('aria-label', `${item.file.name}`);
      el.innerHTML = `
        <span class="file-drag-handle" title="Drag to reorder">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
        </span>
        <img class="file-item-thumb" src="${item.url}" alt="${item.file.name}" loading="lazy">
        <span class="file-item-name">${item.file.name}</span>
        <span class="file-item-size">${fmtBytes(item.file.size)}</span>
        <div class="file-item-controls">
          <button class="icon-btn" data-action="up" aria-label="Move up" title="Move up">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="icon-btn" data-action="down" aria-label="Move down" title="Move down">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="icon-btn danger" data-action="remove" aria-label="Remove" title="Remove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;

      el.querySelector('[data-action="up"]').addEventListener('click', () => move(i, i - 1));
      el.querySelector('[data-action="down"]').addEventListener('click', () => move(i, i + 1));
      el.querySelector('[data-action="remove"]').addEventListener('click', () => remove(i));

      if (i === 0) el.querySelector('[data-action="up"]').disabled = true;
      if (i === items.length - 1) el.querySelector('[data-action="down"]').disabled = true;

      list.appendChild(el);
    });
  }

  function move(from, to) {
    if (to < 0 || to >= items.length) return;
    const tmp = items[from];
    items[from] = items[to];
    items[to] = tmp;
    render();
  }

  function remove(i) {
    URL.revokeObjectURL(items[i].url);
    items.splice(i, 1);
    render();
  }

  function addFiles(files) {
    for (const f of files) {
      if (!f.type.startsWith('image/')) {
        toast(`"${f.name}" is not an image.`, 'error');
        continue;
      }
      const url = URL.createObjectURL(f);
      items.push({ file: f, url });
    }
    render();
  }

  input.addEventListener('change', () => { addFiles([...input.files]); input.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('drag-over');
    addFiles([...e.dataTransfer.files]);
  });
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
  clearBtn.addEventListener('click', () => {
    items.forEach(it => URL.revokeObjectURL(it.url));
    items = [];
    render();
  });

  makeSortable(list, () => items, (sorted) => {
    items = sorted;
    render();
  });

  const PAGE_SIZES = {
    a4: [595.28, 841.89],
    letter: [612, 792],
  };

  function imageToJpeg(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth;
        cv.height = img.naturalHeight;
        cv.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataUrl: cv.toDataURL('image/jpeg', 0.92), w: img.naturalWidth, h: img.naturalHeight });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  btn.addEventListener('click', async () => {
    if (items.length === 0) return;
    btn.disabled = true;
    clearBtn.disabled = true;
    progress.classList.add('visible');
    const pageSize = document.querySelector('input[name="page-size"]:checked')?.value || 'a4';

    try {
      await ensurePdfLib();
      const { PDFDocument } = PDFLib;
      const pdf = await PDFDocument.create();
      const MARGIN = 36;

      for (const item of items) {
        const { dataUrl, w: imgW, h: imgH } = await imageToJpeg(item.file);
        const b64 = dataUrl.split(',')[1];
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const pdfImg = await pdf.embedJpg(bytes);

        let pgW, pgH;
        if (pageSize === 'fit') {
          pgW = imgW * 0.75;
          pgH = imgH * 0.75;
        } else {
          [pgW, pgH] = PAGE_SIZES[pageSize];
          if (imgW > imgH && pgW < pgH) [pgW, pgH] = [pgH, pgW];
        }

        const page = pdf.addPage([pgW, pgH]);
        const avW = pgW - MARGIN * 2;
        const avH = pgH - MARGIN * 2;
        const scale = Math.min(avW / imgW, avH / imgH);
        const dW = imgW * scale;
        const dH = imgH * scale;
        const dx = MARGIN + (avW - dW) / 2;
        const dy = MARGIN + (avH - dH) / 2;

        page.drawImage(pdfImg, { x: dx, y: dy, width: dW, height: dH });
      }

      const pdfBytes = await pdf.save({ useObjectStreams: true });
      progress.classList.remove('visible');
      btn.disabled = false;
      clearBtn.disabled = false;
      downloadBytes(pdfBytes, 'photos.pdf');
      toast('PDF created and downloaded!', 'success');
    } catch (err) {
      progress.classList.remove('visible');
      btn.disabled = false;
      clearBtn.disabled = false;
      toast(`Failed to create PDF: ${err.message}`, 'error');
      console.error(err);
    }
  });

  document.querySelectorAll('input[name="page-size"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.radio-pill').forEach(p => p.classList.remove('checked'));
      radio.closest('.radio-pill').classList.add('checked');
    });
  });

  render();
})();

/* ════════════════════════════════════════════════════════════
   JOB 2: EDIT SCREEN (Virtualization, Render Queue, Max 6 Canvases)
   ════════════════════════════════════════════════════════════ */
(function initEdit() {
  /* ══════ STATE ══════ */
  let pdfDoc = null;
  let originalBytes = null;
  let originalFileName = 'document';
  let pageCount = 0;
  let pages = [];

  let renderQueue = [];
  let isRenderingQueue = false;
  let intersectionObs = null;
  let isPasswordProtected = false;

  /* Global undo/redo stack */
  let undoStack = [];
  let redoStack = [];

  /* Noto font cache */
  const notoFontCache = {};

  /* DOM refs */
  const editInput = document.getElementById('edit-input');
  const openBtn = document.getElementById('edit-open-btn');
  const saveBtn = document.getElementById('save-btn');
  const canvasArea = document.getElementById('edit-canvas-area');
  const emptyState = document.getElementById('edit-empty');
  const flattenCheck = document.getElementById('flatten-check');
  const colPicker = document.getElementById('colour-picker');
  const colSwatch = document.getElementById('colour-swatch');
  const sizeInput = document.getElementById('size-input');
  const signModal = document.getElementById('sign-modal');
  const signCanvas = document.getElementById('sign-canvas');
  const addImgInput = document.getElementById('addimage-input');
  const toolbar = document.getElementById('toolbar');
  const undoBtn = document.getElementById('tool-undo');
  const redoBtn = document.getElementById('tool-redo');

  const passwordModal = document.getElementById('password-modal');
  const passwordInput = document.getElementById('password-input');
  const passwordSubmit = document.getElementById('password-submit');
  const passwordCancel = document.getElementById('password-cancel');
  const passwordDesc = document.getElementById('password-modal-desc');

  /* Floating Formatting Toolbar DOM refs */
  const formatToolbar = document.getElementById('text-format-toolbar');
  const fmtDrag = document.getElementById('fmt-drag');
  const fmtFontFamily = document.getElementById('fmt-font-family');
  const fmtSizeDec = document.getElementById('fmt-size-dec');
  const fmtFontSize = document.getElementById('fmt-font-size');
  const fmtSizeInc = document.getElementById('fmt-size-inc');
  const fmtBold = document.getElementById('fmt-bold');
  const fmtItalic = document.getElementById('fmt-italic');
  const fmtUnderline = document.getElementById('fmt-underline');
  const fmtColorBtn = document.getElementById('fmt-color-btn');
  const fmtColorBar = document.getElementById('fmt-color-bar');
  const fmtColorPicker = document.getElementById('fmt-color-picker');
  const fmtAlignLeft = document.getElementById('fmt-align-left');
  const fmtAlignCenter = document.getElementById('fmt-align-center');
  const fmtAlignRight = document.getElementById('fmt-align-right');
  const fmtSpacingBtn = document.getElementById('fmt-spacing-btn');
  const fmtSpacingPopover = document.getElementById('fmt-spacing-popover');
  const fmtLineSpacing = document.getElementById('fmt-line-spacing');
  const fmtLineSpacingVal = document.getElementById('fmt-line-spacing-val');
  const fmtLetterSpacing = document.getElementById('fmt-letter-spacing');
  const fmtLetterSpacingVal = document.getElementById('fmt-letter-spacing-val');
  const fmtUndo = document.getElementById('fmt-undo');
  const fmtRedo = document.getElementById('fmt-redo');
  const fmtDelete = document.getElementById('fmt-delete');

  let activeSegment = null;
  let activePageData = null;
  let currentSelectionFrame = null;

  let activeTool = 'tool-edittext';
  let drawColour = '#22D3EE';
  let textSize = 14;
  let stampData = null;
  let isPlacingStamp = false;

  const TOOLS = ['tool-edittext', 'tool-addtext', 'tool-draw', 'tool-highlight', 'tool-sign', 'tool-addimage'];
  const toolBtns = {};
  TOOLS.forEach(id => { toolBtns[id] = document.getElementById(id); });

  colPicker.addEventListener('input', () => {
    drawColour = colPicker.value;
    colSwatch.style.background = drawColour;
  });
  sizeInput.addEventListener('input', () => { textSize = parseInt(sizeInput.value) || 14; });

  openBtn.addEventListener('click', () => editInput.click());
  editInput.addEventListener('change', async () => {
    const f = editInput.files[0];
    if (!f) return;
    editInput.value = '';
    await loadPdf(f);
  });

  /* ── Password Modal Handling ── */
  let activePasswordCb = null;
  function promptPassword(callback, reason) {
    isPasswordProtected = true;
    flattenCheck.checked = true;
    flattenCheck.disabled = true;
    activePasswordCb = callback;
    if (passwordDesc) {
      if (reason === 2) {
        passwordDesc.textContent = 'Incorrect password. Please try again:';
        passwordDesc.style.color = 'var(--danger)';
      } else {
        passwordDesc.textContent = 'This PDF document is encrypted. Enter password to view and edit:';
        passwordDesc.style.color = 'var(--text-secondary)';
      }
    }
    if (passwordInput) passwordInput.value = '';
    if (passwordModal) {
      passwordModal.classList.add('open');
      setTimeout(() => passwordInput && passwordInput.focus(), 50);
    }
  }

  window.loadPdfForTesting = loadPdf;
  window.getPagesForTesting = () => pages;
  window.triggerSaveForTesting = () => saveBtn.click();
  window.submitPasswordForTesting = (pwd) => {
    if (activePasswordCb) {
      if (passwordModal) passwordModal.classList.remove('open');
      activePasswordCb(pwd);
    }
  };

  if (passwordSubmit) {
    passwordSubmit.addEventListener('click', () => {
      if (passwordModal) passwordModal.classList.remove('open');
      if (activePasswordCb) {
        const val = passwordInput ? passwordInput.value : '';
        activePasswordCb(val);
      }
    });
  }
  if (passwordCancel) {
    passwordCancel.addEventListener('click', () => {
      if (passwordModal) passwordModal.classList.remove('open');
      if (activePasswordCb) {
        activePasswordCb(new Error('Password prompt cancelled by user'));
      }
      toast('Opening cancelled', 'info');
    });
  }
  if (passwordInput) {
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        passwordSubmit.click();
      }
    });
  }

  /* ── Load PDF: creates virtual placeholders & sets up IntersectionObserver ── */
  async function loadPdf(file) {
    try {
      toast('Loading PDF…');
      await ensurePdfJs();

      emptyState.style.display = 'none';
      deselectSegment();
      canvasArea.innerHTML = '';
      pages = [];
      undoStack = [];
      redoStack = [];
      updateUndoRedoBtns();
      pdfDoc = null;
      originalFileName = file.name ? file.name.replace(/\.pdf$/i, '') : 'document';
      isPasswordProtected = false;
      flattenCheck.checked = false;
      flattenCheck.disabled = false;

      const buf = await file.arrayBuffer();
      originalBytes = new Uint8Array(buf);

      const loadingTask = pdfjsLib.getDocument({
        data: originalBytes.slice(),
      });
      loadingTask.onPassword = (callback, reason) => {
        promptPassword(callback, reason);
      };

      pdfDoc = await loadingTask.promise;
      pageCount = pdfDoc.numPages;

      if (isPasswordProtected) {
        flattenCheck.checked = true;
        flattenCheck.disabled = true;
        toast('Password-protected PDF opened. Saving will use flatten mode.', 'info');
      } else {
        flattenCheck.disabled = false;
      }

      saveBtn.disabled = false;

      // Get page 1 dimensions to set natural dimensions
      const firstPage = await pdfDoc.getPage(1);
      const vp1 = firstPage.getViewport({ scale: 1.0 });
      let displayScale = 1.0;
      if (canvasArea && canvasArea.clientWidth && (canvasArea.clientWidth - 48) < vp1.width) {
        displayScale = Math.max(0.2, (canvasArea.clientWidth - 48) / vp1.width);
      }
      const initialCssW = Math.round(vp1.width * displayScale);
      const initialCssH = Math.round(vp1.height * displayScale);

      // Disconnect prior observer if any
      if (intersectionObs) intersectionObs.disconnect();

      intersectionObs = new IntersectionObserver(handlePageIntersection, {
        root: canvasArea,
        rootMargin: '100% 0px 100% 0px' // 1-screen margin
      });

      // Build lightweight page placeholders
      for (let i = 0; i < pageCount; i++) {
        const wrap = document.createElement('div');
        wrap.className = 'page-wrap';
        wrap.dataset.pageIdx = i;
        wrap.style.width = `${initialCssW}px`;
        wrap.style.height = `${initialCssH}px`;
        wrap.style.maxWidth = '100%';
        wrap.style.aspectRatio = `${vp1.width} / ${vp1.height}`;
        wrap.style.contentVisibility = 'auto';
        wrap.style.containIntrinsicSize = `${initialCssW}px ${initialCssH}px`;

        const placeholder = document.createElement('div');
        placeholder.className = 'page-placeholder';
        placeholder.textContent = `Page ${i + 1} of ${pageCount}`;
        wrap.appendChild(placeholder);

        const canvas = document.createElement('canvas');
        canvas.className = 'page-canvas';
        canvas.width = 0;
        canvas.height = 0;
        canvas.style.display = 'none';

        const overlay = document.createElement('canvas');
        overlay.className = 'overlay-canvas';
        overlay.width = 0;
        overlay.height = 0;
        overlay.style.display = 'none';

        const textLayer = document.createElement('div');
        textLayer.className = 'text-edit-layer';
        textLayer.style.display = 'none';

        const delLabel = document.createElement('div');
        delLabel.className = 'deleted-label';
        delLabel.textContent = 'DELETED — will not appear in saved PDF';

        const ctrlsDiv = document.createElement('div');
        ctrlsDiv.className = 'page-controls';
        ctrlsDiv.innerHTML = `
          <button class="page-ctrl-btn" data-ctrl="up" aria-label="Move page up" title="Move up">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="page-ctrl-btn" data-ctrl="down" aria-label="Move page down" title="Move down">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="page-ctrl-btn danger" data-ctrl="delete" aria-label="Delete page" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
          <button class="page-ctrl-btn restore" data-ctrl="restore" aria-label="Restore page" title="Restore" style="display:none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </button>
        `;

        const badge = document.createElement('div');
        badge.className = 'page-num-badge';
        badge.textContent = `Page ${i + 1}`;

        wrap.appendChild(canvas);
        wrap.appendChild(overlay);
        wrap.appendChild(textLayer);
        wrap.appendChild(delLabel);
        wrap.appendChild(ctrlsDiv);
        wrap.appendChild(badge);

        canvasArea.appendChild(wrap);

        pages[i] = {
          idx: i,
          wrap,
          canvas,
          overlay,
          textLayer,
          placeholder,
          ocrBanner: null,
          ctx: overlay.getContext('2d'),
          isRendered: false,
          isIntersecting: false,
          renderTask: null,
          segments: [],
          edits: [],
          deleted: false,
          viewport: null,
          pjsPage: null,
        };

        ctrlsDiv.querySelector('[data-ctrl="up"]').addEventListener('click', () => movePageUp(i));
        ctrlsDiv.querySelector('[data-ctrl="down"]').addEventListener('click', () => movePageDown(i));
        ctrlsDiv.querySelector('[data-ctrl="delete"]').addEventListener('click', () => deletePage(i, wrap, ctrlsDiv));
        ctrlsDiv.querySelector('[data-ctrl="restore"]').addEventListener('click', () => restorePage(i, wrap, ctrlsDiv));

        attachOverlayEvents(overlay, i);
        intersectionObs.observe(wrap);
      }

      setActiveTool('tool-edittext');
      toast(`Opened "${file.name || 'document.pdf'}" (${pageCount} page${pageCount > 1 ? 's' : ''})`, 'success');
    } catch (err) {
      emptyState.style.display = 'block';
      emptyState.innerHTML = `
        <div style="text-align:center;padding:24px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3 style="margin:12px 0 6px;">Could not open PDF</h3>
          <p style="color:var(--text-secondary);max-width:400px;margin:0 auto 16px;">${err.message || 'The file may be corrupt or in an unsupported format.'}</p>
          <button class="btn btn-secondary" id="edit-retry-btn">Choose another file</button>
        </div>
      `;
      const retryBtn = document.getElementById('edit-retry-btn');
      if (retryBtn) retryBtn.onclick = () => editInput.click();
      toast(`Failed to open PDF: ${err.message}`, 'error');
      console.error(err);
    }
  }

  /* ── IntersectionObserver callback ── */
  function handlePageIntersection(entries) {
    entries.forEach(entry => {
      const idx = parseInt(entry.target.dataset.pageIdx, 10);
      const pageData = pages[idx];
      if (!pageData) return;

      pageData.isIntersecting = entry.isIntersecting;

      if (entry.isIntersecting) {
        if (!pageData.isRendered && !renderQueue.includes(idx)) {
          renderQueue.push(idx);
          processRenderQueue();
        }
      } else {
        if (pageData.renderTask) {
          try { pageData.renderTask.cancel(); } catch (e) { }
          pageData.renderTask = null;
        }
        const qIdx = renderQueue.indexOf(idx);
        if (qIdx !== -1) renderQueue.splice(qIdx, 1);
        freeExcessPages();
      }
    });
  }

  /* ── Render Queue: Render one page at a time ── */
  async function processRenderQueue() {
    if (isRenderingQueue || renderQueue.length === 0) return;
    isRenderingQueue = true;

    while (renderQueue.length > 0) {
      const idx = renderQueue.shift();
      const pageData = pages[idx];
      if (!pageData || pageData.isRendered || pageData.deleted) continue;

      try {
        await renderSinglePage(pageData);
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.warn('Render page error on page', idx + 1, err);
        }
      }

      freeExcessPages();
    }

    isRenderingQueue = false;
  }

  /* ── Render single page ── */
  async function renderSinglePage(pageData) {
    const pageNum = pageData.idx + 1;
    const pjsPage = await pdfDoc.getPage(pageNum);
    pageData.pjsPage = pjsPage;

    // Natural 1.0 viewport in points
    const baseVp = pjsPage.getViewport({ scale: 1.0 });

    // Display scale: 1.0 on desktop (original dimensions), or fit to width on smaller viewports
    let displayScale = 1.0;
    if (canvasArea && canvasArea.clientWidth && (canvasArea.clientWidth - 48) < baseVp.width) {
      displayScale = Math.max(0.2, (canvasArea.clientWidth - 48) / baseVp.width);
    }

    const viewport = pjsPage.getViewport({ scale: displayScale });
    pageData.viewport = viewport;
    pageData.displayScale = displayScale;

    // Retina / crisp rendering backing store
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let renderScale = Math.max(dpr * 1.5, 2.0);
    let renderViewport = pjsPage.getViewport({ scale: displayScale * renderScale });

    const maxSide = 3000;
    const largestSide = Math.max(renderViewport.width, renderViewport.height);
    if (largestSide > maxSide) {
      renderScale = renderScale * (maxSide / largestSide);
      renderViewport = pjsPage.getViewport({ scale: displayScale * renderScale });
    }

    pageData.renderViewport = renderViewport;
    pageData.renderScale = renderScale;

    const cssW = Math.round(viewport.width);
    const cssH = Math.round(viewport.height);

    pageData.wrap.style.width = `${cssW}px`;
    pageData.wrap.style.height = `${cssH}px`;
    pageData.wrap.style.maxWidth = '100%';
    pageData.wrap.style.aspectRatio = `${viewport.width} / ${viewport.height}`;

    const canvas = pageData.canvas;
    canvas.width = Math.floor(renderViewport.width);
    canvas.height = Math.floor(renderViewport.height);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const overlay = pageData.overlay;
    overlay.width = Math.floor(renderViewport.width);
    overlay.height = Math.floor(renderViewport.height);
    overlay.style.width = `${cssW}px`;
    overlay.style.height = `${cssH}px`;

    const textLayer = pageData.textLayer;
    textLayer.style.width = `${cssW}px`;
    textLayer.style.height = `${cssH}px`;

    // Start render task
    const ctx = canvas.getContext('2d', { alpha: false });
    const renderTask = pjsPage.render({ canvasContext: ctx, viewport: renderViewport });
    pageData.renderTask = renderTask;

    await renderTask.promise;
    pageData.renderTask = null;

    // Populate commonObjs font definitions
    try {
      await pjsPage.getOperatorList();
    } catch (e) {}

    // Setup overlay context scaling for crisp high-DPI annotations
    pageData.ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);

    // Build editable text segments
    textLayer.innerHTML = '';
    const textContent = await pjsPage.getTextContent({ includeMarkedContent: false });
    pageData.segments = buildSegments(textContent.items, viewport, pjsPage, textContent);

    // If page has no real text, show OCR banner
    if (pageData.segments.length === 0) {
      showOcrBanner(pageData);
    } else {
      if (pageData.ocrBanner) {
        pageData.ocrBanner.remove();
        pageData.ocrBanner = null;
      }
      // Sort reading order for Tab navigation
      const readingOrder = [...pageData.segments].sort((a, b) => {
        const pA = viewport.convertToViewportPoint(a.x, a.baselineY);
        const pB = viewport.convertToViewportPoint(b.x, b.baselineY);
        const dy = pA[1] - pB[1];
        return Math.abs(dy) > a.fontSize * 0.5 * viewport.scale ? dy : pA[0] - pB[0];
      });

      pageData.segments.forEach(seg => {
        seg.pageIdx = pageData.idx;
        placeSegmentSpan(seg, canvas, textLayer, pageData.idx, viewport, readingOrder);
      });
    }

    // Redraw overlay edits
    redrawOverlay(pageData.idx);

    // Show elements and hide placeholder
    canvas.style.display = 'block';
    overlay.style.display = 'block';
    textLayer.style.display = 'block';
    pageData.placeholder.style.display = 'none';
    pageData.isRendered = true;
  }

  /* ── Free off-screen canvases when > 6 pages are rendered ── */
  function freeExcessPages() {
    const renderedPages = pages.filter(p => p && p.isRendered);
    if (renderedPages.length <= 6) return;

    const areaCenter = canvasArea.scrollTop + (canvasArea.clientHeight / 2);
    renderedPages.sort((a, b) => {
      if (a.isIntersecting !== b.isIntersecting) {
        return a.isIntersecting ? 1 : -1;
      }
      const aDist = Math.abs((a.wrap.offsetTop + a.wrap.offsetHeight / 2) - areaCenter);
      const bDist = Math.abs((b.wrap.offsetTop + b.wrap.offsetHeight / 2) - areaCenter);
      return bDist - aDist;
    });

    while (renderedPages.length > 6 && renderedPages.length > 0) {
      const pageToFree = renderedPages.shift();
      if (!pageToFree) break;

      if (activeSegment && pageToFree.segments && pageToFree.segments.includes(activeSegment)) {
        deselectSegment();
      }

      pageToFree.canvas.width = 0;
      pageToFree.canvas.height = 0;
      pageToFree.canvas.style.display = 'none';

      pageToFree.overlay.width = 0;
      pageToFree.overlay.height = 0;
      pageToFree.overlay.style.display = 'none';

      pageToFree.textLayer.innerHTML = '';
      pageToFree.textLayer.style.display = 'none';

      pageToFree.placeholder.style.display = 'flex';
      pageToFree.isRendered = false;
    }
  }

  /* ══════════════════════════════════════════════════════════
     FONT PROPERTY DETECTION
     Order: page.commonObjs.get(fontName).name ->
            textContent.styles[fontName].fontFamily ->
            fontName
     ══════════════════════════════════════════════════════════ */
  function detectFontProperties(fontName, pjsPage, textContent) {
    let rawName = '';
    let obj = null;
    try {
      if (pjsPage && pjsPage.commonObjs && pjsPage.commonObjs.has(fontName)) {
        obj = pjsPage.commonObjs.get(fontName);
        if (obj) rawName = obj.name || obj.loadedName || '';
      }
    } catch (e) { }

    if (!rawName && textContent && textContent.styles && textContent.styles[fontName]) {
      rawName = textContent.styles[fontName].fontFamily || '';
    }
    if (!rawName) rawName = fontName || '';

    // Strip subset prefixes like "ABCDEF+" or "BAAAAA+"
    const cleanedName = rawName.replace(/^[A-Z]{6}\+/, '');

    const isBold = (obj && (obj.bold || obj.black)) ||
      /bold|black|heavy|semibold|demi|w[6-9]|700|800|900/i.test(cleanedName) ||
      /bold|black|heavy|semibold|demi/i.test(rawName);

    const isItalic = (obj && obj.italic) ||
      /italic|oblique|slanted/i.test(cleanedName) ||
      /italic|oblique|slanted/i.test(rawName);

    let family = 'Helvetica';
    const fallback = (obj && obj.fallbackName) || (textContent && textContent.styles && textContent.styles[fontName] && textContent.styles[fontName].fontFamily) || '';

    if (/times|roman|serif|cambria|garamond|book|palatino|minion|century/i.test(cleanedName) || fallback === 'serif') {
      family = 'Times';
    } else if (/courier|mono|consolas|menlo|fixed/i.test(cleanedName) || fallback === 'monospace') {
      family = 'Courier';
    } else if (/georgia/i.test(cleanedName)) {
      family = 'Georgia';
    }

    let cssFamily = "'Helvetica Neue', Helvetica, Arial, sans-serif";
    if (family === 'Times') cssFamily = "'Times New Roman', Times, serif";
    else if (family === 'Courier') cssFamily = "'Courier New', Courier, monospace";
    else if (family === 'Georgia') cssFamily = "Georgia, serif";
    else {
      const baseName = cleanedName.replace(/[-_]?(bold|italic|regular|semibold|demi|light|medium|black|heavy|mt)/gi, '').trim();
      if (baseName && baseName.length > 2 && !/^g_d/i.test(baseName)) {
        cssFamily = `'${baseName}', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
      }
    }

    return { rawName, cleanedName, family, bold: !!isBold, italic: !!isItalic, cssFamily };
  }

  function getCssFamily(family) {
    switch (family) {
      case 'Times': return "'Times New Roman', Times, serif";
      case 'Courier': return "'Courier New', Courier, monospace";
      case 'Georgia': return "Georgia, serif";
      case 'Space Grotesk': return "'Space Grotesk', sans-serif";
      case 'Noto Sans': return "'Noto Sans', sans-serif";
      case 'Noto Serif': return "'Noto Serif', serif";
      case 'Noto Sans Devanagari': return "'Noto Sans Devanagari', sans-serif";
      case 'Noto Sans Arabic': return "'Noto Sans Arabic', sans-serif";
      case 'Helvetica':
      default:
        return "'Helvetica Neue', Helvetica, Arial, sans-serif";
    }
  }

  /* ══════════════════════════════════════════════════════════
     NOTO FONT SELECTION & LAZY BYTE LOADING
     ══════════════════════════════════════════════════════════ */
  async function loadNotoFontBytes(fontFileName) {
    if (notoFontCache[fontFileName]) return notoFontCache[fontFileName];
    const res = await fetch(`/fonts/${fontFileName}`);
    if (!res.ok) throw new Error(`Failed to load font ${fontFileName}`);
    const ab = await res.arrayBuffer();
    notoFontCache[fontFileName] = new Uint8Array(ab);
    return notoFontCache[fontFileName];
  }

  function pickNotoFontForText(str, isSerif) {
    if (/[\u0900-\u097F]/.test(str)) {
      return { fileName: 'NotoSansDevanagari-Regular.ttf', cssFamily: "'Noto Sans Devanagari', sans-serif" };
    }
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/.test(str)) {
      return { fileName: 'NotoSansArabic-Regular.ttf', cssFamily: "'Noto Sans Arabic', sans-serif" };
    }
    if (isSerif) {
      return { fileName: 'NotoSerif-Regular.ttf', cssFamily: "'Noto Serif', serif" };
    }
    return { fileName: 'NotoSans-Regular.ttf', cssFamily: "'Noto Sans', sans-serif" };
  }

  /* ══════════════════════════════════════════════════════════
     TEXT EXTRACTION & SEGMENT GROUPING IN ROTATED FRAME
     ══════════════════════════════════════════════════════════ */
  function buildSegments(items, viewport, pjsPage, textContent) {
    if (!items || items.length === 0) return [];

    const pageWidth = viewport.viewBox ? Math.abs(viewport.viewBox[2] - viewport.viewBox[0]) : (viewport.width / viewport.scale);

    // 1. Process items: convert transform into user space geometry and text's rotated frame
    const processed = [];
    for (const item of items) {
      if (!item.str || item.str.trim() === '') continue;

      const tx = item.transform || [1, 0, 0, 1, 0, 0];
      const a = tx[0], b = tx[1], c = tx[2], d = tx[3], e = tx[4], f = tx[5];
      let fontSize = Math.hypot(a, b);
      if (fontSize < 0.001) fontSize = Math.hypot(c, d);
      if (fontSize < 0.001) fontSize = 12;

      let angle = Math.atan2(b, a);
      if (angle <= -Math.PI) angle += 2 * Math.PI;
      if (angle > Math.PI) angle -= 2 * Math.PI;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // In the text's rotated frame:
      const u = e * cosA + f * sinA;
      const v = -e * sinA + f * cosA;
      let width = Math.abs(item.width);
      if (width <= 0) {
        width = item.str.length * (fontSize * 0.55);
      }

      const fontProps = detectFontProperties(item.fontName, pjsPage, textContent);

      processed.push({
        str: item.str,
        e, f, u, v,
        fontSize, angle,
        width,
        fontName: item.fontName || '',
        fontProps,
        dir: item.dir || 'ltr',
        hasEOL: item.hasEOL || false,
      });
    }

    if (processed.length === 0) return [];

    // 2. Group items into lines in their own rotated frame:
    // Partition by angle (within 0.05 rad / ~2.8 degrees)
    const angleGroups = [];
    for (const item of processed) {
      let foundGroup = false;
      for (const group of angleGroups) {
        let diff = Math.abs(group.angle - item.angle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (diff <= 0.05) {
          group.items.push(item);
          foundGroup = true;
          break;
        }
      }
      if (!foundGroup) {
        angleGroups.push({ angle: item.angle, items: [item] });
      }
    }

    const segments = [];

    for (const group of angleGroups) {
      // Find lines based on perpendicular distance v
      const lines = [];
      for (const item of group.items) {
        let foundLine = false;
        for (const line of lines) {
          const tol = Math.min(line[0].fontSize, item.fontSize) * 0.35;
          if (Math.abs(item.v - line[0].v) <= tol) {
            line.push(item);
            foundLine = true;
            break;
          }
        }
        if (!foundLine) lines.push([item]);
      }

      // Within each line, sort along u (the baseline direction)
      for (const line of lines) {
        line.sort((a, b) => a.u - b.u);

        let segItems = [line[0]];
        for (let i = 1; i < line.length; i++) {
          const prev = segItems[segItems.length - 1];
          const curr = line[i];
          const prevEndU = prev.u + prev.width;
          const gap = curr.u - prevEndU;

          // Merge ONLY if same styling and close adjacent spacing
          const sameStyle = prev.fontProps.bold === curr.fontProps.bold &&
                            prev.fontProps.italic === curr.fontProps.italic &&
                            prev.fontProps.family === curr.fontProps.family &&
                            Math.abs(prev.fontSize - curr.fontSize) <= 1.0;

          const maxWordGap = prev.fontSize * 1.5;
          if (!sameStyle || prev.hasEOL || gap > maxWordGap || gap < -prev.fontSize * 0.5) {
            segments.push(buildSegmentFromItems(segItems, pjsPage, textContent));
            segItems = [curr];
          } else {
            // Insert space if gap is between words
            if (gap > prev.fontSize * 0.15 && !prev.str.endsWith(' ') && !curr.str.startsWith(' ')) {
              curr.insertSpaceBefore = true;
            }
            segItems.push(curr);
          }
        }
        if (segItems.length > 0) {
          segments.push(buildSegmentFromItems(segItems, pjsPage, textContent));
        }
      }
    }

    // Filter segments clipped completely off the page
    return segments.filter(s => {
      if (!s || !s.originalText || s.originalText.trim().length === 0) return false;
      const pt = viewport.convertToViewportPoint(s.x, s.baselineY);
      if (pt[0] < -150 || pt[0] > viewport.width + 150 || pt[1] < -150 || pt[1] > viewport.height + 150) {
        return false;
      }
      return true;
    });
  }

  function buildSegmentFromItems(items, pjsPage, textContent) {
    if (!items || items.length === 0) return null;

    let text = items[0].str;
    for (let i = 1; i < items.length; i++) {
      if (items[i].insertSpaceBefore) text += ' ';
      text += items[i].str;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const x = first.e;
    const baselineY = first.f;
    const fontSize = first.fontSize;
    const angle = first.angle;
    const angleDeg = angle * (180 / Math.PI);
    const width = Math.max((last.u + last.width) - first.u, first.width);

    const fontProps = first.fontProps || detectFontProperties(first.fontName, pjsPage, textContent);

    // Detect if RTL text (Arabic or Hebrew)
    const isRtl = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/.test(text);

    return {
      originalText: text,
      currentText: null,
      x,
      baselineY,
      origX: x,
      origBaselineY: baselineY,
      fontSize,
      origFontSize: fontSize,
      width,
      origWidth: width,
      angle,
      angleDeg,
      fontName: fontProps.cleanedName,
      rawFontName: fontProps.rawName,
      fontFamily: fontProps.family,
      cssFamily: fontProps.cssFamily,
      bold: fontProps.bold,
      italic: fontProps.italic,
      underline: false,
      isRtl,
      dir: isRtl ? 'rtl' : 'ltr',
      color: '#000000',
      bgColor: '#ffffff',
      textAlign: isRtl ? 'right' : 'left',
      lineSpacing: 1.25,
      letterSpacing: 0,
      span: null,
    };
  }

  /* ══════════════════════════════════════════════════════════
     COLOR SAMPLING (Median of border pixels for clean background)
     ══════════════════════════════════════════════════════════ */
  function sampleSegmentColors(seg, canvas, viewport) {
    try {
      const ctx = canvas.getContext('2d');
      // Convert segment corners to viewport canvas pixels
      const p0 = viewport.convertToViewportPoint(seg.x, seg.baselineY);
      const cosA = Math.cos(seg.angle);
      const sinA = Math.sin(seg.angle);

      // In viewport canvas space, find approximate bounding box
      const p1 = viewport.convertToViewportPoint(seg.x + seg.width * cosA, seg.baselineY + seg.width * sinA);
      const pTop0 = viewport.convertToViewportPoint(seg.x - (seg.fontSize * 0.9) * sinA, seg.baselineY + (seg.fontSize * 0.9) * cosA);
      const pTop1 = viewport.convertToViewportPoint(seg.x + seg.width * cosA - (seg.fontSize * 0.9) * sinA, seg.baselineY + seg.width * sinA + (seg.fontSize * 0.9) * cosA);

      const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], pTop0[0], pTop1[0])) - 3);
      const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], pTop0[1], pTop1[1])) - 3);
      const maxX = Math.min(canvas.width - 1, Math.ceil(Math.max(p0[0], p1[0], pTop0[0], pTop1[0])) + 3);
      const maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(p0[1], p1[1], pTop0[1], pTop1[1])) + 3);

      const sw = maxX - minX;
      const sh = maxY - minY;
      if (sw <= 0 || sh <= 0) return;

      const imgData = ctx.getImageData(minX, minY, sw, sh).data;
      const rVals = [];
      const gVals = [];
      const bVals = [];
      let minLum = 999, darkR = 0, darkG = 0, darkB = 0;

      // Sample border pixels (first 2 rows and last 2 rows, left/right columns)
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const idx = (y * sw + x) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          if (y < 2 || y >= sh - 2 || x < 2 || x >= sw - 2) {
            rVals.push(r);
            gVals.push(g);
            bVals.push(b);
          }
          if (lum < minLum) {
            minLum = lum;
            darkR = r; darkG = g; darkB = b;
          }
        }
      }

      if (rVals.length > 0) {
        rVals.sort((a, b) => a - b);
        gVals.sort((a, b) => a - b);
        bVals.sort((a, b) => a - b);
        const mid = Math.floor(rVals.length / 2);
        seg.bgColor = rgbToHex(rVals[mid], gVals[mid], bVals[mid]);
      } else {
        seg.bgColor = '#ffffff';
      }

      seg.color = minLum < 200 ? rgbToHex(darkR, darkG, darkB) : '#000000';
    } catch (e) {
      seg.color = '#000000';
      seg.bgColor = '#ffffff';
    }
  }

  /* ══════════════════════════════════════════════════════════
     FLOATING FORMATTING TOOLBAR & SELECTION FRAME CONTROLLER
     ══════════════════════════════════════════════════════════ */
  function hideFormatToolbar() {
    if (formatToolbar) formatToolbar.style.display = 'none';
    if (fmtSpacingPopover) fmtSpacingPopover.style.display = 'none';
  }

  function updateFormatToolbarPosition() {
    if (!activeSegment || !activeSegment.span || !formatToolbar) {
      hideFormatToolbar();
      return;
    }
    const rect = activeSegment.span.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    formatToolbar.style.display = 'flex';
    const tbRect = formatToolbar.getBoundingClientRect();
    const tbW = tbRect.width || 560;
    const tbH = tbRect.height || 44;

    let left = rect.left + (rect.width / 2) - (tbW / 2);
    let top = rect.top - tbH - 12;

    const minLeft = 16;
    const maxLeft = window.innerWidth - tbW - 16;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    if (top < 70) {
      top = rect.bottom + 12;
    }

    formatToolbar.style.left = `${left}px`;
    formatToolbar.style.top = `${top}px`;
  }

  function updateFormatToolbarValues(seg) {
    if (!seg) return;
    if (fmtFontFamily) fmtFontFamily.value = seg.fontFamily || 'Helvetica';
    if (fmtFontSize) fmtFontSize.value = Math.round(seg.fontSize || 14);
    if (fmtBold) fmtBold.classList.toggle('active', !!seg.bold);
    if (fmtItalic) fmtItalic.classList.toggle('active', !!seg.italic);
    if (fmtUnderline) fmtUnderline.classList.toggle('active', !!seg.underline);

    const c = seg.color || '#000000';
    if (fmtColorBar) fmtColorBar.style.background = c;
    if (fmtColorPicker) fmtColorPicker.value = (c.startsWith('#') && c.length === 7) ? c : '#000000';

    const align = seg.textAlign || (seg.isRtl ? 'right' : 'left');
    if (fmtAlignLeft) fmtAlignLeft.classList.toggle('active', align === 'left');
    if (fmtAlignCenter) fmtAlignCenter.classList.toggle('active', align === 'center');
    if (fmtAlignRight) fmtAlignRight.classList.toggle('active', align === 'right');

    const ls = seg.lineSpacing || 1.25;
    if (fmtLineSpacing) fmtLineSpacing.value = ls;
    if (fmtLineSpacingVal) fmtLineSpacingVal.textContent = ls.toFixed(2);

    const ltrS = seg.letterSpacing || 0;
    if (fmtLetterSpacing) fmtLetterSpacing.value = ltrS;
    if (fmtLetterSpacingVal) fmtLetterSpacingVal.textContent = `${ltrS}px`;

    updateUndoRedoBtns();
  }

  function selectSegment(seg, pageData) {
    if (activeSegment && activeSegment !== seg) {
      deselectSegment();
    }
    activeSegment = seg;
    activePageData = pageData;

    seg.span.style.color = seg.color || '#000000';
    seg.span.style.background = seg.bgColor || '#ffffff';
    seg.span.classList.add('active-editing');

    updateFormatToolbarValues(seg);
    updateFormatToolbarPosition();
  }

  function deselectSegment() {
    if (!activeSegment) return;
    const seg = activeSegment;
    const span = seg.span;

    if (span) {
      span.classList.remove('active-editing');
      const text = span.innerText;
      if (text !== seg.originalText || (seg.currentText !== null && seg.currentText !== seg.originalText)) {
        seg.currentText = text;
        span.style.color = seg.color || '#000000';
        span.style.background = seg.bgColor || '#ffffff';
        span.classList.add('edited');
      } else {
        span.style.color = 'transparent';
        span.style.background = 'transparent';
        span.classList.remove('edited');
        seg.currentText = null;
      }
    }

    removeSelectionFrame();
    hideFormatToolbar();
    activeSegment = null;
    activePageData = null;
  }

  function createSelectionFrame(seg, pageData) {
    // Natural inline editing without invasive transform boxes
  }

  function removeSelectionFrame() {
    if (currentSelectionFrame) {
      currentSelectionFrame.remove();
      currentSelectionFrame = null;
    }
  }

  function updateSelectionFramePos(seg, frame) {
    // No-op for selection frame
  }

  function attachSelectionFrameEvents(frame, dragBar, edgeE, edgeW, seg, pageData) {
    // No-op
  }

  function setupFormatToolbarListeners() {
    if (!formatToolbar) return;

    if (fmtFontFamily) {
      fmtFontFamily.addEventListener('change', () => {
        if (!activeSegment) return;
        const oldFamily = activeSegment.fontFamily;
        const newFamily = fmtFontFamily.value;
        activeSegment.fontFamily = newFamily;
        activeSegment.cssFamily = getCssFamily(newFamily);
        activeSegment.span.style.fontFamily = activeSegment.cssFamily;
        activeSegment.currentText = activeSegment.span.innerText;
        activeSegment.span.classList.add('edited');
        pushUndo({ type: 'format', seg: activeSegment, prop: 'fontFamily', oldVal: oldFamily, newVal: newFamily });
        updateSelectionFramePos(activeSegment, currentSelectionFrame);
        updateFormatToolbarPosition();
      });
    }

    function changeFontSize(delta) {
      if (!activeSegment) return;
      const oldSize = activeSegment.fontSize;
      const newSize = Math.max(4, Math.min(144, Math.round(oldSize + delta)));
      if (newSize === oldSize) return;

      activeSegment.fontSize = newSize;
      if (fmtFontSize) fmtFontSize.value = newSize;
      const vp = activePageData.viewport;
      const screenFontSize = newSize * vp.scale;
      activeSegment.span.style.fontSize = `${screenFontSize}px`;
      activeSegment.currentText = activeSegment.span.innerText;
      activeSegment.span.classList.add('edited');
      pushUndo({ type: 'format', seg: activeSegment, prop: 'fontSize', oldVal: oldSize, newVal: newSize });
      updateSelectionFramePos(activeSegment, currentSelectionFrame);
      updateFormatToolbarPosition();
    }

    if (fmtSizeDec) fmtSizeDec.addEventListener('click', () => changeFontSize(-1));
    if (fmtSizeInc) fmtSizeInc.addEventListener('click', () => changeFontSize(1));
    if (fmtFontSize) {
      fmtFontSize.addEventListener('change', () => {
        if (!activeSegment) return;
        const val = parseInt(fmtFontSize.value, 10);
        if (isNaN(val)) return;
        const oldSize = activeSegment.fontSize;
        const newSize = Math.max(4, Math.min(144, val));
        activeSegment.fontSize = newSize;
        const vp = activePageData.viewport;
        activeSegment.span.style.fontSize = `${newSize * vp.scale}px`;
        activeSegment.currentText = activeSegment.span.innerText;
        activeSegment.span.classList.add('edited');
        pushUndo({ type: 'format', seg: activeSegment, prop: 'fontSize', oldVal: oldSize, newVal: newSize });
        updateSelectionFramePos(activeSegment, currentSelectionFrame);
        updateFormatToolbarPosition();
      });
    }

    if (fmtBold) {
      fmtBold.addEventListener('click', () => {
        if (!activeSegment) return;
        const oldBold = !!activeSegment.bold;
        activeSegment.bold = !oldBold;
        fmtBold.classList.toggle('active', activeSegment.bold);
        activeSegment.span.style.fontWeight = activeSegment.bold ? 'bold' : 'normal';
        activeSegment.currentText = activeSegment.span.innerText;
        activeSegment.span.classList.add('edited');
        pushUndo({ type: 'format', seg: activeSegment, prop: 'bold', oldVal: oldBold, newVal: activeSegment.bold });
        updateSelectionFramePos(activeSegment, currentSelectionFrame);
      });
    }

    if (fmtItalic) {
      fmtItalic.addEventListener('click', () => {
        if (!activeSegment) return;
        const oldItalic = !!activeSegment.italic;
        activeSegment.italic = !oldItalic;
        fmtItalic.classList.toggle('active', activeSegment.italic);
        activeSegment.span.style.fontStyle = activeSegment.italic ? 'italic' : 'normal';
        activeSegment.currentText = activeSegment.span.innerText;
        activeSegment.span.classList.add('edited');
        pushUndo({ type: 'format', seg: activeSegment, prop: 'italic', oldVal: oldItalic, newVal: activeSegment.italic });
        updateSelectionFramePos(activeSegment, currentSelectionFrame);
      });
    }

    if (fmtUnderline) {
      fmtUnderline.addEventListener('click', () => {
        if (!activeSegment) return;
        const oldUnderline = !!activeSegment.underline;
        activeSegment.underline = !oldUnderline;
        fmtUnderline.classList.toggle('active', activeSegment.underline);
        activeSegment.span.style.textDecoration = activeSegment.underline ? 'underline' : 'none';
        activeSegment.currentText = activeSegment.span.innerText;
        activeSegment.span.classList.add('edited');
        pushUndo({ type: 'format', seg: activeSegment, prop: 'underline', oldVal: oldUnderline, newVal: activeSegment.underline });
      });
    }

    if (fmtColorBtn && fmtColorPicker) {
      fmtColorBtn.addEventListener('click', () => fmtColorPicker.click());
      fmtColorPicker.addEventListener('input', (e) => {
        if (!activeSegment) return;
        const newColor = e.target.value;
        if (fmtColorBar) fmtColorBar.style.background = newColor;
        activeSegment.span.style.color = newColor;
      });
      fmtColorPicker.addEventListener('change', (e) => {
        if (!activeSegment) return;
        const oldColor = activeSegment.color;
        const newColor = e.target.value;
        activeSegment.color = newColor;
        if (fmtColorBar) fmtColorBar.style.background = newColor;
        activeSegment.span.style.color = newColor;
        activeSegment.currentText = activeSegment.span.innerText;
        activeSegment.span.classList.add('edited');
        pushUndo({ type: 'format', seg: activeSegment, prop: 'color', oldVal: oldColor, newVal: newColor });
      });
    }

    function setAlignment(align) {
      if (!activeSegment) return;
      const oldAlign = activeSegment.textAlign || 'left';
      activeSegment.textAlign = align;
      if (fmtAlignLeft) fmtAlignLeft.classList.toggle('active', align === 'left');
      if (fmtAlignCenter) fmtAlignCenter.classList.toggle('active', align === 'center');
      if (fmtAlignRight) fmtAlignRight.classList.toggle('active', align === 'right');
      activeSegment.span.style.textAlign = align;
      activeSegment.currentText = activeSegment.span.innerText;
      activeSegment.span.classList.add('edited');
      pushUndo({ type: 'format', seg: activeSegment, prop: 'textAlign', oldVal: oldAlign, newVal: align });
    }

    if (fmtAlignLeft) fmtAlignLeft.addEventListener('click', () => setAlignment('left'));
    if (fmtAlignCenter) fmtAlignCenter.addEventListener('click', () => setAlignment('center'));
    if (fmtAlignRight) fmtAlignRight.addEventListener('click', () => setAlignment('right'));

    if (fmtSpacingBtn && fmtSpacingPopover) {
      fmtSpacingBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = fmtSpacingPopover.style.display === 'none';
        fmtSpacingPopover.style.display = isHidden ? 'flex' : 'none';
      });
    }
    if (fmtLineSpacing) {
      fmtLineSpacing.addEventListener('input', (e) => {
        if (!activeSegment) return;
        const val = parseFloat(e.target.value);
        if (fmtLineSpacingVal) fmtLineSpacingVal.textContent = val.toFixed(2);
        activeSegment.lineSpacing = val;
        activeSegment.span.style.lineHeight = `${val}`;
        activeSegment.currentText = activeSegment.span.innerText;
        activeSegment.span.classList.add('edited');
        updateSelectionFramePos(activeSegment, currentSelectionFrame);
        updateFormatToolbarPosition();
      });
    }
    if (fmtLetterSpacing) {
      fmtLetterSpacing.addEventListener('input', (e) => {
        if (!activeSegment) return;
        const val = parseFloat(e.target.value);
        if (fmtLetterSpacingVal) fmtLetterSpacingVal.textContent = `${val}px`;
        activeSegment.letterSpacing = val;
        activeSegment.span.style.letterSpacing = `${val}px`;
        activeSegment.currentText = activeSegment.span.innerText;
        activeSegment.span.classList.add('edited');
        updateSelectionFramePos(activeSegment, currentSelectionFrame);
        updateFormatToolbarPosition();
      });
    }

    if (fmtDelete) {
      fmtDelete.addEventListener('click', () => {
        if (!activeSegment) return;
        const seg = activeSegment;
        const oldText = seg.span.innerText;
        pushUndo({ type: 'deleteText', seg, oldText });
        seg.currentText = '';
        seg.span.innerText = '';
        seg.span.style.background = seg.bgColor;
        seg.span.classList.add('edited');
        deselectSegment();
        toast('Text element deleted.', 'info');
      });
    }

    if (fmtDrag) {
      fmtDrag.onpointerdown = (e) => {
        if (!activeSegment || !activeSegment.span || !activePageData) return;
        e.preventDefault();
        e.stopPropagation();

        const seg = activeSegment;
        const span = seg.span;
        const pageData = activePageData;
        const vp = pageData.viewport;

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startLeft = parseFloat(span.style.left) || 0;
        const startTop = parseFloat(span.style.top) || 0;
        const origPdfX = seg.x;
        const origPdfY = seg.baselineY;

        function onPointerMove(moveEvent) {
          const dxScreen = moveEvent.clientX - startClientX;
          const dyScreen = moveEvent.clientY - startClientY;

          let newLeft = startLeft + dxScreen;
          let newTop = startTop + dyScreen;

          const maxLeft = vp.width - (span.offsetWidth || 20);
          const maxTop = vp.height - (span.offsetHeight || 20);
          newLeft = Math.max(0, Math.min(maxLeft, newLeft));
          newTop = Math.max(0, Math.min(maxTop, newTop));

          span.style.left = `${newLeft}px`;
          span.style.top = `${newTop}px`;
          updateFormatToolbarPosition();
        }

        function onPointerUp() {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);

          const curLeft = parseFloat(span.style.left) || 0;
          const curTop = parseFloat(span.style.top) || 0;
          const screenFontSize = seg.fontSize * vp.scale;
          const screenAscent = screenFontSize * 0.82;
          const curBaselineX = curLeft;
          const curBaselineY = curTop + screenAscent;

          const newPdfPt = vp.convertToPdfPoint(curBaselineX, curBaselineY);
          const oldX = origPdfX;
          const oldY = origPdfY;

          seg.x = newPdfPt[0];
          seg.baselineY = newPdfPt[1];
          seg.currentText = span.innerText;
          span.classList.add('edited');

          if (Math.abs(seg.x - oldX) > 0.5 || Math.abs(seg.baselineY - oldY) > 0.5) {
            pushUndo({
              type: 'reposition',
              seg,
              oldPos: { x: oldX, y: oldY, left: startLeft, top: startTop },
              newPos: { x: seg.x, y: seg.baselineY, left: curLeft, top: curTop },
            });
          }
        }

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      };
    }

    if (fmtUndo) {
      fmtUndo.addEventListener('click', () => {
        performUndo();
        if (activeSegment) updateFormatToolbarValues(activeSegment);
      });
    }
    if (fmtRedo) {
      fmtRedo.addEventListener('click', () => {
        performRedo();
        if (activeSegment) updateFormatToolbarValues(activeSegment);
      });
    }

    document.addEventListener('pointerdown', (e) => {
      if (fmtSpacingPopover && !fmtSpacingPopover.contains(e.target) && e.target !== fmtSpacingBtn && !fmtSpacingBtn.contains(e.target)) {
        fmtSpacingPopover.style.display = 'none';
      }

      if (activeSegment && activeSegment.span) {
        if (
          activeSegment.span.contains(e.target) ||
          (formatToolbar && formatToolbar.contains(e.target)) ||
          (e.target.closest && e.target.closest('#text-format-toolbar'))
        ) {
          return;
        }
        deselectSegment();
      }
    });

    if (canvasArea) {
      canvasArea.addEventListener('scroll', () => {
        if (activeSegment) updateFormatToolbarPosition();
      }, { passive: true });
    }
    window.addEventListener('resize', () => {
      if (activeSegment) updateFormatToolbarPosition();
    });
  }

  /* ══════════════════════════════════════════════════════════
     SPAN PLACEMENT WITH EXACT ROTATION & TRANSFORM-ORIGIN
     ══════════════════════════════════════════════════════════ */
  function placeSegmentSpan(seg, canvas, textLayer, pageIdx, viewport, readingOrder) {
    const pageData = pages[pageIdx];
    sampleSegmentColors(seg, canvas, (pageData && pageData.renderViewport) || viewport);

    const span = document.createElement('span');
    span.className = 'text-seg';
    span.contentEditable = 'true';
    span.spellcheck = false;
    span.setAttribute('data-gramm', 'false');
    span.setAttribute('role', 'textbox');
    span.setAttribute('dir', seg.isRtl ? 'rtl' : 'auto');
    span.setAttribute('aria-label', `Editable text: ${seg.originalText}`);

    // Convert PDF baseline start to viewport coordinates
    const p0 = viewport.convertToViewportPoint(seg.x, seg.baselineY);
    const p1 = viewport.convertToViewportPoint(seg.x + Math.cos(seg.angle), seg.baselineY + Math.sin(seg.angle));
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const screenScale = Math.hypot(dx, dy);
    const screenAngle = Math.atan2(dy, dx);
    const screenAngleDeg = screenAngle * (180 / Math.PI);

    const screenFontSize = seg.fontSize * screenScale;
    const screenWidth = Math.max(seg.width * screenScale, 8);
    const screenAscent = screenFontSize * 0.82;
    const screenHeight = screenFontSize * 1.18;

    span.style.position = 'absolute';
    span.style.left = `${p0[0]}px`;
    span.style.top = `${p0[1] - screenAscent}px`;
    span.style.width = `${screenWidth}px`;
    span.style.minHeight = `${screenHeight}px`;
    span.style.fontSize = `${screenFontSize}px`;
    span.style.lineHeight = `${seg.lineSpacing || 1.15}`;
    span.style.fontFamily = seg.cssFamily;
    span.style.transformOrigin = `0px ${screenAscent}px`;
    span.style.transform = `rotate(${screenAngleDeg}deg)`;

    span.style.fontWeight = seg.bold ? 'bold' : 'normal';
    span.style.fontStyle = seg.italic ? 'italic' : 'normal';
    if (seg.underline) span.style.textDecoration = 'underline';
    if (seg.textAlign) span.style.textAlign = seg.textAlign;
    if (seg.letterSpacing) span.style.letterSpacing = `${seg.letterSpacing}px`;
    if (seg.isRtl) {
      span.style.textAlign = 'right';
      span.setAttribute('dir', 'rtl');
    }

    span.innerText = seg.currentText !== null ? seg.currentText : seg.originalText;
    seg.span = span;

    if (seg.currentText !== null && seg.currentText !== seg.originalText) {
      span.style.color = seg.color || '#000000';
      span.style.background = seg.bgColor || '#ffffff';
      span.classList.add('edited');
    } else {
      span.style.color = 'transparent';
      span.style.background = 'transparent';
    }

    let preText = span.innerText;

    span.addEventListener('focus', () => {
      if (activeTool !== 'tool-edittext' && activeTool !== 'tool-addtext') {
        span.blur();
        return;
      }
      preText = span.innerText;
      selectSegment(seg, pages[pageIdx]);
    });

    span.addEventListener('click', (e) => {
      if (activeTool !== 'tool-edittext' && activeTool !== 'tool-addtext') return;
      e.stopPropagation();
      selectSegment(seg, pages[pageIdx]);
    });

    span.addEventListener('input', () => {
      seg.currentText = span.innerText;
      span.classList.add('edited');
      span.style.color = seg.color || '#000000';
      span.style.background = seg.bgColor || '#ffffff';
      updateFormatToolbarPosition();
    });

    span.addEventListener('blur', () => {
      const newText = span.innerText;
      if (newText !== seg.originalText || (seg.currentText !== null && seg.currentText !== seg.originalText)) {
        if (newText !== preText) {
          pushUndo({ type: 'textEdit', seg, oldText: preText, newText });
        }
        seg.currentText = newText;
        span.style.color = seg.color || '#000000';
        span.style.background = seg.bgColor || '#ffffff';
        span.classList.add('edited');
      } else {
        if (activeSegment !== seg) {
          span.style.color = 'transparent';
          span.style.background = 'transparent';
          span.classList.remove('edited');
          seg.currentText = null;
        }
      }
    });

    span.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        // Multi-line: allow creating new lines!
        requestAnimationFrame(() => {
          updateFormatToolbarPosition();
        });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        span.innerText = preText;
        deselectSegment();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (readingOrder && readingOrder.length > 0) {
          const curIdx = readingOrder.indexOf(seg);
          const nextIdx = e.shiftKey
            ? (curIdx - 1 + readingOrder.length) % readingOrder.length
            : (curIdx + 1) % readingOrder.length;
          const nextSeg = readingOrder[nextIdx];
          if (nextSeg && nextSeg.span) {
            nextSeg.span.focus();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (fmtBold) fmtBold.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        if (fmtItalic) fmtItalic.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        if (fmtUnderline) fmtUnderline.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          performRedo();
        } else {
          performUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        performRedo();
      }
    });

    span.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
      requestAnimationFrame(() => {
        updateSelectionFramePos(seg, currentSelectionFrame);
        updateFormatToolbarPosition();
      });
    });

    textLayer.appendChild(span);
  }

  /* ══════════════════════════════════════════════════════════
     OCR FOR SCANNED & IMAGE-ONLY PAGES
     ══════════════════════════════════════════════════════════ */
  function showOcrBanner(pageData) {
    if (pageData.ocrBanner) return;

    const banner = document.createElement('div');
    banner.className = 'ocr-banner';
    banner.innerHTML = `
      <div class="ocr-banner-content">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        <span>Scanned / image page detected.</span>
        <div class="ocr-controls">
          <select class="ocr-lang-select" aria-label="OCR Language">
            <option value="eng">English (eng)</option>
            <option value="hin">Hindi (hin)</option>
          </select>
          <button class="ocr-btn">Make text editable (OCR)</button>
        </div>
      </div>
      <div class="ocr-progress-container" style="display:none;">
        <div class="ocr-progress-bar"><div class="ocr-progress-fill"></div></div>
        <span class="ocr-progress-status">Initializing OCR…</span>
      </div>
    `;

    const ocrBtn = banner.querySelector('.ocr-btn');
    const langSelect = banner.querySelector('.ocr-lang-select');
    const progContainer = banner.querySelector('.ocr-progress-container');
    const progFill = banner.querySelector('.ocr-progress-fill');
    const progStatus = banner.querySelector('.ocr-progress-status');

    ocrBtn.addEventListener('click', async () => {
      try {
        ocrBtn.disabled = true;
        langSelect.disabled = true;
        progContainer.style.display = 'flex';
        progStatus.textContent = 'Loading OCR engine…';
        progFill.style.width = '15%';

        await ensureTesseract();

        const lang = langSelect.value;
        progStatus.textContent = `Recognizing text (${lang})…`;

        const worker = await Tesseract.createWorker(lang, 1, {
          workerPath: '/lib/tesseract/worker.min.js',
          corePath: '/lib/tesseract/tesseract-core-simd-lstm.wasm.js',
          langPath: '/lib/tesseract',
          gzip: true,
          logger: m => {
            if (m.status === 'recognizing text' && typeof m.progress === 'number') {
              const pct = Math.round(m.progress * 100);
              progFill.style.width = `${Math.min(95, 20 + pct * 0.75)}%`;
              progStatus.textContent = `Recognizing text… ${pct}%`;
            }
          }
        });

        // Run on the rendered canvas
        const ret = await worker.recognize(pageData.canvas);
        await worker.terminate();

        progFill.style.width = '100%';
        progStatus.textContent = 'Building editable text segments…';

        const lines = ret.data.lines || [];
        const ocrSegments = [];

        for (const line of lines) {
          const str = line.text.trim();
          if (!str) continue;
          const bbox = line.bbox; // { x0, y0, x1, y1 } in canvas pixels

          // Convert canvas bbox to PDF user space point
          const pPdfBaseline = pageData.viewport.convertToPdfPoint(bbox.x0, bbox.y1);
          const pPdfTop = pageData.viewport.convertToPdfPoint(bbox.x0, bbox.y0);
          const pPdfEnd = pageData.viewport.convertToPdfPoint(bbox.x1, bbox.y1);

          const fontSize = Math.abs(pPdfTop[1] - pPdfBaseline[1]) || 12;
          const width = Math.hypot(pPdfEnd[0] - pPdfBaseline[0], pPdfEnd[1] - pPdfBaseline[1]);

          const seg = {
            originalText: str,
            currentText: null,
            x: pPdfBaseline[0],
            baselineY: pPdfBaseline[1],
            fontSize,
            width,
            angle: 0,
            angleDeg: 0,
            fontName: 'Helvetica',
            rawFontName: 'Helvetica',
            fontFamily: 'Helvetica',
            cssFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            bold: false,
            italic: false,
            isRtl: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(str),
            dir: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(str) ? 'rtl' : 'ltr',
            color: '#000000',
            bgColor: '#ffffff',
            span: null,
            pageIdx: pageData.idx,
            isOcr: true,
          };
          ocrSegments.push(seg);
        }

        pageData.segments = ocrSegments;
        banner.remove();
        pageData.ocrBanner = null;

        const readingOrder = [...pageData.segments];
        pageData.segments.forEach(seg => {
          placeSegmentSpan(seg, pageData.canvas, pageData.textLayer, pageData.idx, pageData.viewport, readingOrder);
        });

        toast(`OCR completed! ${ocrSegments.length} text blocks editable. Flatten mode recommended for scans.`, 'success');
      } catch (err) {
        progContainer.style.display = 'none';
        ocrBtn.disabled = false;
        langSelect.disabled = false;
        toast(`OCR failed: ${err.message}`, 'error');
        console.error(err);
      }
    });

    pageData.wrap.appendChild(banner);
    pageData.ocrBanner = banner;
  }

  /* ── Page controls ── */
  function movePageUp(idx) {
    if (idx === 0) return;
    const thisWrap = pages[idx].wrap;
    const prevWrap = pages[idx - 1].wrap;
    canvasArea.insertBefore(thisWrap, prevWrap);
    const tmp = pages[idx];
    pages[idx] = pages[idx - 1];
    pages[idx - 1] = tmp;
    pages[idx].idx = idx;
    pages[idx - 1].idx = idx - 1;
    thisWrap.dataset.pageIdx = idx - 1;
    prevWrap.dataset.pageIdx = idx;
    updatePageBadges();
  }

  function movePageDown(idx) {
    if (idx >= pages.length - 1) return;
    const thisWrap = pages[idx].wrap;
    const nextWrap = pages[idx + 1].wrap;
    canvasArea.insertBefore(nextWrap, thisWrap);
    const tmp = pages[idx];
    pages[idx] = pages[idx + 1];
    pages[idx + 1] = tmp;
    pages[idx].idx = idx;
    pages[idx + 1].idx = idx + 1;
    thisWrap.dataset.pageIdx = idx + 1;
    nextWrap.dataset.pageIdx = idx;
    updatePageBadges();
  }

  function updatePageBadges() {
    pages.forEach((p, i) => {
      const badge = p.wrap.querySelector('.page-num-badge');
      if (badge) badge.textContent = `Page ${i + 1}`;
    });
  }

  function deletePage(idx, wrap, ctrlsDiv) {
    pages[idx].deleted = true;
    wrap.classList.add('deleted');
    ctrlsDiv.querySelector('[data-ctrl="delete"]').style.display = 'none';
    ctrlsDiv.querySelector('[data-ctrl="restore"]').style.display = '';
    toast('Page marked for deletion. Save to apply.', 'info');
  }

  function restorePage(idx, wrap, ctrlsDiv) {
    pages[idx].deleted = false;
    wrap.classList.remove('deleted');
    ctrlsDiv.querySelector('[data-ctrl="delete"]').style.display = '';
    ctrlsDiv.querySelector('[data-ctrl="restore"]').style.display = 'none';
  }

  /* ── Overlay Drawing ── */
  function redrawOverlay(idx) {
    const pg = pages[idx];
    if (!pg || !pg.isRendered) return;
    const ctx = pg.ctx;
    ctx.clearRect(0, 0, pg.overlay.width, pg.overlay.height);
    for (const edit of pg.edits) {
      drawEdit(ctx, edit);
    }
  }

  function drawEdit(ctx, edit) {
    ctx.save();
    switch (edit.type) {
      case 'addtext':
        ctx.font = `${edit.bold ? 'bold ' : ''} ${edit.fontSize || 14}px ${edit.fontFamily || 'sans-serif'}`;
        ctx.fillStyle = edit.color || '#000000';
        ctx.fillText(edit.str, edit.x, edit.y + (edit.fontSize || 14));
        break;
      case 'draw':
        if (!edit.points || edit.points.length < 2) break;
        ctx.strokeStyle = edit.color || '#22D3EE';
        ctx.lineWidth = edit.lineWidth || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(edit.points[0].x, edit.points[0].y);
        for (let j = 1; j < edit.points.length; j++) ctx.lineTo(edit.points[j].x, edit.points[j].y);
        ctx.stroke();
        break;
      case 'highlight':
        ctx.fillStyle = edit.color || 'rgba(251,191,36,0.4)';
        ctx.fillRect(edit.x, edit.y, edit.w, edit.h);
        break;
      case 'image':
        if (!edit.img) {
          const img = new Image();
          img.src = edit.dataUrl;
          edit.img = img;
          img.onload = () => redrawOverlay(edit.pageIdx);
        }
        if (edit.img.complete) ctx.drawImage(edit.img, edit.x, edit.y, edit.w, edit.h);
        break;
    }
    ctx.restore();
  }

  /* ── Undo / Redo ── */
  function pushUndo(action) {
    undoStack.push(action);
    redoStack = [];
    updateUndoRedoBtns();
  }

  function updateUndoRedoBtns() {
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
    if (fmtUndo) fmtUndo.disabled = undoStack.length === 0;
    if (fmtRedo) fmtRedo.disabled = redoStack.length === 0;
  }

  function performUndo() {
    if (undoStack.length === 0) return;
    const action = undoStack.pop();
    redoStack.push(action);
    applyAction(action, true);
    updateUndoRedoBtns();
  }

  function performRedo() {
    if (redoStack.length === 0) return;
    const action = redoStack.pop();
    undoStack.push(action);
    applyAction(action, false);
    updateUndoRedoBtns();
  }

  function applyAction(action, isUndo) {
    if (action.type === 'overlayEdit') {
      const pg = pages[action.pageIdx];
      if (!pg) return;
      if (isUndo) pg.edits.splice(action.editIdx, 1);
      else pg.edits.splice(action.editIdx, 0, action.edit);
      redrawOverlay(action.pageIdx);
    } else if (action.type === 'textEdit') {
      const seg = action.seg;
      const textToApply = isUndo ? action.oldText : action.newText;
      seg.currentText = textToApply !== seg.originalText ? textToApply : null;
      if (seg.span) {
        seg.span.innerText = textToApply;
        if (seg.currentText !== null) {
          seg.span.style.color = seg.color;
          seg.span.style.background = seg.bgColor;
          seg.span.classList.add('edited');
        } else {
          seg.span.style.color = 'transparent';
          seg.span.style.background = 'transparent';
          seg.span.classList.remove('edited');
        }
      }
      if (activeSegment === seg) {
        updateSelectionFramePos(seg, currentSelectionFrame);
        updateFormatToolbarPosition();
      }
    } else if (action.type === 'format') {
      const seg = action.seg;
      const val = isUndo ? action.oldVal : action.newVal;
      seg[action.prop] = val;
      if (action.prop === 'fontFamily') {
        seg.cssFamily = getCssFamily(val);
        seg.span.style.fontFamily = seg.cssFamily;
      } else if (action.prop === 'fontSize') {
        const vp = pages[seg.pageIdx] ? pages[seg.pageIdx].viewport : null;
        const scale = vp ? vp.scale : 1;
        seg.span.style.fontSize = `${val * scale}px`;
      } else if (action.prop === 'bold') {
        seg.span.style.fontWeight = val ? 'bold' : 'normal';
      } else if (action.prop === 'italic') {
        seg.span.style.fontStyle = val ? 'italic' : 'normal';
      } else if (action.prop === 'underline') {
        seg.span.style.textDecoration = val ? 'underline' : 'none';
      } else if (action.prop === 'color') {
        seg.span.style.color = val;
      } else if (action.prop === 'textAlign') {
        seg.span.style.textAlign = val;
      }
      if (activeSegment === seg) {
        updateFormatToolbarValues(seg);
        updateSelectionFramePos(seg, currentSelectionFrame);
        updateFormatToolbarPosition();
      }
    } else if (action.type === 'reposition') {
      const seg = action.seg;
      const pos = isUndo ? action.oldPos : action.newPos;
      seg.x = pos.x;
      seg.baselineY = pos.y;
      seg.span.style.left = `${pos.left}px`;
      seg.span.style.top = `${pos.top}px`;
      if (activeSegment === seg) {
        updateSelectionFramePos(seg, currentSelectionFrame);
        updateFormatToolbarPosition();
      }
    } else if (action.type === 'resizeWidth') {
      const seg = action.seg;
      const w = isUndo ? action.oldWidth : action.newWidth;
      seg.width = w;
      const vp = pages[seg.pageIdx] ? pages[seg.pageIdx].viewport : null;
      const scale = vp ? vp.scale : 1;
      seg.span.style.width = `${w * scale}px`;
      if (activeSegment === seg) {
        updateSelectionFramePos(seg, currentSelectionFrame);
        updateFormatToolbarPosition();
      }
    } else if (action.type === 'deleteText') {
      const seg = action.seg;
      const text = isUndo ? action.oldText : '';
      seg.currentText = text;
      seg.span.innerText = text;
      if (text) {
        seg.span.classList.remove('edited');
      } else {
        seg.span.classList.add('edited');
        seg.span.style.background = seg.bgColor;
      }
      if (activeSegment === seg) {
        updateSelectionFramePos(seg, currentSelectionFrame);
        updateFormatToolbarPosition();
      }
    }
  }

  if (undoBtn) undoBtn.addEventListener('click', performUndo);
  if (redoBtn) redoBtn.addEventListener('click', performRedo);

  /* ── Tools ── */
  function setActiveTool(toolId) {
    activeTool = toolId;
    isPlacingStamp = false;
    TOOLS.forEach(id => {
      toolBtns[id].setAttribute('aria-pressed', id === toolId ? 'true' : 'false');
    });

    pages.forEach(pg => {
      if (!pg || !pg.overlay) return;
      const needsDraw = toolId === 'tool-draw' || toolId === 'tool-highlight';
      pg.overlay.style.touchAction = needsDraw ? 'none' : 'auto';
      pg.overlay.style.pointerEvents = (toolId === 'tool-edittext') ? 'none' : 'auto';
      if (pg.textLayer) {
        pg.textLayer.style.pointerEvents = (toolId === 'tool-edittext' || toolId === 'tool-addtext') ? 'auto' : 'none';
      }
    });

    updateToolIndicator(toolId);
  }

  const indicator = document.getElementById('toolbar-indicator');
  function updateToolIndicator(toolId) {
    const btn = toolBtns[toolId];
    if (!btn || !indicator) return;
    const tr = toolbar.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    indicator.style.left = `${br.left - tr.left}px`;
    indicator.style.width = `${br.width}px`;
    indicator.style.height = `${br.height}px`;
    indicator.style.top = `${br.top - tr.top}px`;
  }

  toolBtns['tool-edittext'].addEventListener('click', () => setActiveTool('tool-edittext'));
  toolBtns['tool-addtext'].addEventListener('click', () => setActiveTool('tool-addtext'));
  toolBtns['tool-draw'].addEventListener('click', () => setActiveTool(activeTool === 'tool-draw' ? 'tool-edittext' : 'tool-draw'));
  toolBtns['tool-highlight'].addEventListener('click', () => setActiveTool(activeTool === 'tool-highlight' ? 'tool-edittext' : 'tool-highlight'));
  toolBtns['tool-sign'].addEventListener('click', () => openSignModal());
  toolBtns['tool-addimage'].addEventListener('click', () => addImgInput.click());

  addImgInput.addEventListener('change', async () => {
    const f = addImgInput.files[0];
    if (!f) return;
    addImgInput.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      stampData = { type: 'image', dataUrl: reader.result, w: 150, h: 150 };
      isPlacingStamp = true;
      setActiveTool('tool-addimage');
      toast('Tap on a page to place the image.', 'info');
    };
    reader.readAsDataURL(f);
  });

  /* ── Overlay pointer events (throttled with rAF) ── */
  function attachOverlayEvents(overlay, idx) {
    let drawing = false;
    let drawPts = [];
    let hlStart = null;
    let rAfPending = false;

    function getPt(e) {
      const rect = overlay.getBoundingClientRect();
      const scaleX = overlay.width / rect.width;
      const scaleY = overlay.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    overlay.addEventListener('pointerdown', (e) => {
      const pt = getPt(e);
      if (activeTool === 'tool-addtext') {
        handleAddText(pt, idx);
        return;
      }
      if ((activeTool === 'tool-sign' || activeTool === 'tool-addimage') && isPlacingStamp) {
        placeStamp(pt, idx);
        return;
      }
      if (activeTool === 'tool-draw') {
        drawing = true;
        drawPts = [pt];
        overlay.setPointerCapture(e.pointerId);
      } else if (activeTool === 'tool-highlight') {
        drawing = true;
        hlStart = pt;
        overlay.setPointerCapture(e.pointerId);
      }
    });

    overlay.addEventListener('pointermove', (e) => {
      if (!drawing || rAfPending) return;
      rAfPending = true;

      requestAnimationFrame(() => {
        rAfPending = false;
        if (!drawing) return;
        const pt = getPt(e);
        const pg = pages[idx];
        if (!pg) return;

        if (activeTool === 'tool-draw') {
          drawPts.push(pt);
          pg.ctx.save();
          pg.ctx.strokeStyle = drawColour;
          pg.ctx.lineWidth = 2;
          pg.ctx.lineCap = 'round';
          pg.ctx.lineJoin = 'round';
          if (drawPts.length >= 2) {
            pg.ctx.beginPath();
            pg.ctx.moveTo(drawPts[drawPts.length - 2].x, drawPts[drawPts.length - 2].y);
            pg.ctx.lineTo(pt.x, pt.y);
            pg.ctx.stroke();
          }
          pg.ctx.restore();
        } else if (activeTool === 'tool-highlight' && hlStart) {
          redrawOverlay(idx);
          pg.ctx.save();
          pg.ctx.fillStyle = 'rgba(251,191,36,0.40)';
          const x = Math.min(hlStart.x, pt.x);
          const y = Math.min(hlStart.y, pt.y);
          const w = Math.abs(pt.x - hlStart.x);
          const h = Math.abs(pt.y - hlStart.y);
          pg.ctx.fillRect(x, y, w, h);
          pg.ctx.restore();
        }
      });
    }, { passive: true });

    overlay.addEventListener('pointerup', (e) => {
      if (!drawing) return;
      drawing = false;
      const pt = getPt(e);
      const pg = pages[idx];
      if (!pg) return;

      if (activeTool === 'tool-draw' && drawPts.length > 1) {
        const edit = { type: 'draw', points: [...drawPts], color: drawColour, lineWidth: 2 };
        const editIdx = pg.edits.length;
        pg.edits.push(edit);
        pushUndo({ type: 'overlayEdit', pageIdx: idx, edit, editIdx });
        redrawOverlay(idx);
        drawPts = [];
      } else if (activeTool === 'tool-highlight' && hlStart) {
        const x = Math.min(hlStart.x, pt.x);
        const y = Math.min(hlStart.y, pt.y);
        const w = Math.abs(pt.x - hlStart.x);
        const h = Math.abs(pt.y - hlStart.y);
        if (w > 4 && h > 4) {
          const edit = { type: 'highlight', x, y, w, h, color: 'rgba(251,191,36,0.40)' };
          const editIdx = pg.edits.length;
          pg.edits.push(edit);
          pushUndo({ type: 'overlayEdit', pageIdx: idx, edit, editIdx });
        }
        redrawOverlay(idx);
        hlStart = null;
      }
    });
  }

  function handleAddText(pt, idx) {
    const pg = pages[idx];
    if (!pg || !pg.viewport) return;

    const [pdfX, pdfY] = pg.viewport.convertToPdfPoint(pt.x, pt.y);
    const newSeg = {
      originalText: '',
      currentText: 'New text',
      x: pdfX,
      baselineY: pdfY,
      origX: pdfX,
      origBaselineY: pdfY,
      fontSize: textSize || 14,
      origFontSize: textSize || 14,
      width: 120,
      origWidth: 120,
      angle: 0,
      angleDeg: 0,
      fontName: 'Helvetica',
      rawFontName: 'Helvetica',
      fontFamily: 'Helvetica',
      cssFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      bold: false,
      italic: false,
      underline: false,
      isRtl: false,
      dir: 'ltr',
      color: drawColour || '#000000',
      bgColor: '#ffffff',
      textAlign: 'left',
      lineSpacing: 1.25,
      letterSpacing: 0,
      span: null,
      pageIdx: idx,
      isNew: true,
    };

    pg.segments.push(newSeg);
    placeSegmentSpan(newSeg, pg.canvas, pg.textLayer, idx, pg.viewport, pg.segments);
    selectSegment(newSeg, pg);

    if (newSeg.span) {
      newSeg.span.focus();
      const range = document.createRange();
      range.selectNodeContents(newSeg.span);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    toast('Added new text element. Type your text or drag to position.', 'info');
  }

  function placeStamp(pt, idx) {
    if (!stampData) return;
    const pg = pages[idx];
    if (!pg) return;

    const edit = {
      type: 'image',
      dataUrl: stampData.dataUrl,
      x: pt.x - stampData.w / 2,
      y: pt.y - stampData.h / 2,
      w: stampData.w,
      h: stampData.h,
      pageIdx: idx,
    };
    const editIdx = pg.edits.length;
    pg.edits.push(edit);
    pushUndo({ type: 'overlayEdit', pageIdx: idx, edit, editIdx });
    redrawOverlay(idx);

    stampData = null;
    isPlacingStamp = false;
    setActiveTool('tool-edittext');
    toast('Stamp placed!', 'success');
  }

  function openSignModal() {
    signModal.classList.add('open');
    const ctx = signCanvas.getContext('2d');
    const W = signCanvas.clientWidth || 360;
    const H = signCanvas.clientHeight || 160;
    signCanvas.width = W * (window.devicePixelRatio || 1);
    signCanvas.height = H * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, W, H);

    let signing = false;
    let lastPt = null;

    function getPt(e) {
      const r = signCanvas.getBoundingClientRect();
      const cx = e.clientX ?? e.touches[0].clientX;
      const cy = e.clientY ?? e.touches[0].clientY;
      return { x: cx - r.left, y: cy - r.top };
    }

    function onDown(e) { e.preventDefault(); signing = true; lastPt = getPt(e); }
    function onMove(e) {
      if (!signing) return;
      const pt = getPt(e);
      ctx.beginPath();
      ctx.moveTo(lastPt.x, lastPt.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
      lastPt = pt;
    }
    function onUp() { signing = false; }

    signCanvas.addEventListener('pointerdown', onDown);
    signCanvas.addEventListener('pointermove', onMove);
    signCanvas.addEventListener('pointerup', onUp);

    document.getElementById('sign-clear').onclick = () => ctx.clearRect(0, 0, W, H);
    document.getElementById('sign-cancel').onclick = () => {
      signModal.classList.remove('open');
    };
    document.getElementById('sign-done').onclick = () => {
      const dataUrl = signCanvas.toDataURL('image/png');
      stampData = { type: 'sign', dataUrl, w: 160, h: 60 };
      isPlacingStamp = true;
      signModal.classList.remove('open');
      setActiveTool('tool-sign');
      toast('Tap on a page to place your signature.', 'info');
    };
  }

  /* ── Save PDF (Vector / Flatten) ── */
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    toast('Preparing download…');

    try {
      await ensurePdfLib();
      const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;

      const flatten = flattenCheck.checked || isPasswordProtected;
      let pdfBytes;

      if (flatten) {
        // Flattened image mode
        const outPdf = await PDFDocument.create();
        for (const pg of pages) {
          if (!pg || pg.deleted) continue;
          if (!pg.isRendered) {
            await renderSinglePage(pg);
          }

          const tmp = document.createElement('canvas');
          tmp.width = pg.canvas.width;
          tmp.height = pg.canvas.height;
          const tCtx = tmp.getContext('2d');
          tCtx.drawImage(pg.canvas, 0, 0);

          // Draw edited segments
          for (const seg of pg.segments) {
            if (seg.currentText !== null) {
              const origX = seg.origX !== undefined ? seg.origX : seg.x;
              const origBaselineY = seg.origBaselineY !== undefined ? seg.origBaselineY : seg.baselineY;
              const origFontSize = seg.origFontSize !== undefined ? seg.origFontSize : seg.fontSize;
              const origWidth = seg.origWidth !== undefined ? seg.origWidth : seg.width;

              const vpForCanvas = pg.renderViewport || pg.viewport;

              // 1. Erase original text in flatten canvas
              if (!seg.isNew) {
                const origP0 = vpForCanvas.convertToViewportPoint(origX, origBaselineY);
                const origP1 = vpForCanvas.convertToViewportPoint(origX + Math.cos(seg.angle), origBaselineY + Math.sin(seg.angle));
                const odx = origP1[0] - origP0[0];
                const ody = origP1[1] - origP0[1];
                const oScreenScale = Math.hypot(odx, ody);
                const oScreenAngle = Math.atan2(ody, odx);
                const oScreenFontSize = origFontSize * oScreenScale;
                const oScreenAscent = oScreenFontSize * 0.82;
                const oScreenDescent = oScreenFontSize * 0.22;
                const oTotalH = oScreenAscent + oScreenDescent;
                const oTotalW = origWidth * oScreenScale + 2;

                tCtx.save();
                tCtx.translate(origP0[0], origP0[1]);
                tCtx.rotate(oScreenAngle);
                tCtx.fillStyle = seg.bgColor || '#ffffff';
                tCtx.fillRect(-1, -oScreenAscent - 1, oTotalW, oTotalH + 2);
                tCtx.restore();
              }

              // 2. Draw new text if not empty
              const textToDraw = seg.currentText || '';
              if (textToDraw.length > 0) {
                const p0 = vpForCanvas.convertToViewportPoint(seg.x, seg.baselineY);
                const p1 = vpForCanvas.convertToViewportPoint(seg.x + Math.cos(seg.angle), seg.baselineY + Math.sin(seg.angle));
                const dx = p1[0] - p0[0];
                const dy = p1[1] - p0[1];
                const screenScale = Math.hypot(dx, dy);
                const screenAngle = Math.atan2(dy, dx);
                const screenFontSize = seg.fontSize * screenScale;

                tCtx.save();
                tCtx.translate(p0[0], p0[1]);
                tCtx.rotate(screenAngle);

                tCtx.fillStyle = seg.color || '#000000';
                tCtx.font = `${seg.italic ? 'italic ' : ''}${seg.bold ? 'bold ' : ''}${screenFontSize}px ${seg.cssFamily}`;
                tCtx.textBaseline = 'alphabetic';

                const lines = textToDraw.split(/\r?\n/);
                const lineSpacing = seg.lineSpacing || 1.25;

                for (let li = 0; li < lines.length; li++) {
                  const line = lines[li];
                  const lineDy = li * screenFontSize * lineSpacing;
                  const metrics = tCtx.measureText(line);
                  const lineWidth = metrics.width;
                  const boxWidth = seg.width * screenScale;

                  let u_off = 0;
                  if (seg.textAlign === 'center') {
                    u_off = Math.max(0, (boxWidth - lineWidth) / 2);
                  } else if (seg.textAlign === 'right') {
                    u_off = Math.max(0, boxWidth - lineWidth);
                  }

                  tCtx.fillText(line, u_off, lineDy);

                  if (seg.underline) {
                    tCtx.fillRect(u_off, lineDy + screenFontSize * 0.1, lineWidth, Math.max(1, screenFontSize * 0.07));
                  }
                }

                tCtx.restore();
              }
            }
          }

          tCtx.drawImage(pg.overlay, 0, 0);
          const pngUrl = tmp.toDataURL('image/png');
          const b64 = pngUrl.split(',')[1];
          const imgBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const pdfImg = await outPdf.embedPng(imgBytes);

          // Use exact viewport user space dimensions
          const vp1 = pg.viewport;
          const pW = vp1.width / vp1.scale;
          const pH = vp1.height / vp1.scale;
          const page = outPdf.addPage([pW, pH]);
          page.drawImage(pdfImg, { x: 0, y: 0, width: pW, height: pH });
        }
        pdfBytes = await outPdf.save({ useObjectStreams: true });
      } else {
        // Vector mode
        const srcPdf = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
        const outPdf = await PDFDocument.create();

        // Standard font cache
        const stdFonts = {};
        async function getStdFont(fam, bold, italic) {
          let name = StandardFonts.Helvetica;
          if (fam === 'Times') {
            if (bold && italic) name = StandardFonts.TimesRomanBoldItalic;
            else if (bold) name = StandardFonts.TimesRomanBold;
            else if (italic) name = StandardFonts.TimesRomanItalic;
            else name = StandardFonts.TimesRoman;
          } else if (fam === 'Courier') {
            if (bold && italic) name = StandardFonts.CourierBoldOblique;
            else if (bold) name = StandardFonts.CourierBold;
            else if (italic) name = StandardFonts.CourierOblique;
            else name = StandardFonts.Courier;
          } else {
            if (bold && italic) name = StandardFonts.HelveticaBoldOblique;
            else if (bold) name = StandardFonts.HelveticaBold;
            else if (italic) name = StandardFonts.HelveticaOblique;
            else name = StandardFonts.Helvetica;
          }
          if (!stdFonts[name]) {
            stdFonts[name] = await outPdf.embedFont(name);
          }
          return stdFonts[name];
        }

        // Noto font cache in outPdf
        let fontkitRegistered = false;
        const embeddedNotoFonts = {};

        async function getNotoFont(notoFileName) {
          if (!fontkitRegistered) {
            const fk = await ensureFontkit();
            outPdf.registerFontkit(fk);
            fontkitRegistered = true;
          }
          if (!embeddedNotoFonts[notoFileName]) {
            const fontBytes = await loadNotoFontBytes(notoFileName);
            embeddedNotoFonts[notoFileName] = await outPdf.embedFont(fontBytes, { subset: true });
          }
          return embeddedNotoFonts[notoFileName];
        }

        function canFontEncode(font, str) {
          try {
            font.encodeText(str);
            return true;
          } catch (e) {
            return false;
          }
        }

        for (const pg of pages) {
          if (!pg || pg.deleted) continue;
          const [copiedPage] = await outPdf.copyPages(srcPdf, [pg.idx]);
          outPdf.addPage(copiedPage);
          const outPage = outPdf.getPage(outPdf.getPageCount() - 1);

          for (const seg of pg.segments) {
            if (seg.currentText !== null && (seg.currentText !== seg.originalText || seg.isNew)) {
              const bg = seg.bgColor ? hexToRgb(seg.bgColor) : { r: 255, g: 255, b: 255 };
              const col = hexToRgb(seg.color || '#000000');

              // Draw covering rectangle in PDF user space (erases original text)
              const cosA = Math.cos(seg.angle);
              const sinA = Math.sin(seg.angle);
              const origX = seg.origX !== undefined ? seg.origX : seg.x;
              const origBaselineY = seg.origBaselineY !== undefined ? seg.origBaselineY : seg.baselineY;
              const origFontSize = seg.origFontSize !== undefined ? seg.origFontSize : seg.fontSize;
              const origWidth = seg.origWidth !== undefined ? seg.origWidth : seg.width;

              const charW = Math.max(origFontSize * 0.7, origWidth / ((seg.originalText && seg.originalText.length) || 1));
              const estNewWidth = (seg.currentText || '').length * charW;
              const effWidth = Math.max(origWidth, estNewWidth);

              const padU = 1.0;
              const padV = 1.0;
              const u0 = -padU;
              const v0 = -(origFontSize * 0.22) - padV;
              const x_rect = origX + u0 * cosA - v0 * sinA;
              const y_rect = origBaselineY + u0 * sinA + v0 * cosA;
              const w_rect = effWidth + 2 * padU;
              const h_rect = origFontSize * 1.05 + 2 * padV;

              if (!seg.isNew) {
                outPage.drawRectangle({
                  x: x_rect,
                  y: y_rect,
                  width: w_rect,
                  height: h_rect,
                  rotate: degrees(seg.angleDeg),
                  color: rgb(bg.r / 255, bg.g / 255, bg.b / 255),
                });
              }

              const textToDraw = seg.currentText || '';
              if (textToDraw.length > 0) {
                // Font selection
                let chosenFont = await getStdFont(seg.fontFamily, seg.bold, seg.italic);
                if (!canFontEncode(chosenFont, textToDraw)) {
                  // Fall back to Noto font
                  const notoInfo = pickNotoFontForText(textToDraw, seg.fontFamily === 'Times');
                  try {
                    const notoFont = await getNotoFont(notoInfo.fileName);
                    if (canFontEncode(notoFont, textToDraw)) {
                      chosenFont = notoFont;
                    }
                  } catch (e) {
                    console.warn('Noto font embed failed:', e);
                  }
                }

                // If still cannot encode, fallback toast
                if (!canFontEncode(chosenFont, textToDraw)) {
                  toast(`Characters in "${textToDraw.slice(0, 15)}" require flatten mode. Saving with flatten fallback.`, 'warning');
                } else {
                  const lines = textToDraw.split(/\r?\n/);
                  const lineSpacing = seg.lineSpacing || 1.25;

                  for (let li = 0; li < lines.length; li++) {
                    const line = lines[li];
                    const lineDy = li * seg.fontSize * lineSpacing;
                    const lineBaseX = seg.x + lineDy * sinA;
                    const lineBaseY = seg.baselineY - lineDy * cosA;

                    let lineWidth = 0;
                    try {
                      lineWidth = chosenFont.widthOfTextAtSize(line, seg.fontSize);
                    } catch (e) {
                      lineWidth = line.length * (seg.fontSize * 0.5);
                    }

                    let u_off = 0;
                    if (seg.textAlign === 'center') {
                      u_off = Math.max(0, (seg.width - lineWidth) / 2);
                    } else if (seg.textAlign === 'right') {
                      u_off = Math.max(0, seg.width - lineWidth);
                    }

                    const finalLineX = lineBaseX + u_off * cosA;
                    const finalLineY = lineBaseY + u_off * sinA;

                    outPage.drawText(line, {
                      x: finalLineX,
                      y: finalLineY,
                      size: seg.fontSize,
                      font: chosenFont,
                      rotate: degrees(seg.angleDeg),
                      color: rgb(col.r / 255, col.g / 255, col.b / 255),
                    });

                    if (seg.underline) {
                      const uX = finalLineX - (seg.fontSize * 0.12) * sinA;
                      const uY = finalLineY - (seg.fontSize * 0.12) * cosA;
                      outPage.drawRectangle({
                        x: uX,
                        y: uY,
                        width: lineWidth,
                        height: Math.max(1, seg.fontSize * 0.07),
                        rotate: degrees(seg.angleDeg),
                        color: rgb(col.r / 255, col.g / 255, col.b / 255),
                      });
                    }
                  }
                }
              }
            }
          }

          // Draw overlay edits
          if (pg.edits && pg.edits.length > 0 && pg.viewport) {
            const defFont = await getStdFont('Helvetica', false, false);
            for (const edit of pg.edits) {
              if (edit.type === 'addtext') {
                const [pdfX, pdfY] = pg.viewport.convertToPdfPoint(edit.x, edit.y);
                const col = hexToRgb(edit.color || '#000000');
                const fs = (edit.fontSize || textSize) / pg.viewport.scale;
                outPage.drawText(edit.str, {
                  x: pdfX,
                  y: pdfY,
                  size: fs,
                  font: defFont,
                  rotate: degrees(-pg.viewport.rotation),
                  color: rgb(col.r / 255, col.g / 255, col.b / 255),
                });
              } else if (edit.type === 'highlight') {
                const [p0x, p0y] = pg.viewport.convertToPdfPoint(edit.x, edit.y + edit.h);
                const [p1x, p1y] = pg.viewport.convertToPdfPoint(edit.x + edit.w, edit.y);
                outPage.drawRectangle({
                  x: Math.min(p0x, p1x),
                  y: Math.min(p0y, p1y),
                  width: Math.abs(p1x - p0x),
                  height: Math.abs(p1y - p0y),
                  color: rgb(0.98, 0.75, 0.14),
                  opacity: 0.4,
                });
              }
            }
          }
        }

        pdfBytes = await outPdf.save({ useObjectStreams: true });
      }

      saveBtn.disabled = false;
      const outName = `${originalFileName}-edited.pdf`;
      window.__lastSavedPdfBytes = pdfBytes;
      downloadBytes(pdfBytes, outName);
      toast(`PDF saved as "${outName}"!`, 'success');
    } catch (err) {
      saveBtn.disabled = false;
      toast(`Save failed: ${err.message}`, 'error');
      console.error(err);
    }
  });

  setupFormatToolbarListeners();

})();

/* ════════════════════════════════════════════════════════════
   PWA SERVICE WORKER REGISTRATION
   ════════════════════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}
