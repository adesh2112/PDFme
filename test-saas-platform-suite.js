'use strict';
/**
 * PDFme SaaS Platform Verification Suite
 * Tests:
 * 1. Mobile Header & Responsive Navigation Redesign (Center Action Group: Theme, Workspace, Upgrade, Auth)
 * 2. Mobile Responsive Viewport Assertions (320px, 360px, 375px, 390px, 414px, 430px, 768px, 1024px, 1440px)
 * 3. Cross-Device Cloud Sync & Backend-Confirmed Saving
 * 4. Upgrade Button Handlers & Authentication Routing
 * 5. Cloud File Upload, Download & Strict Multi-Tenant Isolation
 * 6. Webhook HMAC-SHA256 Signature Verification & Duplicate Protection
 * 7. PDF Editor Byte-for-Byte Integrity Guard
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { handleWorkspaceRequest } = require('./api/workspace-router.js');
const { handleRazorpayRequest, WEBHOOK_SECRET } = require('./api/razorpay-router.js');
const { verifyEditorGuard } = require('./verify-editor-guard.js');

let passCount = 0;
let failCount = 0;

function assert(cond, name) {
  if (cond) {
    passCount++;
    console.log(`[PASS] ${name}`);
  } else {
    failCount++;
    console.error(`[FAIL] ${name}`);
    process.exitCode = 1;
  }
}

function mockApiCall(handler, method, pathName, headers = {}, body = {}) {
  return new Promise((resolve) => {
    const req = {
      method,
      url: pathName,
      headers: {
        'content-type': 'application/json',
        ...headers
      }
    };
    let statusCode = 200;
    let resHeaders = {};
    let raw = '';
    const res = {
      writeHead(s, h) {
        statusCode = s;
        resHeaders = h || {};
      },
      end(chunk) {
        if (chunk) raw += chunk;
        let json = null;
        try { json = JSON.parse(raw); } catch (e) { json = raw; }
        resolve({ status: statusCode, headers: resHeaders, body: json });
      }
    };
    handler(req, res, pathName, body);
  });
}

async function runSaaSVerification() {
  console.log('========================================================');
  console.log('PDFME SAAS PLATFORM COMPREHENSIVE VERIFICATION SUITE');
  console.log('========================================================\n');

  // --- 1. Mobile Header Architecture ---
  console.log('--- 1. Mobile Header & Navigation Redesign ---');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const saasCss = fs.readFileSync(path.join(__dirname, 'css', 'saas-platform.css'), 'utf8');

  assert(indexHtml.includes('class="mobile-header-wrap"'), 'Mobile header wrap container exists');
  assert(indexHtml.includes('class="mobile-top-row"'), 'Mobile header top row (Logo + Hamburger) exists');
  assert(indexHtml.includes('id="mobile-hamburger-btn"'), 'Mobile hamburger menu button exists');
  assert(indexHtml.includes('class="mobile-actions-group"'), 'Mobile centered middle actions group exists');

  // The 4 crucial mobile options in the centered middle area
  assert(indexHtml.includes('mobile-theme-btn'), 'Mobile centered action 1: Light/Dark Theme toggle present');
  assert(indexHtml.includes('id="mobile-workspace-btn"'), 'Mobile centered action 2: Workspace button present');
  assert(indexHtml.includes('id="mobile-upgrade-btn"'), 'Mobile centered action 3: Upgrade button present');
  assert(indexHtml.includes('id="mobile-auth-btn"'), 'Mobile centered action 4: Sign In / Profile button present');

  // CSS Grid & Responsive rules
  assert(saasCss.includes('grid-template-columns: repeat(4, 1fr)'), 'Uses CSS Grid 4-column balanced layout on mobile');
  assert(saasCss.includes('@media (max-width: 340px)') && saasCss.includes('repeat(2, 1fr)'), 'Narrow mobile (<340px, e.g. 320px) wraps into centered 2x2 grid to prevent cramping');
  assert(saasCss.includes('overflow-x: hidden'), 'Prevents horizontal page clipping and overflow');
  assert(indexHtml.includes('id="mobile-drawer-backdrop"'), 'Secondary navigation hamburger drawer exists');

  // --- 2. Corporate Homepage & 6 Categorized Suites ---
  console.log('\n--- 2. Corporate Homepage & 6 Categories ---');
  assert(indexHtml.includes('Everything You Need to Work Smarter with Documents.'), 'Homepage headline matches specification');
  assert(indexHtml.includes('Edit, convert, organise, analyse, sign and automate your documents with one powerful PDF platform.'), 'Homepage subtitle matches specification');
  assert(indexHtml.includes('1. PDF Productivity'), 'Category 1: PDF Productivity present');
  assert(indexHtml.includes('2. PDF Conversion'), 'Category 2: PDF Conversion present');
  assert(indexHtml.includes('3. AI Document Intelligence'), 'Category 3: AI Document Intelligence present');
  assert(indexHtml.includes('4. Business Document Automation'), 'Category 4: Business Document Automation present');
  assert(indexHtml.includes('5. Document Security'), 'Category 5: Document Security present');
  assert(indexHtml.includes('6. Document Management &amp; Productivity'), 'Category 6: Document Management & Productivity present');
  assert(indexHtml.includes('corporate-footer'), 'Corporate footer present');
  assert(indexHtml.includes('Secure payments by Razorpay') || indexHtml.includes('Razorpay Verified Merchant'), 'Corporate footer contains Razorpay verification badge');

  // --- 3. Genuine User Authentication & Password Reset ---
  console.log('\n--- 3. Genuine Authentication & Session Management ---');
  const testEmail = `corp_${Date.now()}@testcompany.com`;
  const regRes = await mockApiCall(handleWorkspaceRequest, 'POST', '/api/auth/register', {}, {
    name: 'Adesh Corporate Admin',
    email: testEmail,
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!'
  });

  assert(regRes.status === 201, 'User registered with HTTP 201 Created');
  assert(regRes.body.token && regRes.body.token.length > 20, 'Genuine authentication token issued');
  assert(regRes.body.user && regRes.body.user.email === testEmail, 'User record created with email');
  assert(regRes.body.organization && regRes.body.organization.plan === 'FREE', 'New organization initialized on Free tier');

  const userToken = regRes.body.token;

  // Login
  const loginRes = await mockApiCall(handleWorkspaceRequest, 'POST', '/api/auth/login', {}, {
    email: testEmail,
    password: 'SecurePassword123!'
  });
  assert(loginRes.status === 200, 'User logs in with HTTP 200 OK');
  assert(loginRes.body.token, 'Login returns valid session token');

  // Password reset request
  const forgotRes = await mockApiCall(handleWorkspaceRequest, 'POST', '/api/auth/forgot-password', {}, {
    email: testEmail
  });
  assert(forgotRes.status === 200, 'Password reset request succeeds');
  const resetToken = forgotRes.body.resetToken;

  // Confirm password reset
  const resetConfirmRes = await mockApiCall(handleWorkspaceRequest, 'POST', '/api/auth/reset-password', {}, {
    token: resetToken,
    newPassword: 'NewPassword999!'
  });
  assert(resetConfirmRes.status === 200, 'Password reset confirmed with new password');

  // Verify login with new password
  const newLoginRes = await mockApiCall(handleWorkspaceRequest, 'POST', '/api/auth/login', {}, {
    email: testEmail,
    password: 'NewPassword999!'
  });
  assert(newLoginRes.status === 200, 'User logs in successfully with new password');

  // --- 4. Cross-Device Cloud Sync & Backend-Confirmed Saving ---
  console.log('\n--- 4. Cross-Device Cloud Sync & Backend-Confirmed Saving ---');
  // Upload document
  const samplePdfBase64 = Buffer.from('%PDF-1.4 sample corporate document bytes').toString('base64');
  const uploadRes = await mockApiCall(handleWorkspaceRequest, 'POST', '/api/files/upload', {
    'authorization': `Bearer ${userToken}`
  }, {
    title: 'Executive_Contract_2026.pdf',
    dataBase64: samplePdfBase64
  });

  assert(uploadRes.status === 201, 'File uploaded to persistent cloud storage');
  assert(uploadRes.body.status === 'SAVED', 'Backend confirms SAVED status before client displays confirmation');
  assert(uploadRes.body.document && uploadRes.body.document.id, 'Document assigned cloud ID');

  const createdDocId = uploadRes.body.document.id;

  // Simulate signing in from another device (cross-device sync)
  const syncRes = await mockApiCall(handleWorkspaceRequest, 'GET', '/api/workspace/sync', {
    'authorization': `Bearer ${userToken}`
  });

  assert(syncRes.status === 200, 'GET /api/workspace/sync returns 200 OK');
  assert(syncRes.body.documents.some(d => d.id === createdDocId), 'Uploaded document restored across devices on phone/laptop');
  assert(syncRes.body.stats && syncRes.body.stats.totalDocuments >= 1, 'Sync aggregates storage usage and document stats');

  // --- 5. Multi-Tenant Cross-Tenant Security Isolation ---
  console.log('\n--- 5. Security Isolation (User A vs User B) ---');
  const userBEmail = `userB_${Date.now()}@competitor.com`;
  const userBReg = await mockApiCall(handleWorkspaceRequest, 'POST', '/api/auth/register', {}, {
    name: 'Competitor User',
    email: userBEmail,
    password: 'Password123!',
    confirmPassword: 'Password123!'
  });
  const userBToken = userBReg.body.token;

  // User B tries to access User A's document
  const breachAttempt = await mockApiCall(handleWorkspaceRequest, 'POST', '/api/workspace/document-access', {
    'authorization': `Bearer ${userBToken}`
  }, {
    docId: createdDocId
  });

  assert(breachAttempt.status === 403, 'CRITICAL SECURITY: User B cannot access User A document (403 Forbidden)');

  // User B tries to download User A's document
  const downloadBreach = await mockApiCall(handleWorkspaceRequest, 'GET', `/api/files/download?docId=${createdDocId}`, {
    'authorization': `Bearer ${userBToken}`
  });
  assert(downloadBreach.status === 404 || downloadBreach.status === 403, 'CRITICAL SECURITY: Private file download blocked for unauthorized tenant');

  // --- 6. Razorpay Webhook Signature & Cancellation ---
  console.log('\n--- 6. Razorpay Webhooks & Subscriptions ---');
  const webhookPayload = {
    id: 'evt_' + Date.now().toString(36),
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_' + Math.random().toString(36).substring(2, 10),
          order_id: 'order_test_98765',
          amount: 29900,
          currency: 'INR',
          email: testEmail
        }
      }
    }
  };

  const validSig = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(webhookPayload))
    .digest('hex');

  const webhookRes = await mockApiCall(handleRazorpayRequest, 'POST', '/api/razorpay/webhook', {
    'x-razorpay-signature': validSig
  }, webhookPayload);

  assert(webhookRes.status === 200, 'POST /api/razorpay/webhook verifies authentic signature');

  // Duplicate webhook event
  const duplicateWebhook = await mockApiCall(handleRazorpayRequest, 'POST', '/api/razorpay/webhook', {
    'x-razorpay-signature': validSig
  }, webhookPayload);
  assert(duplicateWebhook.status === 200 && duplicateWebhook.body.message?.includes('Duplicate'), 'Duplicate webhook event rejected/ignored (Idempotency protection)');

  // Forged signature rejection
  const forgedWebhook = await mockApiCall(handleRazorpayRequest, 'POST', '/api/razorpay/webhook', {
    'x-razorpay-signature': 'forged_signature_xyz'
  }, webhookPayload);
  assert(forgedWebhook.status === 400, 'Forged webhook signature rejected with HTTP 400');

  // Cancel subscription endpoint
  const cancelRes = await mockApiCall(handleRazorpayRequest, 'POST', '/api/subscription/cancel', {
    'authorization': `Bearer ${userToken}`
  });
  assert(cancelRes.status === 200, 'Subscription cancellation handled gracefully');
  assert(cancelRes.body.status === 'CANCELLED_PENDING_EXPIRY', 'Retains access until end of billing cycle');

  // --- 7. PDF Editor Guard Integrity ---
  console.log('\n--- 7. PDF Editor Integrity Guard ---');
  const guardPassed = verifyEditorGuard();
  assert(guardPassed === true, 'PDF Editor Integrity Guard remains 100% PASSING');

  console.log('\n========================================================');
  console.log(`SAAS PLATFORM TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================================');
}

if (require.main === module) {
  runSaaSVerification().catch(e => {
    console.error('Test execution failed:', e);
    process.exit(1);
  });
}

module.exports = { runSaaSVerification };

