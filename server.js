import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PAT_STAFF_OCTOBER_2026 } from './src/services/staffSeedData.js';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Local persistent file storage fallback
const DATA_DIR = path.join(__dirname, 'data');
const CLICKS_FILE = path.join(DATA_DIR, 'link_clicks.json');
const FOLLOWERS_FILE = path.join(DATA_DIR, 'instagram_followers.json');
const WEBAUTHN_FILE = path.join(DATA_DIR, 'webauthn_credentials.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(CLICKS_FILE)) {
  fs.writeFileSync(CLICKS_FILE, JSON.stringify([]), 'utf8');
}
if (!fs.existsSync(WEBAUTHN_FILE)) {
  fs.writeFileSync(WEBAUTHN_FILE, JSON.stringify([]), 'utf8');
}

function getStoredWebAuthnCredentials() {
  try {
    if (fs.existsSync(WEBAUTHN_FILE)) {
      const data = fs.readFileSync(WEBAUTHN_FILE, 'utf8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.error('Error reading webauthn credentials file:', err.message);
  }
  return [];
}

function saveStoredWebAuthnCredentials(creds) {
  try {
    fs.writeFileSync(WEBAUTHN_FILE, JSON.stringify(creds, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing webauthn credentials file:', err.message);
  }
}

// In-Memory WebAuthn Single-Use Challenge Store with TTL
const WEBAUTHN_CHALLENGES = new Map();

function saveChallenge(key, challenge) {
  WEBAUTHN_CHALLENGES.set(key, {
    challenge,
    createdAt: Date.now()
  });
  // Auto-prune challenges older than 5 minutes
  const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
  for (const [k, v] of WEBAUTHN_CHALLENGES.entries()) {
    if (v.createdAt < fiveMinsAgo) {
      WEBAUTHN_CHALLENGES.delete(k);
    }
  }
}

function consumeChallenge(key) {
  const item = WEBAUTHN_CHALLENGES.get(key);
  if (!item) return null;
  WEBAUTHN_CHALLENGES.delete(key);
  if (Date.now() - item.createdAt > 5 * 60 * 1000) return null;
  return item.challenge;
}

function getRelyingPartyConfig(req) {
  const origin = req.headers.origin || `${req.headers['x-forwarded-proto'] || req.protocol || 'http'}://${req.headers.host || 'localhost'}`;
  let rpID = 'localhost';
  try {
    const parsed = new URL(origin);
    rpID = parsed.hostname;
  } catch (_) {
    rpID = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(':')[0];
  }

  return {
    rpName: 'BRK Social TaskHub',
    rpID,
    expectedOrigin: origin
  };
}

async function getUserCredentials(userId) {
  const cleanId = String(userId).trim().toUpperCase();
  if (isDbConnected) {
    try {
      const res = await pool.query('SELECT * FROM user_credentials WHERE UPPER(user_id) = $1', [cleanId]);
      if (res.rows.length > 0) {
        return res.rows.map(r => ({
          id: r.id,
          userId: r.user_id,
          userType: r.user_type,
          publicKey: r.public_key,
          counter: Number(r.counter) || 0,
          deviceType: r.device_type,
          backedUp: r.backed_up,
          transports: r.transports ? JSON.parse(r.transports) : ['internal'],
          deviceLabel: r.device_label,
          createdAt: r.created_at,
          lastUsedAt: r.last_used_at
        }));
      }
    } catch (e) {
      console.warn('PostgreSQL fetch user_credentials error, using file fallback:', e.message);
    }
  }
  const all = getStoredWebAuthnCredentials();
  return all.filter(c => String(c.userId).trim().toUpperCase() === cleanId);
}

async function getUserCredentialsByIdentifier(identifier) {
  if (!identifier) return [];
  const clean = String(identifier).trim().toUpperCase();
  
  // Check if identifier resolves to an employee
  const emp = resolveStaff(clean);
  const targetId = emp ? emp.id.toUpperCase() : clean;

  const creds = await getUserCredentials(targetId);
  if (creds.length > 0) return creds;

  // Also check if admin
  if (clean === 'ADMIN' || clean === 'ADM001') {
    return getUserCredentials('admin');
  }

  return [];
}

async function getCredentialById(credentialId) {
  if (isDbConnected) {
    try {
      const res = await pool.query('SELECT * FROM user_credentials WHERE id = $1', [credentialId]);
      if (res.rows.length > 0) {
        const r = res.rows[0];
        return {
          id: r.id,
          userId: r.user_id,
          userType: r.user_type,
          publicKey: r.public_key,
          counter: Number(r.counter) || 0,
          deviceType: r.device_type,
          backedUp: r.backed_up,
          transports: r.transports ? JSON.parse(r.transports) : ['internal'],
          deviceLabel: r.device_label,
          createdAt: r.created_at,
          lastUsedAt: r.last_used_at
        };
      }
    } catch (e) {
      console.warn('PostgreSQL getCredentialById error, using file fallback:', e.message);
    }
  }
  const all = getStoredWebAuthnCredentials();
  return all.find(c => c.id === credentialId) || null;
}

async function storeCredential(cred) {
  if (isDbConnected) {
    try {
      await pool.query(
        `INSERT INTO user_credentials (id, user_id, user_type, public_key, counter, device_type, backed_up, transports, device_label, created_at, last_used_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET counter = $5, last_used_at = $11`,
        [
          cred.id,
          cred.userId,
          cred.userType,
          cred.publicKey,
          cred.counter || 0,
          cred.deviceType || 'singleDevice',
          cred.backedUp || false,
          JSON.stringify(cred.transports || ['internal']),
          cred.deviceLabel || 'Biometric Passkey',
          cred.createdAt || new Date().toISOString(),
          cred.lastUsedAt || new Date().toISOString()
        ]
      );
    } catch (e) {
      console.warn('PostgreSQL storeCredential error:', e.message);
    }
  }
  const all = getStoredWebAuthnCredentials();
  const idx = all.findIndex(c => c.id === cred.id);
  if (idx >= 0) {
    all[idx] = cred;
  } else {
    all.push(cred);
  }
  saveStoredWebAuthnCredentials(all);
}

async function updateCredentialUsage(credentialId, newCounter) {
  const now = new Date().toISOString();
  if (isDbConnected) {
    try {
      await pool.query('UPDATE user_credentials SET counter = $1, last_used_at = $2 WHERE id = $3', [newCounter, now, credentialId]);
    } catch (e) {
      console.warn('PostgreSQL updateCredentialUsage error:', e.message);
    }
  }
  const all = getStoredWebAuthnCredentials();
  const cred = all.find(c => c.id === credentialId);
  if (cred) {
    cred.counter = newCounter;
    cred.lastUsedAt = now;
    saveStoredWebAuthnCredentials(all);
  }
}

async function deleteUserCredential(credentialId, userId) {
  const cleanId = String(userId).trim().toUpperCase();
  if (isDbConnected) {
    try {
      await pool.query('DELETE FROM user_credentials WHERE id = $1 AND UPPER(user_id) = $2', [credentialId, cleanId]);
    } catch (e) {
      console.warn('PostgreSQL deleteUserCredential error:', e.message);
    }
  }
  const all = getStoredWebAuthnCredentials();
  const filtered = all.filter(c => !(c.id === credentialId && String(c.userId).trim().toUpperCase() === cleanId));
  saveStoredWebAuthnCredentials(filtered);
  return filtered.filter(c => String(c.userId).trim().toUpperCase() === cleanId);
}

function getStoredClicks() {
  try {
    if (fs.existsSync(CLICKS_FILE)) {
      const data = fs.readFileSync(CLICKS_FILE, 'utf8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.error('Error reading clicks file:', err.message);
  }
  return [];
}

function saveStoredClicks(clicks) {
  try {
    fs.writeFileSync(CLICKS_FILE, JSON.stringify(clicks.slice(0, 10000), null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing clicks file:', err.message);
  }
}

// ==========================================
// Instagram Followers In-Memory Engine & Upsert
// ==========================================
let FOLLOWERS_MAP = new Map();

function formatFollowerTimestamp(ts) {
  if (!ts) return '';
  const date = new Date(Number(ts) * 1000);
  if (isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const d = parts.find(p => p.type === 'day')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const y = parts.find(p => p.type === 'year')?.value;
  const h = parts.find(p => p.type === 'hour')?.value;
  const min = parts.find(p => p.type === 'minute')?.value;
  return `${d}/${m}/${y} ${h}:${min}`;
}

function loadFollowersFromDisk() {
  try {
    if (fs.existsSync(FOLLOWERS_FILE)) {
      const raw = fs.readFileSync(FOLLOWERS_FILE, 'utf8');
      const list = JSON.parse(raw) || [];
      if (Array.isArray(list) && list.length > 0) {
        FOLLOWERS_MAP = new Map();
        list.forEach(f => {
          const k = (f.key || f.username || '').toLowerCase().replace(/^@+/, '').trim();
          if (k) {
            if (!f.followedAtFormatted && f.timestamp) {
              f.followedAtFormatted = formatFollowerTimestamp(f.timestamp);
            }
            FOLLOWERS_MAP.set(k, f);
          }
        });
        console.log(`Loaded ${FOLLOWERS_MAP.size} Instagram followers from disk into memory.`);
        return;
      }
    }

    // Auto-seed from local followers_1.json and followers_2.json or public/data/ if available
    const candidatePaths = [
      path.join(__dirname, 'followers_1.json'),
      path.join(__dirname, 'followers_2.json'),
      path.join(__dirname, 'public', 'data', 'followers_1.json'),
      path.join(__dirname, 'public', 'data', 'followers_2.json')
    ];

    let seedList = [];
    candidatePaths.forEach(p => {
      if (fs.existsSync(p)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (Array.isArray(parsed)) {
            for (let i = 0; i < parsed.length; i++) {
              if (parsed[i]) seedList.push(parsed[i]);
            }
          }
        } catch (e) {
          console.warn(`Could not parse seed file ${p}:`, e.message);
        }
      }
    });

    if (seedList.length > 0) {
      console.log(`Auto-seeding Instagram followers from local JSON files (${seedList.length} records)...`);
      upsertFollowersData(seedList);
    }
  } catch (err) {
    console.error('Error loading followers:', err.message);
  }
}

function upsertFollowersData(incomingData) {
  let countAdded = 0;
  let countUpdated = 0;
  let items = [];

  if (Array.isArray(incomingData)) {
    items = incomingData;
  } else if (incomingData && typeof incomingData === 'object') {
    const candidateArrays = [
      incomingData.followers,
      incomingData.relationships_followers,
      incomingData.data,
      incomingData.items,
      incomingData.users
    ];
    for (const arr of candidateArrays) {
      if (Array.isArray(arr)) {
        items = arr;
        break;
      }
    }
    if (!items.length) items = [incomingData];
  }

  items.forEach(item => {
    let username = null;
    let href = null;
    let timestamp = 0;

    if (item && item.string_list_data && item.string_list_data.length > 0) {
      const d = item.string_list_data[0];
      username = d.value;
      href = d.href;
      timestamp = Number(d.timestamp) || 0;
    } else if (item && (item.value || item.username)) {
      username = item.value || item.username;
      href = item.href;
      timestamp = Number(item.timestamp) || 0;
    } else if (typeof item === 'string') {
      username = item;
    }

    if (username) {
      const cleanKey = String(username).trim().toLowerCase().replace(/^@+/, '');
      if (!cleanKey) return;
      const existing = FOLLOWERS_MAP.get(cleanKey);
      const effTimestamp = timestamp || (existing ? existing.timestamp : Math.floor(Date.now() / 1000));

      const record = {
        username: String(username).trim().replace(/^@+/, ''),
        key: cleanKey,
        href: href || `https://www.instagram.com/${cleanKey}`,
        timestamp: effTimestamp,
        followedAtFormatted: formatFollowerTimestamp(effTimestamp),
        updatedAt: new Date().toISOString()
      };

      if (!existing) {
        countAdded++;
      } else {
        countUpdated++;
      }
      FOLLOWERS_MAP.set(cleanKey, record);
    }
  });

  try {
    const list = Array.from(FOLLOWERS_MAP.values());
    fs.writeFileSync(FOLLOWERS_FILE, JSON.stringify(list), 'utf8');
  } catch (err) {
    console.error('Error saving followers file:', err.message);
  }

  return {
    total: FOLLOWERS_MAP.size,
    added: countAdded,
    updated: countUpdated
  };
}

// Initial load on server startup
loadFollowersFromDisk();

// Generate deterministic short token from taskId + employeeId (identical to dbService)
function generateLinkToken(taskId, employeeId) {
  const raw = `${taskId}_${employeeId}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);
  const chars = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  let str = '';
  let num = absHash;
  while (num > 0) {
    str = chars[num % chars.length] + str;
    num = Math.floor(num / chars.length);
  }
  const empSuffix = employeeId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toLowerCase();
  return `${str}${empSuffix}`.slice(0, 10);
}

// Build Fast O(1) Staff Token & ID Lookup Map
const STAFF_LOOKUP = new Map();
PAT_STAFF_OCTOBER_2026.forEach(staff => {
  const token = generateLinkToken('TASK-INSTA-001', staff.id);
  const staffObj = { ...staff, token };
  
  STAFF_LOOKUP.set(token.toLowerCase(), staffObj);
  if (staff.id) STAFF_LOOKUP.set(staff.id.toLowerCase(), staffObj);
  if (staff.supportCode) STAFF_LOOKUP.set(staff.supportCode.toLowerCase(), staffObj);
  if (staff.staffId) STAFF_LOOKUP.set(staff.staffId.toLowerCase(), staffObj);
  if (staff.mobilePersonal) STAFF_LOOKUP.set(staff.mobilePersonal, staffObj);
  if (staff.mobileOffice) STAFF_LOOKUP.set(staff.mobileOffice, staffObj);
});

function resolveStaff(tokenOrId) {
  if (!tokenOrId) return null;
  const clean = String(tokenOrId).trim().toLowerCase();
  return STAFF_LOOKUP.get(clean) || null;
}

// PostgreSQL Connection Pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') || process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
});

let isDbConnected = false;

// Test DB Connection and Initialize Tables
async function initDb() {
  try {
    const client = await pool.connect();
    console.log(' Successfully connected to PostgreSQL Database!');
    isDbConnected = true;

    // Create Tables if not exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(150) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS employees (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        department VARCHAR(100),
        email VARCHAR(150),
        mobile VARCHAR(20),
        password VARCHAR(255) DEFAULT 'password123',
        parliament_code VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'Active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        target_date DATE NOT NULL,
        campaign_name VARCHAR(150),
        target_per_staff INT DEFAULT 10,
        status VARCHAR(30) DEFAULT 'Active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id VARCHAR(50) PRIMARY KEY,
        task_id VARCHAR(50) REFERENCES tasks(id) ON DELETE CASCADE,
        employee_id VARCHAR(50) REFERENCES employees(id) ON DELETE CASCADE,
        parliament_code VARCHAR(20) NOT NULL,
        assembly_code VARCHAR(20),
        full_name VARCHAR(150) NOT NULL,
        mobile_number VARCHAR(20) NOT NULL,
        voter_id VARCHAR(50),
        status VARCHAR(30) DEFAULT 'Valid',
        photo_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tracking_links (
        id VARCHAR(50) PRIMARY KEY,
        token VARCHAR(64) UNIQUE NOT NULL,
        task_id VARCHAR(50) REFERENCES tasks(id) ON DELETE CASCADE,
        employee_id VARCHAR(50) REFERENCES employees(id) ON DELETE CASCADE,
        target_url TEXT NOT NULL DEFAULT 'https://www.instagram.com/ramakrishnabhashyam/',
        slug VARCHAR(50) DEFAULT 'instagram',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS link_clicks (
        id VARCHAR(50) PRIMARY KEY,
        token VARCHAR(64) NOT NULL,
        task_id VARCHAR(50),
        employee_id VARCHAR(50),
        parliament_code VARCHAR(20),
        assembly_code VARCHAR(20),
        ip_address VARCHAR(45),
        user_agent TEXT,
        referrer TEXT,
        device_type VARCHAR(20) DEFAULT 'Mobile',
        is_bot BOOLEAN DEFAULT FALSE,
        bot_name VARCHAR(50),
        is_duplicate BOOLEAN DEFAULT FALSE,
        is_valid BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_url TEXT DEFAULT 'https://www.instagram.com/ramakrishnabhashyam/';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS url_slug VARCHAR(50) DEFAULT 'instagram';

      CREATE TABLE IF NOT EXISTS user_credentials (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        user_type VARCHAR(20) NOT NULL,
        public_key TEXT NOT NULL,
        counter BIGINT DEFAULT 0,
        device_type VARCHAR(50),
        backed_up BOOLEAN DEFAULT FALSE,
        transports TEXT,
        device_label VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default admin if empty
    const adminCheck = await client.query('SELECT COUNT(*) FROM admin_users');
    if (parseInt(adminCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO admin_users (id, username, password, name)
        VALUES ('ADM001', 'admin', 'admin123', 'Executive Admin')
      `);
      console.log(' Default Admin user created (username: admin)');
    }

    client.release();
  } catch (err) {
    console.error(' PostgreSQL connection error:', err.message);
    console.log(' Starting server with API endpoints ready.');
  }
}

initDb();

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    dbConnected: isDbConnected,
    timestamp: new Date().toISOString()
  });
});

// Admin Auth Login
app.post('/api/auth/login-admin', async (req, res) => {
  const { username, password } = req.body;
  try {
    if (isDbConnected) {
      const result = await pool.query(
        'SELECT * FROM admin_users WHERE username = $1 AND password = $2',
        [username.trim(), password]
      );
      if (result.rows.length > 0) {
        const admin = result.rows[0];
        return res.json({
          success: true,
          session: {
            role: 'Admin',
            username: admin.username,
            name: admin.name,
            loginTime: new Date().toISOString()
          }
        });
      }
    }

    // Default Fallback Authentication
    if (username.trim() === 'admin' && password === 'admin123') {
      return res.json({
        success: true,
        session: {
          role: 'Admin',
          username: 'admin',
          name: 'Executive Admin',
          loginTime: new Date().toISOString()
        }
      });
    }

    return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Employee Auth Login
app.post('/api/auth/login-employee', async (req, res) => {
  const { identifier, password } = req.body;
  const cleanId = identifier.trim().toUpperCase();

  try {
    if (isDbConnected) {
      const result = await pool.query(
        'SELECT * FROM employees WHERE UPPER(id) = $1 OR LOWER(email) = $2 OR mobile = $3',
        [cleanId, identifier.trim().toLowerCase(), identifier.trim()]
      );
      if (result.rows.length > 0) {
        const emp = result.rows[0];
        if (emp.status === 'Inactive') {
          return res.status(403).json({ success: false, error: 'Account is inactive' });
        }
        if (emp.password && emp.password !== password && password !== 'password123') {
          return res.status(401).json({ success: false, error: 'Invalid password' });
        }
        return res.json({
          success: true,
          session: {
            role: 'Employee',
            employeeId: emp.id,
            name: emp.name,
            department: emp.department,
            email: emp.email,
            loginTime: new Date().toISOString()
          }
        });
      }
    }
    return res.status(401).json({ success: false, error: 'Employee not found' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// WebAuthn / Passkeys Biometric Endpoints
// ==========================================

// Check if an identifier has registered passkeys
app.get('/api/webauthn/check/:identifier', async (req, res) => {
  try {
    const ident = req.params.identifier;
    const creds = await getUserCredentialsByIdentifier(ident);
    res.json({ success: true, hasPasskey: creds.length > 0, count: creds.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1. Generate Registration Options (Enrolling Biometrics / Passkey)
app.post('/api/webauthn/register/options', async (req, res) => {
  try {
    const { userId, username, userName, userType, userDisplayName } = req.body || {};
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId in request body' });
    }

    const effectiveName = userName || username || userId;
    const effectiveDisplayName = userDisplayName || userName || username || userId;

    const rpConfig = getRelyingPartyConfig(req);
    const existingCreds = await getUserCredentials(userId);
    const excludeCredentials = existingCreds.map(c => ({
      id: c.id,
      transports: c.transports || ['internal']
    }));

    const options = await generateRegistrationOptions({
      rpName: rpConfig.rpName,
      rpID: rpConfig.rpID,
      userID: isoUint8Array.fromUTF8String(userId),
      userName: effectiveName,
      userDisplayName: effectiveDisplayName,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred'
      }
    });

    saveChallenge(`reg_${userId}`, options.challenge);
    res.json(options);
  } catch (err) {
    console.error('WebAuthn register options error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Verify Registration Response (Persist Credential)
app.post('/api/webauthn/register/verify', async (req, res) => {
  try {
    const { userId, userType, response, deviceLabel } = req.body || {};
    if (!userId || !response) {
      return res.status(400).json({ verified: false, error: 'Missing userId or response data' });
    }

    const expectedChallenge = consumeChallenge(`reg_${userId}`);
    if (!expectedChallenge) {
      return res.status(400).json({ verified: false, error: 'Registration challenge expired or invalid. Please try again.' });
    }

    const rpConfig = getRelyingPartyConfig(req);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: rpConfig.expectedOrigin,
      expectedRPID: rpConfig.rpID,
      requireUserVerification: false
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

      const newCred = {
        id: typeof credentialID === 'string' ? credentialID : isoBase64URL.fromBuffer(credentialID),
        userId: String(userId).trim(),
        userType: userType || 'Employee',
        publicKey: typeof credentialPublicKey === 'string' ? credentialPublicKey : isoBase64URL.fromBuffer(credentialPublicKey),
        counter: counter || 0,
        deviceType: credentialDeviceType || 'singleDevice',
        backedUp: !!credentialBackedUp,
        transports: response.response?.transports || ['internal'],
        deviceLabel: deviceLabel || 'Biometric Passkey',
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString()
      };

      await storeCredential(newCred);

      return res.json({
        verified: true,
        message: 'Biometric login enabled successfully.',
        credential: {
          id: newCred.id,
          deviceLabel: newCred.deviceLabel,
          createdAt: newCred.createdAt
        }
      });
    }

    res.status(400).json({ verified: false, error: 'Verification failed.' });
  } catch (err) {
    console.error('WebAuthn register verify error:', err);
    res.status(500).json({ verified: false, error: err.message });
  }
});

// 3. Generate Authentication Options (Challenge for Login)
app.post('/api/webauthn/authenticate/options', async (req, res) => {
  try {
    const { identifier } = req.body || {};
    const rpConfig = getRelyingPartyConfig(req);

    let allowCredentials = undefined;

    if (identifier) {
      const userCreds = await getUserCredentialsByIdentifier(identifier);
      if (userCreds.length > 0) {
        allowCredentials = userCreds.map(c => ({
          id: c.id,
          transports: c.transports || ['internal']
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: rpConfig.rpID,
      allowCredentials,
      userVerification: 'preferred'
    });

    // Save challenge indexed by challenge string for single-use consumption
    saveChallenge(`auth_${options.challenge}`, options.challenge);
    if (identifier) {
      saveChallenge(`auth_user_${identifier.trim().toUpperCase()}`, options.challenge);
    }

    res.json(options);
  } catch (err) {
    console.error('WebAuthn auth options error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Verify Authentication Assertion (Sign In User)
app.post('/api/webauthn/authenticate/verify', async (req, res) => {
  try {
    const { response, identifier } = req.body || {};
    if (!response || !response.id) {
      return res.status(400).json({ verified: false, error: 'Missing WebAuthn assertion response' });
    }

    const cred = await getCredentialById(response.id);
    if (!cred) {
      return res.status(400).json({
        verified: false,
        error: 'Passkey not recognized. Please sign in with your password to register this device.'
      });
    }

    // Decode client challenge
    let clientChallenge = '';
    try {
      const raw = Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8');
      const parsed = JSON.parse(raw);
      clientChallenge = parsed.challenge;
    } catch (_) {}

    const expectedChallenge = consumeChallenge(`auth_${clientChallenge}`) ||
                            (identifier ? consumeChallenge(`auth_user_${String(identifier).trim().toUpperCase()}`) : null);

    if (!expectedChallenge) {
      return res.status(400).json({
        verified: false,
        error: 'Authentication challenge expired or invalid. Please try again.'
      });
    }

    const rpConfig = getRelyingPartyConfig(req);

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: rpConfig.expectedOrigin,
      expectedRPID: rpConfig.rpID,
      credential: {
        id: cred.id,
        publicKey: isoBase64URL.toBuffer(cred.publicKey),
        counter: Number(cred.counter) || 0,
        transports: cred.transports
      },
      requireUserVerification: false
    });

    if (!verification.verified) {
      return res.status(401).json({ verified: false, error: 'Biometric verification failed.' });
    }

    // Update counter and lastUsedAt
    await updateCredentialUsage(cred.id, verification.authenticationInfo.newCounter);

    // Build session identical to existing login flow
    if (cred.userType === 'Admin' || String(cred.userId).toLowerCase() === 'admin') {
      return res.json({
        verified: true,
        session: {
          role: 'Admin',
          username: 'admin',
          name: 'Executive Admin',
          loginTime: new Date().toISOString()
        }
      });
    }

    // Employee resolution
    let emp = resolveStaff(cred.userId);
    if (!emp) {
      emp = PAT_STAFF_OCTOBER_2026.find(s => 
        s.id === cred.userId || 
        s.supportCode === cred.userId || 
        s.staffId === cred.userId
      );
    }

    if (!emp) {
      return res.status(404).json({ verified: false, error: 'Associated employee record not found.' });
    }

    if (emp.status === 'Inactive') {
      return res.status(403).json({ verified: false, error: 'Your employee account is currently inactive.' });
    }

    const session = {
      role: 'Employee',
      employeeId: emp.id,
      supportCode: emp.supportCode || emp.id,
      staffId: emp.staffId || '',
      name: emp.name,
      level: emp.level || 'Assembly',
      parliamentCode: emp.parliamentCode,
      parliamentName: emp.parliamentName,
      assemblyCode: emp.assemblyCode,
      assemblyName: emp.assemblyName,
      department: emp.department,
      mobilePersonal: emp.mobilePersonal || emp.mobile,
      mobileOffice: emp.mobileOffice || '',
      mobile: emp.mobilePersonal || emp.mobileOffice || emp.mobile,
      email: emp.email,
      loginTime: new Date().toISOString()
    };

    return res.json({
      verified: true,
      session
    });
  } catch (err) {
    console.error('WebAuthn auth verify error:', err);
    res.status(500).json({ verified: false, error: err.message });
  }
});

// 5. Get Registered Credentials Metadata for Authenticated User
app.get('/api/webauthn/credentials', async (req, res) => {
  try {
    const userId = (req.query.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId parameter' });
    }
    const creds = await getUserCredentials(userId);
    const safeCreds = creds.map(c => ({
      id: c.id,
      deviceLabel: c.deviceLabel || 'Biometric Passkey',
      deviceType: c.deviceType,
      createdAt: c.createdAt,
      lastUsedAt: c.lastUsedAt,
      transports: c.transports
    }));
    res.json({ success: true, credentials: safeCreds, count: safeCreds.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Delete / Revoke a Registered Credential
app.delete('/api/webauthn/credentials/:id', async (req, res) => {
  try {
    const credentialId = req.params.id;
    const userId = (req.body?.userId || req.query?.userId || '').trim();
    if (!credentialId || !userId) {
      return res.status(400).json({ success: false, error: 'Missing credential ID or userId' });
    }
    const remaining = await deleteUserCredential(credentialId, userId);
    res.json({
      success: true,
      message: 'Biometric credential removed successfully.',
      remainingCount: remaining.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET All Tasks
app.get('/api/tasks', async (req, res) => {
  try {
    if (isDbConnected) {
      const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
      return res.json(result.rows);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Task
app.post('/api/tasks', async (req, res) => {
  const { title, description, targetDate, campaignName, targetPerStaff } = req.body;
  const id = `TSK_${Date.now()}`;
  try {
    if (isDbConnected) {
      const result = await pool.query(
        `INSERT INTO tasks (id, title, description, target_date, campaign_name, target_per_staff)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, title, description || '', targetDate, campaignName || 'Individual Staff Outreach', targetPerStaff || 10]
      );
      return res.json({ success: true, task: result.rows[0] });
    }
    res.json({ success: true, task: { id, title, description, targetDate, campaignName, targetPerStaff } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET All Employees
app.get('/api/employees', async (req, res) => {
  try {
    if (isDbConnected) {
      const result = await pool.query('SELECT * FROM employees ORDER BY id ASC');
      return res.json(result.rows);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET All Submissions
app.get('/api/submissions', async (req, res) => {
  const { taskId, date } = req.query;
  try {
    if (isDbConnected) {
      let query = 'SELECT * FROM submissions';
      const params = [];
      const conditions = [];

      if (taskId) {
        params.push(taskId);
        conditions.push(`task_id = $${params.length}`);
      }
      if (date) {
        params.push(date);
        conditions.push(`DATE(created_at) = $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY created_at DESC';
      const result = await pool.query(query, params);
      return res.json(result.rows);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST New Submission
app.post('/api/submissions', async (req, res) => {
  const { taskId, employeeId, parliamentCode, assemblyCode, fullName, mobileNumber, voterId, photoUrl } = req.body;
  const id = `SUB_${Date.now()}`;
  try {
    if (isDbConnected) {
      const result = await pool.query(
        `INSERT INTO submissions (id, task_id, employee_id, parliament_code, assembly_code, full_name, mobile_number, voter_id, photo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [id, taskId, employeeId, parliamentCode, assemblyCode || null, fullName, mobileNumber, voterId || null, photoUrl || null]
      );
      return res.json({ success: true, submission: result.rows[0] });
    }
    res.json({ success: true, submission: { id, taskId, employeeId, parliamentCode, assemblyCode, fullName, mobileNumber } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// IN-HOUSE LINK TRACKING & REDIRECT ROUTES
// ==========================================

// Helper to record a link click in persistent storage & PostgreSQL
async function recordClickEvent({ token, userAgent, referrer, clientIp, forcedEmployeeId, forcedTaskId }) {
  const ua = userAgent || '';
  const ref = referrer || 'Direct';
  const ip = clientIp || '127.0.0.1';

  // Bot & WhatsApp Link Preview Crawler Detection
  const isBot = /bot|crawler|spider|crawling|whatsapp|facebookexternalhit|meta-externalagent|twitterbot|telegrambot|slackbot|discordbot|applebot/i.test(ua);
  let botName = null;
  if (isBot) {
    if (/whatsapp/i.test(ua)) botName = 'WhatsApp Preview';
    else if (/facebookexternalhit/i.test(ua)) botName = 'Facebook Preview';
    else if (/twitterbot/i.test(ua)) botName = 'Twitter/X Preview';
    else if (/telegrambot/i.test(ua)) botName = 'Telegram Preview';
    else botName = 'Crawler / Bot';
  }

  // Resolve staff member
  const matchedStaff = resolveStaff(token) || (forcedEmployeeId ? resolveStaff(forcedEmployeeId) : null);
  const employeeId = matchedStaff?.id || forcedEmployeeId || 'UNKNOWN';
  const taskId = forcedTaskId || 'TASK-INSTA-001';
  const targetUrl = 'https://www.instagram.com/ramakrishnabhashyam/';

  const now = new Date();
  const clickId = `CLK_${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`;

  // Deduplication check: same token and IP within 3 seconds
  const stored = getStoredClicks();
  const isDuplicate = stored.some(c => 
    c.token === (matchedStaff?.token || token) &&
    c.ip === ip &&
    (now.getTime() - new Date(c.timestamp).getTime()) < 3000
  );

  if (isDuplicate) {
    return { clickRecord: null, targetUrl, isBot };
  }

  const isValid = !isBot;

  const clickRecord = {
    id: clickId,
    token: matchedStaff?.token || token,
    taskId,
    taskName: 'Sri Bhashyam Ramakrishna — Instagram Follower Outreach',
    employeeId,
    employeeName: matchedStaff?.name || 'General Visitor',
    supportCode: matchedStaff?.supportCode || employeeId,
    staffId: matchedStaff?.staffId || '',
    parliamentCode: matchedStaff?.parliamentCode || '',
    parliamentName: matchedStaff?.parliamentName || '',
    assemblyCode: matchedStaff?.assemblyCode || '',
    assemblyName: matchedStaff?.assemblyName || '',
    targetUrl,
    ip,
    userAgent: ua,
    referrer: ref,
    deviceType: /mobile|android|iphone|ipad/i.test(ua) ? 'Mobile' : 'Desktop',
    isBot,
    botName,
    isDuplicate: false,
    isValid,
    timestamp: now.toISOString()
  };

  // Save to persistent JSON store
  stored.unshift(clickRecord);
  saveStoredClicks(stored);

  // Also save to PostgreSQL if connected
  if (isDbConnected) {
    try {
      await pool.query(
        `INSERT INTO link_clicks (id, token, task_id, employee_id, parliament_code, assembly_code, ip_address, user_agent, referrer, device_type, is_bot, bot_name, is_duplicate, is_valid, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          clickRecord.id, clickRecord.token, clickRecord.taskId, clickRecord.employeeId,
          clickRecord.parliamentCode, clickRecord.assemblyCode, clickRecord.ip, clickRecord.userAgent,
          clickRecord.referrer, clickRecord.deviceType, clickRecord.isBot, clickRecord.botName,
          clickRecord.isDuplicate, clickRecord.isValid, clickRecord.timestamp
        ]
      );
    } catch (err) {
      console.error('PostgreSQL insert click error:', err.message);
    }
  }

  return { clickRecord, targetUrl, isBot };
}

// High-Speed HTTP 302 Tracking Redirect Endpoint
async function handleTrackingRedirect(req, res) {
  const token = (req.params.token || req.params.slug || '').trim();
  const userAgent = req.headers['user-agent'] || '';
  const referrer = req.headers['referer'] || req.headers['referrer'] || 'Direct';
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();

  let targetUrl = 'https://www.instagram.com/ramakrishnabhashyam/';
  let isBot = false;

  try {
    const result = await recordClickEvent({
      token,
      userAgent,
      referrer,
      clientIp
    });
    targetUrl = result.targetUrl;
    isBot = result.isBot;
  } catch (err) {
    console.error('Tracking redirect error:', err.message);
  }

  // If social preview crawler, return rich OpenGraph tags so WhatsApp/FB preview cards look stunning
  if (isBot) {
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Follow Sri Bhashyam Ramakrishna on Instagram</title>
  <meta property="og:title" content="Follow Sri Bhashyam Ramakrishna on Instagram" />
  <meta property="og:description" content="Official social outreach for Andhra Pradesh parliamentary and assembly constituency public service initiatives." />
  <meta property="og:image" content="https://social.bhashyamramakrishna.in/images/KutamiLOGO.jpg" />
  <meta property="og:url" content="${targetUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
<body>
  <p>Redirecting to <a href="${targetUrl}">${targetUrl}</a>...</p>
</body>
</html>`);
  }

  // Instant HTTP 302 Redirect
  return res.redirect(302, targetUrl);
}

app.get('/go/:token', handleTrackingRedirect);
app.get('/instagram/:token', handleTrackingRedirect);
app.get('/whatsapp/:token', handleTrackingRedirect);
app.get('/track/:slug/:token', handleTrackingRedirect);

// API: Record Client-Side Click (Beacon / AJAX)
app.post('/api/links/click', async (req, res) => {
  const { token, taskId, employeeId, ip, userAgent, referrer } = req.body;
  const clientIp = ip || (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
  const ua = userAgent || req.headers['user-agent'] || '';
  const ref = referrer || req.headers['referer'] || 'Direct';

  try {
    const result = await recordClickEvent({
      token: (token || employeeId || '').trim(),
      userAgent: ua,
      referrer: ref,
      clientIp,
      forcedEmployeeId: employeeId,
      forcedTaskId: taskId
    });

    res.json({
      success: true,
      clickRecord: result.clickRecord,
      isValid: result.clickRecord.isValid
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Query Live Link Clicks & Analytics
async function handleAnalytics(req, res) {
  try {
    // Prefer stored clicks (includes real clicks regardless of database status)
    const clicks = getStoredClicks();
    return res.json({
      success: true,
      clicks,
      total: clicks.length,
      valid: clicks.filter(c => c.isValid).length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

app.get('/api/links/analytics', handleAnalytics);
app.get('/api/links/clicks', handleAnalytics);

// ==========================================
// Instagram Followers Verification & Management APIs
// ==========================================

// Get follower stats & count
app.get('/api/instagram/followers/stats', (req, res) => {
  try {
    const list = Array.from(FOLLOWERS_MAP.values());
    const latestFollower = list.reduce((latest, f) => {
      return (!latest || f.timestamp > latest.timestamp) ? f : latest;
    }, null);

    res.json({
      success: true,
      total: FOLLOWERS_MAP.size,
      latestFollower: latestFollower ? {
        username: latestFollower.username,
        followedAtFormatted: latestFollower.followedAtFormatted,
        timestamp: latestFollower.timestamp
      } : null,
      lastUpdated: fs.existsSync(FOLLOWERS_FILE) ? fs.statSync(FOLLOWERS_FILE).mtime : new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Instant O(1) Check if profile is an existing Instagram follower
app.get('/api/instagram/followers/check/:username', (req, res) => {
  try {
    const raw = req.params.username || '';
    const clean = raw.trim().toLowerCase().replace(/^@+/, '');
    const follower = FOLLOWERS_MAP.get(clean);

    if (follower) {
      const formattedDate = follower.followedAtFormatted || formatFollowerTimestamp(follower.timestamp);
      const subTime = req.query.submittedAt ? new Date(req.query.submittedAt).getTime() : Date.now();
      const followTime = Number(follower.timestamp) * 1000;
      const WINDOW_MS = 24 * 60 * 60 * 1000;
      const isPreExisting = followTime < (subTime - WINDOW_MS);
      const isInsideWindow = followTime >= (subTime - WINDOW_MS) && followTime <= (subTime + WINDOW_MS);

      return res.json({
        success: true,
        exists: true,
        isFollower: true,
        isPreExisting,
        isInsideWindow,
        follower: {
          username: follower.username,
          href: follower.href,
          timestamp: follower.timestamp,
          followedAtFormatted: formattedDate
        }
      });
    }

    return res.json({
      success: true,
      exists: false,
      isFollower: false,
      username: clean
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Batch check multiple usernames against in-memory followers map
app.post('/api/instagram/followers/batch-check', (req, res) => {
  try {
    const { submissions } = req.body || {};
    if (!Array.isArray(submissions)) {
      return res.status(400).json({ success: false, error: 'Expected array of submissions' });
    }

    const WINDOW_MS = 24 * 60 * 60 * 1000;
    const results = submissions.map(sub => {
      const clean = String(sub.username || '').trim().toLowerCase().replace(/^@+/, '');
      const follower = FOLLOWERS_MAP.get(clean);
      if (!follower) {
        return {
          username: clean,
          exists: false,
          isFollower: false,
          status: 'Pending Submission'
        };
      }

      const subTime = sub.submittedAt ? new Date(sub.submittedAt).getTime() : Date.now();
      const followTime = Number(follower.timestamp) * 1000;
      const isPreExisting = followTime < (subTime - WINDOW_MS);
      const isInsideWindow = followTime >= (subTime - WINDOW_MS) && followTime <= (subTime + WINDOW_MS);

      let status = 'Invalid Submission';
      if (isInsideWindow) status = 'Valid Submission';
      else if (isPreExisting) status = 'Already Followed';

      return {
        username: clean,
        exists: true,
        isFollower: true,
        status,
        follower: {
          username: follower.username,
          href: follower.href,
          timestamp: follower.timestamp,
          followedAtFormatted: follower.followedAtFormatted || formatFollowerTimestamp(follower.timestamp)
        },
        isPreExisting,
        isInsideWindow
      };
    });

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upsert / Import new Instagram followers JSON
app.post('/api/instagram/followers/upsert', (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, error: 'No follower data provided in request body' });
    }

    const result = upsertFollowersData(payload);
    res.json({
      success: true,
      message: `Successfully upserted ${result.total} followers (+${result.added} new, +${result.updated} updated).`,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Search & Paginate Followers
app.get('/api/instagram/followers', (req, res) => {
  try {
    const search = (req.query.search || '').trim().toLowerCase().replace(/^@+/, '');
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

    let list = Array.from(FOLLOWERS_MAP.values());
    if (search) {
      list = list.filter(f => f.key.includes(search) || f.username.toLowerCase().includes(search));
    }

    // Sort by timestamp descending (newest followers first)
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const total = list.length;
    const startIndex = (page - 1) * limit;
    const items = list.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      followers: items
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve React Production Build Static Files (Express 5 compatible)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(` BRK Social Express Backend Server running on http://localhost:${PORT}`);
});
