'use strict';
/**
 * Automated Test Suite for Razorpay Standard Web Checkout Integration
 * Tests:
 * 1. Environment and credentials setup (.env and .gitignore)
 * 2. GET /api/payment-config
 * 3. POST /api/create-order (validation & order generation via Razorpay API)
 * 4. POST /api/verify-payment (HMAC-SHA256 signature verification, rejection of invalid signatures, activation of paid subscriptions)
 * 5. GET /api/billing/history & GET /api/admin/payments
 * 6. Frontend checkout wiring and security assertions
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

const { handleRazorpayRequest, PLAN_CATALOG } = require('./api/razorpay-router.js');
const { verifyEditorGuard } = require('./verify-editor-guard.js');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// Helper to simulate mock HTTP req / res for serverless router test
function mockRequest(method, pathName, headers = {}, body = {}) {
  return new Promise((resolve) => {
    const req = {
      method,
      headers: {
        'content-type': 'application/json',
        ...headers
      }
    };

    let responseStatusCode = 200;
    let responseHeaders = {};
    let responseBody = '';

    const res = {
      writeHead(status, hdrs) {
        responseStatusCode = status;
        responseHeaders = hdrs || {};
      },
      end(chunk) {
        if (chunk) responseBody += chunk;
        let json = null;
        try {
          json = JSON.parse(responseBody);
        } catch (e) {
          json = responseBody;
        }
        resolve({
          status: responseStatusCode,
          headers: responseHeaders,
          body: json
        });
      }
    };

    handleRazorpayRequest(req, res, pathName, body);
  });
}

async function runRazorpayTests() {
  console.log('========================================================');
  console.log('RUNNING RAZORPAY STANDARD WEB CHECKOUT TEST SUITE');
  console.log('Testing: Order Creation, Signature Verification & Plans');
  console.log('========================================================\n');

  // 1. Credentials & Environment
  console.log('--- 1. Environment & Credential Security ---');
  assert(fs.existsSync(path.join(__dirname, '.env')), '.env file exists in project root');
  assert(process.env.RAZORPAY_KEY_ID === 'rzp_test_TyC5uxlbueziUM', 'RAZORPAY_KEY_ID loaded correctly');
  assert(process.env.RAZORPAY_KEY_SECRET === 'rp6FxwqTS7YREpB1Q6r4oIDn', 'RAZORPAY_KEY_SECRET loaded correctly');
  
  const gitignoreContent = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8');
  assert(gitignoreContent.includes('.env'), '.gitignore properly ignores .env file to prevent credential leaks');

  // Verify KEY_SECRET is not in client-accessible frontend scripts
  const frontendFiles = ['index.html', 'js/platform-ui.js', 'js/razorpay-checkout.js'];
  for (const file of frontendFiles) {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert(!content.includes(process.env.RAZORPAY_KEY_SECRET), `CRITICAL: ${file} does NOT contain RAZORPAY_KEY_SECRET`);
  }

  // 2. Gateway Config Endpoint
  console.log('\n--- 2. Payment Gateway Config Endpoint ---');
  const configRes = await mockRequest('GET', '/api/payment-config');
  assert(configRes.status === 200, 'GET /api/payment-config returns 200 OK');
  assert(configRes.body.key_id === process.env.RAZORPAY_KEY_ID, 'Exposes correct Key ID');
  assert(!configRes.body.key_secret, 'Never exposes Key Secret in response');
  assert(configRes.body.plans && configRes.body.plans.PRO_MONTHLY.amountPaise === 14900, 'Catalog provides accurate Pro plan details');

  // 3. Backend Create Order
  console.log('\n--- 3. Backend Endpoint: POST /api/create-order ---');
  // 3a. Minimum amount validation
  const minAmountRes = await mockRequest('POST', '/api/create-order', {}, { amount: 50 });
  assert(minAmountRes.status === 400, 'Rejects amount < 100 paise with HTTP 400');
  assert(minAmountRes.body.error && minAmountRes.body.error.includes('Minimum amount is 100 paise'), 'Returns descriptive error for sub-minimum amounts');

  // 3b. Invalid amount
  const nanAmountRes = await mockRequest('POST', '/api/create-order', {}, { amount: 'abc' });
  assert(nanAmountRes.status === 400, 'Rejects non-numeric amount with HTTP 400');

  // 3c. Valid order creation via Razorpay API
  console.log('Connecting to Razorpay Test API to create order...');
  const orderRes = await mockRequest('POST', '/api/create-order', {}, {
    amount: 14900, // ₹149 Pro Plan
    currency: 'INR',
    planKey: 'PRO_MONTHLY'
  });

  assert(orderRes.status === 200, 'POST /api/create-order returns 200 OK');
  assert(orderRes.body.order_id && orderRes.body.order_id.startsWith('order_'), `Razorpay generated genuine order_id (${orderRes.body.order_id})`);
  assert(orderRes.body.amount === 14900, 'Order amount matches requested 14900 paise');
  assert(orderRes.body.currency === 'INR', 'Order currency is INR');
  assert(orderRes.body.key_id === process.env.RAZORPAY_KEY_ID, 'Order returns client key_id');

  const generatedOrderId = orderRes.body.order_id;
  const mockPaymentId = 'pay_' + Math.random().toString(36).substring(2, 16);

  // 4. Backend Signature Verification
  console.log('\n--- 4. Backend Endpoint: POST /api/verify-payment ---');
  // 4a. Missing fields
  const missingFieldRes = await mockRequest('POST', '/api/verify-payment', {}, {
    razorpay_order_id: generatedOrderId,
    razorpay_payment_id: mockPaymentId
    // missing razorpay_signature
  });
  assert(missingFieldRes.status === 400, 'Rejects missing signature with HTTP 400');

  // 4b. Invalid / Forged signature rejection
  const forgedRes = await mockRequest('POST', '/api/verify-payment', {}, {
    razorpay_order_id: generatedOrderId,
    razorpay_payment_id: mockPaymentId,
    razorpay_signature: 'fake_tampered_signature_1234567890abcdef'
  });
  assert(forgedRes.status === 400, 'CRITICAL SECURITY: Forged payment signature rejected with HTTP 400');
  assert(forgedRes.body.success === false, 'Order NOT marked as paid upon signature mismatch');

  // 4c. Valid authentic HMAC-SHA256 signature verification
  const authenticSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${generatedOrderId}|${mockPaymentId}`)
    .digest('hex');

  const validVerifyRes = await mockRequest('POST', '/api/verify-payment', {}, {
    razorpay_order_id: generatedOrderId,
    razorpay_payment_id: mockPaymentId,
    razorpay_signature: authenticSignature,
    planKey: 'PRO_MONTHLY',
    amount: 14900,
    currency: 'INR'
  });

  assert(validVerifyRes.status === 200, 'POST /api/verify-payment returns 200 OK for authentic signature');
  assert(validVerifyRes.body.success === true, 'Verification returns success: true');
  assert(validVerifyRes.body.payment_id === mockPaymentId, 'Echoes verified payment ID');
  assert(validVerifyRes.body.order_id === generatedOrderId, 'Echoes verified order ID');
  assert(validVerifyRes.body.plan === 'PRO', 'Activates PRO subscription');

  // 5. Billing History & Admin Analytics
  console.log('\n--- 5. Billing History & Admin Analytics ---');
  const adminRes = await mockRequest('GET', '/api/admin/payments');
  assert(adminRes.status === 200, 'GET /api/admin/payments returns 200 OK');
  assert(adminRes.body.analytics && adminRes.body.analytics.totalVerifiedTransactions >= 1, 'Verified transaction recorded in system database');
  assert(adminRes.body.analytics.totalGrossRevenueINR >= 149, 'Gross revenue accurately reflects verified payments');

  // 6. Frontend Integration & Editor Guard
  console.log('\n--- 6. Frontend Integration & PDF Editor Protection ---');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(indexHtml.includes('checkout.razorpay.com/v1/checkout.js'), 'index.html loads Razorpay Checkout.js SDK');
  assert(indexHtml.includes('js/razorpay-checkout.js'), 'index.html loads PDFme Razorpay checkout client');
  assert(indexHtml.includes('subscribeToPlan(\'PRO\')'), 'Pro upgrade button connected to Razorpay checkout trigger');
  assert(indexHtml.includes('subscribeToPlan(\'PREMIUM\')'), 'Premium upgrade button connected to Razorpay checkout trigger');
  assert(indexHtml.includes('subscribeToPlan(\'BUSINESS\')'), 'Business upgrade button connected to Razorpay checkout trigger');
  assert(indexHtml.includes('setBillingCycle(\'monthly\')'), 'Monthly/Annual billing cycle toggle configured');

  const guardOk = verifyEditorGuard();
  assert(guardOk === true, 'PDF Editor Integrity Guard remains 100% PASSING');

  console.log('\n========================================================');
  console.log(`RAZORPAY TEST RESULTS: ${passedTests} / ${totalTests} tests PASSED (${Math.round(passedTests/totalTests*100)}%)`);
  console.log('========================================================');
}

if (require.main === module) {
  runRazorpayTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = { runRazorpayTests };

