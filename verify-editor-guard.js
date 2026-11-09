'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const backupDir = path.join(ROOT, 'backups', 'editor-reference');

function getHash(str) {
  // Normalize CRLF to LF to be cross-platform consistent
  const normalized = str.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function verifyEditorGuard() {
  console.log('=== PDF EDITOR INTEGRITY CHECK ===');
  let allPass = true;

  // 1. Check backup exists
  if (!fs.existsSync(backupDir)) {
    console.error('FAIL: Backup directory does not exist.');
    return false;
  }

  // 2. Check initEdit in app.js
  const appJsCurrent = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const appJsBackup = fs.readFileSync(path.join(backupDir, 'app.js'), 'utf8');

  const startIndexCurrent = appJsCurrent.indexOf('(function initEdit() {');
  const endIndexCurrent = appJsCurrent.indexOf('setupFormatToolbarListeners();\n\n})();');
  const startIndexBackup = appJsBackup.indexOf('(function initEdit() {');
  const endIndexBackup = appJsBackup.indexOf('setupFormatToolbarListeners();\n\n})();');

  if (startIndexCurrent === -1 || endIndexCurrent === -1 || startIndexBackup === -1 || endIndexBackup === -1) {
    // Try with \r\n
    const endAltCurrent = appJsCurrent.indexOf('setupFormatToolbarListeners();\r\n\r\n})();');
    const endAltBackup = appJsBackup.indexOf('setupFormatToolbarListeners();\r\n\r\n})();');
    if (startIndexCurrent === -1 || endAltCurrent === -1) {
      console.error('FAIL: Could not locate initEdit block in app.js');
      allPass = false;
    } else {
      const currentBlock = appJsCurrent.slice(startIndexCurrent, endAltCurrent + 36);
      const backupBlock = appJsBackup.slice(startIndexBackup, endAltBackup + 36);
      const currentHash = getHash(currentBlock);
      const backupHash = getHash(backupBlock);
      if (currentHash === backupHash) {
        console.log(`PASS: initEdit block in app.js is 100% byte-for-byte identical to baseline reference (${currentBlock.length} bytes, SHA-256: ${currentHash.slice(0, 10)}...).`);
      } else {
        console.error('FAIL: initEdit block in app.js has been modified! Hash mismatch.');
        allPass = false;
      }
    }
  } else {
    const currentBlock = appJsCurrent.slice(startIndexCurrent, endIndexCurrent + 34);
    const backupBlock = appJsBackup.slice(startIndexBackup, endIndexBackup + 34);
    const currentHash = getHash(currentBlock);
    const backupHash = getHash(backupBlock);
    if (currentHash === backupHash) {
      console.log(`PASS: initEdit block in app.js is 100% byte-for-byte identical to baseline reference (${currentBlock.length} bytes, SHA-256: ${currentHash.slice(0, 10)}...).`);
    } else {
      console.error('FAIL: initEdit block in app.js has been modified! Hash mismatch.');
      allPass = false;
    }
  }

  // 3. Check critical HTML elements in index.html
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const criticalIds = [
    'screen-edit',
    'edit-heading',
    'flatten-check',
    'edit-open-btn',
    'edit-input',
    'save-btn',
    'edit-canvas-area',
    'edit-empty',
    'text-format-toolbar',
    'toolbar',
    'sign-modal',
    'password-modal',
    'toast-container'
  ];

  for (const id of criticalIds) {
    if (!indexHtml.includes(`id="${id}"`)) {
      console.error(`FAIL: Critical editor element id="${id}" missing from index.html!`);
      allPass = false;
    }
  }
  if (allPass) {
    console.log(`PASS: All ${criticalIds.length} critical PDF editor DOM elements are present in index.html.`);
  }

  // 4. Check critical CSS classes in styles.css
  const stylesCss = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  const criticalCss = [
    '.edit-layout',
    '.edit-canvas-area',
    '.page-wrap',
    '.page-canvas',
    '.overlay-canvas',
    '#toolbar',
    '.format-toolbar'
  ];
  for (const sel of criticalCss) {
    if (!stylesCss.includes(sel)) {
      console.error(`FAIL: Critical editor CSS class ${sel} missing from styles.css!`);
      allPass = false;
    }
  }
  if (allPass) {
    console.log(`PASS: All ${criticalCss.length} critical PDF editor CSS classes are preserved in styles.css.`);
  }

  console.log('==================================');
  if (allPass) {
    console.log('STATUS: PDF Editor Integrity Guard PASSED. The editor is fully protected.\n');
  } else {
    console.error('STATUS: PDF Editor Integrity Guard FAILED.\n');
  }
  return allPass;
}

if (require.main === module) {
  const ok = verifyEditorGuard();
  process.exit(ok ? 0 : 1);
}

module.exports = { verifyEditorGuard };
