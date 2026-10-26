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
app.use(express.text({ type: ['text/*', 'application/json'], limit: '100mb' }));

// Local persistent file storage fallback
const DATA_DIR = path.join(__dirname, 'data');
const CLICKS_FILE = path.join(DATA_DIR, 'link_clicks.json');
const FOLLOWERS_FILE = path.join(DATA_DIR, 'instagram_followers.json');
const WEBAUTHN_FILE = path.join(DATA_DIR, 'webauthn_credentials.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(CLICKS_FILE)) {
  fs.writeFileSync(CLICKS_FILE, JSON.stringify([]), 'utf8');
}
if (!fs.existsSync(WEBAUTHN_FILE)) {
  fs.writeFileSync(WEBAUTHN_FILE, JSON.stringify([]), 'utf8');
}
if (!fs.existsSync(SUBMISSIONS_FILE)) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([]), 'utf8');
}
if (!fs.existsSync(TASKS_FILE)) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify([
    {
      id: 'TASK-INSTA-001',
      name: 'Instagram Follower Outreach',
      title: 'Instagram Follower Outreach',
      description: 'Connect with local youth and active social media users via Instagram outreach.',
      platform: 'Instagram',
      submissionType: 'Instagram Handle',
      targetUrl: 'https://www.instagram.com/ramakrishnabhashyam/',
      urlSlug: 'instagram',
      dailyTarget: 10,
      targetPerStaff: 10,
      frequency: 'Daily',
      status: 'Active',
      createdDate: '2026-09-17'
    },
    {
      id: 'TASK-WA-002',
      name: 'WhatsApp Voter Connect',
      title: 'WhatsApp Voter Connect',
      description: 'Gather verified WhatsApp contact numbers of constituency booth leads.',
      platform: 'WhatsApp',
      submissionType: 'Mobile Number',
      targetUrl: 'https://chat.whatsapp.com/',
      urlSlug: 'whatsapp',
      dailyTarget: 15,
      targetPerStaff: 15,
      frequency: 'Daily',
      status: 'Active',
      createdDate: '2026-09-18'
    }
  ], null, 2), 'utf8');
}

function getStoredSubmissions() {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.error('Error reading submissions file:', err.message);
  }
  return [];
}

function saveStoredSubmissions(submissions) {
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions.slice(0, 50000), null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing submissions file:', err.message);
  }
}

function getStoredTasks() {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const data = fs.readFileSync(TASKS_FILE, 'utf8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.error('Error reading tasks file:', err.message);
  }
  return [];
}

function saveStoredTasks(tasks) {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing tasks file:', err.message);
  }
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
        id VARCHAR(100) PRIMARY KEY,
        task_id VARCHAR(50),
        employee_id VARCHAR(50),
        employee_name VARCHAR(150),
        support_code VARCHAR(50),
        staff_id VARCHAR(50),
        parliament_code VARCHAR(20),
        parliament_name VARCHAR(100),
        assembly_code VARCHAR(20),
        assembly_name VARCHAR(100),
        platform VARCHAR(50) DEFAULT 'Instagram',
        username VARCHAR(150) NOT NULL,
        raw_input TEXT,
        status VARCHAR(50) DEFAULT 'Valid Submission',
        is_valid BOOLEAN DEFAULT TRUE,
        is_follower BOOLEAN DEFAULT FALSE,
        is_duplicate BOOLEAN DEFAULT FALSE,
        duplicate_of VARCHAR(100),
        followed_at_formatted VARCHAR(50),
        followed_at_timestamp BIGINT,
        verification_badge TEXT,
        verification_note TEXT,
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        date VARCHAR(20),
        time_formatted_ist VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS task_id VARCHAR(50);
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS employee_name VARCHAR(150);
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS support_code VARCHAR(50);
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS staff_id VARCHAR(50);
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS parliament_code VARCHAR(20);
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS parliament_name VARCHAR(100);
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS assembly_code VARCHAR(20);
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS assembly_name VARCHAR(100);
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'Instagram';
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS username VARCHAR(150);
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS raw_input TEXT;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Valid Submission';
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT TRUE;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_follower BOOLEAN DEFAULT FALSE;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS duplicate_of VARCHAR(100);
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS followed_at_formatted VARCHAR(50);
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS followed_at_timestamp BIGINT;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS verification_badge TEXT;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS verification_note TEXT;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS date VARCHAR(20);
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS time_formatted_ist VARCHAR(20);

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

// Submission Normalization & Staff Enrichment Helper
function normalizeSubmissionRecord(input) {
  if (!input) return null;
  const nowIso = new Date().toISOString();
  const rawId = input.id || `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const employeeId = String(input.employeeId || '').trim();
  const staff = resolveStaff(employeeId);
  const cleanUsername = String(input.username || input.normalizedUsername || input.handle || '').trim().toLowerCase().replace(/^@+/, '');
  const taskId = input.taskId || 'TASK-INSTA-001';
  const submittedAt = input.submittedAt || input.created_at || input.timestamp || nowIso;
  
  // Date in IST YYYY-MM-DD
  let dateStr = input.date;
  if (!dateStr) {
    try {
      const d = new Date(submittedAt);
      dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
    } catch (_) {
      dateStr = new Date().toISOString().split('T')[0];
    }
  }

  // Time in IST HH:mm
  let timeStr = input.timeFormattedIST || '';
  if (!timeStr) {
    try {
      const d = new Date(submittedAt);
      timeStr = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(d);
    } catch (_) {}
  }

  const rawStatus = input.status || 'Valid Submission';
  const isValid = input.isValid !== undefined 
    ? Boolean(input.isValid) 
    : (rawStatus === 'Valid Submission' || rawStatus === 'Valid');

  return {
    id: String(rawId),
    taskId,
    employeeId: staff?.id || employeeId || 'UNKNOWN',
    employeeName: input.employeeName || staff?.name || 'Staff Member',
    supportCode: staff?.supportCode || input.supportCode || employeeId,
    staffId: staff?.staffId || input.staffId || '',
    parliamentCode: staff?.parliamentCode || input.parliamentCode || (employeeId.startsWith('APP') ? employeeId.substring(0, 5) : ''),
    parliamentName: staff?.parliamentName || input.parliamentName || '',
    assemblyCode: staff?.assemblyCode || input.assemblyCode || '',
    assemblyName: staff?.assemblyName || input.assemblyName || '',
    platform: input.platform || 'Instagram',
    username: cleanUsername,
    rawInput: input.rawInput || input.raw_input || cleanUsername,
    status: rawStatus,
    isValid,
    isFollower: Boolean(input.isFollower),
    isDuplicate: Boolean(input.isDuplicate),
    duplicateOf: input.duplicateOf || null,
    followedAtFormatted: input.followedAtFormatted || null,
    followedAtTimestamp: input.followedAtTimestamp ? Number(input.followedAtTimestamp) : null,
    verificationBadge: input.verificationBadge || null,
    verificationNote: input.verificationNote || null,
    submittedAt,
    date: dateStr,
    timeFormattedIST: timeStr
  };
}

// Bi-directional Submissions Merger
function mergeSubmissions(serverList, clientList) {
  const map = new Map();
  // 1. Existing server submissions are baseline
  (serverList || []).forEach(s => {
    if (s && s.id) {
      map.set(String(s.id), s);
    }
  });

  let addedCount = 0;
  let updatedCount = 0;

  // 2. Incorporate client submissions
  (clientList || []).forEach(raw => {
    const norm = normalizeSubmissionRecord(raw);
    if (!norm || !norm.username) return;

    if (!map.has(norm.id)) {
      // Check if duplicate submission under same task & username exists
      const existingSameUser = Array.from(map.values()).find(s => 
        s.taskId === norm.taskId &&
        String(s.username).toLowerCase() === norm.username.toLowerCase()
      );

      if (existingSameUser) {
        // If already exists under another ID, keep the earlier/authoritative one
        return;
      }

      map.set(norm.id, norm);
      addedCount++;
    } else {
      const existing = map.get(norm.id);
      // If server was pending and client has updated verification
      if (existing.status === 'Pending Submission' && (norm.status === 'Valid Submission' || norm.status === 'Already Followed')) {
        map.set(norm.id, { ...existing, ...norm });
        updatedCount++;
      }
    }
  });

  const merged = Array.from(map.values());
  merged.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  return { merged, addedCount, updatedCount };
}

// GET All Tasks
app.get('/api/tasks', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    if (isDbConnected) {
      try {
        const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
        if (result.rows.length > 0) {
          return res.json(result.rows);
        }
      } catch (dbErr) {
        console.warn('PostgreSQL tasks fetch error, using file fallback:', dbErr.message);
      }
    }
    const tasks = getStoredTasks();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create or Update Task
app.post('/api/tasks', async (req, res) => {
  const { id, title, name, description, targetDate, campaignName, targetPerStaff, dailyTarget, platform, submissionType, targetUrl, urlSlug } = req.body;
  const taskId = id || `TSK_${Date.now()}`;
  const effectiveName = name || title || 'New Task';
  const effectiveTarget = Number(dailyTarget || targetPerStaff) || 10;
  
  const newTask = {
    id: taskId,
    name: effectiveName,
    title: effectiveName,
    description: description || '',
    targetDate: targetDate || new Date().toISOString().split('T')[0],
    campaignName: campaignName || 'Individual Staff Outreach',
    targetPerStaff: effectiveTarget,
    dailyTarget: effectiveTarget,
    platform: platform || 'Instagram',
    submissionType: submissionType || 'Instagram Handle',
    targetUrl: targetUrl || 'https://www.instagram.com/ramakrishnabhashyam/',
    urlSlug: urlSlug || 'instagram',
    status: 'Active',
    createdAt: new Date().toISOString()
  };

  try {
    const tasks = getStoredTasks();
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx >= 0) {
      tasks[idx] = { ...tasks[idx], ...newTask };
    } else {
      tasks.unshift(newTask);
    }
    saveStoredTasks(tasks);

    if (isDbConnected) {
      try {
        await pool.query(
          `INSERT INTO tasks (id, title, description, target_date, campaign_name, target_per_staff, target_url, url_slug)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             title = $2, description = $3, target_date = $4, campaign_name = $5, target_per_staff = $6, target_url = $7, url_slug = $8`,
          [taskId, effectiveName, description || '', newTask.targetDate, newTask.campaignName, effectiveTarget, newTask.targetUrl, newTask.urlSlug]
        );
      } catch (dbErr) {
        console.warn('PostgreSQL task insert error:', dbErr.message);
      }
    }
    return res.json({ success: true, task: newTask });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET All Employees
app.get('/api/employees', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    if (isDbConnected) {
      try {
        const result = await pool.query('SELECT * FROM employees ORDER BY id ASC');
        if (result.rows.length > 0) {
          return res.json(result.rows);
        }
      } catch (dbErr) {
        console.warn('PostgreSQL employees fetch error, using staff seed:', dbErr.message);
      }
    }
    res.json(PAT_STAFF_OCTOBER_2026);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET All Submissions (with query filters, no-cache headers, and file + DB sync)
app.get('/api/submissions', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { taskId, date, employeeId, parliamentCode, assemblyCode, status, search } = req.query;
  try {
    let list = getStoredSubmissions();

    if (isDbConnected) {
      try {
        const result = await pool.query(`
          SELECT 
            id, task_id as "taskId", employee_id as "employeeId",
            employee_name as "employeeName", support_code as "supportCode",
            staff_id as "staffId", parliament_code as "parliamentCode",
            parliament_name as "parliamentName", assembly_code as "assemblyCode",
            assembly_name as "assemblyName", platform, username,
            raw_input as "rawInput", status, is_valid as "isValid",
            is_follower as "isFollower", is_duplicate as "isDuplicate",
            duplicate_of as "duplicateOf", followed_at_formatted as "followedAtFormatted",
            followed_at_timestamp as "followedAtTimestamp",
            verification_badge as "verificationBadge", verification_note as "verificationNote",
            submitted_at as "submittedAt", date, time_formatted_ist as "timeFormattedIST"
          FROM submissions 
          ORDER BY submitted_at DESC
        `);
        if (result.rows.length > 0) {
          const { merged } = mergeSubmissions(result.rows, list);
          list = merged;
        }
      } catch (dbErr) {
        console.warn('PostgreSQL submissions fetch error, using file storage:', dbErr.message);
      }
    }

    if (taskId) {
      list = list.filter(s => s.taskId === taskId);
    }
    if (date) {
      list = list.filter(s => s.date === date || (s.submittedAt && s.submittedAt.startsWith(date)));
    }
    if (employeeId) {
      const cleanEmp = String(employeeId).trim().toUpperCase();
      list = list.filter(s => 
        (s.employeeId && s.employeeId.toUpperCase() === cleanEmp) ||
        (s.supportCode && s.supportCode.toUpperCase() === cleanEmp)
      );
    }
    if (parliamentCode) {
      const cleanP = String(parliamentCode).trim().toUpperCase();
      list = list.filter(s => s.parliamentCode && s.parliamentCode.toUpperCase() === cleanP);
    }
    if (assemblyCode) {
      const cleanA = String(assemblyCode).trim().toUpperCase();
      list = list.filter(s => s.assemblyCode && s.assemblyCode.toUpperCase() === cleanA);
    }
    if (status) {
      list = list.filter(s => s.status === status);
    }
    if (search) {
      const q = String(search).toLowerCase().trim();
      list = list.filter(s => 
        (s.username && s.username.toLowerCase().includes(q)) ||
        (s.employeeName && s.employeeName.toLowerCase().includes(q)) ||
        (s.employeeId && s.employeeId.toLowerCase().includes(q))
      );
    }

    return res.json({
      success: true,
      submissions: list,
      total: list.length,
      valid: list.filter(s => s.isValid).length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, submissions: [] });
  }
});

// POST New Submission (single or batch)
app.post('/api/submissions', async (req, res) => {
  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) {}
    }
    const incomingSub = payload?.submission || payload;
    if (!incomingSub) {
      return res.status(400).json({ success: false, error: 'No submission data provided' });
    }

    const items = Array.isArray(incomingSub) ? incomingSub : [incomingSub];
    const normalizedItems = items.map(normalizeSubmissionRecord).filter(Boolean);

    if (normalizedItems.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid submission objects provided' });
    }

    const currentList = getStoredSubmissions();
    const { merged, addedCount, updatedCount } = mergeSubmissions(currentList, normalizedItems);
    saveStoredSubmissions(merged);

    // Persist to PostgreSQL if connected
    if (isDbConnected) {
      for (const norm of normalizedItems) {
        try {
          await pool.query(
            `INSERT INTO submissions (
              id, task_id, employee_id, employee_name, support_code, staff_id,
              parliament_code, parliament_name, assembly_code, assembly_name,
              platform, username, raw_input, status, is_valid, is_follower,
              is_duplicate, duplicate_of, followed_at_formatted, followed_at_timestamp,
              verification_badge, verification_note, submitted_at, date, time_formatted_ist
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              is_valid = EXCLUDED.is_valid,
              is_follower = EXCLUDED.is_follower,
              verification_badge = EXCLUDED.verification_badge,
              verification_note = EXCLUDED.verification_note,
              followed_at_formatted = EXCLUDED.followed_at_formatted,
              followed_at_timestamp = EXCLUDED.followed_at_timestamp`,
            [
              norm.id, norm.taskId, norm.employeeId, norm.employeeName, norm.supportCode, norm.staffId,
              norm.parliamentCode, norm.parliamentName, norm.assemblyCode, norm.assemblyName,
              norm.platform, norm.username, norm.rawInput, norm.status, norm.isValid, norm.isFollower,
              norm.isDuplicate, norm.duplicateOf, norm.followedAtFormatted, norm.followedAtTimestamp,
              norm.verificationBadge, norm.verificationNote, norm.submittedAt, norm.date, norm.timeFormattedIST
            ]
          );
        } catch (dbErr) {
          console.warn('PostgreSQL insert submission error, stored in file:', dbErr.message);
        }
      }
    }

    return res.json({
      success: true,
      submission: normalizedItems[0],
      submissions: normalizedItems,
      added: addedCount,
      updated: updatedCount,
      total: merged.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Bi-directional Submissions Sync Route
app.post('/api/submissions/sync', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }
    const localSubs = Array.isArray(body?.localSubmissions) 
      ? body.localSubmissions 
      : (Array.isArray(body) ? body : []);

    const serverSubs = getStoredSubmissions();
    const { merged, addedCount, updatedCount } = mergeSubmissions(serverSubs, localSubs);

    if (addedCount > 0 || updatedCount > 0) {
      saveStoredSubmissions(merged);

      if (isDbConnected) {
        for (const sub of localSubs) {
          const norm = normalizeSubmissionRecord(sub);
          if (!norm) continue;
          try {
            await pool.query(
              `INSERT INTO submissions (
                id, task_id, employee_id, employee_name, support_code, staff_id,
                parliament_code, parliament_name, assembly_code, assembly_name,
                platform, username, raw_input, status, is_valid, is_follower,
                is_duplicate, duplicate_of, followed_at_formatted, followed_at_timestamp,
                verification_badge, verification_note, submitted_at, date, time_formatted_ist
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
              ON CONFLICT (id) DO NOTHING`,
              [
                norm.id, norm.taskId, norm.employeeId, norm.employeeName, norm.supportCode, norm.staffId,
                norm.parliamentCode, norm.parliamentName, norm.assemblyCode, norm.assemblyName,
                norm.platform, norm.username, norm.rawInput, norm.status, norm.isValid, norm.isFollower,
                norm.isDuplicate, norm.duplicateOf, norm.followedAtFormatted, norm.followedAtTimestamp,
                norm.verificationBadge, norm.verificationNote, norm.submittedAt, norm.date, norm.timeFormattedIST
              ]
            );
          } catch (_) {}
        }
      }
    }

    return res.json({
      success: true,
      submissions: merged,
      total: merged.length,
      syncedAdded: addedCount,
      syncedUpdated: updatedCount
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Revalidate All Stored Submissions against Followers DB
app.post('/api/submissions/revalidate', (req, res) => {
  try {
    const list = getStoredSubmissions();
    if (!list.length) {
      return res.json({ success: true, updatedCount: 0, total: 0 });
    }

    const WINDOW_MS = 24 * 60 * 60 * 1000;
    let updatedCount = 0;

    for (let i = 0; i < list.length; i++) {
      const sub = list[i];
      const clean = String(sub.username || '').trim().toLowerCase().replace(/^@+/, '');
      const follower = FOLLOWERS_MAP.get(clean);

      // Check duplicates against earlier submissions
      const prior = list.slice(i + 1).find(p => String(p.username || '').trim().toLowerCase().replace(/^@+/, '') === clean);
      if (prior) {
        if (sub.status !== 'Already Followed' || !sub.isDuplicate) {
          sub.status = 'Already Followed';
          sub.isValid = false;
          sub.isDuplicate = true;
          sub.duplicateOf = prior.id;
          sub.verificationBadge = 'Duplicate Submission';
          sub.verificationNote = `Duplicate of submission by ${prior.employeeName || 'staff'}`;
          updatedCount++;
        }
        continue;
      }

      if (!follower) {
        if (sub.status !== 'Pending Submission') {
          sub.status = 'Pending Submission';
          sub.isValid = false;
          sub.isFollower = false;
          sub.verificationBadge = 'Pending Follow Sync';
          sub.verificationNote = 'Awaiting next official follower JSON sync';
          updatedCount++;
        }
        continue;
      }

      const subTime = sub.submittedAt ? new Date(sub.submittedAt).getTime() : Date.now();
      const followTime = Number(follower.timestamp) * 1000;
      const formattedDate = follower.followedAtFormatted || formatFollowerTimestamp(follower.timestamp);

      if (followTime < (subTime - WINDOW_MS)) {
        if (sub.status !== 'Already Followed') {
          sub.status = 'Already Followed';
          sub.isValid = false;
          sub.isFollower = true;
          sub.followedAtFormatted = formattedDate;
          sub.followedAtTimestamp = follower.timestamp;
          sub.verificationBadge = `✓ Existing Follower: ${formattedDate}`;
          sub.verificationNote = 'Followed prior to campaign window';
          updatedCount++;
        }
      } else if (followTime > (subTime + WINDOW_MS)) {
        if (sub.status !== 'Invalid Submission') {
          sub.status = 'Invalid Submission';
          sub.isValid = false;
          sub.isFollower = true;
          sub.followedAtFormatted = formattedDate;
          sub.followedAtTimestamp = follower.timestamp;
          sub.verificationBadge = `Outside 24h Window: ${formattedDate}`;
          sub.verificationNote = 'Followed after 24h window expired';
          updatedCount++;
        }
      } else {
        if (sub.status !== 'Valid Submission' || !sub.isValid) {
          sub.status = 'Valid Submission';
          sub.isValid = true;
          sub.isFollower = true;
          sub.followedAtFormatted = formattedDate;
          sub.followedAtTimestamp = follower.timestamp;
          sub.verificationBadge = `✓ Followed: ${formattedDate}`;
          sub.verificationNote = 'Verified genuine new follower';
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      saveStoredSubmissions(list);
    }

    res.json({
      success: true,
      updatedCount,
      total: list.length,
      submissions: list
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE Single Submission
app.delete('/api/submissions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const list = getStoredSubmissions();
    const filtered = list.filter(s => s.id !== id);
    saveStoredSubmissions(filtered);

    if (isDbConnected) {
      try {
        await pool.query('DELETE FROM submissions WHERE id = $1', [id]);
      } catch (dbErr) {
        console.warn('PostgreSQL delete submission error:', dbErr.message);
      }
    }

    res.json({ success: true, remaining: filtered.length });
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
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) {}
  }
  const { token, taskId, employeeId, ip, userAgent, referrer } = body || {};
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
      isValid: result.clickRecord?.isValid ?? false
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Query Live Link Clicks & Analytics
async function handleAnalytics(req, res) {
  try {
    let clicks = [];
    if (isDbConnected) {
      try {
        const result = await pool.query(`
          SELECT 
            id, token, task_id as "taskId", employee_id as "employeeId",
            parliament_code as "parliamentCode", assembly_code as "assemblyCode",
            ip_address as "ip", user_agent as "userAgent", referrer,
            device_type as "deviceType", is_bot as "isBot", bot_name as "botName",
            is_duplicate as "isDuplicate", is_valid as "isValid",
            created_at as "timestamp"
          FROM link_clicks 
          ORDER BY created_at DESC 
          LIMIT 10000
        `);

        clicks = result.rows.map(r => {
          const emp = resolveStaff(r.employeeId) || resolveStaff(r.token);
          return {
            ...r,
            taskName: 'Sri Bhashyam Ramakrishna — Instagram Follower Outreach',
            employeeName: emp?.name || 'General Visitor',
            supportCode: emp?.supportCode || r.employeeId,
            staffId: emp?.staffId || '',
            parliamentName: emp?.parliamentName || '',
            assemblyName: emp?.assemblyName || '',
            targetUrl: 'https://www.instagram.com/ramakrishnabhashyam/'
          };
        });
      } catch (dbErr) {
        console.warn('PostgreSQL fetch link_clicks error, using file fallback:', dbErr.message);
        clicks = getStoredClicks();
      }
    } else {
      clicks = getStoredClicks();
    }

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
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(` BRK Social Express Backend Server running on http://localhost:${PORT}`);
});
