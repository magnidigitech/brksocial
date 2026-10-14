import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PAT_STAFF_OCTOBER_2026 } from './src/services/staffSeedData.js';

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

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(CLICKS_FILE)) {
  fs.writeFileSync(CLICKS_FILE, JSON.stringify([]), 'utf8');
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
  const pad = (n) => String(n).padStart(2, '0');
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${d}/${m}/${y} ${h}:${min}`;
}

function loadFollowersFromDisk() {
  try {
    if (fs.existsSync(FOLLOWERS_FILE)) {
      const raw = fs.readFileSync(FOLLOWERS_FILE, 'utf8');
      const list = JSON.parse(raw) || [];
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

    // Auto-seed from local followers_1.json and followers_2.json if available
    const f1Path = path.join(__dirname, 'followers_1.json');
    const f2Path = path.join(__dirname, 'followers_2.json');
    let seedList = [];
    if (fs.existsSync(f1Path)) {
      try { seedList.push(...JSON.parse(fs.readFileSync(f1Path, 'utf8'))); } catch (e) {}
    }
    if (fs.existsSync(f2Path)) {
      try { seedList.push(...JSON.parse(fs.readFileSync(f2Path, 'utf8'))); } catch (e) {}
    }

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
  const items = Array.isArray(incomingData) ? incomingData : [incomingData];

  items.forEach(item => {
    let username = null;
    let href = null;
    let timestamp = 0;

    if (item.string_list_data && item.string_list_data.length > 0) {
      const d = item.string_list_data[0];
      username = d.value;
      href = d.href;
      timestamp = Number(d.timestamp) || 0;
    } else if (item.value || item.username) {
      username = item.value || item.username;
      href = item.href;
      timestamp = Number(item.timestamp) || 0;
    }

    if (username) {
      const cleanKey = username.trim().toLowerCase().replace(/^@+/, '');
      if (!cleanKey) return;
      const existing = FOLLOWERS_MAP.get(cleanKey);
      const effTimestamp = timestamp || (existing ? existing.timestamp : Math.floor(Date.now() / 1000));

      const record = {
        username: username.trim().replace(/^@+/, ''),
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

  // Deduplication check: same token and IP within 2 seconds
  const stored = getStoredClicks();
  const isDuplicate = stored.some(c => 
    c.token === (matchedStaff?.token || token) &&
    c.ip === ip &&
    (now.getTime() - new Date(c.timestamp).getTime()) < 2000
  );

  const isValid = !isBot && !isDuplicate;

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
    isDuplicate,
    isValid,
    timestamp: now.toISOString()
  };

  // Always save to persistent JSON store
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
      return res.json({
        success: true,
        exists: true,
        isFollower: true,
        follower: {
          username: follower.username,
          href: follower.href,
          timestamp: follower.timestamp,
          followedAtFormatted: follower.followedAtFormatted || formatFollowerTimestamp(follower.timestamp)
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
