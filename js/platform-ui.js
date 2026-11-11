'use strict';
/**
 * PDFme Unified SaaS Platform Controller
 * Manages:
 * 1. Responsive Navigation & Mobile Header Action Group (Theme, Workspace, Upgrade, Auth)
 * 2. Light / Dark Theme with backend sync
 * 3. Genuine User Authentication (Register, Login, Password Reset, Logout)
 * 4. Upgrade Button routing (logged-out -> Auth -> Pricing; logged-in -> Pricing)
 * 5. Cloud Workspace, Storage, Folders, Favorites, Sync & Saving Status
 * 6. Subscription Management & Cancel flow
 * 7. Strictly protects the existing PDF editor on screen-edit.
 */

(function initPlatform() {
  let currentUser = null;
  let authRedirectTarget = null;
  let activeWorkspaceTab = 'docs';
  let currentWorkspaceFolderId = null;
  let lastWorkspaceData = null;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  // --- 1. Theme Management (Warm Yellow Corporate Light Mode vs High-Contrast Dark) ---
  function updateThemeUI(isLight) {
    document.querySelectorAll('.theme-toggle-btn, .mobile-theme-btn').forEach(btn => {
      if (isLight) {
        // LIGHT MODE: Clearly visible warm golden sun icon, white/cream circular background
        btn.innerHTML = `
          <svg class="theme-icon sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" fill="#FBBF24" stroke="#D97706"/>
            <path d="M12 1.5v2.5"/>
            <path d="M12 20v2.5"/>
            <path d="m4.57 4.57 1.77 1.77"/>
            <path d="m17.66 17.66 1.77 1.77"/>
            <path d="M1.5 12h2.5"/>
            <path d="M20 12h2.5"/>
            <path d="m6.34 17.66-1.77 1.77"/>
            <path d="m19.43 4.57-1.77 1.77"/>
          </svg>
        `;
        btn.setAttribute('title', 'Switch to Dark Mode');
        btn.setAttribute('aria-label', 'Switch to Dark Mode');
      } else {
        // DARK MODE: Clearly visible crescent moon icon, dark circular background, subtle glow
        btn.innerHTML = `
          <svg class="theme-icon moon-icon" width="18" height="18" viewBox="0 0 24 24" fill="#FCD34D" stroke="#FBBF24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 5px rgba(252,211,77,0.55));" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        `;
        btn.setAttribute('title', 'Switch to Light Mode');
        btn.setAttribute('aria-label', 'Switch to Light Mode');
      }
    });
  }

  function applyTheme(themeStr) {
    const isLight = themeStr === 'light';
    if (isLight) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('pdfme-theme', themeStr);
    updateThemeUI(isLight);
  }
  window.applyTheme = applyTheme;

  const savedTheme = localStorage.getItem('pdfme-theme') || 'light';
  applyTheme(savedTheme);

  window.toggleTheme = function() {
    const isLight = document.body.classList.toggle('light-theme');
    const themeStr = isLight ? 'light' : 'dark';
    localStorage.setItem('pdfme-theme', themeStr);
    updateThemeUI(isLight);

    // Save preference to user account if logged in
    const token = localStorage.getItem('pdfme-token');
    if (token) {
      apiFetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ theme: themeStr })
      }).catch(() => {});
    }
  };

  // --- 2. Mobile Drawer & Navigation ---
  window.toggleMobileDrawer = function(forceClose) {
    const drawer = document.getElementById('mobile-drawer-backdrop');
    if (!drawer) return;
    if (forceClose === true) {
      drawer.classList.remove('active');
    } else {
      drawer.classList.toggle('active');
    }
  };

  // --- Sidebar Controller (Collapsible Desktop & Mobile Drawer) ---
  window.toggleSidebar = function(forceState) {
    const sidebar = document.getElementById('pdfme-sidebar');
    const mainWrap = document.getElementById('pdfme-main-wrapper');
    if (!sidebar) return;
    if (typeof forceState === 'boolean') {
      if (forceState) {
        sidebar.classList.add('collapsed');
        if (mainWrap) mainWrap.classList.add('sidebar-collapsed');
      } else {
        sidebar.classList.remove('collapsed');
        if (mainWrap) mainWrap.classList.remove('sidebar-collapsed');
      }
    } else {
      sidebar.classList.toggle('collapsed');
      if (mainWrap) mainWrap.classList.toggle('sidebar-collapsed');
    }
  };

  window.updateSidebarFolders = function(folders, docs, stats) {
    const tree = document.getElementById('sidebar-folders-tree');
    if (!tree) return;
    const foldersList = Array.isArray(folders) ? folders : [];
    const docCount = Array.isArray(docs) ? docs.length : 0;
    
    let html = `
      <div class="sidebar-folder-item ${!currentWorkspaceFolderId ? 'active' : ''}" onclick="window.switchCategory('workspace'); if (typeof window.openWorkspaceFolder === 'function') window.openWorkspaceFolder(null, 'All Documents');">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="sidebar-folder-name">All Documents</span>
        <span class="sidebar-folder-count">${docCount}</span>
      </div>
    `;

    foldersList.forEach(f => {
      const isSel = currentWorkspaceFolderId === f.id;
      html += `
        <div class="sidebar-folder-item ${isSel ? 'active' : ''}" onclick="window.switchCategory('workspace'); if (typeof window.openWorkspaceFolder === 'function') window.openWorkspaceFolder('${f.id}', '${escapeAttr(f.name)}');">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span class="sidebar-folder-name" title="${escapeAttr(f.name)}">${escapeHtml(f.name)}</span>
          <span class="sidebar-folder-count">${f.documentCount || 0}</span>
        </div>
      `;
    });

    tree.innerHTML = html;

    const meter = document.getElementById('sidebar-storage-text');
    if (meter && stats) {
      const mb = ((stats.totalBytesUsed || 0) / (1024 * 1024)).toFixed(1);
      meter.textContent = `${mb} MB used`;
    }
  };

  // --- 3. Screen Switching ---
  const allScreenIds = [
    'screen-home',
    'screen-merge',
    'screen-photos',
    'screen-edit',
    'screen-tool',
    'screen-convert',
    'screen-organize',
    'screen-ai',
    'screen-security',
    'screen-business',
    'screen-workspace',
    'screen-pricing'
  ];

  window.switchCategory = function(categoryId) {
    allScreenIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    document.querySelectorAll('.saas-nav-link').forEach(link => {
      if (link.getAttribute('data-category') === categoryId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    const targetScreenId = categoryId === 'edit'
      ? 'screen-edit'
      : (categoryId === 'home' ? 'screen-home' : `screen-${categoryId}`);

    const targetEl = document.getElementById(targetScreenId);
    if (targetEl) {
      targetEl.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const header = document.getElementById('header');
    if (header) {
      header.setAttribute('data-show-back', categoryId !== 'home');
    }

    // Record tool in user history
    if (categoryId !== 'home' && categoryId !== 'workspace' && categoryId !== 'pricing') {
      trackRecentTool(categoryId);
    }

    // Refresh workspace if opened
    if (categoryId === 'workspace') {
      window.refreshWorkspaceData();
    }

    window.toggleMobileDrawer(true);
  };

  // --- 4. Upgrade Button Routing (SECTION 9) ---
  window.handleUpgradeClick = function() {
    const token = localStorage.getItem('pdfme-token');
    if (!token) {
      // Logged-out user: open sign-in/up modal and set redirect to pricing
      window.openAuthModal('signin', 'pricing');
    } else {
      // Logged-in user: open Pricing directly
      window.switchCategory('pricing');
    }
  };

  // --- Tier Access Guard & Paywall System ---
  function isUserSubscribed() {
    const token = localStorage.getItem('pdfme-token');
    if (!token) return false;
    const user = currentUser || JSON.parse(localStorage.getItem('pdfme-user') || '{}');
    if (user && (user.planTier === 'PRO' || user.planTier === 'ENTERPRISE' || user.isPro === true || (user.subscription && user.subscription.status === 'active'))) {
      return true;
    }
    return false;
  }
  window.isUserSubscribed = isUserSubscribed;

  window.openPaywallModal = function(toolId, toolName) {
    const modal = document.getElementById('paywall-modal-backdrop');
    if (!modal) return;
    const titleEl = document.getElementById('paywall-tool-title');
    const descEl = document.getElementById('paywall-tool-desc');
    const name = toolName || toolId || 'Premium Tool';
    if (titleEl) titleEl.textContent = `Unlock ${name}`;
    if (descEl) descEl.textContent = `${name} is an advanced feature included in PDFme Pro. Subscribe today to unlock unlimited conversions, OCR scanning, AI Document tools, and enterprise cloud workspace storage.`;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closePaywallModal = function() {
    const modal = document.getElementById('paywall-modal-backdrop');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  // --- 5. Authentication System (SECTION 4) ---
  window.openAuthModal = function(tab = 'signin', redirect = null) {
    authRedirectTarget = redirect;
    const modal = document.getElementById('auth-modal-backdrop');
    if (modal) {
      modal.classList.add('active');
      window.switchAuthTab(tab);
    }
  };

  window.closeAuthModal = function() {
    const modal = document.getElementById('auth-modal-backdrop');
    if (modal) modal.classList.remove('active');
  };

  window.switchAuthTab = function(tab) {
    const tabSignin = document.getElementById('auth-tab-signin');
    const tabSignup = document.getElementById('auth-tab-signup');
    const tabForgot = document.getElementById('auth-tab-forgot');

    const formSignin = document.getElementById('auth-form-signin');
    const formSignup = document.getElementById('auth-form-signup');
    const formForgot = document.getElementById('auth-form-forgot');

    const errBox = document.getElementById('auth-error-msg');
    const succBox = document.getElementById('auth-success-msg');
    if (errBox) errBox.style.display = 'none';
    if (succBox) succBox.style.display = 'none';

    [tabSignin, tabSignup, tabForgot].forEach(t => t?.classList.remove('active'));
    [formSignin, formSignup, formForgot].forEach(f => { if (f) f.style.display = 'none'; });

    if (tab === 'signup') {
      tabSignup?.classList.add('active');
      if (formSignup) formSignup.style.display = 'block';
    } else if (tab === 'forgot') {
      tabForgot?.classList.add('active');
      if (formForgot) formForgot.style.display = 'block';
    } else {
      tabSignin?.classList.add('active');
      if (formSignin) formSignin.style.display = 'block';
    }
  };

  // --- Safe API Client with Content-Type Verification & Configurable API Base URL ---
  function getApiBaseUrl() {
    if (window.PDFME_API_BASE_URL) return window.PDFME_API_BASE_URL.replace(/\/$/, '');
    if (window.PDFME_API_URL) return window.PDFME_API_URL.replace(/\/$/, '');
    const metaTag = document.querySelector('meta[name="pdfme-api-url"]');
    if (metaTag && metaTag.content && metaTag.content.trim()) {
      return metaTag.content.trim().replace(/\/$/, '');
    }
    const stored = localStorage.getItem('pdfme_api_url');
    if (stored && stored.trim()) return stored.trim().replace(/\/$/, '');

    // In local development, if running on a known static dev server port (like 5500 Live Server, 5173 Vite, or 51002),
    // point to the local Node backend on port 8080. Otherwise, use the current origin serving the app.
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const staticDevPorts = ['5500', '5173', '51002', '3001'];
    if (isLocal && staticDevPorts.includes(window.location.port)) {
      return `${window.location.protocol}//${window.location.hostname}:8080`;
    }

    return '';
  }
  window.getApiBaseUrl = getApiBaseUrl;

  window.setPdfmeApiUrl = function(newUrl) {
    if (newUrl) {
      localStorage.setItem('pdfme_api_url', newUrl.trim());
      window.PDFME_API_BASE_URL = newUrl.trim();
    } else {
      localStorage.removeItem('pdfme_api_url');
      delete window.PDFME_API_BASE_URL;
    }
  };

  function showWakeUpNotice(msg) {
    const errBox = document.getElementById('auth-error-msg');
    if (errBox) {
      errBox.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px;">
        <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
        ${msg}
      </span>`;
      errBox.style.display = 'block';
      errBox.style.background = 'rgba(255, 216, 77, 0.15)';
      errBox.style.borderColor = 'var(--primary, #FFD84D)';
      errBox.style.color = 'var(--text, #292929)';
    }
  }

  function hideWakeUpNotice() {
    const errBox = document.getElementById('auth-error-msg');
    if (errBox && errBox.innerHTML.includes('spin-icon')) {
      errBox.style.display = 'none';
      errBox.style.background = '';
      errBox.style.borderColor = '';
      errBox.style.color = '';
    }
  }

  async function pollHealthUntilAwake(healthUrl, maxSeconds = 60) {
    showWakeUpNotice('Waking up the server, this can take up to a minute...');
    const startTime = Date.now();
    while (Date.now() - startTime < maxSeconds * 1000) {
      try {
        const res = await fetch(healthUrl, { method: 'GET', credentials: 'include' });
        if (res.ok) {
          hideWakeUpNotice();
          return true;
        }
      } catch (e) {
        // Still waiting for server to spin up
      }
      await new Promise(r => setTimeout(r, 3000));
    }
    hideWakeUpNotice();
    return false;
  }

  async function apiFetch(path, options = {}) {
    const baseUrl = getApiBaseUrl();
    const url = path.startsWith('http') ? path : (baseUrl ? `${baseUrl}${path}` : path);
    const healthUrl = baseUrl ? `${baseUrl}/api/health` : '/api/health';

    const headers = { ...(options.headers || {}) };
    const token = localStorage.getItem('pdfme-token');
    if (token && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions = {
      ...options,
      headers,
      credentials: 'include'
    };

    let res;
    try {
      res = await fetch(url, fetchOptions);
      if ([502, 503, 504].includes(res.status)) {
        const awake = await pollHealthUntilAwake(healthUrl, 60);
        if (awake) {
          res = await fetch(url, fetchOptions);
        }
      }
    } catch (netErr) {
      const awake = await pollHealthUntilAwake(healthUrl, 60);
      if (awake) {
        try {
          res = await fetch(url, fetchOptions);
        } catch (retryErr) {
          throw new Error('Cannot reach the server. Please check your internet connection.');
        }
      } else {
        throw new Error('Cannot reach the server. Please check your internet connection or verify the server is running.');
      }
    }

    const contentType = res.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error('Unable to process server response. Please try again.');
      }
    } else {
      const text = await res.text().catch(() => '');
      if (text && text.trim().startsWith('{')) {
        try { data = JSON.parse(text); } catch (e) {}
      }
      if (!data) {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('API endpoint not found (404). Please ensure the backend server is running and API routes are configured.');
          }
          throw new Error(`Server returned status ${res.status}.`);
        } else {
          data = { message: text };
        }
      }
    }

    if (!res.ok) {
      const errMsg = data?.error || data?.message || `Request failed (${res.status})`;
      throw new Error(errMsg);
    }
    if (data && typeof data === 'object') {
      try {
        Object.defineProperty(data, 'ok', { value: true, enumerable: false, configurable: true });
        Object.defineProperty(data, 'status', { value: res.status, enumerable: false, configurable: true });
        Object.defineProperty(data, 'json', { value: async () => data, enumerable: false, configurable: true });
        Object.defineProperty(data, 'text', { value: async () => JSON.stringify(data), enumerable: false, configurable: true });
      } catch (e) {}
    }
    return data;
  }
  window.apiFetch = apiFetch;

  function setBtnLoading(btnId, isLoading, text) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
      btn.classList.add('btn-loading');
      const span = btn.querySelector('.btn-text') || btn;
      btn.dataset.origText = span.textContent;
      span.textContent = text || 'Please wait...';
    } else {
      btn.classList.remove('btn-loading');
      const span = btn.querySelector('.btn-text') || btn;
      if (btn.dataset.origText) span.textContent = btn.dataset.origText;
    }
  }

  // --- Password Visibility Toggle ---
  window.togglePasswordVisibility = function(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    if (btnEl) {
      btnEl.innerHTML = isPassword
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      btnEl.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
    }
  };

  window.handleLoginSubmit = async function(e) {
    e.preventDefault();
    const emailInput = document.getElementById('auth-login-email');
    const passInput = document.getElementById('auth-login-password');
    const errBox = document.getElementById('auth-error-msg');
    const succBox = document.getElementById('auth-success-msg');
    if (errBox) errBox.style.display = 'none';
    if (succBox) succBox.style.display = 'none';

    const email = (emailInput?.value || '').trim();
    const password = passInput?.value || '';

    // Client-side validation
    if (!email || !email.includes('@')) {
      if (errBox) {
        errBox.textContent = 'Please enter a valid email address.';
        errBox.style.display = 'block';
      }
      emailInput?.focus();
      return;
    }
    if (!password) {
      if (errBox) {
        errBox.textContent = 'Please enter your password.';
        errBox.style.display = 'block';
      }
      passInput?.focus();
      return;
    }

    setBtnLoading('auth-signin-submit-btn', true, 'Signing in...');

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      localStorage.setItem('pdfme-token', data.token);
      localStorage.setItem('pdfme-user', JSON.stringify(data.user));
      currentUser = data.user;

      // Restore user's saved theme preference from account
      if (data.user && data.user.theme) {
        applyTheme(data.user.theme);
      }

      updateAuthUI(currentUser);
      window.closeAuthModal();
      showToast('Signed in successfully!', 'success');

      if (authRedirectTarget) {
        const dest = authRedirectTarget;
        authRedirectTarget = null;
        window.switchCategory(dest);
      } else {
        window.switchCategory('workspace');
        window.refreshWorkspaceData();
      }
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message || 'Invalid email or password.';
        errBox.style.display = 'block';
      }
    } finally {
      setBtnLoading('auth-signin-submit-btn', false);
    }
  };

  window.handleSignupSubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById('auth-signup-name')?.value?.trim();
    const email = document.getElementById('auth-signup-email')?.value?.trim();
    const password = document.getElementById('auth-signup-password')?.value || '';
    const confirmPassword = document.getElementById('auth-signup-confirm')?.value || '';
    const errBox = document.getElementById('auth-error-msg');
    const succBox = document.getElementById('auth-success-msg');
    if (errBox) errBox.style.display = 'none';
    if (succBox) succBox.style.display = 'none';

    if (!name) {
      if (errBox) {
        errBox.textContent = 'Please enter your full name.';
        errBox.style.display = 'block';
      }
      return;
    }
    if (!email || !email.includes('@')) {
      if (errBox) {
        errBox.textContent = 'Please enter a valid work email address.';
        errBox.style.display = 'block';
      }
      return;
    }
    if (!password || password.length < 6) {
      if (errBox) {
        errBox.textContent = 'Password must be at least 6 characters.';
        errBox.style.display = 'block';
      }
      return;
    }
    if (password !== confirmPassword) {
      if (errBox) {
        errBox.textContent = 'Passwords do not match.';
        errBox.style.display = 'block';
      }
      return;
    }

    setBtnLoading('auth-signup-submit-btn', true, 'Creating account...');

    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, confirmPassword })
      });

      localStorage.setItem('pdfme-token', data.token);
      localStorage.setItem('pdfme-user', JSON.stringify(data.user));
      currentUser = data.user;
      if (data.user && data.user.theme) {
        applyTheme(data.user.theme);
      }
      updateAuthUI(currentUser);
      window.closeAuthModal();
      showToast('Corporate account created successfully!', 'success');

      if (authRedirectTarget) {
        const dest = authRedirectTarget;
        authRedirectTarget = null;
        window.switchCategory(dest);
      } else {
        window.switchCategory('workspace');
        window.refreshWorkspaceData();
      }
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message || 'Registration failed.';
        errBox.style.display = 'block';
      }
    } finally {
      setBtnLoading('auth-signup-submit-btn', false);
    }
  };

  window.handleForgotSubmit = async function(e) {
    e.preventDefault();
    const email = document.getElementById('auth-forgot-email')?.value?.trim();
    const succBox = document.getElementById('auth-success-msg');
    const errBox = document.getElementById('auth-error-msg');
    if (errBox) errBox.style.display = 'none';
    if (succBox) succBox.style.display = 'none';

    if (!email || !email.includes('@')) {
      if (errBox) {
        errBox.textContent = 'Please enter a valid account email.';
        errBox.style.display = 'block';
      }
      return;
    }

    setBtnLoading('auth-forgot-submit-btn', true, 'Generating instructions...');

    try {
      const data = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (data.resetToken) {
        const step1 = document.getElementById('auth-forgot-step1');
        const step2 = document.getElementById('auth-forgot-step2');
        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'block';
        const tokenInput = document.getElementById('auth-reset-token');
        if (tokenInput) tokenInput.value = data.resetToken;
        if (succBox) {
          succBox.textContent = 'Reset token generated! Enter your new password below.';
          succBox.style.display = 'block';
        }
      } else {
        if (succBox) {
          succBox.textContent = data.message || 'If an account exists, password reset instructions have been generated.';
          succBox.style.display = 'block';
        }
      }
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    } finally {
      setBtnLoading('auth-forgot-submit-btn', false);
    }
  };

  window.handleResetPasswordSubmit = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const token = document.getElementById('auth-reset-token')?.value?.trim();
    const newPassword = document.getElementById('auth-reset-password')?.value || '';
    const confirmPassword = document.getElementById('auth-reset-confirm')?.value || '';
    const errBox = document.getElementById('auth-error-msg');
    const succBox = document.getElementById('auth-success-msg');
    if (errBox) errBox.style.display = 'none';
    if (succBox) succBox.style.display = 'none';

    if (!token) {
      if (errBox) {
        errBox.textContent = 'Please enter the reset token.';
        errBox.style.display = 'block';
      }
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      if (errBox) {
        errBox.textContent = 'Password must be at least 6 characters.';
        errBox.style.display = 'block';
      }
      return;
    }
    if (newPassword !== confirmPassword) {
      if (errBox) {
        errBox.textContent = 'Passwords do not match.';
        errBox.style.display = 'block';
      }
      return;
    }

    setBtnLoading('auth-reset-submit-btn', true, 'Updating password...');
    try {
      const data = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      showToast(data.message || 'Password updated successfully! You can now sign in.', 'success');
      window.switchAuthTab('signin');
      if (succBox) {
        succBox.textContent = 'Password updated successfully. Please sign in with your new password.';
        succBox.style.display = 'block';
      }
      const loginPassInput = document.getElementById('auth-login-password');
      if (loginPassInput) loginPassInput.value = '';
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    } finally {
      setBtnLoading('auth-reset-submit-btn', false);
    }
  };

  window.handleLogout = async function() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Proceed with local logout regardless of server connectivity
    }
    localStorage.removeItem('pdfme-token');
    localStorage.removeItem('pdfme-user');
    currentUser = null;
    updateAuthUI(null);
    window.closeAccountMenu();
    window.closeMobileAccountSheet();
    showToast('Signed out of PDFme.', 'info');
    window.switchCategory('home');
  };

  function updateAuthUI(user) {
    const desktopAuthBtn = document.getElementById('header-desktop-auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');

    if (user) {
      const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
      const displayName = user.name ? user.name.split(' ')[0] : 'Profile';

      if (desktopAuthBtn) {
        desktopAuthBtn.innerHTML = `
          <span class="user-avatar-mini">${initial}</span>
          <span>${displayName}</span>
        `;
      }
      if (mobileAuthBtn) {
        mobileAuthBtn.innerHTML = `
          <span class="user-avatar-mini" style="width:18px;height:18px;font-size:0.65rem;">${initial}</span>
          <span class="btn-label">${displayName}</span>
        `;
      }

      const planName = (user.role === 'ADMIN' ? 'Admin • ' : '') + ((user.organization && user.organization.plan) || 'FREE') + ' PLAN';
      document.querySelectorAll('#menu-user-name, #mobile-menu-user-name').forEach(el => el.textContent = user.name || 'User');
      document.querySelectorAll('#menu-user-email, #mobile-menu-user-email').forEach(el => el.textContent = user.email || '');
      document.querySelectorAll('#menu-user-plan, #mobile-menu-user-plan').forEach(el => el.textContent = planName.toUpperCase());
    } else {
      if (desktopAuthBtn) {
        desktopAuthBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Sign In</span>
        `;
      }
      if (mobileAuthBtn) {
        mobileAuthBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span class="btn-label">Sign In</span>
        `;
      }
    }
  }

  window.handleAuthBtnClick = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!currentUser) {
      window.openAuthModal('signin');
    } else {
      if (window.innerWidth <= 900) {
        window.openMobileAccountSheet();
      } else {
        window.toggleDesktopAccountMenu();
      }
    }
  };

  window.toggleDesktopAccountMenu = function() {
    const menu = document.getElementById('desktop-account-menu');
    if (!menu) return;
    const isVisible = menu.style.display === 'block';
    menu.style.display = isVisible ? 'none' : 'block';
  };

  window.closeAccountMenu = function() {
    const menu = document.getElementById('desktop-account-menu');
    if (menu) menu.style.display = 'none';
  };

  window.openMobileAccountSheet = function() {
    const sheet = document.getElementById('mobile-account-backdrop');
    if (sheet) sheet.classList.add('active');
  };

  window.closeMobileAccountSheet = function() {
    const sheet = document.getElementById('mobile-account-backdrop');
    if (sheet) sheet.classList.remove('active');
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-account-wrapper')) {
      window.closeAccountMenu();
    }
  });

  // --- 6. Cloud Workspace & Cross-Device Sync (SECTIONS 5, 6 & 7) ---
  window.updateSavingStatus = function(state) {
    const el = document.getElementById('workspace-save-status');
    if (!el) return;
    if (state === 'saving') {
      el.className = 'save-status-badge saving';
      el.innerHTML = '● Saving...';
    } else if (state === 'saved') {
      el.className = 'save-status-badge saved';
      el.innerHTML = '✓ Saved to Cloud';
    } else {
      el.className = 'save-status-badge error';
      el.innerHTML = '✕ Save failed – Retry';
      el.onclick = () => window.refreshWorkspaceData();
    }
  };

  window.refreshWorkspaceData = async function() {
    const token = localStorage.getItem('pdfme-token');
    if (!token) {
      window.currentWorkspaceFolders = [];
      window.currentWorkspaceDocs = [];
      renderLoggedOutWorkspace();
      return;
    }

    window.updateSavingStatus('saving');
    try {
      const data = await apiFetch('/api/workspace/sync', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      lastWorkspaceData = data;

      currentUser = data.user;
      window.currentWorkspaceFolders = data.folders || [];
      window.currentWorkspaceDocs = data.documents || [];
      updateAuthUI(currentUser);
      renderWorkspaceUI(data);
      if (typeof window.updateSidebarFolders === 'function') {
        window.updateSidebarFolders(data.folders, data.documents, data.stats);
      }
      window.updateSavingStatus('saved');
    } catch (err) {
      console.warn('Workspace sync failed:', err);
      window.updateSavingStatus('error');
    }
  };

  function renderLoggedOutWorkspace() {
    const container = document.getElementById('workspace-dynamic-content');
    if (!container) return;
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;max-width:540px;margin:0 auto;">
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(255,216,77,0.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;color:var(--saas-gold);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h3 style="font-size:1.4rem;font-weight:700;margin-bottom:10px;">Sign In to Access Your Cloud Workspace</h3>
        <p style="color:var(--text-muted);font-size:0.95rem;line-height:1.5;margin-bottom:28px;">
          All your uploaded PDFs, edited documents, e-signed contracts, business templates, and billing records are permanently stored and synchronized across all your devices.
        </p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="window.openAuthModal('signin')" style="padding:10px 24px;">Sign In</button>
          <button class="btn btn-ghost" onclick="window.openAuthModal('signup')" style="padding:10px 24px;border:1px solid var(--border);">Create Free Account</button>
        </div>
      </div>
    `;
  }

  function renderWorkspaceUI(data) {
    const container = document.getElementById('workspace-dynamic-content');
    if (!container) return;

    const org = data.organization || {};
    const plan = org.plan || 'FREE';
    const docs = data.documents || [];
    const folders = data.folders || [];
    const bytesUsed = data.stats?.totalBytesUsed || 0;
    const mbUsed = (bytesUsed / (1024 * 1024)).toFixed(1);

    container.innerHTML = `
      <div class="workspace-header-card">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
          <div>
            <h3 style="font-size:1.35rem;font-weight:800;letter-spacing:-0.02em;">${org.name || 'My Cloud Workspace'}</h3>
            <p style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;">
              Plan: <strong style="color:var(--saas-accent);">${plan}</strong> · Storage: <strong>${mbUsed} MB</strong> used · Role: <strong>${data.user?.role || 'Admin'}</strong>
            </p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm btn-new-folder" onclick="promptCreateFolder()" style="display:inline-flex;align-items:center;gap:7px;padding:8px 18px;border-radius:9px;font-weight:700;font-size:0.875rem;background:#FFD84D;color:#292929;border:1px solid #F4B942;cursor:pointer;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
              <span>New Folder</span>
            </button>
            <label class="btn btn-ghost btn-sm" style="cursor:pointer;padding:8px 16px;border-radius:9px;border:1px solid var(--border);display:inline-flex;align-items:center;gap:7px;font-weight:600;font-size:0.875rem;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>+ Upload PDF</span>
              <input type="file" accept=".pdf" style="display:none;" onchange="handleWorkspaceFileUpload(event)">
            </label>
            <button class="btn btn-ghost btn-sm" onclick="handleLogout()" style="color:var(--danger);display:inline-flex;align-items:center;gap:6px;padding:8px 14px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <div class="workspace-tabs-bar">
        <button class="workspace-tab-btn ${activeWorkspaceTab === 'docs' ? 'active' : ''}" onclick="switchWorkspaceTab('docs')">📁 My Documents (${docs.length})</button>
        <button class="workspace-tab-btn ${activeWorkspaceTab === 'favorites' ? 'active' : ''}" onclick="switchWorkspaceTab('favorites')">⭐ Favourites (${docs.filter(d => d.isFavorite).length})</button>
        <button class="workspace-tab-btn ${activeWorkspaceTab === 'subscription' ? 'active' : ''}" onclick="switchWorkspaceTab('subscription')">💳 My Subscription</button>
        <button class="workspace-tab-btn ${activeWorkspaceTab === 'activity' ? 'active' : ''}" onclick="switchWorkspaceTab('activity')">📜 Audit Trail</button>
      </div>

      <div id="workspace-tab-panel"></div>
    `;

    renderWorkspaceTabContent(data);
  }

  window.switchWorkspaceTab = function(tab) {
    activeWorkspaceTab = tab;
    window.refreshWorkspaceData();
  };

  function renderDocsGrid(displayDocs, folders) {
    if (!displayDocs || displayDocs.length === 0) {
      return `
        <div style="text-align:center;padding:36px 20px;color:var(--text-muted);border:1px dashed var(--border);border-radius:12px;">
          <p style="font-size:0.95rem;font-weight:600;">No documents in this view yet.</p>
        </div>
      `;
    }
    return `
      <div class="workspace-doc-grid">
        ${displayDocs.map(doc => {
          const folderObj = (folders || []).find(f => f.id === doc.folderId);
          return `
            <div class="workspace-doc-card">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                  <div style="width:36px;height:36px;border-radius:8px;background:rgba(244,185,66,0.15);color:var(--saas-gold);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div style="min-width:0;">
                    <h4 style="font-size:0.9rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0 0 2px;" title="${escapeAttr(doc.title)}">${escapeHtml(doc.title)}</h4>
                    <span style="font-size:0.75rem;color:var(--text-muted);">${(doc.size ? (doc.size / 1024).toFixed(1) + ' KB' : 'PDF')} · v${doc.version || 1}</span>
                    ${folderObj ? `<span style="font-size:0.7rem;padding:1px 6px;border-radius:4px;background:rgba(244,185,66,0.15);color:var(--saas-accent);display:inline-block;margin-left:4px;">📂 ${escapeHtml(folderObj.name)}</span>` : ''}
                  </div>
                </div>
                <button onclick="toggleDocFavorite('${doc.id}', ${!doc.isFavorite})" style="background:none;border:none;cursor:pointer;color:${doc.isFavorite ? '#F59E0B' : 'var(--text-muted)'};font-size:1.1rem;">
                  ${doc.isFavorite ? '★' : '☆'}
                </button>
              </div>
              <div class="doc-card-actions" style="display:flex;gap:4px;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
                <button class="btn btn-ghost btn-sm" onclick="switchCategory('edit')" style="font-size:0.75rem;padding:4px 8px;">Edit</button>
                <button class="btn btn-ghost btn-sm" onclick="downloadCloudDoc('${doc.id}')" style="font-size:0.75rem;padding:4px 8px;">Download</button>
                <button class="btn btn-ghost btn-sm" onclick="promptMoveDocument('${doc.id}', '${escapeAttr(doc.title)}')" style="font-size:0.75rem;padding:4px 8px;">Move</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteCloudDoc('${doc.id}')" style="font-size:0.75rem;padding:4px 8px;color:var(--danger);margin-left:auto;">Delete</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderWorkspaceTabContent(data) {
    const panel = document.getElementById('workspace-tab-panel');
    if (!panel) return;
    const docs = data.documents || [];
    const folders = data.folders || [];

    if (activeWorkspaceTab === 'docs' || activeWorkspaceTab === 'favorites') {
      const currentFolder = currentWorkspaceFolderId
        ? folders.find(f => f.id === currentWorkspaceFolderId)
        : null;

      // Inside a specific folder view:
      if (activeWorkspaceTab === 'docs' && currentFolder) {
        const folderDocs = docs.filter(d => d.folderId === currentWorkspaceFolderId);
        panel.innerHTML = `
          <div class="workspace-breadcrumb-bar" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;padding:12px 16px;background:var(--bg-elevated);border-radius:10px;border:1px solid var(--border);flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;font-size:0.9rem;">
              <button class="btn btn-ghost btn-sm" onclick="openWorkspaceFolder(null)" style="padding:4px 10px;font-weight:600;display:inline-flex;align-items:center;gap:5px;">
                <span>📁</span> All Folders
              </button>
              <span style="color:var(--text-muted);">&gt;</span>
              <strong style="color:var(--text);font-size:1rem;display:inline-flex;align-items:center;gap:5px;">
                <span>📂</span> ${escapeHtml(currentFolder.name)}
              </strong>
              <span style="font-size:0.8rem;color:var(--text-muted);">(${folderDocs.length} files)</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <label class="btn btn-primary btn-sm" style="cursor:pointer;padding:6px 14px;border-radius:6px;font-size:0.8rem;">
                + Upload to Folder
                <input type="file" accept=".pdf" style="display:none;" onchange="handleWorkspaceFileUpload(event, '${currentFolder.id}')">
              </label>
              <button class="btn btn-ghost btn-sm" onclick="promptRenameFolder('${currentFolder.id}', '${escapeAttr(currentFolder.name)}')" style="font-size:0.8rem;border:1px solid var(--border);">Rename</button>
              <button class="btn btn-ghost btn-sm" onclick="confirmDeleteFolder('${currentFolder.id}', '${escapeAttr(currentFolder.name)}')" style="font-size:0.8rem;color:var(--danger);border:1px solid var(--border);">Delete</button>
            </div>
          </div>

          ${folderDocs.length === 0 ? `
            <div style="text-align:center;padding:48px 20px;color:var(--text-muted);border:1px dashed var(--border);border-radius:12px;">
              <p style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">This folder is empty.</p>
              <p style="font-size:0.85rem;margin-bottom:16px;">Upload a PDF to store it directly inside "${escapeHtml(currentFolder.name)}".</p>
              <label class="btn btn-primary btn-sm" style="cursor:pointer;padding:8px 18px;">
                + Upload PDF
                <input type="file" accept=".pdf" style="display:none;" onchange="handleWorkspaceFileUpload(event, '${currentFolder.id}')">
              </label>
            </div>
          ` : renderDocsGrid(folderDocs, folders)}
        `;
        return;
      }

      // Root view:
      const displayDocs = activeWorkspaceTab === 'favorites'
        ? docs.filter(d => d.isFavorite)
        : docs;

      panel.innerHTML = `
        ${activeWorkspaceTab === 'docs' ? `
          <div style="margin-bottom:28px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
              <h4 style="font-size:1.05rem;font-weight:700;display:flex;align-items:center;gap:8px;margin:0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--saas-accent);"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>My Folders (${folders.length})</span>
              </h4>
              <button class="btn btn-ghost btn-sm" onclick="promptCreateFolder()" style="display:inline-flex;align-items:center;gap:5px;font-size:0.8rem;padding:5px 12px;border:1px solid var(--border);border-radius:8px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>New Folder</span>
              </button>
            </div>

            ${folders.length === 0 ? `
              <div style="padding:24px 20px;background:var(--bg-elevated);border:1px dashed var(--border);border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="width:40px;height:40px;border-radius:10px;background:rgba(244,185,66,0.15);display:flex;align-items:center;justify-content:center;color:var(--saas-accent);flex-shrink:0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <div>
                    <p style="font-size:0.9rem;font-weight:700;margin:0 0 2px;">No folders created yet</p>
                    <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">Create folders to organize your invoices, contracts, and confidential documents.</p>
                  </div>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="promptCreateFolder()" style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:8px;padding:6px 14px;white-space:nowrap;font-weight:600;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>Create First Folder</span>
                </button>
              </div>
            ` : `
              <div class="workspace-folders-grid">
                ${folders.map(f => {
                  const count = docs.filter(d => d.folderId === f.id).length;
                  const updatedText = f.updatedAt ? new Date(f.updatedAt).toLocaleDateString() : 'Recently';
                  return `
                    <div class="workspace-folder-card" onclick="openWorkspaceFolder('${f.id}')">
                      <div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1;">
                        <div class="folder-svg-icon" style="width:40px;height:40px;border-radius:10px;background:rgba(255,216,77,0.22);border:1px solid rgba(244,185,66,0.35);display:flex;align-items:center;justify-content:center;color:var(--saas-accent);flex-shrink:0;">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                          </svg>
                        </div>
                        <div style="min-width:0;flex:1;">
                          <h4 style="font-size:0.95rem;font-weight:700;margin:0 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeAttr(f.name)}">${escapeHtml(f.name)}</h4>
                          <span style="font-size:0.75rem;color:var(--text-muted);display:inline-block;">${count} ${count === 1 ? 'document' : 'documents'} · Updated ${updatedText}</span>
                        </div>
                      </div>
                      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;" onclick="event.stopPropagation()">
                        <button class="btn btn-ghost btn-sm" title="Open Folder" onclick="openWorkspaceFolder('${f.id}')" style="padding:5px 10px;font-size:0.8rem;border:1px solid var(--border);border-radius:6px;font-weight:600;">Open</button>
                        <button class="btn btn-ghost btn-sm" title="Rename Folder" onclick="promptRenameFolder('${f.id}', '${escapeAttr(f.name)}')" style="padding:5px 9px;font-size:0.8rem;border:1px solid var(--border);border-radius:6px;">✎</button>
                        <button class="btn btn-ghost btn-sm" title="Delete Folder" onclick="confirmDeleteFolder('${f.id}', '${escapeAttr(f.name)}')" style="padding:5px 9px;font-size:0.8rem;color:var(--danger);border:1px solid var(--border);border-radius:6px;">✕</button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h4 style="font-size:1rem;font-weight:700;margin:0;">
              📄 Documents (${displayDocs.length})
            </h4>
          </div>
        ` : ''}

        ${displayDocs.length === 0 ? `
          <div style="text-align:center;padding:48px 20px;color:var(--text-muted);border:1px dashed var(--border);border-radius:12px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:0.6;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p style="font-size:0.95rem;font-weight:600;">No documents in this view yet.</p>
            <p style="font-size:0.8rem;margin-top:4px;">Upload PDFs or edit documents to save them permanently in your cloud account.</p>
          </div>
        ` : renderDocsGrid(displayDocs, folders)}
      `;
    } else if (activeWorkspaceTab === 'subscription') {
      const org = data.organization || {};
      const plan = org.plan || 'FREE';
      const payments = data.payments || [];

      panel.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:20px;margin-bottom:32px;">
          <div class="workspace-header-card" style="margin-bottom:0;">
            <span style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Current Subscription</span>
            <h3 style="font-size:1.8rem;font-weight:800;color:var(--saas-accent);margin:8px 0;">${plan} Plan</h3>
            <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:18px;">Status: <strong>${org.subscriptionStatus || 'ACTIVE'}</strong></p>
            <div style="display:flex;gap:10px;">
              <button class="btn btn-primary btn-sm" onclick="switchCategory('pricing')">Change / Upgrade Plan</button>
              ${plan !== 'FREE' ? `<button class="btn btn-ghost btn-sm" onclick="cancelSubscription()" style="color:var(--danger);">Cancel</button>` : ''}
            </div>
          </div>
        </div>

        <h4 style="font-size:1.05rem;font-weight:700;margin-bottom:14px;">Verified Razorpay Billing History</h4>
        <div class="billing-table-wrap" style="margin-top:0;">
          <table class="billing-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Plan Tier</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${payments.length > 0 ? payments.map(p => `
                <tr>
                  <td><code>${p.paymentId || p.id}</code></td>
                  <td><strong>${p.planTier || 'PRO'}</strong></td>
                  <td>₹${p.amountINR || (p.amountPaise ? Math.round(p.amountPaise/100) : 149)}</td>
                  <td><span style="color:#10B981;font-weight:700;">VERIFIED</span></td>
                  <td style="color:var(--text-muted);">${new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">No verified billing records found for this account.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `;
    } else if (activeWorkspaceTab === 'activity') {
      const logs = data.activityLogs || [];
      panel.innerHTML = `
        <div style="border:1px solid var(--border);border-radius:12px;background:var(--bg-card);overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:0.85rem;text-align:left;">
            <thead style="background:var(--bg-elevated);border-bottom:1px solid var(--border);">
              <tr>
                <th style="padding:12px 16px;">Action</th>
                <th style="padding:12px 16px;">Target</th>
                <th style="padding:12px 16px;">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length > 0 ? logs.map(l => `
                <tr style="border-bottom:1px solid var(--border);">
                  <td style="padding:10px 16px;font-weight:600;color:var(--saas-accent);">${l.action}</td>
                  <td style="padding:10px 16px;">${l.target}</td>
                  <td style="padding:10px 16px;color:var(--text-muted);">${new Date(l.timestamp).toLocaleString()}</td>
                </tr>
              `).join('') : `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-muted);">No activity recorded yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // --- Folder Management & Modals ---
  window.promptCreateFolder = function() {
    const token = localStorage.getItem('pdfme-token');
    if (!token) {
      if (typeof showToast === 'function') showToast('Please sign in to create persistent workspace folders.', 'info');
      if (typeof window.openAuthModal === 'function') window.openAuthModal('signin', 'workspace');
      return;
    }
    const modal = document.getElementById('folder-modal-backdrop');
    if (!modal) return;
    const titleEl = document.getElementById('folder-modal-title');
    if (titleEl) titleEl.textContent = 'Create New Folder';
    const subEl = document.getElementById('folder-modal-subtitle');
    if (subEl) subEl.textContent = 'Organize documents into dedicated workspace folders.';
    const submitBtn = document.getElementById('folder-modal-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Create Folder';
    const idInp = document.getElementById('folder-id-input');
    if (idInp) idInp.value = '';
    const nameInp = document.getElementById('folder-name-input');
    if (nameInp) nameInp.value = '';
    const err = document.getElementById('folder-modal-error');
    if (err) err.style.display = 'none';
    modal.classList.add('active');
    setTimeout(() => { if (nameInp) nameInp.focus(); }, 60);
  };

  window.promptRenameFolder = function(folderId, currentName) {
    const modal = document.getElementById('folder-modal-backdrop');
    if (!modal) return;
    const titleEl = document.getElementById('folder-modal-title');
    if (titleEl) titleEl.textContent = 'Rename Folder';
    const subEl = document.getElementById('folder-modal-subtitle');
    if (subEl) subEl.textContent = 'Update the folder display name.';
    const submitBtn = document.getElementById('folder-modal-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Save Changes';
    const idInp = document.getElementById('folder-id-input');
    if (idInp) idInp.value = folderId;
    const nameInp = document.getElementById('folder-name-input');
    if (nameInp) nameInp.value = currentName || '';
    const err = document.getElementById('folder-modal-error');
    if (err) err.style.display = 'none';
    modal.classList.add('active');
    setTimeout(() => { if (nameInp) nameInp.focus(); }, 60);
  };

  window.closeFolderModal = function() {
    const modal = document.getElementById('folder-modal-backdrop');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  window.handleFolderFormSubmit = async function(e) {
    e.preventDefault();
    const token = localStorage.getItem('pdfme-token');
    if (!token) {
      showToast('Please sign in to manage folders.', 'warning');
      window.openAuthModal('signin');
      return;
    }
    const name = document.getElementById('folder-name-input')?.value?.trim();
    const folderId = document.getElementById('folder-id-input')?.value?.trim();
    const errBox = document.getElementById('folder-modal-error');

    if (!name) {
      if (errBox) {
        errBox.textContent = 'Please enter a folder name.';
        errBox.style.display = 'block';
      }
      return;
    }

    try {
      const endpoint = folderId ? '/api/workspace/folders/rename' : '/api/workspace/folders';
      const body = folderId ? { folderId, name } : { name };
      await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      window.closeFolderModal();
      showToast(folderId ? '✓ Folder renamed successfully' : '✓ Folder created successfully', 'success');
      await window.refreshWorkspaceData();
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message || 'Operation failed';
        errBox.style.display = 'block';
      }
    }
  };

  window.confirmDeleteFolder = async function(folderId, folderName) {
    if (!confirm(`Are you sure you want to delete folder "${folderName}"? Documents inside will remain safe in your workspace.`)) return;
    const token = localStorage.getItem('pdfme-token');
    if (!token) return;

    try {
      await apiFetch('/api/workspace/folders/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId })
      });

      if (currentWorkspaceFolderId === folderId) {
        currentWorkspaceFolderId = null;
      }
      showToast('✓ Folder deleted successfully', 'info');
      await window.refreshWorkspaceData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.openWorkspaceFolder = function(folderId) {
    currentWorkspaceFolderId = folderId;
    activeWorkspaceTab = 'docs';
    window.refreshWorkspaceData();
  };

  // --- Document Moving ---
  window.promptMoveDocument = function(docId, docTitle) {
    const modal = document.getElementById('move-doc-modal-backdrop');
    if (!modal) return;
    const nameEl = document.getElementById('move-doc-name');
    if (nameEl) nameEl.textContent = `Move "${docTitle}" to:`;
    const list = document.getElementById('move-folder-list');
    const folders = (lastWorkspaceData && lastWorkspaceData.folders) || [];

    if (list) {
      list.innerHTML = `
        <button class="btn btn-ghost" onclick="submitMoveDocument('${docId}', null)" style="justify-content:flex-start;padding:10px 14px;border:1px solid var(--border);border-radius:8px;text-align:left;display:flex;align-items:center;gap:8px;">
          <span>📁</span> Main Workspace (Root / No Folder)
        </button>
        ${folders.map(f => `
          <button class="btn btn-ghost" onclick="submitMoveDocument('${docId}', '${f.id}')" style="justify-content:flex-start;padding:10px 14px;border:1px solid var(--border);border-radius:8px;text-align:left;display:flex;align-items:center;gap:8px;">
            <span>📂</span> ${escapeHtml(f.name)}
          </button>
        `).join('')}
      `;
    }
    modal.classList.add('active');
  };

  window.closeMoveDocModal = function() {
    const modal = document.getElementById('move-doc-modal-backdrop');
    if (modal) modal.classList.remove('active');
  };

  window.submitMoveDocument = async function(docId, targetFolderId) {
    const token = localStorage.getItem('pdfme-token');
    if (!token) return;

    try {
      const res = await apiFetch('/api/workspace/documents/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ docId, folderId: targetFolderId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to move document');

      window.closeMoveDocModal();
      showToast('✓ Document moved successfully', 'success');
      window.refreshWorkspaceData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.handleWorkspaceFileUpload = async function(e, specificFolderId) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    window.updateSavingStatus('saving');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const targetFolder = specificFolderId || currentWorkspaceFolderId || null;
        const res = await apiFetch('/api/files/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: file.name,
            dataBase64: reader.result,
            size: file.size,
            folderId: targetFolder
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        window.updateSavingStatus('saved');
        showToast('Document uploaded to cloud workspace!', 'success');
        window.refreshWorkspaceData();
      } catch (err) {
        window.updateSavingStatus('error');
        showToast(err.message, 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  window.toggleDocFavorite = async function(docId, isFavorite) {
    await apiFetch('/api/workspace/documents/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId, isFavorite })
    });
    window.refreshWorkspaceData();
  };

  window.deleteCloudDoc = async function(docId) {
    if (!confirm('Are you sure you want to delete this document from your cloud account?')) return;
    await apiFetch('/api/workspace/documents/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId })
    });
    showToast('Document deleted.', 'info');
    window.refreshWorkspaceData();
  };

  window.cancelSubscription = async function() {
    if (!confirm('Cancel your subscription? You will retain access until the end of the billing cycle.')) return;
    const res = await apiFetch('/api/subscription/cancel', {
      method: 'POST'
    });
    const d = await res.json();
    showToast(d.message || 'Subscription cancelled.', 'info');
    window.refreshWorkspaceData();
  };

  // --- 7. Comprehensive Search Engine & Filter ---
  const SEARCH_TOOLS_CATALOG = [
    // Convert Tools
    { id: 'pdf-to-word', name: 'PDF to Word (DOCX)', desc: 'Extract editable Microsoft Word DOCX from PDF', category: 'Convert', badge: 'Convert', tier: 'FREE', keywords: ['docx', 'word', 'doc', 'convert', 'extract', 'pdf to word'], action: () => window.openToolModal && window.openToolModal('pdf-to-word', 'PDF to Word (DOCX)') },
    { id: 'word-to-pdf', name: 'Word (DOCX) to PDF', desc: 'Convert Microsoft Word documents to clean PDF', category: 'Convert', badge: 'Convert', tier: 'FREE', keywords: ['word', 'docx', 'doc', 'convert', 'word to pdf'], action: () => window.openToolModal && window.openToolModal('word-to-pdf', 'Word (DOCX) to PDF') },
    { id: 'pdf-to-excel', name: 'PDF to Excel (XLSX)', desc: 'Extract tabular PDF data into Excel worksheets', category: 'Convert', badge: 'Convert', tier: 'FREE', keywords: ['excel', 'xlsx', 'xls', 'spreadsheet', 'table', 'pdf to excel'], action: () => window.openToolModal && window.openToolModal('pdf-to-excel', 'PDF to Excel (XLSX)') },
    { id: 'excel-to-pdf', name: 'Excel (XLSX) to PDF', desc: 'Convert Excel spreadsheets to PDF documents', category: 'Convert', badge: 'Convert', tier: 'FREE', keywords: ['excel', 'xlsx', 'xls', 'spreadsheet', 'sheets', 'excel to pdf'], action: () => window.openToolModal && window.openToolModal('excel-to-pdf', 'Excel (XLSX) to PDF') },
    { id: 'pdf-to-ppt', name: 'PDF to PowerPoint (PPTX)', desc: 'Convert PDF presentation slides to editable PPTX', category: 'Convert', badge: 'Convert', tier: 'FREE', keywords: ['powerpoint', 'pptx', 'ppt', 'slides', 'presentation', 'pdf to ppt'], action: () => window.openToolModal && window.openToolModal('pdf-to-ppt', 'PDF to PowerPoint (PPTX)') },
    { id: 'pptx-to-pdf', name: 'PowerPoint to PDF', desc: 'Convert PowerPoint presentations to clean PDF', category: 'Convert', badge: 'Convert', tier: 'FREE', keywords: ['powerpoint', 'pptx', 'ppt', 'slides', 'ppt to pdf'], action: () => window.openToolModal && window.openToolModal('pptx-to-pdf', 'PowerPoint to PDF') },
    { id: 'pdf-to-jpg', name: 'PDF to JPG', desc: 'Extract high-resolution JPG images from PDF pages', category: 'Convert', badge: 'Convert', tier: 'FREE', keywords: ['jpg', 'jpeg', 'image', 'photo', 'extract', 'pdf to jpg'], action: () => window.openToolModal && window.openToolModal('pdf-to-jpg', 'PDF to JPG') },
    { id: 'pdf-to-png', name: 'PDF to PNG', desc: 'Extract crisp transparent PNG images from PDF pages', category: 'Convert', badge: 'Convert', tier: 'FREE', keywords: ['png', 'image', 'photo', 'transparent', 'pdf to png'], action: () => window.openToolModal && window.openToolModal('pdf-to-png', 'PDF to PNG') },
    { id: 'jpg-to-pdf', name: 'JPG / Photo to PDF', desc: 'Convert JPG photos and images to clean PDF document', category: 'Convert', badge: 'Convert', tier: 'FREE', keywords: ['jpg', 'jpeg', 'photo', 'image', 'picture', 'jpg to pdf'], action: () => window.switchCategory ? window.switchCategory('photos') : (window.openToolModal && window.openToolModal('jpg-to-pdf', 'JPG to PDF')) },
    { id: 'png-to-pdf', name: 'PNG to PDF', desc: 'Convert PNG graphics and illustrations to PDF document', category: 'Convert', badge: 'Convert', tier: 'FREE', keywords: ['png', 'graphics', 'image', 'convert', 'png to pdf'], action: () => window.openToolModal && window.openToolModal('png-to-pdf', 'PNG to PDF') },
    { id: 'html-to-pdf', name: 'HTML to PDF', desc: 'Convert rich HTML markup and CSS into vector PDF', category: 'Convert', badge: 'Convert', tier: 'FREE', keywords: ['html', 'web', 'markup', 'code', 'render', 'html to pdf'], action: () => window.openToolModal && window.openToolModal('html-to-pdf', 'HTML to PDF') },

    // Organise Tools
    { id: 'merge-pdf', name: 'Merge PDF', desc: 'Combine multiple PDF documents into a single file', category: 'Organise', badge: 'Organise', tier: 'FREE', keywords: ['merge', 'combine', 'join', 'append', 'bind', 'merge pdf'], action: () => window.switchCategory ? window.switchCategory('merge') : (window.openToolModal && window.openToolModal('organize-pdf', 'Merge PDF')) },
    { id: 'split-pdf', name: 'Split PDF', desc: 'Extract page ranges or separate PDF into individual files', category: 'Organise', badge: 'Organise', tier: 'FREE', keywords: ['split', 'separate', 'divide', 'cut', 'extract pages', 'split pdf'], action: () => window.openToolModal && window.openToolModal('split-pdf', 'Split PDF') },
    { id: 'reorder-pdf', name: 'Reorder PDF Pages', desc: 'Drag, reorder, sort and rearrange pages in any order', category: 'Organise', badge: 'Organise', tier: 'FREE', keywords: ['reorder', 'rearrange', 'sort', 'organize', 'pages', 'reorder pdf'], action: () => window.openToolModal && window.openToolModal('reorder-pdf', 'Reorder Pages') },
    { id: 'delete-pages', name: 'Delete PDF Pages', desc: 'Select and remove unwanted or blank pages from PDF', category: 'Organise', badge: 'Organise', tier: 'FREE', keywords: ['delete', 'remove', 'discard', 'pages', 'delete pages'], action: () => window.openToolModal && window.openToolModal('delete-pages', 'Delete PDF Pages') },
    { id: 'extract-pages', name: 'Extract PDF Pages', desc: 'Extract selected pages into a brand new PDF document', category: 'Organise', badge: 'Organise', tier: 'FREE', keywords: ['extract', 'select', 'pull', 'export pages', 'extract pages'], action: () => window.openToolModal && window.openToolModal('extract-pages', 'Extract PDF Pages') },
    { id: 'rotate-pdf', name: 'Rotate PDF', desc: 'Rotate PDF pages 90, 180, or 270 degrees clockwise', category: 'Organise', badge: 'Organise', tier: 'FREE', keywords: ['rotate', 'turn', 'orientation', 'landscape', 'portrait', 'rotate pdf'], action: () => window.openToolModal && window.openToolModal('rotate-pdf', 'Rotate PDF') },
    { id: 'page-numbers', name: 'Add Page Numbers', desc: 'Insert custom headers, footers and page numbering', category: 'Organise', badge: 'Organise', tier: 'FREE', keywords: ['numbers', 'paginate', 'header', 'footer', 'page numbers'], action: () => window.openToolModal && window.openToolModal('page-numbers', 'Add Page Numbers') },
    { id: 'crop-pdf', name: 'Crop PDF', desc: 'Trim page margins and adjust visible dimensions', category: 'Organise', badge: 'Organise', tier: 'FREE', keywords: ['crop', 'trim', 'cut', 'margins', 'resize', 'crop pdf'], action: () => window.openToolModal && window.openToolModal('crop-pdf', 'Crop PDF') },
    { id: 'compress-pdf', name: 'Compress PDF', desc: 'Reduce PDF file size with stream compression', category: 'Organise', badge: 'Organise', tier: 'FREE', keywords: ['compress', 'reduce', 'shrink', 'smaller', 'optimize', 'compress pdf'], action: () => window.openToolModal && window.openToolModal('compress-pdf', 'Compress PDF') },

    // Edit Tools
    { id: 'edit-pdf', name: 'Edit PDF', desc: 'In-place editor to modify text, Marathi script, shapes & annotations', category: 'Edit', badge: 'Editor', tier: 'FREE', keywords: ['edit', 'draw', 'text', 'annotate', 'signature', 'mark', 'marathi', 'edit pdf'], action: () => window.switchCategory && window.switchCategory('edit') },

    // AI PDF Tools
    { id: 'ai-assistant', name: 'AI PDF Assistant', desc: 'Interactive chat copilot for deep analysis and document guidance', category: 'AI Tools', badge: 'AI', tier: 'PREMIUM', keywords: ['ai', 'copilot', 'assistant', 'chat', 'ask', 'prompt', 'ai assistant'], action: () => window.openToolModal && window.openToolModal('ai-assistant', 'AI PDF Assistant') },
    { id: 'ai-summarizer', name: 'AI Document Summarizer', desc: 'Instant executive summaries, bullet points, and key takeaways', category: 'AI Tools', badge: 'AI', tier: 'PREMIUM', keywords: ['summarize', 'summary', 'brief', 'key points', 'ai', 'ai summarizer', 'summarizer'], action: () => window.openToolModal && window.openToolModal('ai-summarizer', 'AI Document Summarizer') },
    { id: 'ai-translator', name: 'AI Document Translator', desc: 'Translate document text across 20+ languages preserving layout', category: 'AI Tools', badge: 'AI', tier: 'PREMIUM', keywords: ['translate', 'translator', 'language', 'marathi', 'hindi', 'multilingual'], action: () => window.openToolModal && window.openToolModal('ai-translator', 'AI Document Translator') },
    { id: 'ocr-pdf', name: 'OCR Scanner & Searchable PDF', desc: 'Convert scanned PDFs and images into searchable, selectable text', category: 'AI Tools', badge: 'AI', tier: 'PREMIUM', keywords: ['ocr', 'scanner', 'searchable', 'optical', 'recognize', 'text layer'], action: () => window.openToolModal && window.openToolModal('ocr-pdf', 'OCR Scanner & Searchable PDF') },
    { id: 'ai-contract', name: 'Contract Analyzer', desc: 'Review legal agreements, detect risks, indemnity, and key obligations', category: 'AI Tools', badge: 'AI', tier: 'PREMIUM', keywords: ['contract', 'legal', 'agreements', 'clauses', 'risk', 'nda', 'contract analyzer'], action: () => window.openToolModal && window.openToolModal('ai-contract', 'Contract Analyzer') },
    { id: 'doc-compare', name: 'Document Comparison', desc: 'Compare two PDFs and highlight additions, deletions and text changes', category: 'AI Tools', badge: 'AI', tier: 'PREMIUM', keywords: ['compare', 'diff', 'difference', 'version', 'changes', 'document comparison'], action: () => window.openToolModal && window.openToolModal('doc-compare', 'Document Comparison') },
    { id: 'invoice-extractor', name: 'Invoice Extractor', desc: 'Extract structured vendor, tax, amount and line-item data into JSON', category: 'AI Tools', badge: 'AI', tier: 'PREMIUM', keywords: ['invoice', 'bill', 'receipt', 'tax', 'extract', 'tables', 'invoice extractor'], action: () => window.openToolModal && window.openToolModal('invoice-extractor', 'Invoice Data Extractor') },
    { id: 'ai-chat', name: 'Chat with PDF', desc: 'Interactive conversation with any PDF document with source citations', category: 'AI Tools', badge: 'AI', tier: 'PREMIUM', keywords: ['chat', 'talk', 'converse', 'ask questions', 'ai', 'chat with pdf'], action: () => window.openToolModal && window.openToolModal('ai-chat', 'Chat with PDF') },
    { id: 'ai-qa', name: 'PDF Q&A', desc: 'Get direct factual answers to specific questions from document pages', category: 'AI Tools', badge: 'AI', tier: 'PREMIUM', keywords: ['qa', 'q&a', 'questions', 'answers', 'query', 'search', 'ask questions'], action: () => window.openToolModal && window.openToolModal('ai-qa', 'PDF Question & Answer') },
    { id: 'ai-extract', name: 'Information Extraction', desc: 'Pull key entities, dates, dollar amounts, and contact details', category: 'AI Tools', badge: 'AI', tier: 'PREMIUM', keywords: ['extract', 'entities', 'names', 'dates', 'amounts', 'regex', 'information extraction'], action: () => window.openToolModal && window.openToolModal('ai-extract', 'Information Extraction') },
    { id: 'ai-insights', name: 'Document Insights', desc: 'Semantic sentiment, reading complexity, and thematic insights', category: 'AI Tools', badge: 'AI', tier: 'PREMIUM', keywords: ['insights', 'themes', 'analytics', 'semantic', 'sentiment', 'document insights'], action: () => window.openToolModal && window.openToolModal('ai-insights', 'Document Insights') },
    { id: 'ai-multi', name: 'Multi-PDF Analysis', desc: 'Cross-document synthesis and comparative insights across files', category: 'AI Tools', badge: 'AI', tier: 'PREMIUM', keywords: ['multi', 'multiple', 'cross', 'batch', 'synthesis', 'multi pdf'], action: () => window.openToolModal && window.openToolModal('ai-multi', 'Multi-PDF Analysis') },
    { id: 'ai-exec-summary', name: 'Executive Summary', desc: 'High-level strategic briefing and executive decision support', category: 'AI Tools', badge: 'AI', tier: 'PREMIUM', keywords: ['executive', 'strategic', 'briefing', 'decision', 'c-level', 'executive summary'], action: () => window.openToolModal && window.openToolModal('ai-exec-summary', 'Executive Summary') },

    // PDF Security Tools
    { id: 'password-protect', name: 'Password Protect PDF', desc: 'Encrypt document with 256-bit AES encryption & restrict permissions', category: 'Security', badge: 'Security', tier: 'FREE', keywords: ['password', 'protect', 'encrypt', 'lock', 'security', 'aes', 'protect pdf', 'password protect'], action: () => window.openToolModal && window.openToolModal('password-protect', 'Password Protect PDF') },
    { id: 'unlock-pdf', name: 'Unlock PDF', desc: 'Remove password protection and printing/editing restrictions', category: 'Security', badge: 'Security', tier: 'FREE', keywords: ['unlock', 'decrypt', 'remove password', 'open', 'unlock pdf'], action: () => window.openToolModal && window.openToolModal('unlock-pdf', 'Unlock PDF') },
    { id: 'watermark-pdf', name: 'Watermark PDF', desc: 'Stamp custom text or image watermarks across all pages', category: 'Security', badge: 'Security', tier: 'FREE', keywords: ['watermark', 'stamp', 'confidential', 'draft', 'logo', 'watermark pdf'], action: () => window.openToolModal && window.openToolModal('watermark-pdf', 'Watermark PDF') },
    { id: 'esign', name: 'E-Signature Workflow', desc: 'Sign PDFs digitally with audit trail and signer tracking', category: 'Security', badge: 'Security', tier: 'FREE', keywords: ['esign', 'sign', 'signature', 'digital signature', 'contract'], action: () => window.openToolModal && window.openToolModal('esign', 'E-Signature Workflow') },
    { id: 'remove-metadata', name: 'Sanitize Metadata', desc: 'Strip author, software, GPS and revision history from PDF', category: 'Security', badge: 'Security', tier: 'FREE', keywords: ['metadata', 'sanitize', 'clean', 'strip', 'privacy', 'hidden', 'remove metadata'], action: () => window.openToolModal && window.openToolModal('remove-metadata', 'Sanitize Metadata') },

    // Business Tools
    { id: 'gen-invoice', name: 'Invoice Generator', desc: 'Create GST-compliant invoices with line items, tax and discounts', category: 'Business', badge: 'Business', tier: 'BUSINESS', keywords: ['invoice', 'bill', 'billing', 'gst', 'tax', 'receipt', 'invoice generator'], action: () => window.openToolModal && window.openToolModal('gen-invoice', 'Invoice Generator') },
    { id: 'gen-offer', name: 'Offer Letter Generator', desc: 'Create job offer letters with salary breakdown and terms', category: 'Business', badge: 'Business', tier: 'BUSINESS', keywords: ['offer', 'letter', 'hr', 'job', 'employment', 'salary', 'offer letter'], action: () => window.openToolModal && window.openToolModal('gen-offer', 'Offer Letter Generator') },
    { id: 'gen-payslip', name: 'Salary Slip Generator', desc: 'Generate monthly salary payslips with allowances and deductions', category: 'Business', badge: 'Business', tier: 'BUSINESS', keywords: ['payslip', 'salary', 'payroll', 'wages', 'earnings', 'salary slip'], action: () => window.openToolModal && window.openToolModal('gen-payslip', 'Salary Slip Generator') },
    { id: 'gen-exp-cert', name: 'Experience Certificate', desc: 'Issue verifiable work experience and relieving letters', category: 'Business', badge: 'Business', tier: 'BUSINESS', keywords: ['experience', 'certificate', 'relieving', 'service', 'employment'], action: () => window.openToolModal && window.openToolModal('gen-exp-cert', 'Experience Certificate') },
    { id: 'gen-bulk', name: 'Bulk Document Generator', desc: 'Batch generate certificates and letters from CSV spreadsheets', category: 'Business', badge: 'Business', tier: 'BUSINESS', keywords: ['bulk', 'batch', 'csv', 'mail merge', 'generate', 'multiple', 'bulk generator'], action: () => window.openToolModal && window.openToolModal('gen-bulk', 'Bulk Document Generator') },
    { id: 'repair-pdf', name: 'PDF Repair', desc: 'Rebuild damaged cross-reference tables and recover salvageable PDF contents', category: 'Business', badge: 'Utility', tier: 'FREE', keywords: ['repair', 'fix', 'recover', 'corrupt', 'damaged', 'xref', 'pdf repair'], action: () => window.openToolModal && window.openToolModal('repair-pdf', 'PDF Repair') },
    { id: 'flatten-pdf', name: 'Flatten PDF', desc: 'Flatten all interactive form fields, signatures, and annotations into static page graphics', category: 'Business', badge: 'Utility', tier: 'FREE', keywords: ['flatten', 'forms', 'annotations', 'lock', 'static', 'flatten pdf'], action: () => window.openToolModal && window.openToolModal('flatten-pdf', 'Flatten PDF') }
  ];

  let currentSearchResults = [];
  let selectedResultIndex = -1;
  let searchDebounceTimer = null;

  function getSearchableWorkspaceItems() {
    const items = [];
    if (Array.isArray(window.currentWorkspaceFolders)) {
      window.currentWorkspaceFolders.forEach(folder => {
        items.push({
          id: `folder-${folder.id}`,
          name: folder.name,
          desc: `Workspace Folder (${folder.documentCount || 0} documents)`,
          category: 'Workspace',
          badge: 'Folder',
          keywords: ['folder', 'directory', folder.name.toLowerCase()],
          action: () => {
            if (window.switchCategory) window.switchCategory('workspace');
            if (window.openWorkspaceFolder) window.openWorkspaceFolder(folder.id, folder.name);
          }
        });
      });
    }
    if (Array.isArray(window.currentWorkspaceDocs)) {
      window.currentWorkspaceDocs.forEach(doc => {
        items.push({
          id: `doc-${doc.id}`,
          name: doc.title || 'Untitled Document',
          desc: `Workspace Document · ${doc.size ? Math.round(doc.size / 1024) + ' KB' : 'PDF'}`,
          category: 'Workspace',
          badge: 'Document',
          keywords: ['document', 'file', 'doc', (doc.title || '').toLowerCase()],
          action: () => {
            if (window.switchCategory) window.switchCategory('workspace');
            if (doc.url) window.open(doc.url, '_blank');
          }
        });
      });
    }
    return items;
  }

  function highlightMatches(text, query) {
    if (!query) return escapeHtml(text);
    const words = query.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return escapeHtml(text);
    const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${escapedWords})`, 'gi');
    return escapeHtml(text).replace(regex, '<mark style="background:rgba(244,185,66,0.35);color:inherit;padding:0 2px;border-radius:2px;">$1</mark>');
  }

  function executeToolSearch(query, activeMode = 'desktop') {
    const q = (query || '').toLowerCase().trim();
    const words = q.split(/\s+/).filter(Boolean);
    const dropdownDesktop = document.getElementById('saas-search-dropdown');
    const dropdownMobile = document.getElementById('saas-search-dropdown-mobile');
    const clearDesktop = document.getElementById('saas-search-clear');
    const clearMobile = document.getElementById('saas-search-clear-mobile');

    if (clearDesktop) clearDesktop.style.display = q ? 'flex' : 'none';
    if (clearMobile) clearMobile.style.display = q ? 'flex' : 'none';

    // Filter page cards simultaneously
    document.querySelectorAll('.saas-tool-card').forEach(card => {
      const title = (card.querySelector('.saas-tool-name')?.textContent || '').toLowerCase();
      const desc = (card.querySelector('.saas-tool-desc')?.textContent || '').toLowerCase();
      const text = `${title} ${desc}`;
      const matches = !q || text.includes(q) || (words.length > 0 && words.every(w => text.includes(w)));
      if (matches) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });

    if (!q) {
      if (dropdownDesktop) { dropdownDesktop.classList.remove('active'); dropdownDesktop.innerHTML = ''; }
      if (dropdownMobile) { dropdownMobile.classList.remove('active'); dropdownMobile.innerHTML = ''; }
      currentSearchResults = [];
      selectedResultIndex = -1;
      return;
    }

    const allItems = [...SEARCH_TOOLS_CATALOG, ...getSearchableWorkspaceItems()];

    // Score and filter matches
    const scored = [];
    allItems.forEach(item => {
      const nameLower = item.name.toLowerCase();
      const descLower = item.desc.toLowerCase();
      const catLower = item.category.toLowerCase();
      const kw = item.keywords || [];
      const combined = `${nameLower} ${descLower} ${catLower} ${kw.join(' ')}`;

      let score = 0;
      if (nameLower === q) score += 100;
      else if (nameLower.startsWith(q)) score += 60;
      else if (nameLower.includes(q)) score += 40;

      if (kw.some(k => k === q)) score += 30;
      else if (kw.some(k => k.includes(q))) score += 15;

      if (descLower.includes(q)) score += 10;
      if (catLower.includes(q)) score += 5;

      // Token-based matching for multi-word queries (e.g. "AI Summarizer", "PDF to Word")
      if (words.length > 1) {
        if (words.every(w => combined.includes(w))) score += 45;
        if (words.every(w => nameLower.includes(w))) score += 35;
      }
      words.forEach(w => {
        if (w.length >= 2) {
          if (nameLower.includes(w)) score += 8;
          if (kw.some(k => k.includes(w))) score += 6;
        }
      });

      if (score > 0) {
        scored.push({ item, score });
      }
    });

    scored.sort((a, b) => b.score - a.score);
    currentSearchResults = scored.map(s => s.item);
    selectedResultIndex = currentSearchResults.length > 0 ? 0 : -1;

    const dropdown = activeMode === 'mobile' ? dropdownMobile : dropdownDesktop;
    const otherDropdown = activeMode === 'mobile' ? dropdownDesktop : dropdownMobile;

    if (otherDropdown) {
      otherDropdown.classList.remove('active');
      otherDropdown.innerHTML = '';
    }

    if (!dropdown) return;

    if (currentSearchResults.length === 0) {
      dropdown.innerHTML = `<div class="saas-search-empty" style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.9rem;">No matching tools or workspace items found for "<strong>${escapeHtml(query)}</strong>"</div>`;
      dropdown.classList.add('active');
      return;
    }

    let html = `<ul class="saas-search-results-list" role="listbox">`;
    currentSearchResults.forEach((item, idx) => {
      const isSelected = idx === selectedResultIndex;
      html += `
        <li class="saas-search-item ${isSelected ? 'selected' : ''}" role="option" aria-selected="${isSelected}" data-index="${idx}" onclick="selectSearchResult(${idx})">
          <div class="saas-search-item-meta" style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:4px;">
            <span class="saas-search-item-badge">${escapeHtml(item.badge || item.category)}</span>
            <span class="tool-tier-badge ${item.tier === 'FREE' ? 'free' : 'pro'}">${item.tier === 'FREE' ? 'Free' : 'PRO'}</span>
          </div>
          <div class="saas-search-item-info">
            <div class="saas-search-item-title">${highlightMatches(item.name, query)}</div>
            <div class="saas-search-item-desc">${escapeHtml(item.desc)}</div>
          </div>
        </li>
      `;
    });
    html += `</ul>`;
    dropdown.innerHTML = html;
    dropdown.classList.add('active');
  }

  window.handleToolSearchInput = function(val, mode = 'desktop') {
    const inputDesktop = document.getElementById('saas-search-input');
    const inputMobile = document.getElementById('saas-search-input-mobile');
    if (mode === 'desktop' && inputMobile && inputMobile.value !== val) {
      inputMobile.value = val;
    } else if (mode === 'mobile' && inputDesktop && inputDesktop.value !== val) {
      inputDesktop.value = val;
    }

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      executeToolSearch(val, mode);
    }, 150);
  };

  window.selectSearchResult = function(index) {
    const item = currentSearchResults[index];
    if (!item) return;

    // Close dropdowns
    const dropdownDesktop = document.getElementById('saas-search-dropdown');
    const dropdownMobile = document.getElementById('saas-search-dropdown-mobile');
    if (dropdownDesktop) { dropdownDesktop.classList.remove('active'); dropdownDesktop.innerHTML = ''; }
    if (dropdownMobile) { dropdownMobile.classList.remove('active'); dropdownMobile.innerHTML = ''; }

    // Clear inputs and restore tool card visibility on pages
    const inputDesktop = document.getElementById('saas-search-input');
    const inputMobile = document.getElementById('saas-search-input-mobile');
    if (inputDesktop) inputDesktop.value = '';
    if (inputMobile) inputMobile.value = '';
    const clearDesktop = document.getElementById('saas-search-clear');
    const clearMobile = document.getElementById('saas-search-clear-mobile');
    if (clearDesktop) clearDesktop.style.display = 'none';
    if (clearMobile) clearMobile.style.display = 'none';
    document.querySelectorAll('.saas-tool-card').forEach(card => {
      card.style.display = 'flex';
    });

    // Execute action
    if (typeof item.action === 'function') {
      item.action();
    }
  };

  window.clearToolSearch = function(mode = 'desktop') {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    const inputDesktop = document.getElementById('saas-search-input');
    const inputMobile = document.getElementById('saas-search-input-mobile');
    if (inputDesktop) inputDesktop.value = '';
    if (inputMobile) inputMobile.value = '';
    executeToolSearch('', mode);
    document.querySelectorAll('.saas-tool-card').forEach(card => {
      card.style.display = 'flex';
    });
    if (mode === 'desktop' && inputDesktop) inputDesktop.focus();
    if (mode === 'mobile' && inputMobile) inputMobile.focus();
  };

  window.filterTools = function(query) {
    executeToolSearch(query, 'desktop');
  };

  function updateActiveSearchItem(dropdown) {
    const items = dropdown.querySelectorAll('.saas-search-item');
    items.forEach((el, idx) => {
      if (idx === selectedResultIndex) {
        el.classList.add('selected');
        el.setAttribute('aria-selected', 'true');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('selected');
        el.setAttribute('aria-selected', 'false');
      }
    });
  }

  function setupSearchKeyNavigation(inputEl, mode) {
    if (!inputEl) return;
    inputEl.addEventListener('keydown', e => {
      const dropdown = document.getElementById(mode === 'mobile' ? 'saas-search-dropdown-mobile' : 'saas-search-dropdown');
      if (!dropdown || !dropdown.classList.contains('active')) {
        if (e.key === 'ArrowDown' && inputEl.value.trim()) {
          executeToolSearch(inputEl.value.trim(), mode);
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentSearchResults.length > 0) {
          selectedResultIndex = (selectedResultIndex + 1) % currentSearchResults.length;
          updateActiveSearchItem(dropdown);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentSearchResults.length > 0) {
          selectedResultIndex = (selectedResultIndex - 1 + currentSearchResults.length) % currentSearchResults.length;
          updateActiveSearchItem(dropdown);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentSearchResults.length > 0) {
          const targetIndex = selectedResultIndex >= 0 ? selectedResultIndex : 0;
          window.selectSearchResult(targetIndex);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        window.clearToolSearch(mode);
      }
    });
  }

  // Close dropdown on outside click
  document.addEventListener('click', e => {
    const deskWrap = document.getElementById('desktop-search-wrap');
    const mobWrap = document.getElementById('mobile-search-wrap');
    if (deskWrap && !deskWrap.contains(e.target)) {
      const d = document.getElementById('saas-search-dropdown');
      if (d) d.classList.remove('active');
    }
    if (mobWrap && !mobWrap.contains(e.target)) {
      const m = document.getElementById('saas-search-dropdown-mobile');
      if (m) m.classList.remove('active');
    }
  });

  // Shortcut Ctrl+K
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const input = document.getElementById('saas-search-input');
      if (input) {
        input.focus();
        input.select();
      }
    }
  });

  function trackRecentTool(categoryId) {
    try {
      const recents = JSON.parse(localStorage.getItem('pdfme-recents') || '[]');
      const updated = [categoryId, ...recents.filter(c => c !== categoryId)].slice(0, 5);
      localStorage.setItem('pdfme-recents', JSON.stringify(updated));
    } catch (e) {}
  }

  // --- 8. Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const savedTheme = localStorage.getItem('pdfme-theme') || 'light';
      applyTheme(savedTheme);

      setupSearchKeyNavigation(document.getElementById('saas-search-input'), 'desktop');
      setupSearchKeyNavigation(document.getElementById('saas-search-input-mobile'), 'mobile');

      const savedUser = localStorage.getItem('pdfme-user');
      if (savedUser) {
        currentUser = JSON.parse(savedUser);
        if (currentUser && currentUser.theme) {
          applyTheme(currentUser.theme);
        }
        updateAuthUI(currentUser);
      }
    } catch (e) {
      console.warn('Initialization error:', e);
    }
  });

  function showToast(msg, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, type);
    }
  }

})();
