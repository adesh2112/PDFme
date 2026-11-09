'use strict';
/**
 * Master Platform Regression Test Suite
 * Executes automated test suites for Phases 2 through 7,
 * verifying all PDF features and confirming zero regressions to the existing PDF editor.
 */

const { runPhase2Tests } = require('./test-phase2.js');
const { runPhase3Tests } = require('./test-phase3.js');
const { runPhase4Tests } = require('./test-phase4.js');
const { runPhase5Tests } = require('./test-phase5.js');
const { runPhase6Tests } = require('./test-phase6.js');
const { runPhase7Tests } = require('./test-phase7.js');
const { runRazorpayTests } = require('./test-razorpay.js');
const { verifyEditorGuard } = require('./verify-editor-guard.js');

async function runMasterRegression() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║       PDFME COMPREHENSIVE PLATFORM REGRESSION TEST SUITE         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const results = {};

  console.log('>>> [1/6] Running Phase 2: Conversion, Organization & Security...');
  results.phase2 = await runPhase2Tests();

  console.log('\n>>> [2/6] Running Phase 3: OCR, Document Comparison & Invoice Extractor...');
  results.phase3 = await runPhase3Tests();

  console.log('\n>>> [3/6] Running Phase 4: AI PDF Tools & Secure Backend API...');
  results.phase4 = await runPhase4Tests();

  console.log('\n>>> [4/6] Running Phase 5: Business Document Generators & Bulk Processing...');
  results.phase5 = await runPhase5Tests();

  console.log('\n>>> [5/6] Running Phase 6: E-Signature Workflow & Audit Trail...');
  results.phase6 = await runPhase6Tests();

  console.log('\n>>> [6/6] Running Phase 7: Corporate Workspace & Multi-Tenant Security...');
  results.phase7 = await runPhase7Tests();

  console.log('\n>>> [7/7] Running Razorpay Standard Web Checkout Integration Suite...');
  try {
    await runRazorpayTests();
    results.razorpay = true;
  } catch (e) {
    console.error('Razorpay test error:', e);
    results.razorpay = false;
  }

  console.log('\n>>> [FINAL GUARD] Verifying Existing PDF Editor Byte-for-Byte Integrity...');
  results.editorGuard = verifyEditorGuard();

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const allPassed = Object.values(results).every(r => r === true);

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                     FINAL REGRESSION SUMMARY                     ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║ Phase 2 (Conversion, Organization, Security):      ${results.phase2 ? 'PASSED (100%)' : 'FAILED'}     ║`);
  console.log(`║ Phase 3 (OCR, Doc Comparison, Invoice Extractor):  ${results.phase3 ? 'PASSED (100%)' : 'FAILED'}     ║`);
  console.log(`║ Phase 4 (AI PDF Tools & Secure Backend API):       ${results.phase4 ? 'PASSED (100%)' : 'FAILED'}     ║`);
  console.log(`║ Phase 5 (Business Document Generators & Bulk):     ${results.phase5 ? 'PASSED (100%)' : 'FAILED'}     ║`);
  console.log(`║ Phase 6 (E-Signature Workflow & Audit Trail):       ${results.phase6 ? 'PASSED (100%)' : 'FAILED'}     ║`);
  console.log(`║ Phase 7 (Corporate Workspace & Multi-Tenant):      ${results.phase7 ? 'PASSED (100%)' : 'FAILED'}     ║`);
  console.log(`║ Razorpay Standard Web Checkout (Backend & Web):    ${results.razorpay ? 'PASSED (100%)' : 'FAILED'}     ║`);
  console.log(`║ Existing PDF Editor Integrity Guard:               ${results.editorGuard ? 'PASSED (100%)' : 'FAILED'}     ║`);
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║ Status: ${allPassed ? 'ALL SUITES PASSED' : 'SUITE FAILURES DETECTED'} | Total Time: ${durationSec}s              ║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  return allPassed;
}

if (require.main === module) {
  runMasterRegression().then(ok => {
    process.exit(ok ? 0 : 1);
  });
}

module.exports = { runMasterRegression };

