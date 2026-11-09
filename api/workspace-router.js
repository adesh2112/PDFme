'use strict';
/**
 * Corporate Workspace Backend Router
 * Multi-tenant architecture with organization isolation, role-based access control,
 * approval workflows, version history, and audit activity logs.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'workspace-data.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory multi-tenant store with JSON persistence
let db = {
  users: [],
  organizations: [],
  documents: [],
  documentVersions: [],
  approvals: [],
  activityLogs: [],
  folders: [],
  payments: []
};

function loadDb() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (!Array.isArray(db.payments)) db.payments = [];
    } catch (e) {
      console.warn('Could not read workspace data file, starting with fresh store');
    }
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to persist workspace data:', e.message);
  }
}

loadDb();

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
}

function generateToken(user) {
  const payload = {
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const payload = JSON.parse(json);
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function getAuthUser(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) return null;
  return db.users.find(u => u.id === payload.userId) || null;
}

function logActivity(orgId, userId, action, target) {
  const log = {
    id: 'ACT-' + Math.random().toString(36).substring(2, 9),
    orgId,
    userId,
    action,
    target,
    timestamp: new Date().toISOString()
  };
  db.activityLogs.unshift(log);
  if (db.activityLogs.length > 500) db.activityLogs.pop();
  saveDb();
  return log;
}

/**
 * Workspace API Request Handler
 */
function handleWorkspaceRequest(req, res, pathName, body) {
  // 1. User Registration
  if (pathName === '/api/auth/register') {
    const { email, password, name, orgName } = body;
    if (!email || !password || !name) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Email, password, and name are required.' }));
      return;
    }

    if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User with this email already exists.' }));
      return;
    }

    const orgId = 'ORG-' + Math.random().toString(36).substring(2, 9);
    const org = {
      id: orgId,
      name: orgName || `${name}'s Organization`,
      plan: 'FREE',
      createdAt: new Date().toISOString()
    };
    db.organizations.push(org);

    const salt = crypto.randomBytes(16).toString('hex');
    const user = {
      id: 'USR-' + Math.random().toString(36).substring(2, 9),
      email: email.toLowerCase(),
      name,
      salt,
      passwordHash: hashPassword(password, salt),
      orgId,
      role: 'ADMIN', // first user in org is Admin
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    saveDb();

    logActivity(orgId, user.id, 'USER_REGISTERED', email);

    const token = generateToken(user);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      organization: org
    }));
    return;
  }

  // 2. User Login
  if (pathName === '/api/auth/login') {
    const { email, password } = body;
    const user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid email or password.' }));
      return;
    }

    const testHash = hashPassword(password || '', user.salt);
    if (testHash !== user.passwordHash) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid email or password.' }));
      return;
    }

    const org = db.organizations.find(o => o.id === user.orgId);
    const token = generateToken(user);
    logActivity(user.orgId, user.id, 'USER_LOGGED_IN', email);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      organization: org
    }));
    return;
  }

  // Authenticated routes beyond this point
  const authUser = getAuthUser(req);
  if (!authUser) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized. Please log in.' }));
    return;
  }

  // 3. Get Current User Profile
  if (pathName === '/api/auth/me') {
    const org = db.organizations.find(o => o.id === authUser.orgId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      user: { id: authUser.id, email: authUser.email, name: authUser.name, role: authUser.role },
      organization: org
    }));
    return;
  }

  // 4. Invite Team Member
  if (pathName === '/api/org/invite') {
    if (authUser.role !== 'ADMIN') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Only organization Admins can invite team members.' }));
      return;
    }

    const { email, role, name } = body;
    if (!email) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Email is required.' }));
      return;
    }

    const validRole = ['ADMIN', 'EDITOR', 'VIEWER'].includes((role || '').toUpperCase()) ? role.toUpperCase() : 'VIEWER';
    const tempSalt = crypto.randomBytes(16).toString('hex');
    const invitedUser = {
      id: 'USR-' + Math.random().toString(36).substring(2, 9),
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      salt: tempSalt,
      passwordHash: hashPassword('Welcome123!', tempSalt),
      orgId: authUser.orgId,
      role: validRole,
      createdAt: new Date().toISOString()
    };

    db.users.push(invitedUser);
    saveDb();
    logActivity(authUser.orgId, authUser.id, 'TEAM_MEMBER_INVITED', email);

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: `Invited ${email} as ${validRole}`,
      member: { id: invitedUser.id, email: invitedUser.email, name: invitedUser.name, role: invitedUser.role }
    }));
    return;
  }

  // 5. Get Documents (Strictly scoped to user's org)
  if (pathName === '/api/workspace/documents') {
    if (req.method === 'GET') {
      const orgDocs = db.documents.filter(d => d.orgId === authUser.orgId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ documents: orgDocs }));
      return;
    }

    if (req.method === 'POST') {
      if (authUser.role === 'VIEWER') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Viewers do not have permission to create documents.' }));
        return;
      }

      const { title, folderId, size, hash } = body;
      const docId = 'DOC-' + Math.random().toString(36).substring(2, 9);
      const newDoc = {
        id: docId,
        orgId: authUser.orgId,
        folderId: folderId || null,
        title: title || 'Untitled Document.pdf',
        version: 1,
        status: 'DRAFT',
        createdBy: authUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.documents.push(newDoc);

      // Create initial version record
      db.documentVersions.push({
        id: 'VER-' + Math.random().toString(36).substring(2, 9),
        docId,
        orgId: authUser.orgId,
        versionNumber: 1,
        size: size || 1024,
        hash: hash || 'sha256-initial',
        createdBy: authUser.id,
        createdAt: new Date().toISOString(),
        notes: 'Initial upload'
      });

      saveDb();
      logActivity(authUser.orgId, authUser.id, 'DOCUMENT_CREATED', newDoc.title);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ document: newDoc }));
      return;
    }
  }

  // 6. Request Approval Workflow
  if (pathName === '/api/workspace/approvals/request') {
    const { docId, notes } = body;
    const doc = db.documents.find(d => d.id === docId && d.orgId === authUser.orgId);
    if (!doc) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Document not found in your organization.' }));
      return;
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
    db.approvals.push(approval);
    saveDb();
    logActivity(authUser.orgId, authUser.id, 'APPROVAL_REQUESTED', doc.title);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Approval workflow initiated', approval }));
    return;
  }

  // 7. Decide Approval (Approve / Reject)
  if (pathName === '/api/workspace/approvals/decide') {
    if (authUser.role !== 'ADMIN' && authUser.role !== 'EDITOR') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Insufficient permissions to approve documents.' }));
      return;
    }

    const { approvalId, decision, comments } = body; // decision: 'APPROVED' or 'REJECTED'
    const approval = db.approvals.find(a => a.id === approvalId && a.orgId === authUser.orgId);
    if (!approval) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Approval record not found.' }));
      return;
    }

    const doc = db.documents.find(d => d.id === approval.docId && d.orgId === authUser.orgId);
    approval.status = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    approval.decidedBy = authUser.id;
    approval.decidedAt = new Date().toISOString();
    approval.comments = comments || '';

    if (doc) {
      doc.status = approval.status;
      doc.updatedAt = new Date().toISOString();
    }

    saveDb();
    logActivity(authUser.orgId, authUser.id, `DOCUMENT_${approval.status}`, doc ? doc.title : 'Document');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `Document ${approval.status}`, approval }));
    return;
  }

  // 8. Document Version History
  if (pathName === '/api/workspace/versions') {
    const { docId } = body;
    const doc = db.documents.find(d => d.id === docId && d.orgId === authUser.orgId);
    if (!doc) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Document not found.' }));
      return;
    }

    const versions = db.documentVersions.filter(v => v.docId === docId && v.orgId === authUser.orgId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ docId, versions }));
    return;
  }

  // 9. Activity Logs (Audit Trail)
  if (pathName === '/api/workspace/activity') {
    const orgLogs = db.activityLogs.filter(l => l.orgId === authUser.orgId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ activityLogs: orgLogs }));
    return;
  }

  // 10. Organization Document Security / Cross-Org Access Check
  if (pathName === '/api/workspace/document-access') {
    const { docId } = body;
    const doc = db.documents.find(d => d.id === docId);
    if (!doc) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Document not found.' }));
      return;
    }

    // STRICT MULTI-TENANT ISOLATION CHECK
    if (doc.orgId !== authUser.orgId) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'FORBIDDEN: Document belongs to another organization. Cross-tenant access is strictly prohibited.'
      }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ document: doc, accessGranted: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Workspace route not found.' }));
}

module.exports = {
  handleWorkspaceRequest,
  generateToken,
  verifyToken,
  getAuthUser,
  logActivity,
  saveDb,
  db
};

