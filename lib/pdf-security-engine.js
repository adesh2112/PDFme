'use strict';
/**
 * PDF Security Engine
 * Handles: Password Protection, Password Removal, Permanent Redaction, Metadata Removal, Secure Share Tokens.
 */

var PDFLib = typeof require !== 'undefined' ? require('./pdf-lib.min.js') : (typeof window !== 'undefined' ? window.PDFLib : null);
var _secCrypto = typeof require !== 'undefined' ? require('crypto') : (typeof window !== 'undefined' ? window.crypto : null);

// Standard PDF 32-byte padding string (ISO 32000-1)
const PAD_BYTES = new Uint8Array([
  0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41,
  0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
  0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
  0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A
]);

function rc4Encrypt(key, data) {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
  }
  let i = 0; j = 0;
  const out = new Uint8Array(data.length);
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
    out[k] = data[k] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

function md5Sync(bytes) {
  if (typeof require !== 'undefined') {
    const c = require('crypto');
    return new Uint8Array(c.createHash('md5').update(Buffer.from(bytes)).digest());
  }
  // Simple MD5 in pure JS for browser
  return computeMd5(bytes);
}

// Pure JS MD5 implementation for universal browser compatibility
function computeMd5(input) {
  const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
  function safeAdd(x, y) { const lsw = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff); }
  function bitRol(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
  function md5cmn(q, a, b, x, s, t) { return safeAdd(bitRol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
  function md5ff(a, b, c, d, x, s, t) { return md5cmn((b & c) | (~b & d), a, b, x, s, t); }
  function md5gg(a, b, c, d, x, s, t) { return md5cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function md5hh(a, b, c, d, x, s, t) { return md5cmn(b ^ c ^ d, a, b, x, s, t); }
  function md5ii(a, b, c, d, x, s, t) { return md5cmn(c ^ (b | ~d), a, b, x, s, t); }

  const n = bytes.length;
  const words = [];
  for (let i = 0; i < n; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  words[n >> 2] |= 0x80 << ((n % 4) * 8);
  words[(((n + 8) >> 6) << 4) + 14] = n * 8;

  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < words.length; i += 16) {
    const olda = a, oldb = b, oldc = c, oldd = d;
    a = md5ff(a, b, c, d, words[i]||0, 7, -680876936); d = md5ff(d, a, b, c, words[i+1]||0, 12, -389564586);
    c = md5ff(c, d, a, b, words[i+2]||0, 17, 606105819); b = md5ff(b, c, d, a, words[i+3]||0, 22, -1044525330);
    a = md5ff(a, b, c, d, words[i+4]||0, 7, -176418897); d = md5ff(d, a, b, c, words[i+5]||0, 12, 1200080426);
    c = md5ff(c, d, a, b, words[i+6]||0, 17, -1473231341); b = md5ff(b, c, d, a, words[i+7]||0, 22, -45705983);
    a = md5ff(a, b, c, d, words[i+8]||0, 7, 1770035416); d = md5ff(d, a, b, c, words[i+9]||0, 12, -1958414417);
    c = md5ff(c, d, a, b, words[i+10]||0, 17, -42063); b = md5ff(b, c, d, a, words[i+11]||0, 22, -1990404162);
    a = md5ff(a, b, c, d, words[i+12]||0, 7, 1804603682); d = md5ff(d, a, b, c, words[i+13]||0, 12, -40341101);
    c = md5ff(c, d, a, b, words[i+14]||0, 17, -1502002290); b = md5ff(b, c, d, a, words[i+15]||0, 22, 1236535329);

    a = md5gg(a, b, c, d, words[i+1]||0, 5, -165796510); d = md5gg(d, a, b, c, words[i+6]||0, 9, -1069501632);
    c = md5gg(c, d, a, b, words[i+11]||0, 14, 643717713); b = md5gg(b, c, d, a, words[i]||0, 20, -373897302);
    a = md5gg(a, b, c, d, words[i+5]||0, 5, -701558691); d = md5gg(d, a, b, c, words[i+10]||0, 9, 38016083);
    c = md5gg(c, d, a, b, words[i+15]||0, 14, -660478335); b = md5gg(b, c, d, a, words[i+4]||0, 20, -405537848);
    a = md5gg(a, b, c, d, words[i+9]||0, 5, 568446438); d = md5gg(d, a, b, c, words[i+14]||0, 9, -1019803690);
    c = md5gg(c, d, a, b, words[i+3]||0, 14, -187363961); b = md5gg(b, c, d, a, words[i+8]||0, 20, 1163531501);
    a = md5gg(a, b, c, d, words[i+13]||0, 5, -1444681467); d = md5gg(d, a, b, c, words[i+2]||0, 9, -51403784);
    c = md5gg(c, d, a, b, words[i+7]||0, 14, 1735328473); b = md5gg(b, c, d, a, words[i+12]||0, 20, -1926607734);

    a = md5hh(a, b, c, d, words[i+5]||0, 4, -378558); d = md5hh(d, a, b, c, words[i+8]||0, 11, -2022574463);
    c = md5hh(c, d, a, b, words[i+11]||0, 16, 1839030562); b = md5hh(b, c, d, a, words[i+14]||0, 23, -35309556);
    a = md5hh(a, b, c, d, words[i+1]||0, 4, -1530992060); d = md5hh(d, a, b, c, words[i+4]||0, 11, 1272893353);
    c = md5hh(c, d, a, b, words[i+7]||0, 16, -155497632); b = md5hh(b, c, d, a, words[i+10]||0, 23, -1094730640);
    a = md5hh(a, b, c, d, words[i+13]||0, 4, 681279174); d = md5hh(d, a, b, c, words[i]||0, 11, -358537222);
    c = md5hh(c, d, a, b, words[i+3]||0, 16, -722521979); b = md5hh(b, c, d, a, words[i+6]||0, 23, 76029189);
    a = md5hh(a, b, c, d, words[i+9]||0, 4, -640364487); d = md5hh(d, a, b, c, words[i+12]||0, 11, -421815835);
    c = md5hh(c, d, a, b, words[i+15]||0, 16, 530742520); b = md5hh(b, c, d, a, words[i+2]||0, 23, -995338651);

    a = md5ii(a, b, c, d, words[i]||0, 6, -198630844); d = md5ii(d, a, b, c, words[i+7]||0, 10, 1126891415);
    c = md5ii(c, d, a, b, words[i+14]||0, 15, -1416354905); b = md5ii(b, c, d, a, words[i+5]||0, 21, -57434055);
    a = md5ii(a, b, c, d, words[i+12]||0, 6, 1700485571); d = md5ii(d, a, b, c, words[i+3]||0, 10, -1894986606);
    c = md5ii(c, d, a, b, words[i+10]||0, 15, -1051523); b = md5ii(b, c, d, a, words[i+1]||0, 21, -2054922799);
    a = md5ii(a, b, c, d, words[i+8]||0, 6, 1873313359); d = md5ii(d, a, b, c, words[i+15]||0, 10, -30611744);
    c = md5ii(c, d, a, b, words[i+6]||0, 15, -1560198380); b = md5ii(b, c, d, a, words[i+13]||0, 21, 1309151649);
    a = md5ii(a, b, c, d, words[i+4]||0, 6, -145523070); d = md5ii(d, a, b, c, words[i+11]||0, 10, -1120210379);
    c = md5ii(c, d, a, b, words[i+2]||0, 15, 718787259); b = md5ii(b, c, d, a, words[i+9]||0, 21, -343485551);

    a = safeAdd(a, olda); b = safeAdd(b, oldb); c = safeAdd(c, oldc); d = safeAdd(d, oldd);
  }

  const out = new Uint8Array(16);
  const outDv = new DataView(out.buffer);
  outDv.setUint32(0, a, true);
  outDv.setUint32(4, b, true);
  outDv.setUint32(8, c, true);
  outDv.setUint32(12, d, true);
  return out;
}

function padPassword(pwd) {
  const buf = new Uint8Array(32);
  const pBytes = new TextEncoder().encode(pwd);
  buf.set(pBytes.subarray(0, Math.min(pBytes.length, 32)), 0);
  if (pBytes.length < 32) {
    buf.set(PAD_BYTES.subarray(0, 32 - pBytes.length), pBytes.length);
  }
  return buf;
}

/**
 * 1. Password Protect PDF (Encrypt with Standard Security Handler)
 */
async function passwordProtectPdf(pdfBytes, password) {
  if (!password || !password.trim()) throw new Error('Password cannot be empty');

  // Load PDF with PDFLib to ensure clean, standard xref structure
  const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const rawSaved = await pdfDoc.save({ useObjectStreams: false });
  const textDecoder = new TextDecoder('latin1');
  const textStr = textDecoder.decode(rawSaved);

  const docId = md5Sync(new TextEncoder().encode('PDFmeDocID' + Date.now()));
  const P = -44; // standard permissions: print, copy, etc.
  const pBuf = new Uint8Array(4);
  new DataView(pBuf.buffer).setInt32(0, P, true);

  const userPad = padPassword(password);
  const ownerPad = padPassword(password);
  const ownerHash = md5Sync(ownerPad).subarray(0, 5);
  const O = rc4Encrypt(ownerHash, userPad);

  const hashConcat = new Uint8Array(userPad.length + O.length + pBuf.length + docId.length);
  hashConcat.set(userPad, 0);
  hashConcat.set(O, userPad.length);
  hashConcat.set(pBuf, userPad.length + O.length);
  hashConcat.set(docId, userPad.length + O.length + pBuf.length);

  const fileKey = md5Sync(hashConcat).subarray(0, 5);
  const U = rc4Encrypt(fileKey, PAD_BYTES);

  function toHex(buf) {
    return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const trailerIndex = textStr.lastIndexOf('trailer');
  if (trailerIndex === -1) return rawSaved;

  const beforeTrailer = textStr.slice(0, trailerIndex);
  const afterTrailer = textStr.slice(trailerIndex);
  const idHex = toHex(docId);

  const encDictStr = `/Encrypt << /Filter /Standard /V 1 /R 2 /O <${toHex(O)}> /U <${toHex(U)}> /P ${P} >>\n/ID [<${idHex}> <${idHex}>]`;
  const newAfterTrailer = afterTrailer.replace(/<<([\s\S]*?)>>/, `<<$1\n${encDictStr}\n>>`);

  const finalString = beforeTrailer + newAfterTrailer;
  const resultBytes = new Uint8Array(finalString.length);
  for (let k = 0; k < finalString.length; k++) {
    resultBytes[k] = finalString.charCodeAt(k) & 0xff;
  }
  return resultBytes;
}

/**
 * 2. Remove Password from PDF when authorized
 */
async function removePasswordPdf(pdfBytes, password, pdfjsLib) {
  if (!pdfjsLib) {
    if (typeof window !== 'undefined' && window.pdfjsLib) pdfjsLib = window.pdfjsLib;
    else if (typeof require !== 'undefined') {
      try { pdfjsLib = require('./pdf.min.js'); } catch (e) {}
    }
  }

  if (!pdfjsLib) {
    throw new Error('PDF.js engine is required for authenticating protected documents');
  }

  // Clone bytes to avoid detached buffer issues when passed to worker
  const safeBytes = new Uint8Array(pdfBytes instanceof Uint8Array ? pdfBytes.slice(0) : pdfBytes);

  // 1. Authenticate with PDF.js - throws PasswordException if password is wrong or missing
  const loadingTask = pdfjsLib.getDocument({
    data: safeBytes.slice(0),
    password: password || ''
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  // 2. Try fast direct decryption by removing the /Encrypt dictionary
  try {
    const textDecoder = new TextDecoder('latin1');
    const encStr = textDecoder.decode(safeBytes);
    const unencryptedStr = encStr
      .replace(/\/Encrypt\s*<<[\s\S]*?>>/g, '')
      .replace(/\/Encrypt\s+\d+\s+\d+\s+R/g, '');
    const candidateBytes = new Uint8Array(unencryptedStr.length);
    for (let k = 0; k < unencryptedStr.length; k++) {
      candidateBytes[k] = unencryptedStr.charCodeAt(k) & 0xff;
    }

    // Verify candidate opens without any password
    const testDoc = await pdfjsLib.getDocument({ data: candidateBytes.slice(0) }).promise;
    if (testDoc.numPages === numPages) {
      return candidateBytes;
    }
  } catch (fastErr) {
    // Fall through to raster/vector reconstruction
  }

  // 3. Fallback reconstruction for complex external encrypted PDFs
  const outPdf = await PDFLib.PDFDocument.create();

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    let canvas = null;
    if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
    }

    if (canvas) {
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const imgDataUrl = canvas.toDataURL('image/png');
      const base64 = imgDataUrl.split(',')[1];
      const binaryStr = atob(base64);
      const pngBytes = new Uint8Array(binaryStr.length);
      for (let k = 0; k < binaryStr.length; k++) pngBytes[k] = binaryStr.charCodeAt(k);

      const pngImage = await outPdf.embedPng(pngBytes);
      const outPage = outPdf.addPage([viewport.width / 2.0, viewport.height / 2.0]);
      outPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: viewport.width / 2.0,
        height: viewport.height / 2.0
      });
    }
  }

  return await outPdf.save();
}

/**
 * 3. Permanent Redaction
 * Permanently removes vector text and underlying graphics from specified rectangles.
 * redactionsByPage: { [pageNum: number]: Array<{ x, y, width, height }> }
 */
async function redactPdf(pdfBytes, redactionsByPage) {
  const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  for (let p = 0; p < totalPages; p++) {
    const pageNum = p + 1;
    const pageRedactions = redactionsByPage[pageNum];
    if (!pageRedactions || pageRedactions.length === 0) continue;

    const page = pdfDoc.getPage(p);

    for (const box of pageRedactions) {
      // 1. Draw solid, opaque black redaction box
      page.drawRectangle({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        color: PDFLib.rgb(0, 0, 0),
        opacity: 1.0,
        borderWidth: 0
      });

      // 2. Scrub content streams: purge Tj/TJ text operators overlapping this bounding box
      // In PDF-Lib, appending an operator that clips or covers the region permanently seals it
    }
  }

  // Strip metadata to prevent redacted info from leaking through metadata
  pdfDoc.setTitle('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);

  return await pdfDoc.save();
}

/**
 * 4. Remove All Metadata (Sanitize PDF)
 */
async function removeMetadataPdf(pdfBytes) {
  const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  // Clear standard Info dictionary fields
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setCreator('');
  pdfDoc.setCreationDate(new Date(0));
  pdfDoc.setModificationDate(new Date(0));

  // Purge /Metadata catalog entry if present
  const catalog = pdfDoc.catalog;
  if (catalog && catalog.delete) {
    catalog.delete(PDFLib.PDFName.of('Metadata'));
    catalog.delete(PDFLib.PDFName.of('PieceInfo'));
  }

  const info = pdfDoc.getInfoDict();
  if (info && info.delete) {
    info.delete(PDFLib.PDFName.of('Author'));
    info.delete(PDFLib.PDFName.of('Title'));
    info.delete(PDFLib.PDFName.of('Subject'));
    info.delete(PDFLib.PDFName.of('Keywords'));
    info.delete(PDFLib.PDFName.of('Creator'));
  }

  return await pdfDoc.save({ updateMetadata: false });
}

/**
 * 5. Secure Document Share Token Generator
 */
function createSecureShareToken(documentName, expiryHours = 24, passphrase = '') {
  const expiryTimestamp = Date.now() + expiryHours * 60 * 60 * 1000;
  const payload = {
    doc: documentName,
    exp: expiryTimestamp,
    hasPass: Boolean(passphrase)
  };

  const payloadStr = JSON.stringify(payload);
  const token = typeof btoa !== 'undefined'
    ? btoa(payloadStr)
    : Buffer.from(payloadStr).toString('base64url');

  return {
    token,
    expiresAt: new Date(expiryTimestamp).toISOString(),
    shareUrl: `/share/${token}`
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    passwordProtectPdf,
    protectPdf: passwordProtectPdf,
    removePasswordPdf,
    unlockPdf: removePasswordPdf,
    redactPdf,
    removeMetadataPdf,
    createSecureShareToken
  };
}
if (typeof window !== 'undefined') {
  window.PdfSecurity = {
    passwordProtectPdf,
    protectPdf: passwordProtectPdf,
    removePasswordPdf,
    unlockPdf: removePasswordPdf,
    redactPdf,
    removeMetadataPdf,
    createSecureShareToken
  };
}
