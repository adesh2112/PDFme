'use strict';
/**
 * PDFme Database & Persistence Layer
 * Dual-engine persistence:
 * 1. PostgreSQL (via 'pg' when DATABASE_URL is configured, e.g. on Render)
 * 2. High-performance JSON file store (data/workspace-data.json) as robust fallback
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'workspace-data.json');
const STORAGE_DIR = path.join(DATA_DIR, 'storage');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

let db = {
  users: [],
  organizations: [],
  documents: [],
  documentVersions: [],
  folders: [],
  savedTemplates: [],
  payments: [],
  activityLogs: [],
  processedWebhooks: []
};

// Check for PostgreSQL availability
let pgPool = null;
let usePostgres = false;

if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    usePostgres = true;
    console.log('[DB] PostgreSQL pool configured with DATABASE_URL');
  } catch (err) {
    console.warn('[DB] "pg" module not installed or PostgreSQL connection failed. Using local persistent storage.', err.message);
    usePostgres = false;
  }
}

// Load local database file
function loadLocalDb() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      db.users = Array.isArray(parsed.users) ? parsed.users : [];
      db.organizations = Array.isArray(parsed.organizations) ? parsed.organizations : [];
      db.documents = Array.isArray(parsed.documents) ? parsed.documents : [];
      db.documentVersions = Array.isArray(parsed.documentVersions) ? parsed.documentVersions : [];
      db.folders = Array.isArray(parsed.folders) ? parsed.folders : [];
      db.savedTemplates = Array.isArray(parsed.savedTemplates) ? parsed.savedTemplates : [];
      db.payments = Array.isArray(parsed.payments) ? parsed.payments : [];
      db.activityLogs = Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [];
      db.processedWebhooks = Array.isArray(parsed.processedWebhooks) ? parsed.processedWebhooks : [];
    } catch (e) {
      console.warn('[DB] Could not parse local database file, using clean memory store:', e.message);
    }
  }
}

function saveLocalDb() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('[DB] Failed to save local database file:', e.message);
  }
}

// Initialize PostgreSQL schema if active
async function initPgSchema() {
  if (!usePostgres || !pgPool) return;
  try {
    const client = await pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS organizations (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          plan VARCHAR(32) DEFAULT 'FREE',
          plan_expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          salt VARCHAR(64) NOT NULL,
          org_id VARCHAR(64) REFERENCES organizations(id),
          role VARCHAR(32) DEFAULT 'ADMIN',
          theme VARCHAR(16) DEFAULT 'light',
          preferences JSONB DEFAULT '{}'::jsonb,
          reset_token VARCHAR(128),
          reset_expires TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
        CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);

        CREATE TABLE IF NOT EXISTS folders (
          id VARCHAR(64) PRIMARY KEY,
          org_id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS documents (
          id VARCHAR(64) PRIMARY KEY,
          org_id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NOT NULL,
          folder_id VARCHAR(64),
          title VARCHAR(255) NOT NULL,
          size BIGINT DEFAULT 0,
          status VARCHAR(32) DEFAULT 'DRAFT',
          file_path TEXT,
          hash VARCHAR(128),
          is_favorite BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS document_versions (
          id VARCHAR(64) PRIMARY KEY,
          doc_id VARCHAR(64) NOT NULL,
          org_id VARCHAR(64) NOT NULL,
          version_number INT DEFAULT 1,
          size BIGINT DEFAULT 0,
          hash VARCHAR(128),
          created_by VARCHAR(64) NOT NULL,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS payments (
          id VARCHAR(64) PRIMARY KEY,
          order_id VARCHAR(128) NOT NULL,
          payment_id VARCHAR(128),
          signature VARCHAR(255),
          amount_paise INT NOT NULL,
          amount_inr INT NOT NULL,
          currency VARCHAR(10) DEFAULT 'INR',
          plan_key VARCHAR(64),
          plan_tier VARCHAR(32),
          billing_cycle VARCHAR(32),
          status VARCHAR(32) DEFAULT 'VERIFIED',
          user_id VARCHAR(64),
          user_email VARCHAR(255),
          org_id VARCHAR(64),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
          id VARCHAR(64) PRIMARY KEY,
          org_id VARCHAR(64),
          user_id VARCHAR(64),
          action VARCHAR(128) NOT NULL,
          target TEXT,
          timestamp TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      console.log('[DB] PostgreSQL tables verified and ready.');

      // Hydrate in-memory db from PostgreSQL on startup
      const usersRes = await client.query('SELECT * FROM users');
      if (usersRes.rows.length > 0) {
        db.users = usersRes.rows.map(mapUserRow);
      }
      const orgsRes = await client.query('SELECT * FROM organizations');
      if (orgsRes.rows.length > 0) {
        db.organizations = orgsRes.rows.map(mapOrgRow);
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[DB] PostgreSQL schema initialization error:', err.message);
  }
}

// Map PostgreSQL row to User object
function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    salt: row.salt,
    orgId: row.org_id,
    role: row.role || 'ADMIN',
    theme: row.theme || 'light',
    preferences: typeof row.preferences === 'string' ? JSON.parse(row.preferences) : (row.preferences || {}),
    resetToken: row.reset_token || null,
    resetExpires: row.reset_expires ? new Date(row.reset_expires).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

function mapOrgRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    plan: row.plan || 'FREE',
    planExpiresAt: row.plan_expires_at || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

// Database helper functions
async function findUserByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();

  if (usePostgres && pgPool) {
    try {
      const res = await pgPool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
      if (res.rows.length > 0) {
        const user = mapUserRow(res.rows[0]);
        // Keep in-memory cache synchronized
        const idx = db.users.findIndex(u => u.email.toLowerCase() === cleanEmail);
        if (idx >= 0) db.users[idx] = user;
        else db.users.push(user);
        return user;
      }
    } catch (err) {
      console.warn('[DB] PostgreSQL findUserByEmail error, using local fallback:', err.message);
    }
  }
  return db.users.find(u => u.email.toLowerCase() === cleanEmail) || null;
}

async function findUserById(id) {
  if (!id) return null;
  if (usePostgres && pgPool) {
    try {
      const res = await pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (res.rows.length > 0) {
        return mapUserRow(res.rows[0]);
      }
    } catch (err) {
      console.warn('[DB] PostgreSQL findUserById error, using local fallback:', err.message);
    }
  }
  return db.users.find(u => u.id === id) || null;
}

async function createUser(user, org) {
  if (usePostgres && pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      if (org) {
        await client.query(`
          INSERT INTO organizations (id, name, plan, created_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING
        `, [org.id, org.name, org.plan || 'FREE', org.createdAt || new Date().toISOString()]);
      }
      await client.query(`
        INSERT INTO users (id, email, name, password_hash, salt, org_id, role, theme, preferences, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        user.id,
        user.email.toLowerCase().trim(),
        user.name.trim(),
        user.passwordHash,
        user.salt,
        user.orgId,
        user.role || 'ADMIN',
        user.theme || 'light',
        JSON.stringify(user.preferences || {}),
        user.createdAt || new Date().toISOString()
      ]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[DB] PostgreSQL createUser transaction failed:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  // Always update in-memory and persistent local JSON store
  if (org && !db.organizations.some(o => o.id === org.id)) {
    db.organizations.push(org);
  }
  db.users.push(user);
  saveLocalDb();
  return user;
}

async function updateUser(id, updates) {
  if (!id) return null;

  if (usePostgres && pgPool) {
    try {
      const setClauses = [];
      const values = [];
      let i = 1;

      if (updates.passwordHash !== undefined) {
        setClauses.push(`password_hash = $${i++}`);
        values.push(updates.passwordHash);
      }
      if (updates.salt !== undefined) {
        setClauses.push(`salt = $${i++}`);
        values.push(updates.salt);
      }
      if (updates.theme !== undefined) {
        setClauses.push(`theme = $${i++}`);
        values.push(updates.theme);
      }
      if (updates.preferences !== undefined) {
        setClauses.push(`preferences = $${i++}`);
        values.push(JSON.stringify(updates.preferences));
      }
      if (updates.resetToken !== undefined) {
        setClauses.push(`reset_token = $${i++}`);
        values.push(updates.resetToken);
      }
      if (updates.resetExpires !== undefined) {
        setClauses.push(`reset_expires = $${i++}`);
        values.push(updates.resetExpires);
      }

      if (setClauses.length > 0) {
        values.push(id);
        const query = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${i}`;
        await pgPool.query(query, values);
      }
    } catch (err) {
      console.warn('[DB] PostgreSQL updateUser error:', err.message);
    }
  }

  // Always update local store
  const user = db.users.find(u => u.id === id);
  if (user) {
    Object.assign(user, updates);
    saveLocalDb();
  }
  return user;
}

async function checkDatabaseHealth() {
  if (usePostgres && pgPool) {
    try {
      const start = Date.now();
      const res = await pgPool.query('SELECT 1 + 1 AS check_result, NOW() AS server_time');
      const latencyMs = Date.now() - start;
      return {
        connected: true,
        type: 'postgresql',
        latencyMs,
        serverTime: res.rows[0].server_time,
        pool: {
          total: pgPool.totalCount,
          idle: pgPool.idleCount,
          waiting: pgPool.waitingCount
        }
      };
    } catch (err) {
      return {
        connected: false,
        type: 'postgresql',
        error: err.message,
        fallbackActive: true,
        fallbackType: 'persistent_json_file'
      };
    }
  }

  return {
    connected: true,
    type: 'persistent_json_file',
    filePath: DATA_FILE,
    usersCount: db.users.length,
    organizationsCount: db.organizations.length,
    documentsCount: (db.documents || []).length
  };
}

// Initial load
loadLocalDb();
if (usePostgres) {
  initPgSchema().catch(e => console.warn('[DB] PG init warning:', e.message));
}

module.exports = {
  db,
  loadLocalDb,
  saveLocalDb,
  STORAGE_DIR,
  usePostgres,
  pgPool,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  checkDatabaseHealth,
  initPgSchema
};

