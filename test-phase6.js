'use strict';
const PDFLib = require('./lib/pdf-lib.min.js');
const { signDocument, getSha256Hex } = require('./lib/esign-engine.js');
const { verifyEditorGuard } = require('./verify-editor-guard.js');

async function runPhase6Tests() {
  console.log('========================================================');
  console.log('RUNNING PHASE 6 AUTOMATED TEST SUITE');
  console.log('Testing: E-Signature Workflow & Audit Trail');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(desc, condition) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  try {
    // 1. Create a base PDF
    const baseDoc = await PDFLib.PDFDocument.create();
    baseDoc.addPage([595.28, 841.89]);
    const originalBytes = await baseDoc.save();

    // 2. Prepare 1x1 signature image bytes
    const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

    const signers = [
      {
        pageNum: 1,
        x: 100,
        y: 200,
        width: 120,
        height: 40,
        signatureImageBytes: png1x1,
        signerName: 'Alexander Hayes',
        signerEmail: 'alex.hayes@enterprise.com',
        ip: '192.168.1.104',
        timestamp: '2026-05-15 14:30:00'
      },
      {
        pageNum: 1,
        x: 350,
        y: 200,
        width: 120,
        height: 40,
        signatureImageBytes: png1x1,
        signerName: 'Maria Rodriguez',
        signerEmail: 'maria.r@clientcorp.com',
        ip: '10.0.0.52',
        timestamp: '2026-05-15 15:45:12'
      }
    ];

    const result = await signDocument(originalBytes, signers, { includeAuditTrail: true });

    assert('Document status reports COMPLETED', result.status === 'COMPLETED');
    assert('Session ID generated with ESIGN- prefix', result.sessionId.startsWith('ESIGN-'));
    assert('Original document SHA-256 hash computed', result.originalHash && result.originalHash.length === 64);

    const signedDoc = await PDFLib.PDFDocument.load(result.signedPdfBytes);
    assert('Signed PDF appends audit trail certificate page (1 original + 1 cert = 2 pages)', signedDoc.getPageCount() === 2);

    // Test without audit trail
    const resultNoCert = await signDocument(originalBytes, signers, { includeAuditTrail: false });
    const signedNoCertDoc = await PDFLib.PDFDocument.load(resultNoCert.signedPdfBytes);
    assert('Signed PDF respects includeAuditTrail: false (preserves 1 page)', signedNoCertDoc.getPageCount() === 1);

  } catch (err) {
    console.error('Error during E-Sign tests:', err);
    assert('E-Sign tests executed without error', false);
  }

  // Integrity Check for Existing PDF Editor
  console.log('\n--- Checking PDF Editor Integrity Guard ---');
  const guardPassed = verifyEditorGuard();
  assert('CRITICAL: Existing PDF Editor integrity guard passes 100%', guardPassed);

  console.log('\n========================================================');
  console.log(`PHASE 6 TEST RESULTS: ${passed} / ${total} tests PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================');

  return passed === total;
}

if (require.main === module) {
  runPhase6Tests().then(ok => {
    process.exit(ok ? 0 : 1);
  });
}

module.exports = { runPhase6Tests };

