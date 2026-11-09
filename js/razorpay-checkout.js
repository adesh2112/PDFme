'use strict';
/**
 * PDFme Razorpay Standard Web Checkout Client
 * Implements official Razorpay Web Checkout flow:
 * 1. Calls backend /api/create-order
 * 2. Launches Razorpay Standard Checkout modal with order_id
 * 3. Handles success callback and sends (order_id, payment_id, signature) to /api/verify-payment
 * 4. Displays verification status, receipts, and handles cancellation / failure states.
 */

(function initRazorpayIntegration() {
  let activeBillingCycle = 'monthly'; // 'monthly' | 'yearly'

  // Available Plan Catalog with Razorpay configurations
  const PRICING_PLANS = {
    PRO: {
      name: 'Pro',
      monthly: { planKey: 'PRO_MONTHLY', inr: 149, paise: 14900, period: '/ month', note: 'Billed monthly' },
      yearly: { planKey: 'PRO_YEARLY', inr: 1199, paise: 119900, period: '/ year', note: '₹99.9/mo billed yearly (Save 33%)' }
    },
    PREMIUM: {
      name: 'Premium',
      monthly: { planKey: 'PREMIUM_MONTHLY', inr: 299, paise: 29900, period: '/ month', note: 'Billed monthly' },
      yearly: { planKey: 'PREMIUM_YEARLY', inr: 2499, paise: 249900, period: '/ year', note: '₹208/mo billed yearly (Save 30%)' }
    },
    BUSINESS: {
      name: 'Business',
      monthly: { planKey: 'BUSINESS_MONTHLY', inr: 799, paise: 79900, period: '/ month', note: 'Billed monthly' },
      yearly: { planKey: 'BUSINESS_YEARLY', inr: 6999, paise: 699900, period: '/ year', note: '₹583/mo billed yearly (Save 27%)' }
    }
  };

  /**
   * Toggle between monthly and yearly billing display
   */
  window.setBillingCycle = function(cycle) {
    activeBillingCycle = cycle === 'yearly' ? 'yearly' : 'monthly';

    const monthlyBtn = document.getElementById('billing-toggle-monthly');
    const yearlyBtn = document.getElementById('billing-toggle-yearly');
    if (monthlyBtn && yearlyBtn) {
      if (activeBillingCycle === 'yearly') {
        yearlyBtn.classList.add('active');
        monthlyBtn.classList.remove('active');
      } else {
        monthlyBtn.classList.add('active');
        yearlyBtn.classList.remove('active');
      }
    }

    // Update pricing cards in DOM
    ['PRO', 'PREMIUM', 'BUSINESS'].forEach(planId => {
      const priceEl = document.getElementById(`price-val-${planId.toLowerCase()}`);
      const periodEl = document.getElementById(`price-period-${planId.toLowerCase()}`);
      const noteEl = document.getElementById(`price-note-${planId.toLowerCase()}`);
      const config = PRICING_PLANS[planId][activeBillingCycle];

      if (priceEl) priceEl.textContent = `₹${config.inr.toLocaleString('en-IN')}`;
      if (periodEl) periodEl.textContent = config.period;
      if (noteEl) noteEl.textContent = config.note;
    });
  };

  /**
   * Helper to display toasts
   */
  function showToastMessage(msg, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, type);
    } else {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type || 'info'}`;
      toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 9999;
        background: ${type === 'error' ? '#EF4444' : (type === 'success' ? '#10B981' : '#292929')};
        color: #FFFFFF; padding: 12px 20px; border-radius: 8px; font-weight: 500;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2); font-size: 0.9rem;
        display: flex; align-items: center; gap: 8px;
      `;
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    }
  }

  /**
   * Ensure Razorpay checkout.js script is ready
   */
  async function ensureRazorpayLoaded() {
    if (window.Razorpay) return true;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Failed to load Razorpay checkout script. Check your internet connection.'));
      document.head.appendChild(script);
    });
  }

  /**
   * Standard Razorpay Subscription / Order Checkout Trigger
   */
  window.subscribeToPlan = async function(planTier) {
    const tier = (planTier || 'PRO').toUpperCase();
    const planConfig = PRICING_PLANS[tier] ? PRICING_PLANS[tier][activeBillingCycle] : PRICING_PLANS.PRO.monthly;

    await window.initiateRazorpayCheckout({
      planKey: planConfig.planKey,
      planName: `${PRICING_PLANS[tier].name} (${activeBillingCycle === 'yearly' ? 'Annual' : 'Monthly'})`,
      amountPaise: planConfig.paise,
      amountINR: planConfig.inr,
      billingCycle: activeBillingCycle
    });
  };

  /**
   * Main Checkout Implementation
   */
  window.initiateRazorpayCheckout = async function({ planKey, planName, amountPaise, amountINR, billingCycle, customReceipt }) {
    try {
      showToastMessage('Initializing secure Razorpay checkout...', 'info');

      await ensureRazorpayLoaded();

      // Retrieve authentication token if user is signed into workspace
      const token = localStorage.getItem('pdfme-token');
      const authHeaders = { 'Content-Type': 'application/json' };
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;

      // STEP 1: Backend - Create Order (POST /api/create-order)
      const orderPayload = {
        amount: amountPaise,
        currency: 'INR',
        planKey: planKey || 'PRO_MONTHLY',
        billingCycle: billingCycle || 'monthly',
        receipt: customReceipt || ('rcpt_' + Date.now().toString(36))
      };

      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(orderPayload)
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        throw new Error(errData.error || `Order creation failed (${orderRes.status})`);
      }

      const orderData = await orderRes.json();
      const orderId = orderData.order_id;
      const keyId = orderData.key_id;

      if (!orderId) {
        throw new Error('Order creation did not return an order_id.');
      }

      // Pre-fill user information if available
      let prefillName = 'PDFme Customer';
      let prefillEmail = 'customer@pdfme.io';
      try {
        const savedUser = localStorage.getItem('pdfme-user');
        if (savedUser) {
          const u = JSON.parse(savedUser);
          if (u.name) prefillName = u.name;
          if (u.email) prefillEmail = u.email;
        }
      } catch (e) {}

      // STEP 2: FRONTEND - Open Razorpay Modal
      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'PDFme Platform',
        description: planName || 'PDFme Subscription',
        image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%23FFD84D"/><text y="22" x="7" font-size="20" font-weight="bold" fill="%23292929">P</text></svg>',
        order_id: orderId,
        theme: {
          color: '#F4B942' // Warm yellow/gold theme
        },
        prefill: {
          name: prefillName,
          email: prefillEmail
        },
        modal: {
          ondismiss: function() {
            showToastMessage('Payment cancelled by user.', 'info');
          }
        },
        handler: async function(response) {
          // STEP 3: BACKEND - Verify Signature (POST /api/verify-payment)
          showToastMessage('Verifying payment signature with PDFme server...', 'info');

          try {
            const verifyPayload = {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planKey: planKey,
              amount: orderData.amount,
              currency: orderData.currency,
              billingCycle: billingCycle || 'monthly'
            };

            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify(verifyPayload)
            });

            const verifyResult = await verifyRes.json();

            if (verifyRes.ok && verifyResult.success) {
              showToastMessage('Payment verified successfully!', 'success');
              displayPaymentSuccessModal(verifyResult);

              // Update any cached organization status
              if (window.refreshWorkspaceData) {
                window.refreshWorkspaceData();
              }
              if (window.loadBillingHistory) {
                window.loadBillingHistory();
              }
            } else {
              showToastMessage(verifyResult.error || 'Payment verification failed: Signature mismatch.', 'error');
            }
          } catch (verifyErr) {
            console.error('Signature verification call error:', verifyErr);
            showToastMessage('Error communicating with verification endpoint: ' + verifyErr.message, 'error');
          }
        }
      };

      const rzpInstance = new window.Razorpay(options);

      rzpInstance.on('payment.failed', function(resp) {
        console.error('Razorpay payment failed:', resp.error);
        showToastMessage(`Payment Failed: ${resp.error.description || resp.error.reason}`, 'error');
      });

      rzpInstance.open();

    } catch (err) {
      console.error('Razorpay Checkout Error:', err);
      showToastMessage(`Checkout error: ${err.message}`, 'error');
    }
  };

  /**
   * Success Modal with Verified Receipt
   */
  function displayPaymentSuccessModal(result) {
    let modal = document.getElementById('payment-success-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'payment-success-modal';
      modal.className = 'saas-modal-backdrop active';
      document.body.appendChild(modal);
    } else {
      modal.classList.add('active');
    }

    const p = result.payment || {};
    const amountINR = p.amountINR || result.amount || (p.amountPaise ? p.amountPaise / 100 : 0);

    modal.innerHTML = `
      <div class="saas-modal-box" style="max-width:500px;text-align:center;">
        <div class="saas-modal-header" style="justify-content:center;position:relative;border:none;padding-top:28px;">
          <div style="width:56px;height:56px;border-radius:50%;background:#ECFDF5;display:flex;align-items:center;justify-content:center;margin:0 auto;color:#10B981;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <button class="saas-modal-close" style="position:absolute;top:16px;right:16px;" onclick="document.getElementById('payment-success-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="saas-modal-body" style="padding:12px 28px 28px 28px;">
          <h3 style="font-size:1.35rem;font-weight:700;margin-bottom:6px;">Payment Verified!</h3>
          <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:20px;">
            Your transaction has been securely confirmed by Razorpay and your account is upgraded to <strong>${result.planName || result.plan || 'PRO'}</strong>.
          </p>

          <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:left;font-size:0.85rem;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:var(--text-muted);">Payment ID:</span>
              <strong style="font-family:monospace;font-size:0.8rem;">${result.payment_id || p.paymentId || 'N/A'}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:var(--text-muted);">Order ID:</span>
              <strong style="font-family:monospace;font-size:0.8rem;">${result.order_id || p.orderId || 'N/A'}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:var(--text-muted);">Amount Paid:</span>
              <strong>₹${amountINR.toLocaleString('en-IN')} INR</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:var(--text-muted);">Plan Activated:</span>
              <span style="color:var(--saas-accent);font-weight:700;">${result.planName || result.plan || 'PRO'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:var(--text-muted);">Verification Method:</span>
              <span>HMAC-SHA256 (Server verified)</span>
            </div>
          </div>

          <button class="btn btn-primary" style="width:100%;" onclick="document.getElementById('payment-success-modal').classList.remove('active');switchCategory('home');">
            Start Using ${result.plan || 'Pro'} Tools
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Load and render Billing History
   */
  window.loadBillingHistory = async function() {
    const container = document.getElementById('billing-history-table-body');
    if (!container) return;

    try {
      const token = localStorage.getItem('pdfme-token');
      const res = await fetch('/api/billing/history', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      const list = data.billingHistory || [];

      if (list.length === 0) {
        container.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">No verified billing records found yet.</td></tr>`;
        return;
      }

      container.innerHTML = list.map(item => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:12px;font-family:monospace;font-size:0.8rem;">${item.paymentId}</td>
          <td style="padding:12px;font-weight:600;">${item.planKey || item.planTier}</td>
          <td style="padding:12px;">₹${(item.amountINR || (item.amountPaise/100)).toLocaleString('en-IN')}</td>
          <td style="padding:12px;">
            <span style="background:#ECFDF5;color:#10B981;font-weight:600;font-size:0.75rem;padding:3px 8px;border-radius:9999px;">
              ${item.status}
            </span>
          </td>
          <td style="padding:12px;font-size:0.8rem;color:var(--text-muted);">${new Date(item.createdAt).toLocaleDateString()}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.error('Failed to load billing history:', e);
    }
  };

  // Expose to window
  window.PRICING_PLANS = PRICING_PLANS;
})();

