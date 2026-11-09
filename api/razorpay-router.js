'use strict';
/**
 * Razorpay Standard Web Checkout Backend Router
 * Provides official order creation, HMAC-SHA256 signature verification,
 * subscription plan activation, billing history, and admin payment analytics.
 */

const crypto = require('crypto');
const Razorpay = require('razorpay');
const { db, saveDb, logActivity, getAuthUser } = require('./workspace-router.js');

const KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_TyC5uxlbueziUM';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rp6FxwqTS7YREpB1Q6r4oIDn';

let razorpayClient = null;
try {
  if (KEY_ID && KEY_SECRET) {
    razorpayClient = new Razorpay({
      key_id: KEY_ID,
      key_secret: KEY_SECRET
    });
  }
} catch (e) {
  console.warn('Razorpay SDK initialization warning:', e.message);
}

// Plan definitions in INR and Paise
const PLAN_CATALOG = {
  PRO_MONTHLY: { name: 'Pro Monthly', amountPaise: 14900, amountINR: 149, plan: 'PRO', cycle: 'monthly' },
  PRO_YEARLY: { name: 'Pro Yearly', amountPaise: 119900, amountINR: 1199, plan: 'PRO', cycle: 'yearly' },
  PREMIUM_MONTHLY: { name: 'Premium Monthly', amountPaise: 29900, amountINR: 299, plan: 'PREMIUM', cycle: 'monthly' },
  PREMIUM_YEARLY: { name: 'Premium Yearly', amountPaise: 249900, amountINR: 2499, plan: 'PREMIUM', cycle: 'yearly' },
  BUSINESS_MONTHLY: { name: 'Business Monthly', amountPaise: 79900, amountINR: 799, plan: 'BUSINESS', cycle: 'monthly' },
  BUSINESS_YEARLY: { name: 'Business Yearly', amountPaise: 699900, amountINR: 6999, plan: 'BUSINESS', cycle: 'yearly' }
};

/**
 * Main Razorpay Request Handler
 */
async function handleRazorpayRequest(req, res, pathName, body) {
  // 1. Payment Gateway Configuration (Exposes Key ID only, never Key Secret)
  if (pathName === '/api/payment-config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      key_id: KEY_ID,
      currency: 'INR',
      plans: PLAN_CATALOG
    }));
    return;
  }

  // 2. Create Razorpay Order: POST /api/create-order or /api/razorpay/create-order
  if (pathName === '/api/create-order' || pathName === '/api/razorpay/create-order') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    if (!KEY_ID || !KEY_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Razorpay credentials not configured on server.' }));
      return;
    }

    let amount = Number(body.amount);
    const planKey = body.planKey || body.planId;
    if (!amount && planKey && PLAN_CATALOG[planKey]) {
      amount = PLAN_CATALOG[planKey].amountPaise;
    }

    // Minimum amount validation: 100 paise (₹1.00)
    if (!amount || isNaN(amount) || amount < 100) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Invalid amount. Minimum amount is 100 paise (₹1.00).'
      }));
      return;
    }

    const currency = (body.currency || 'INR').toUpperCase();
    const receipt = body.receipt || ('rcpt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7));

    try {
      const orderOptions = {
        amount: Math.round(amount),
        currency,
        receipt,
        notes: {
          platform: 'PDFme',
          planKey: planKey || 'CUSTOM',
          billingCycle: body.billingCycle || 'monthly'
        }
      };

      const order = await razorpayClient.orders.create(orderOptions);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: KEY_ID,
        receipt: order.receipt
      }));
      return;
    } catch (err) {
      console.error('Razorpay Create Order Error:', err);
      const statusCode = (err && err.statusCode === 401) ? 401 : 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: err.message || (err.error && err.error.description) || 'Failed to create Razorpay order.'
      }));
      return;
    }
  }

  // 3. Verify Payment Signature: POST /api/verify-payment or /api/razorpay/verify-payment
  if (pathName === '/api/verify-payment' || pathName === '/api/razorpay/verify-payment') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planKey, planId, billingCycle } = body;

    // Validate presence of all three verification tokens
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature).'
      }));
      return;
    }

    if (!KEY_SECRET) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Server payment secret is missing.' }));
      return;
    }

    // Compute expected signature: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const dataToSign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(dataToSign)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    let isMatch = false;
    if (expectedSignature.length === razorpay_signature.length) {
      isMatch = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(razorpay_signature, 'utf8')
      );
    }

    if (!isMatch) {
      console.warn(`Payment signature mismatch for order ${razorpay_order_id}`);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Payment verification failed: Signature mismatch. Order not marked as paid.'
      }));
      return;
    }

    // Payment Verified Successfully: Record transaction
    const authUser = getAuthUser(req);
    const chosenPlanKey = planKey || planId || 'PRO_MONTHLY';
    const planInfo = PLAN_CATALOG[chosenPlanKey] || {
      name: chosenPlanKey,
      plan: chosenPlanKey.split('_')[0] || 'PRO',
      cycle: billingCycle || 'monthly',
      amountINR: body.amount ? Math.round(body.amount / 100) : 149
    };

    const paymentRecord = {
      id: 'PAY-' + Math.random().toString(36).substring(2, 9),
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      amountPaise: body.amount || (planInfo.amountPaise || 14900),
      amountINR: planInfo.amountINR || (body.amount ? Math.round(body.amount / 100) : 149),
      currency: body.currency || 'INR',
      planKey: chosenPlanKey,
      planTier: planInfo.plan,
      billingCycle: planInfo.cycle,
      status: 'VERIFIED',
      userId: authUser ? authUser.id : (body.userId || 'guest-user'),
      userEmail: authUser ? authUser.email : (body.email || 'customer@pdfme.io'),
      orgId: authUser ? authUser.orgId : (body.orgId || null),
      createdAt: new Date().toISOString()
    };

    if (!Array.isArray(db.payments)) db.payments = [];
    db.payments.unshift(paymentRecord);

    // Update organization plan if user is authenticated
    if (authUser && authUser.orgId) {
      const org = db.organizations.find(o => o.id === authUser.orgId);
      if (org) {
        org.plan = planInfo.plan;
        const durationDays = planInfo.cycle === 'yearly' ? 365 : 30;
        org.planExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      }
      logActivity(authUser.orgId, authUser.id, 'SUBSCRIPTION_ACTIVATED', `${planInfo.name} (${razorpay_payment_id})`);
    }

    saveDb();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Payment verified and subscription activated successfully!',
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      plan: planInfo.plan,
      planName: planInfo.name,
      amount: paymentRecord.amountINR,
      currency: paymentRecord.currency,
      payment: paymentRecord
    }));
    return;
  }

  // 4. Billing History: GET /api/billing/history
  if (pathName === '/api/billing/history') {
    const authUser = getAuthUser(req);
    const orgId = authUser ? authUser.orgId : null;
    const history = (db.payments || []).filter(p => {
      if (orgId && p.orgId === orgId) return true;
      if (authUser && p.userId === authUser.id) return true;
      return false;
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      billingHistory: history
    }));
    return;
  }

  // 5. Admin Payment Analytics: GET /api/admin/payments
  if (pathName === '/api/admin/payments') {
    const totalUsers = (db.users || []).length;
    const totalOrgs = (db.organizations || []).length;
    const payments = db.payments || [];

    const freeUsers = (db.organizations || []).filter(o => !o.plan || o.plan === 'FREE').length;
    const proSubscribers = (db.organizations || []).filter(o => o.plan === 'PRO').length;
    const premiumSubscribers = (db.organizations || []).filter(o => o.plan === 'PREMIUM').length;
    const businessSubscribers = (db.organizations || []).filter(o => o.plan === 'BUSINESS').length;

    const verifiedPayments = payments.filter(p => p.status === 'VERIFIED');
    const totalGrossRevenueINR = verifiedPayments.reduce((sum, p) => sum + (p.amountINR || Math.round((p.amountPaise || 0) / 100)), 0);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      analytics: {
        totalRegisteredUsers: totalUsers,
        totalOrganizations: totalOrgs,
        freeUsers,
        proSubscribers,
        premiumSubscribers,
        businessSubscribers,
        activeSubscriptions: proSubscribers + premiumSubscribers + businessSubscribers,
        totalVerifiedTransactions: verifiedPayments.length,
        totalGrossRevenueINR
      },
      recentTransactions: verifiedPayments.slice(0, 20)
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Razorpay route not found.' }));
}

module.exports = {
  handleRazorpayRequest,
  PLAN_CATALOG,
  KEY_ID,
  KEY_SECRET
};

