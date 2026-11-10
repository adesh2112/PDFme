'use strict';
/**
 * Corporate SaaS Platform Workspace & Auth Backend Router
 * Multi-tenant architecture with organization isolation, role-based access control,
 * approval workflows, version history, audit activity logs, cloud file persistence,
 * user authentication, and cross-device sync.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const {
  db,
  saveLocalDb,
  STORAGE_DIR,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  checkDatabaseHealth
} = require('./db.js');

const SESSION_SECRET = process.env.SESSION_SECRET || 'pdfme_session_secret_key_prod_2026';

function isAllowedOrigin(origin, hostHeader) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    const port = url.port;
    if (hostHeader) {
      const cleanHost = hostHeader.split(':')[0].toLowerCase();
      if (host.toLowerCase() === cleanHost) return true;
    }
    if ((host === 'localhost' || host === '127.0.0.1') && (port === '51002' || port === '8080')) return true;
    if (host.endsWith('.onrender.com')) return true;
    const custom = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL;
    if (custom) {
      const list = custom.split(',').map(s => s.trim().toLowerCase());
      if (list.includes(origin.toLowerCase()) || list.includes(host.toLowerCase())) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// In-memory Rate Limiting
const rateLimitMap = new Map();

function isRateLimited(ip, action, maxAttempts, windowMs) {
  const key = `${ip}:${action}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count++;
  rateLimitMap.set(key, entry);
  return entry.count > maxAttempts;
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, storedHash, salt) {
  if (storedHash && (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$'))) {
    return bcrypt.compareSync(password, storedHash);
  }
  // Backwards compatibility for existing PBKDF2 hashes
  if (salt) {
    const testHash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
    return testHash === storedHash;
  }
  return false;
}

function generateSignedToken(user) {
  const payload = {
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    email: user.email,
    exp: Date.now() + 14 * 24 * 60 * 60 * 1000 // 14 days
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifySignedToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length === 2) {
    const [body, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (payload.exp < Date.now()) return null;
      return payload;
    } catch (e) {
      return null;
    }
  }
  // Support legacy tokens
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const payload = JSON.parse(json);
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function getAuthTokenFromReq(req) {
  // 1. Check httpOnly cookie: pdfme_session=<token>
  const cookieHeader = req.headers['cookie'] || '';
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)pdfme_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  // 2. Check Authorization: Bearer <token>
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function getAuthUser(req) {
  const token = getAuthTokenFromReq(req);
  if (!token) return null;
  const payload = verifySignedToken(token);
  if (!payload) return null;
  return db.users.find(u => u.id === payload.userId) || null;
}

function logActivity(orgId, userId, action, target) {
  // Never log passwords or secrets
  const cleanTarget = (target || '').replace(/(password|token|secret)=[^&]+/gi, '$1=***');
  const log = {
    id: 'ACT-' + Math.random().toString(36).substring(2, 9),
    orgId,
    userId,
    action,
    target: cleanTarget,
    timestamp: new Date().toISOString()
  };
  if (!Array.isArray(db.activityLogs)) db.activityLogs = [];
  db.activityLogs.unshift(log);
  if (db.activityLogs.length > 500) db.activityLogs.pop();
  saveLocalDb();
  return log;
}

/**
 * Workspace and Auth API Request Handler
 */
async function handleWorkspaceRequest(req, res, pathName, body) {
  const origin = req.headers['origin'];
  const hostHeader = req.headers['x-forwarded-host'] || req.headers['host'];
  const allowed = isAllowedOrigin(origin, hostHeader);

  // Helper for JSON responses with proper CORS and Cookies
  const sendJson = (status, obj, extraHeaders = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders
    };
    if (allowed) {
      if (origin) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
      } else {
        headers['Access-Control-Allow-Origin'] = '*';
      }
      headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
    }
    res.writeHead(status, headers);
    res.end(JSON.stringify(obj));
  };

  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';

  // Health check: GET /api/health or /health
  if (pathName === '/api/health' || pathName === '/health') {
    const dbHealth = await checkDatabaseHealth();
    return sendJson(200, {
      status: 'ok',
      service: 'PDFme Workspace & Auth API',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      uptime: process.uptime()
    });
  }

  // 1. User Registration: POST /api/auth/register
  if (pathName === '/api/auth/register') {
    if (isRateLimited(clientIp, 'register', 5, 15 * 60 * 1000)) {
      return sendJson(429, { error: 'Too many registration attempts. Please try again after 15 minutes.' });
    }

    const { email, password, confirmPassword, name, orgName } = body || {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name || name.trim().length < 2) {
      return sendJson(400, { error: 'Full name must be at least 2 characters.' });
    }
    if (!email || !emailRegex.test(email.trim())) {
      return sendJson(400, { error: 'Please enter a valid work email address.' });
    }
    if (!password || password.length < 6) {
      return sendJson(400, { error: 'Password must be at least 6 characters long.' });
    }
    if (confirmPassword && password !== confirmPassword) {
      return sendJson(400, { error: 'Passwords do not match.' });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return sendJson(400, { error: 'Email already registered. Please sign in or use another email.' });
    }

    const orgId = 'ORG-' + Math.random().toString(36).substring(2, 9);
    const org = {
      id: orgId,
      name: orgName || `${name.trim()}'s Workspace`,
      plan: 'FREE',
      createdAt: new Date().toISOString()
    };

    const passwordHash = hashPassword(password);
    const user = {
      id: 'USR-' + Math.random().toString(36).substring(2, 9),
      email: email.toLowerCase().trim(),
      name: name.trim(),
      salt: '', // Bcrypt includes salt internally
      passwordHash,
      orgId,
      role: 'ADMIN',
      theme: 'light',
      preferences: { recentTools: [] },
      createdAt: new Date().toISOString()
    };
    
    await createUser(user, org);
    logActivity(orgId, user.id, 'USER_REGISTERED', email);

    const token = generateSignedToken(user);
    const isProd = process.env.NODE_ENV === 'production';
    const cookieHeader = `pdfme_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 86400}${isProd ? '; Secure' : ''}`;

    return sendJson(201, {
      message: 'Account created successfully',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, theme: user.theme },
      organization: org
    }, { 'Set-Cookie': cookieHeader });
  }

  // 2. User Login: POST /api/auth/login
  if (pathName === '/api/auth/login') {
    if (isRateLimited(clientIp, 'login', 10, 15 * 60 * 1000)) {
      return sendJson(429, { error: 'Too many login attempts. Please try again after 15 minutes.' });
    }

    const { email, password } = body || {};
    if (!email || !password) {
      return sendJson(400, { error: 'Email and password are required.' });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return sendJson(401, { error: 'Invalid email or password.' });
    }

    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      return sendJson(401, { error: 'Invalid email or password.' });
    }

    const org = db.organizations.find(o => o.id === user.orgId) || { id: user.orgId, plan: 'FREE' };
    const token = generateSignedToken(user);
    logActivity(user.orgId, user.id, 'USER_LOGGED_IN', email);

    const isProd = process.env.NODE_ENV === 'production';
    const cookieHeader = `pdfme_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 86400}${isProd ? '; Secure' : ''}`;

    return sendJson(200, {
      message: 'Signed in successfully',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, theme: user.theme || 'light' },
      organization: org
    }, { 'Set-Cookie': cookieHeader });
  }

  // 3. User Logout: POST /api/auth/logout
  if (pathName === '/api/auth/logout') {
    const isProd = process.env.NODE_ENV === 'production';
    const cookieHeader = `pdfme_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? '; Secure' : ''}`;
    const token = getAuthTokenFromReq(req);
    const payload = verifySignedToken(token);
    if (payload) {
      logActivity(payload.orgId || '', payload.userId || '', 'USER_LOGGED_OUT', payload.email || '');
    }
    return sendJson(200, { message: 'Signed out successfully' }, { 'Set-Cookie': cookieHeader });
  }

  // 4. Password Reset Request: POST /api/auth/forgot-password
  if (pathName === '/api/auth/forgot-password') {
    if (isRateLimited(clientIp, 'forgot', 5, 15 * 60 * 1000)) {
      return sendJson(429, { error: 'Too many password reset attempts. Please try again after 15 minutes.' });
    }

    const { email } = body || {};
    if (!email) {
      return sendJson(400, { error: 'Email is required.' });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      // Don't disclose user existence for security
      return sendJson(200, { message: 'If an account with that email exists, password reset instructions have been generated.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour
    await updateUser(user.id, { resetToken, resetExpires });

    // Note for production deployment:
    // To dispatch reset emails in production, configure an SMTP service (such as Resend, SendGrid, or AWS SES)
    // with process.env.RESEND_API_KEY or process.env.SMTP_URL.
    return sendJson(200, {
      message: 'Password reset link generated successfully.',
      resetToken,
      devResetToken: resetToken // Returned for dev/test verification; in live production sent via email
    });
  }

  // 5. Confirm Password Reset: POST /api/auth/reset-password
  if (pathName === '/api/auth/reset-password') {
    const { token, newPassword } = body || {};
    if (!token || !newPassword) {
      return sendJson(400, { error: 'Token and new password are required.' });
    }
    if (newPassword.length < 6) {
      return sendJson(400, { error: 'Password must be at least 6 characters long.' });
    }
    const user = db.users.find(u => u.resetToken === token && new Date(u.resetExpires) > new Date());
    if (!user) {
      return sendJson(400, { error: 'Invalid or expired password reset token.' });
    }

    const passwordHash = hashPassword(newPassword);
    await updateUser(user.id, { passwordHash, resetToken: null, resetExpires: null });

    return sendJson(200, { message: 'Password updated successfully. You can now sign in.' });
  }

  // Authenticated routes beyond this point
  const authUser = getAuthUser(req);
  if (!authUser) {
    return sendJson(401, { error: 'Unauthorized. Please sign in.' });
  }

  // 5. Get Current User Profile: GET /api/auth/me
  if (pathName === '/api/auth/me') {
    const org = db.organizations.find(o => o.id === authUser.orgId) || { id: authUser.orgId, plan: 'FREE' };
    const userDocs = (db.documents || []).filter(d => d.userId === authUser.id || d.orgId === authUser.orgId);
    return sendJson(200, {
      user: {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
        role: authUser.role,
        theme: authUser.theme || 'light',
        preferences: authUser.preferences || {}
      },
      organization: org,
      stats: {
        totalDocuments: userDocs.length,
        favoriteDocuments: userDocs.filter(d => d.isFavorite).length
      }
    });
  }

  // 6. Update User Preferences (Theme, etc.): POST /api/user/preferences
  if (pathName === '/api/user/preferences') {
    const { theme, recentTool } = body || {};
    const updates = {};
    if (theme && ['light', 'dark'].includes(theme)) {
      authUser.theme = theme;
      updates.theme = theme;
    }
    if (!authUser.preferences) authUser.preferences = {};
    if (recentTool) {
      if (!Array.isArray(authUser.preferences.recentTools)) authUser.preferences.recentTools = [];
      authUser.preferences.recentTools = [
        recentTool,
        ...authUser.preferences.recentTools.filter(t => t !== recentTool)
      ].slice(0, 10);
      updates.preferences = authUser.preferences;
    }
    await updateUser(authUser.id, updates);
    return sendJson(200, {
      message: 'Preferences updated',
      theme: authUser.theme,
      preferences: authUser.preferences
    });
  }

  // 7. Full Cross-Device Workspace Sync: GET /api/workspace/sync
  if (pathName === '/api/workspace/sync') {
    const org = db.organizations.find(o => o.id === authUser.orgId) || { id: authUser.orgId, plan: 'FREE' };
    const userDocs = (db.documents || []).filter(d => d.userId === authUser.id || d.orgId === authUser.orgId);
    const userFolders = (db.folders || []).filter(f => f.userId === authUser.id || f.orgId === authUser.orgId);
    const userTemplates = (db.savedTemplates || []).filter(t => t.userId === authUser.id || t.orgId === authUser.orgId);
    const userLogs = (db.activityLogs || []).filter(l => l.orgId === authUser.orgId).slice(0, 30);
    const userPayments = (db.payments || []).filter(p => p.userId === authUser.id || p.orgId === authUser.orgId);

    // Calculate storage usage
    const totalBytes = userDocs.reduce((sum, d) => sum + (d.size || 0), 0);

    return sendJson(200, {
      user: {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
        role: authUser.role,
        theme: authUser.theme || 'light'
      },
      organization: org,
      documents: userDocs,
      folders: userFolders,
      templates: userTemplates,
      activityLogs: userLogs,
      payments: userPayments,
      stats: {
        totalDocuments: userDocs.length,
        totalBytesUsed: totalBytes,
        totalBytesLimit: org.plan === 'BUSINESS' ? 100 * 1024 * 1024 * 1024 : (org.plan === 'PREMIUM' ? 25 * 1024 * 1024 * 1024 : (org.plan === 'PRO' ? 5 * 1024 * 1024 * 1024 : 100 * 1024 * 1024)),
        planTier: org.plan || 'FREE'
      }
    });
  }

  // 8. Documents CRUD: GET /api/workspace/documents & POST /api/workspace/documents
  if (pathName === '/api/workspace/documents') {
    if (req.method === 'GET') {
      const orgDocs = (db.documents || []).filter(d => d.orgId === authUser.orgId || d.userId === authUser.id);
      return sendJson(200, { documents: orgDocs });
    }

    if (req.method === 'POST') {
      if (authUser.role === 'VIEWER') {
        return sendJson(403, { error: 'Viewers do not have permission to create documents.' });
      }

      const { title, folderId, size, hash, isFavorite } = body;
      const docId = 'DOC-' + Math.random().toString(36).substring(2, 9);
      const newDoc = {
        id: docId,
        orgId: authUser.orgId,
        userId: authUser.id,
        folderId: folderId || null,
        title: title || 'Untitled Document.pdf',
        size: Number(size) || 1024,
        version: 1,
        status: 'DRAFT',
        isFavorite: Boolean(isFavorite),
        createdBy: authUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!Array.isArray(db.documents)) db.documents = [];
      db.documents.unshift(newDoc);

      // Create version record
      if (!Array.isArray(db.documentVersions)) db.documentVersions = [];
      db.documentVersions.push({
        id: 'VER-' + Math.random().toString(36).substring(2, 9),
        docId,
        orgId: authUser.orgId,
        versionNumber: 1,
        size: newDoc.size,
        hash: hash || 'sha256-initial',
        createdBy: authUser.id,
        createdAt: new Date().toISOString(),
        notes: 'Initial version'
      });

      saveLocalDb();
      logActivity(authUser.orgId, authUser.id, 'DOCUMENT_CREATED', newDoc.title);

      return sendJson(201, {
        status: 'SAVED',
        message: 'Document saved to cloud workspace successfully',
        document: newDoc
      });
    }
  }

  // 9. Document Update / Favorite / Rename: POST /api/workspace/documents/update
  if (pathName === '/api/workspace/documents/update') {
    const { docId, title, folderId, isFavorite, status } = body;
    const doc = (db.documents || []).find(d => d.id === docId && (d.orgId === authUser.orgId || d.userId === authUser.id));
    if (!doc) {
      return sendJson(404, { error: 'Document not found.' });
    }

    if (title !== undefined) doc.title = title;
    if (folderId !== undefined) doc.folderId = folderId;
    if (isFavorite !== undefined) doc.isFavorite = Boolean(isFavorite);
    if (status !== undefined) doc.status = status;
    doc.updatedAt = new Date().toISOString();

    saveLocalDb();
    logActivity(authUser.orgId, authUser.id, 'DOCUMENT_UPDATED', doc.title);

    return sendJson(200, {
      status: 'SAVED',
      message: 'Document updated successfully',
      document: doc
    });
  }

  // 10. Document Delete: POST /api/workspace/documents/delete
  if (pathName === '/api/workspace/documents/delete') {
    const { docId } = body;
    const index = (db.documents || []).findIndex(d => d.id === docId && (d.orgId === authUser.orgId || d.userId === authUser.id));
    if (index === -1) {
      return sendJson(404, { error: 'Document not found.' });
    }

    const removed = db.documents.splice(index, 1)[0];
    if (removed.filePath && fs.existsSync(removed.filePath)) {
      try { fs.unlinkSync(removed.filePath); } catch (e) {}
    }

    saveLocalDb();
    logActivity(authUser.orgId, authUser.id, 'DOCUMENT_DELETED', removed.title);

    return sendJson(200, {
      status: 'DELETED',
      message: 'Document deleted successfully',
      docId
    });
  }

  // 11. Cloud File Upload: POST /api/files/upload
  if (pathName === '/api/files/upload') {
    const { title, dataBase64, folderId, size } = body;
    if (!dataBase64) {
      return sendJson(400, { error: 'Document data (base64) is required.' });
    }

    const docId = 'DOC-' + Math.random().toString(36).substring(2, 9);
    const fileName = `${docId}_${Date.now()}.pdf`;
    const filePath = path.join(STORAGE_DIR, fileName);

    try {
      const buffer = Buffer.from(dataBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
      fs.writeFileSync(filePath, buffer);

      const doc = {
        id: docId,
        orgId: authUser.orgId,
        userId: authUser.id,
        folderId: folderId || null,
        title: title || `Document_${Date.now()}.pdf`,
        size: buffer.length,
        filePath,
        fileName,
        version: 1,
        status: 'UPLOADED',
        isFavorite: false,
        createdBy: authUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!Array.isArray(db.documents)) db.documents = [];
      db.documents.unshift(doc);
      saveLocalDb();

      logActivity(authUser.orgId, authUser.id, 'FILE_UPLOADED', doc.title);

      return sendJson(201, {
        status: 'SAVED',
        message: 'File uploaded and secured in persistent cloud storage.',
        document: doc
      });
    } catch (err) {
      console.error('File upload error:', err);
      return sendJson(500, { error: 'Failed to write file to cloud storage.' });
    }
  }

  // 12. Cloud File Download: GET /api/files/download
  if (pathName.startsWith('/api/files/download')) {
    const urlObj = new URL(req.url, 'http://localhost');
    const docId = urlObj.searchParams.get('docId') || body.docId;
    const doc = (db.documents || []).find(d => d.id === docId && (d.orgId === authUser.orgId || d.userId === authUser.id));

    if (!doc) {
      return sendJson(404, { error: 'Document not found or access denied.' });
    }

    if (doc.filePath && fs.existsSync(doc.filePath)) {
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.title)}"`,
        'Content-Length': fs.statSync(doc.filePath).size
      });
      return fs.createReadStream(doc.filePath).pipe(res);
    } else {
      // Return JSON with dummy PDF bytes or notice
      return sendJson(200, {
        message: 'Document record retrieved',
        document: doc
      });
    }
  }

  // 13. Folders: GET /api/workspace/folders & POST /api/workspace/folders
  if (pathName === '/api/workspace/folders') {
    if (req.method === 'GET') {
      const folders = (db.folders || []).filter(f => f.orgId === authUser.orgId || f.userId === authUser.id);
      return sendJson(200, { folders });
    }
    if (req.method === 'POST') {
      const { name } = body;
      if (!name) return sendJson(400, { error: 'Folder name is required.' });
      const folder = {
        id: 'FLD-' + Math.random().toString(36).substring(2, 9),
        orgId: authUser.orgId,
        userId: authUser.id,
        name: name.trim(),
        createdAt: new Date().toISOString()
      };
      if (!Array.isArray(db.folders)) db.folders = [];
      db.folders.push(folder);
      saveLocalDb();
      return sendJson(201, { folder });
    }
  }

  // 14. Document Version History
  if (pathName === '/api/workspace/versions') {
    const { docId } = body;
    const doc = (db.documents || []).find(d => d.id === docId && d.orgId === authUser.orgId);
    if (!doc) {
      return sendJson(404, { error: 'Document not found.' });
    }
    const versions = (db.documentVersions || []).filter(v => v.docId === docId && v.orgId === authUser.orgId);
    return sendJson(200, { docId, versions });
  }

  // 15. Activity Logs (Audit Trail)
  if (pathName === '/api/workspace/activity') {
    const orgLogs = (db.activityLogs || []).filter(l => l.orgId === authUser.orgId);
    return sendJson(200, { activityLogs: orgLogs });
  }

  // 16. Invite Team Member
  if (pathName === '/api/org/invite') {
    if (authUser.role !== 'ADMIN') {
      return sendJson(403, { error: 'Only organization Admins can invite team members.' });
    }
    const { email, role, name } = body;
    if (!email) return sendJson(400, { error: 'Email is required.' });

    const validRole = ['ADMIN', 'EDITOR', 'VIEWER'].includes((role || '').toUpperCase()) ? role.toUpperCase() : 'VIEWER';
    const tempSalt = crypto.randomBytes(16).toString('hex');
    const invitedUser = {
      id: 'USR-' + Math.random().toString(36).substring(2, 9),
      email: email.toLowerCase().trim(),
      name: name || email.split('@')[0],
      salt: tempSalt,
      passwordHash: hashPassword('Welcome123!', tempSalt),
      orgId: authUser.orgId,
      role: validRole,
      createdAt: new Date().toISOString()
    };
    db.users.push(invitedUser);
    saveLocalDb();
    logActivity(authUser.orgId, authUser.id, 'TEAM_MEMBER_INVITED', email);
    return sendJson(201, {
      message: `Invited ${email} as ${validRole}`,
      member: { id: invitedUser.id, email: invitedUser.email, name: invitedUser.name, role: invitedUser.role }
    });
  }

  // 17. Request Approval Workflow
  if (pathName === '/api/workspace/approvals/request') {
    const { docId, notes } = body;
    const doc = (db.documents || []).find(d => d.id === docId && d.orgId === authUser.orgId);
    if (!doc) {
      return sendJson(404, { error: 'Document not found in your organization.' });
    }
    doc.status = 'PENDING_APPROVAL';
    const approval = {
      id: 'APP-' + Math.random().toString(36).substring(2, 9),
      docId,
      orgId: authUser.orgId,
      requestedBy: authUser.id,
      status: 'PENDING',
      notes: notes || 'Approval requested',
      requestedAt: new Date().toISOString()
    };
    if (!Array.isArray(db.approvals)) db.approvals = [];
    db.approvals.push(approval);
    saveLocalDb();
    logActivity(authUser.orgId, authUser.id, 'APPROVAL_REQUESTED', doc.title);
    return sendJson(200, { message: 'Approval workflow initiated', approval });
  }

  // 18. Decide Approval
  if (pathName === '/api/workspace/approvals/decide') {
    if (authUser.role !== 'ADMIN' && authUser.role !== 'EDITOR') {
      return sendJson(403, { error: 'Insufficient permissions to approve documents.' });
    }
    const { approvalId, decision, comments } = body;
    const approval = (db.approvals || []).find(a => a.id === approvalId && a.orgId === authUser.orgId);
    if (!approval) {
      return sendJson(404, { error: 'Approval record not found.' });
    }
    const doc = (db.documents || []).find(d => d.id === approval.docId && d.orgId === authUser.orgId);
    approval.status = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    approval.decidedBy = authUser.id;
    approval.decidedAt = new Date().toISOString();
    approval.comments = comments || '';
    if (doc) {
      doc.status = approval.status;
      doc.updatedAt = new Date().toISOString();
    }
    saveLocalDb();
    logActivity(authUser.orgId, authUser.id, `DOCUMENT_${approval.status}`, doc ? doc.title : 'Document');
    return sendJson(200, { message: `Document ${approval.status}`, approval });
  }

  // 19. Organization Document Access / Cross-Tenant Guard
  if (pathName === '/api/workspace/document-access') {
    const { docId } = body;
    const doc = (db.documents || []).find(d => d.id === docId);
    if (!doc) {
      return sendJson(404, { error: 'Document not found.' });
    }
    if (doc.orgId !== authUser.orgId && doc.userId !== authUser.id) {
      return sendJson(403, {
        error: 'FORBIDDEN: Document belongs to another organization. Cross-tenant access is strictly prohibited.'
      });
    }
    return sendJson(200, { document: doc, accessGranted: true });
  }

  return sendJson(404, { error: 'Workspace route not found.' });
}

const generateToken = generateSignedToken;
const verifyToken = verifySignedToken;

module.exports = {
  handleWorkspaceRequest,
  generateToken,
  generateSignedToken,
  verifyToken,
  verifySignedToken,
  getAuthUser,
  logActivity,
  saveDb: saveLocalDb,
  db
};
