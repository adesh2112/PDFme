'use strict';
const fs = require('fs');
const path = require('path');
const PDFLib = require('./lib/pdf-lib.min.js');

// Global mock DOM environment
global.window = global;
global.PDFLib = PDFLib;
global.pdfLib = PDFLib;

// Load test image files
const portraitJpgBytes = fs.readFileSync('test-files/portrait.jpg');
const landscapeJpgBytes = fs.readFileSync('test-files/landscape.jpg');
const portraitPngBytes = fs.readFileSync('test-files/portrait.png');
const landscapePngBytes = fs.readFileSync('test-files/landscape.png');

// Mock URL
let objectUrlId = 0;
const blobStorage = new Map();
global.URL = {
  createObjectURL: (blob) => {
    const id = `blob:test-${++objectUrlId}`;
    blobStorage.set(id, blob);
    return id;
  },
  revokeObjectURL: (id) => {
    blobStorage.delete(id);
  }
};

// Mock Image
class MockImage {
  constructor() {
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this._src = '';
  }
  set src(val) {
    this._src = val;
    process.nextTick(() => {
      const blob = blobStorage.get(val);
      if (!blob) {
        if (typeof this.onerror === 'function') this.onerror(new Error('Invalid URL'));
        return;
      }
      if (blob._isCorrupted) {
        if (typeof this.onerror === 'function') this.onerror(new Error('Corrupted image'));
        return;
      }
      this.naturalWidth = blob._mockWidth || 100;
      this.naturalHeight = blob._mockHeight || 100;
      if (typeof this.onload === 'function') this.onload();
    });
  }
  get src() {
    return this._src;
  }
}
global.Image = MockImage;

// Mock Canvas
class MockCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
  }
  getContext(type) {
    return {
      drawImage: () => {}
    };
  }
  toDataURL(mime, quality) {
    // Return minimal valid base64 image data
    if (mime === 'image/png') {
      return 'data:image/png;base64,' + portraitPngBytes.toString('base64');
    }
    return 'data:image/jpeg;base64,' + portraitJpgBytes.toString('base64');
  }
}

class ClassList {
  constructor() { this._set = new Set(); }
  add(...c) { c.forEach(x => this._set.add(x)); }
  remove(...c) { c.forEach(x => this._set.delete(x)); }
  contains(c) { return this._set.has(c); }
  toggle(c) { if (this._set.has(c)) this._set.delete(c); else this._set.add(c); }
}

// Mock DOM Elements
class MockElement {
  constructor(tagName, id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.classList = new ClassList();
    this.children = [];
    this.attributes = new Map();
    this.style = {};
    this.listeners = new Map();
    this.disabled = false;
    this.value = '';
    this._innerHTML = '';
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = val;
    this.children = [];
    if (!val) return;
    // Simple parser for buttons with data-action
    const re = /<button[^>]*data-action="([^"]+)"[^>]*>/g;
    let m;
    while ((m = re.exec(val)) !== null) {
      const btn = new MockElement('button');
      btn.setAttribute('data-action', m[1]);
      btn.classList.add('icon-btn');
      this.children.push(btn);
    }
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  setAttribute(k, v) {
    this.attributes.set(k, v);
  }

  getAttribute(k) {
    return this.attributes.get(k);
  }

  addEventListener(ev, fn) {
    if (!this.listeners.has(ev)) this.listeners.set(ev, []);
    this.listeners.get(ev).push(fn);
  }

  dispatchEvent(ev) {
    const list = this.listeners.get(ev.type) || [];
    for (const fn of list) fn(ev);
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this, preventDefault: () => {} });
  }

  querySelector(sel) {
    if (sel.startsWith('[data-action=')) {
      const action = sel.match(/\[data-action="?([^"\]]+)"?\]/)[1];
      return this._findDescendant(el => el.getAttribute('data-action') === action);
    }
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      return this._findDescendant(el => el.classList.has(cls));
    }
    return null;
  }

  querySelectorAll(sel) {
    const res = [];
    this._collectDescendants(el => {
      if (sel.startsWith('[data-action=')) {
        const action = sel.match(/\[data-action="?([^"\]]+)"?\]/)[1];
        return el.getAttribute('data-action') === action;
      }
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        return el.classList.has(cls);
      }
      return false;
    }, res);
    return res;
  }

  _findDescendant(predicate) {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const found = child._findDescendant(predicate);
      if (found) return found;
    }
    return null;
  }

  _collectDescendants(predicate, acc) {
    for (const child of this.children) {
      if (predicate(child)) acc.push(child);
      child._collectDescendants(predicate, acc);
    }
  }

  closest(sel) {
    return this;
  }
}

// Minimal document mock
const elementsById = new Map();
global.document = {
  head: new MockElement('head'),
  body: new MockElement('body'),
  getElementById: (id) => {
    if (!elementsById.has(id)) {
      const el = new MockElement('div', id);
      elementsById.set(id, el);
    }
    return elementsById.get(id);
  },
  createElement: (tag) => {
    if (tag === 'canvas') return new MockCanvas();
    return new MockElement(tag);
  },
  querySelector: (sel) => {
    if (sel.includes('input[name="page-size"]:checked')) {
      return pageSizeRadioChecked;
    }
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel.includes('input[name="page-size"]')) {
      return pageSizeRadios;
    }
    return [];
  }
};

let pageSizeRadioChecked = { value: 'a4' };
let pageSizeRadios = [
  { value: 'a4', checked: true, addEventListener: () => {}, closest: () => ({ classList: new Set() }) },
  { value: 'letter', checked: false, addEventListener: () => {}, closest: () => ({ classList: new Set() }) },
  { value: 'fit', checked: false, addEventListener: () => {}, closest: () => ({ classList: new Set() }) }
];

// Helper mock File
class MockFile {
  constructor(buffer, name, mime, width = 100, height = 100, isCorrupted = false) {
    this.buffer = buffer;
    this.name = name;
    this.type = mime;
    this.size = buffer ? buffer.length : 0;
    this._mockWidth = width;
    this._mockHeight = height;
    this._isCorrupted = isCorrupted;
  }
  async arrayBuffer() {
    if (this._isCorrupted) throw new Error('Corrupted file read');
    return this.buffer.buffer.slice(this.buffer.byteOffset, this.buffer.byteOffset + this.buffer.byteLength);
  }
}

// Intercept downloads and toasts
let downloads = [];
let toasts = [];

global.downloadBytes = function(bytes, filename) {
  downloads.push({ bytes, filename });
};

global.toast = function(msg, type = 'info') {
  toasts.push({ msg, type });
};

global.fmtBytes = function(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
};

global.makeSortable = function() {};

// Load app.js and initialize photos
const appJs = fs.readFileSync('app.js', 'utf8');

// Extract the ensurePdfLib and initPhotos functions to evaluate
const ensurePdfLibMatch = appJs.match(/let pdfLibPromise[\s\S]*?return pdfLibPromise;\s*\}/);
const initPhotosMatch = appJs.match(/\(function initPhotos\(\) \{[\s\S]*?\}\)\(\);/);

if (!ensurePdfLibMatch || !initPhotosMatch) {
  console.error('Could not find ensurePdfLib or initPhotos in app.js');
  process.exit(1);
}

// Evaluate ensurePdfLib & initPhotos in our mock DOM environment
new Function('PDFLib', 'window', 'document', ensurePdfLibMatch[0] + '\nglobal.ensurePdfLib = ensurePdfLib;')(PDFLib, window, document);
eval(initPhotosMatch[0]);

const photosList = document.getElementById('photos-list');
const photosBtn = document.getElementById('photos-btn');
const photosClear = document.getElementById('photos-clear');
const photosDrop = document.getElementById('photos-drop');
const photosInput = document.getElementById('photos-input');

function addFilesToUI(files) {
  const ev = {
    preventDefault: () => {},
    classList: { remove: () => {} },
    dataTransfer: { files }
  };
  const dropHandlers = photosDrop.listeners.get('drop') || [];
  for (const h of dropHandlers) h(ev);
}

async function runDomTests() {
  console.log('========================================================');
  console.log('PHOTO TO PDF DOM COMPREHENSIVE TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  const total = 8;

  // TEST 1: One JPG to PDF
  try {
    downloads = [];
    toasts = [];
    photosClear.click();

    const f1 = new MockFile(portraitJpgBytes, 'single-portrait.jpg', 'image/jpeg', 120, 240);
    addFilesToUI([f1]);

    pageSizeRadioChecked.value = 'a4';
    photosBtn.click();
    await new Promise(r => setTimeout(r, 100));

    if (downloads.length === 0) throw new Error('No download triggered');
    const dl = downloads[0];
    const doc = await PDFLib.PDFDocument.load(dl.bytes);
    if (doc.getPageCount() !== 1) throw new Error('Expected 1 page');
    if (dl.filename !== 'single-portrait.pdf') throw new Error(`Unexpected name: ${dl.filename}`);
    if (!toasts.some(t => t.type === 'success')) throw new Error('No success toast');

    console.log('[PASS] Test 1: One JPG to PDF: generated 1-page PDF, downloaded as "single-portrait.pdf"');
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 1:', e.message);
  }

  // TEST 2: One PNG to PDF
  try {
    downloads = [];
    toasts = [];
    photosClear.click();

    const f2 = new MockFile(landscapePngBytes, 'single-landscape.png', 'image/png', 400, 150);
    addFilesToUI([f2]);

    pageSizeRadioChecked.value = 'a4';
    photosBtn.click();
    await new Promise(r => setTimeout(r, 100));

    if (downloads.length === 0) throw new Error('No download triggered');
    const dl = downloads[0];
    const doc = await PDFLib.PDFDocument.load(dl.bytes);
    if (doc.getPageCount() !== 1) throw new Error('Expected 1 page');
    if (dl.filename !== 'single-landscape.pdf') throw new Error(`Unexpected name: ${dl.filename}`);
    if (!toasts.some(t => t.type === 'success')) throw new Error('No success toast');

    console.log('[PASS] Test 2: One PNG to PDF: generated 1-page PDF, downloaded as "single-landscape.pdf"');
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 2:', e.message);
  }

  // TEST 3: Multiple images to PDF
  try {
    downloads = [];
    toasts = [];
    photosClear.click();

    const f1 = new MockFile(portraitJpgBytes, 'img1.jpg', 'image/jpeg', 120, 240);
    const f2 = new MockFile(landscapePngBytes, 'img2.png', 'image/png', 400, 150);
    const f3 = new MockFile(portraitPngBytes, 'img3.png', 'image/png', 100, 300);
    addFilesToUI([f1, f2, f3]);

    pageSizeRadioChecked.value = 'a4';
    photosBtn.click();
    await new Promise(r => setTimeout(r, 100));

    if (downloads.length === 0) throw new Error('No download triggered');
    const dl = downloads[0];
    const doc = await PDFLib.PDFDocument.load(dl.bytes);
    if (doc.getPageCount() !== 3) throw new Error(`Expected 3 pages, got ${doc.getPageCount()}`);
    if (dl.filename !== 'photos.pdf') throw new Error(`Expected photos.pdf, got ${dl.filename}`);
    if (!toasts.some(t => t.type === 'success')) throw new Error('No success toast');

    console.log('[PASS] Test 3: Multiple images to PDF: generated 3-page PDF with all images in order');
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 3:', e.message);
  }

  // TEST 4: Portrait and landscape images
  try {
    downloads = [];
    toasts = [];
    photosClear.click();

    const fPortrait = new MockFile(portraitJpgBytes, 'portrait.jpg', 'image/jpeg', 120, 240);
    const fLandscape = new MockFile(landscapeJpgBytes, 'landscape.jpg', 'image/jpeg', 320, 160);
    addFilesToUI([fPortrait, fLandscape]);

    pageSizeRadioChecked.value = 'a4';
    photosBtn.click();
    await new Promise(r => setTimeout(r, 100));

    const dl = downloads[0];
    const doc = await PDFLib.PDFDocument.load(dl.bytes);
    const p1 = doc.getPage(0);
    const p2 = doc.getPage(1);

    if (p1.getWidth() >= p1.getHeight()) throw new Error('Page 1 should be portrait (width < height)');
    if (p2.getWidth() <= p2.getHeight()) throw new Error('Page 2 should be landscape (width > height)');

    console.log('[PASS] Test 4: Portrait and landscape images: orientation correctly set for each page');
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 4:', e.message);
  }

  // TEST 5: Rearranging image order
  try {
    downloads = [];
    toasts = [];
    photosClear.click();

    const f1 = new MockFile(portraitJpgBytes, 'first.jpg', 'image/jpeg', 120, 240);
    const f2 = new MockFile(landscapePngBytes, 'second.png', 'image/png', 400, 150);
    addFilesToUI([f1, f2]);

    // Click "down" button on item 0
    const downBtn = photosList.children[0].querySelector('[data-action="down"]');
    if (!downBtn) throw new Error('Move down button not found');
    downBtn.click();

    // Use fit mode to check page dimensions
    pageSizeRadioChecked.value = 'fit';
    photosBtn.click();
    await new Promise(r => setTimeout(r, 100));

    const dl = downloads[0];
    const doc = await PDFLib.PDFDocument.load(dl.bytes);
    // Page 0 should now be second.png (400x150 -> 300x112.5)
    const p0 = doc.getPage(0);
    if (Math.round(p0.getWidth()) !== 300 || Math.round(p0.getHeight()) !== 113) {
      throw new Error(`Page 0 does not match second.png: ${p0.getWidth()}x${p0.getHeight()}`);
    }
    // Page 1 should now be first.jpg (120x240 -> 90x180)
    const p1 = doc.getPage(1);
    if (Math.round(p1.getWidth()) !== 90 || Math.round(p1.getHeight()) !== 180) {
      throw new Error(`Page 1 does not match first.jpg: ${p1.getWidth()}x${p1.getHeight()}`);
    }

    console.log('[PASS] Test 5: Rearranging image order: sequence [second, first] confirmed in PDF');
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 5:', e.message);
  }

  // TEST 6: Removing an image
  try {
    downloads = [];
    toasts = [];
    photosClear.click();

    const f1 = new MockFile(portraitJpgBytes, 'keep1.jpg', 'image/jpeg', 120, 240);
    const f2 = new MockFile(landscapePngBytes, 'remove-me.png', 'image/png', 400, 150);
    const f3 = new MockFile(portraitPngBytes, 'keep2.png', 'image/png', 100, 300);
    addFilesToUI([f1, f2, f3]);

    if (photosList.children.length !== 3) throw new Error('Expected 3 items in list');

    // Click remove on item 1 (remove-me.png)
    const removeBtn = photosList.children[1].querySelector('[data-action="remove"]');
    if (!removeBtn) throw new Error('Remove button not found');
    removeBtn.click();

    if (photosList.children.length !== 2) throw new Error(`Expected 2 items after remove, got ${photosList.children.length}`);

    pageSizeRadioChecked.value = 'a4';
    photosBtn.click();
    await new Promise(r => setTimeout(r, 100));

    const dl = downloads[0];
    const doc = await PDFLib.PDFDocument.load(dl.bytes);
    if (doc.getPageCount() !== 2) throw new Error(`Expected 2 pages in PDF, got ${doc.getPageCount()}`);

    console.log('[PASS] Test 6: Removing an image: item removed from UI and omitted from PDF');
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 6:', e.message);
  }

  // TEST 7: Downloading the generated PDF
  try {
    downloads = [];
    toasts = [];
    photosClear.click();

    const f = new MockFile(portraitJpgBytes, 'invoice-photo.jpg', 'image/jpeg', 120, 240);
    addFilesToUI([f]);

    pageSizeRadioChecked.value = 'a4';
    photosBtn.click();
    await new Promise(r => setTimeout(r, 100));

    if (downloads.length !== 1) throw new Error('Download function was not called');
    const dl = downloads[0];
    if (!dl.bytes || dl.bytes.length === 0) throw new Error('Downloaded bytes are empty');
    if (dl.filename !== 'invoice-photo.pdf') throw new Error(`Filename mismatch: ${dl.filename}`);

    console.log(`[PASS] Test 7: Downloading generated PDF: download triggered with "${dl.filename}" (${dl.bytes.length} bytes)`);
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 7:', e.message);
  }

  // TEST 8: Opening the downloaded PDF to verify it is valid
  try {
    const lastDl = downloads[0];
    if (!lastDl) throw new Error('No downloaded PDF to inspect');

    const loadedDoc = await PDFLib.PDFDocument.load(lastDl.bytes);
    if (!loadedDoc) throw new Error('Failed to parse downloaded PDF document');
    const page = loadedDoc.getPage(0);
    if (page.getWidth() <= 0 || page.getHeight() <= 0) throw new Error('Invalid page dimensions');

    console.log(`[PASS] Test 8: Opening downloaded PDF: successfully loaded and verified (${page.getWidth()}x${page.getHeight()} pt)`);
    passed++;
  } catch (e) {
    console.error('[FAIL] Test 8:', e.message);
  }

  // EXTRA: Error handling checks
  console.log('\n--- Error Handling Checks ---');

  // A. Empty upload
  toasts = [];
  photosClear.click();
  photosBtn.click();
  const emptyWarn = toasts.some(t => t.type === 'warning');
  if (emptyWarn) {
    console.log('[PASS] Error Handling: Empty submit blocked with warning toast');
  } else {
    console.error('[FAIL] Error Handling: Empty submit did not show warning');
  }

  // B. Corrupted image
  toasts = [];
  downloads = [];
  photosClear.click();
  const corruptFile = new MockFile(Buffer.from('corrupt data'), 'corrupt.jpg', 'image/jpeg', 0, 0, true);
  addFilesToUI([corruptFile]);
  photosBtn.click();
  await new Promise(r => setTimeout(r, 100));

  const corruptError = toasts.some(t => t.type === 'error' && t.msg.includes('corrupted'));
  const noSuccess = !toasts.some(t => t.type === 'success');
  const noDownload = downloads.length === 0;

  if (corruptError && noSuccess && noDownload) {
    console.log('[PASS] Error Handling: Corrupted image handled with clear error toast, no success or download');
  } else {
    console.error('[FAIL] Error Handling: Corrupted image not handled properly:', toasts);
  }

  // C. Invalid file format
  toasts = [];
  photosClear.click();
  const txtFile = new MockFile(Buffer.from('plain text'), 'document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  addFilesToUI([txtFile]);
  const formatError = toasts.some(t => t.type === 'error' && t.msg.includes('not a supported image format'));
  if (formatError) {
    console.log('[PASS] Error Handling: Non-image format rejected with clear error toast');
  } else {
    console.error('[FAIL] Error Handling: Non-image format not rejected');
  }

  console.log('\n========================================================');
  console.log(`RESULTS: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================\n');

  if (passed !== total) process.exit(1);
}

runDomTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
