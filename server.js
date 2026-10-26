import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PAT_STAFF_OCTOBER_2026 } from './src/services/staffSeedData.js';
import {
  normalizeInstagramUsername,
  parseFollowerItem,
  processFollowerPayload,
  extractItemsFromParsedJson
} from './src/services/instagramUtils.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_RESET_PASSWORD = process.env.ADMIN_RESET_PASSWORD || 'Magni@3939';

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.text({ type: ['text/*', 'application/json'], limit: '100mb' }));

// Local persistent file storage fallback
const DATA_DIR = path.join(__dirname, 'data');
const CLICKS_FILE = path.join(DATA_DIR, 'link_clicks.json');
const FOLLOWERS_FILE = path.join(DATA_DIR, 'instagram_followers.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const EMPLOYEES_FILE = path.join(DATA_DIR, 'employees.json');
const IMPORTS_FILE = path.join(DATA_DIR, 'follower_imports.json');
const EVENTS_FILE = path.join(DATA_DIR, 'follower_events.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'admin_audit_logs.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(EMPLOYEES_FILE)) {
  try {
    fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(PAT_STAFF_OCTOBER_2026, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not initialize EMPLOYEES_FILE:', err.message);
  }
}
if (!fs.existsSync(CLICKS_FILE)) {
  fs.writeFileSync(CLICKS_FILE, JSON.stringify([]), 'utf8');
}
if (!fs.existsSync(SUBMISSIONS_FILE)) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([]), 'utf8');
}
if (!fs.existsSync(IMPORTS_FILE)) {
  fs.writeFileSync(IMPORTS_FILE, JSON.stringify([]), 'utf8');
}
if (!fs.existsSync(EVENTS_FILE)) {
  fs.writeFileSync(EVENTS_FILE, JSON.stringify([]), 'utf8');
}
if (!fs.existsSync(AUDIT_LOGS_FILE)) {
  fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify([]), 'utf8');
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
// Follower Imports, Events, Audit Log Storage
// ==========================================
function getStoredImports() {
  try {
    if (fs.existsSync(IMPORTS_FILE)) {
      return JSON.parse(fs.readFileSync(IMPORTS_FILE, 'utf8')) || [];
    }
  } catch (err) {
    console.error('Error reading imports file:', err.message);
  }
  return [];
}

function saveStoredImports(importsList) {
  try {
    fs.writeFileSync(IMPORTS_FILE, JSON.stringify(importsList.slice(0, 500), null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving imports file:', err.message);
  }
}

function getStoredEvents() {
  try {
    if (fs.existsSync(EVENTS_FILE)) {
      return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8')) || [];
    }
  } catch (err) {
    console.error('Error reading events file:', err.message);
  }
  return [];
}

function saveStoredEvents(eventsList) {
  try {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(eventsList.slice(0, 10000), null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving events file:', err.message);
  }
}

function getStoredAuditLogs() {
  try {
    if (fs.existsSync(AUDIT_LOGS_FILE)) {
      return JSON.parse(fs.readFileSync(AUDIT_LOGS_FILE, 'utf8')) || [];
    }
  } catch (err) {
    console.error('Error reading audit logs file:', err.message);
  }
  return [];
}

function saveStoredAuditLogs(logsList) {
  try {
    fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(logsList.slice(0, 1000), null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving audit logs file:', err.message);
  }
}

function logAuditAction(action, operator, details, result = 'SUCCESS') {
  const auditEntry = {
    id: `AUD_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    action,
    operator: operator || 'Administrator',
    details: typeof details === 'object' ? JSON.stringify(details) : String(details),
    result,
    createdAt: new Date().toISOString()
  };

  const logs = getStoredAuditLogs();
  logs.unshift(auditEntry);
  saveStoredAuditLogs(logs);

  if (isDbConnected) {
    pool.query(
      `INSERT INTO admin_audit_logs (id, action, operator, details, result, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [auditEntry.id, auditEntry.action, auditEntry.operator, auditEntry.details, auditEntry.result, auditEntry.createdAt]
    ).catch(e => console.warn('PostgreSQL audit log insert error:', e.message));
  }

  return auditEntry;
}

// ==========================================
// Instagram Followers Canonical In-Memory Map
// ==========================================
let FOLLOWERS_MAP = new Map();
let isReconciliationLocked = false;

function formatFollowerTimestamp(ts) {
  if (!ts) return '';
  const num = Number(ts);
  const ms = num < 1e11 ? num * 1000 : num;
  const date = new Date(ms);
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
      if (Array.isArray(list)) {
        FOLLOWERS_MAP = new Map();
        list.forEach(f => {
          const k = (f.key || f.username || '').toLowerCase().replace(/^@+/, '').trim();
          if (k) {
            if (!f.followedAtFormatted && f.timestamp) {
              f.followedAtFormatted = formatFollowerTimestamp(f.timestamp);
            }
            if (!f.status) f.status = 'active';
            if (!f.firstSeenAt) f.firstSeenAt = f.timestamp ? new Date(Number(f.timestamp) * 1000).toISOString() : new Date().toISOString();
            if (!f.lastSeenAt) f.lastSeenAt = new Date().toISOString();
            if (!f.lastFollowedAt) f.lastFollowedAt = f.firstSeenAt;
            FOLLOWERS_MAP.set(k, f);
          }
        });
        console.log(`Loaded ${FOLLOWERS_MAP.size} Instagram followers from disk into memory.`);
        return;
      }
    }

    // Auto-seed only on very first cold setup if no baseline has ever been established
    const imports = getStoredImports();
    if (imports.length === 0 && FOLLOWERS_MAP.size === 0) {
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
            const items = extractItemsFromParsedJson(parsed);
            if (Array.isArray(items)) {
              for (let i = 0; i < items.length; i++) {
                if (items[i]) seedList.push(items[i]);
              }
            }
          } catch (e) {
            console.warn(`Could not parse seed file ${p}:`, e.message);
          }
        }
      });

      if (seedList.length > 0) {
        console.log(`Auto-seeding initial baseline from local JSON files (${seedList.length} records)...`);
        executeReconciliationCommit(seedList, 'BASELINE', 'System Auto-Seed').catch(e => {
          console.warn('Auto-seed reconciliation warning:', e.message);
        });
      }
    }
  } catch (err) {
    console.error('Error loading followers:', err.message);
  }
}

/**
 * Generate Reconciliation Preview (Non-mutating)
 */
function generateReconciliationPreview(payload, mode = 'RECONCILIATION') {
  const processed = processFollowerPayload(payload);
  if (!processed.isValid) {
    return {
      success: false,
      error: processed.error || 'Invalid follower payload.',
      readyToCommit: false
    };
  }

  const incomingMap = processed.uniqueMap;
  const currentActiveKeys = new Set();
  
  for (const [key, follower] of FOLLOWERS_MAP.entries()) {
    if (follower.status === 'active' || !follower.status) {
      currentActiveKeys.add(key);
    }
  }

  const previousActiveCount = currentActiveKeys.size;
  const validUniqueCount = incomingMap.size;

  let retainedKeys = [];
  let newFollowerKeys = [];
  let unfollowerKeys = [];
  const warnings = [];

  if (mode === 'BASELINE') {
    // Mode A: Baseline establishes initial state. All valid unique become active.
    for (const key of incomingMap.keys()) {
      newFollowerKeys.push(key);
    }
    if (previousActiveCount > 0) {
      warnings.push(`Establishing a fresh baseline will reset active records. The new baseline will contain ${validUniqueCount.toLocaleString()} followers.`);
    }
  } else {
    // Mode B: Set Comparison:
    // Retained = Previous ∩ Current
    // New = Current - Previous
    // Unfollowers = Previous - Current
    for (const key of incomingMap.keys()) {
      if (currentActiveKeys.has(key)) {
        retainedKeys.push(key);
      } else {
        newFollowerKeys.push(key);
      }
    }

    for (const key of currentActiveKeys) {
      if (!incomingMap.has(key)) {
        unfollowerKeys.push(key);
      }
    }

    // Safety checks & warnings
    if (previousActiveCount > 100 && unfollowerKeys.length > previousActiveCount * 0.3) {
      warnings.push(`Significant decrease detected: ${unfollowerKeys.length.toLocaleString()} unfollowers (${Math.round((unfollowerKeys.length / previousActiveCount) * 100)}% drop). Verify that this file contains the complete follower export and not a partial segment.`);
    }
    if (previousActiveCount > 100 && newFollowerKeys.length > previousActiveCount * 0.5) {
      warnings.push(`Significant increase detected: +${newFollowerKeys.length.toLocaleString()} new followers. Verify that this file matches the target Instagram account.`);
    }
  }

  const netChange = newFollowerKeys.length - unfollowerKeys.length;
  const projectedActiveCount = mode === 'BASELINE' ? validUniqueCount : previousActiveCount + netChange;

  return {
    success: true,
    readyToCommit: true,
    mode,
    metrics: {
      totalSubmitted: processed.totalSubmitted,
      validUnique: validUniqueCount,
      previousActiveFollowers: previousActiveCount,
      projectedActiveFollowers: projectedActiveCount,
      retainedFollowers: retainedKeys.length,
      newFollowers: newFollowerKeys.length,
      newUnfollowers: unfollowerKeys.length,
      netChange,
      invalidRecords: processed.invalidCount,
      duplicateRecords: processed.duplicateCount
    },
    sampleNewFollowers: newFollowerKeys.slice(0, 15).map(k => incomingMap.get(k)?.username || k),
    sampleUnfollowers: unfollowerKeys.slice(0, 15).map(k => FOLLOWERS_MAP.get(k)?.username || k),
    warnings
  };
}

/**
 * Execute Full Reconciliation Commit Atomically
 */
async function executeReconciliationCommit(payload, mode = 'RECONCILIATION', operator = 'Admin') {
  if (isReconciliationLocked) {
    throw new Error('Another import or reconciliation operation is currently in progress. Please wait.');
  }

  isReconciliationLocked = true;
  const importId = `IMP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  try {
    const processed = processFollowerPayload(payload);
    if (!processed.isValid) {
      throw new Error(processed.error || 'Invalid follower payload.');
    }

    const incomingMap = processed.uniqueMap;
    const currentActiveKeys = new Set();
    
    for (const [key, follower] of FOLLOWERS_MAP.entries()) {
      if (follower.status === 'active' || !follower.status) {
        currentActiveKeys.add(key);
      }
    }

    const previousActiveCount = currentActiveKeys.size;
    const validUniqueCount = incomingMap.size;

    let retainedKeys = [];
    let newFollowerKeys = [];
    let unfollowerKeys = [];
    const newEvents = [];

    if (mode === 'BASELINE') {
      // BASELINE MODE: Establish initial canonical follower records without artificial events
      FOLLOWERS_MAP.clear();

      for (const [key, item] of incomingMap.entries()) {
        const followerRecord = {
          username: item.username,
          key: key,
          href: item.href,
          status: 'active',
          firstSeenAt: nowIso,
          lastSeenAt: nowIso,
          lastFollowedAt: nowIso,
          lastUnfollowedAt: null,
          lastImportId: importId,
          timestamp: item.timestamp,
          followedAtFormatted: formatFollowerTimestamp(item.timestamp),
          updatedAt: nowIso
        };
        FOLLOWERS_MAP.set(key, followerRecord);
      }
    } else {
      // RECONCILIATION MODE: Set Comparison
      // 1. Retained followers
      for (const [key, item] of incomingMap.entries()) {
        if (currentActiveKeys.has(key)) {
          retainedKeys.push(key);
          const existing = FOLLOWERS_MAP.get(key);
          if (existing) {
            existing.lastSeenAt = nowIso;
            existing.lastImportId = importId;
            existing.updatedAt = nowIso;
          }
        } else {
          // 2. Newly detected followers (or returning followers)
          newFollowerKeys.push(key);
          const existing = FOLLOWERS_MAP.get(key);
          const isReturning = existing && existing.status === 'unfollowed';

          const followerRecord = {
            username: item.username,
            key: key,
            href: item.href,
            status: 'active',
            firstSeenAt: existing ? existing.firstSeenAt : nowIso,
            lastSeenAt: nowIso,
            lastFollowedAt: nowIso,
            lastUnfollowedAt: existing ? existing.lastUnfollowedAt : null,
            lastImportId: importId,
            timestamp: item.timestamp,
            followedAtFormatted: formatFollowerTimestamp(item.timestamp),
            updatedAt: nowIso
          };
          FOLLOWERS_MAP.set(key, followerRecord);

          newEvents.push({
            id: `EVT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            username: item.username,
            eventType: 'FOLLOW',
            importId,
            eventTime: nowIso,
            notes: isReturning ? 'Follower re-followed account' : 'New follower detected in snapshot'
          });
        }
      }

      // 3. Newly detected unfollowers (present in previous active, missing from current)
      for (const key of currentActiveKeys) {
        if (!incomingMap.has(key)) {
          unfollowerKeys.push(key);
          const existing = FOLLOWERS_MAP.get(key);
          if (existing) {
            existing.status = 'unfollowed';
            existing.lastUnfollowedAt = nowIso;
            existing.lastImportId = importId;
            existing.updatedAt = nowIso;

            newEvents.push({
              id: `EVT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              username: existing.username,
              eventType: 'UNFOLLOW',
              importId,
              eventTime: nowIso,
              notes: 'Follower unfollowed (missing from complete snapshot)'
            });
          }
        }
      }
    }

    // 4. Reconcile Linked Employee Submissions
    const submissions = getStoredSubmissions();
    let submissionsUpdatedCount = 0;
    const unfollowerSet = new Set(unfollowerKeys);
    const newFollowerSet = new Set(newFollowerKeys);
    const incomingSet = new Set(incomingMap.keys());

    for (const sub of submissions) {
      if (!sub.username) continue;
      const cleanSub = String(sub.username).trim().toLowerCase().replace(/^@+/, '');

      if (mode === 'BASELINE') {
        if (incomingSet.has(cleanSub)) {
          if (sub.status !== 'Valid Submission' || !sub.isValid) {
            sub.status = 'Valid Submission';
            sub.isValid = true;
            sub.isFollower = true;
            sub.verificationBadge = '✓ Baseline Follower Verified';
            sub.verificationNote = 'Verified against clean baseline snapshot';
            sub.lastReconciledAt = nowIso;
            submissionsUpdatedCount++;
          }
        } else {
          if (sub.status !== 'Pending Submission') {
            sub.status = 'Pending Submission';
            sub.isValid = false;
            sub.isFollower = false;
            sub.verificationBadge = 'Pending Follow Sync';
            sub.verificationNote = 'Awaiting next official follower JSON sync';
            sub.lastReconciledAt = nowIso;
            submissionsUpdatedCount++;
          }
        }
      } else {
        // Mode B: Reconciliation
        if (unfollowerSet.has(cleanSub)) {
          // A previously active follower unfollowed
          if (sub.status === 'Valid Submission' || sub.status === 'active' || sub.isValid) {
            sub.status = 'unfollowed';
            sub.isValid = false;
            sub.isFollower = false;
            sub.unfollowedAt = nowIso;
            sub.verificationBadge = '⚠️ Unfollowed Account';
            sub.verificationNote = `Unfollow detected in import ${importId}`;
            sub.lastReconciledAt = nowIso;
            submissionsUpdatedCount++;
          }
        } else if (newFollowerSet.has(cleanSub)) {
          // A follower returned or pending submission was matched
          if (sub.status === 'unfollowed' || sub.status === 'Pending Submission') {
            const wasUnfollowed = sub.status === 'unfollowed';
            sub.status = 'Valid Submission';
            sub.isValid = true;
            sub.isFollower = true;
            if (wasUnfollowed) sub.reFollowedAt = nowIso;
            sub.verificationBadge = wasUnfollowed ? '✓ Follower Re-activated' : '✓ Follower Verified';
            sub.verificationNote = wasUnfollowed
              ? `Re-followed account detected in import ${importId}`
              : `Verified genuine follower in import ${importId}`;
            sub.lastReconciledAt = nowIso;
            submissionsUpdatedCount++;
          }
        }
      }
    }

    // Persist all data atomically
    // 1. Followers to disk
    const followersList = Array.from(FOLLOWERS_MAP.values());
    fs.writeFileSync(FOLLOWERS_FILE, JSON.stringify(followersList), 'utf8');

    // 2. Submissions to disk
    if (submissionsUpdatedCount > 0) {
      saveStoredSubmissions(submissions);
    }

    // 3. Events to disk
    if (newEvents.length > 0) {
      const storedEvents = getStoredEvents();
      saveStoredEvents([...newEvents, ...storedEvents]);
    }

    // 4. Import summary record
    const activeFollowersCount = followersList.filter(f => f.status === 'active').length;
    const importSummary = {
      id: importId,
      import_id: importId,
      timestamp: nowIso,
      mode,
      totalSubmitted: processed.totalSubmitted,
      total_submitted_records: processed.totalSubmitted,
      validUnique: validUniqueCount,
      valid_unique_usernames: validUniqueCount,
      previousActiveFollowers: previousActiveCount,
      currentActiveFollowers: activeFollowersCount,
      activeCount: activeFollowersCount,
      retainedFollowers: retainedKeys.length,
      retained_followers: retainedKeys.length,
      newFollowers: newFollowerKeys.length,
      new_followers: newFollowerKeys.length,
      newUnfollowers: unfollowerKeys.length,
      new_unfollowers: unfollowerKeys.length,
      netChange: newFollowerKeys.length - unfollowerKeys.length,
      invalidOrDuplicate: processed.invalidCount + processed.duplicateCount,
      submissionsUpdated: submissionsUpdatedCount,
      status: 'COMPLETED',
      operator
    };

    const imports = getStoredImports();
    imports.unshift(importSummary);
    saveStoredImports(imports);

    // 5. Audit log
    logAuditAction(
      mode === 'BASELINE' ? 'INITIAL_BASELINE_IMPORT' : 'DAILY_RECONCILIATION_IMPORT',
      operator,
      importSummary
    );

    // 6. PostgreSQL sync if connected
    if (isDbConnected) {
      try {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          if (mode === 'BASELINE') {
            await client.query('TRUNCATE TABLE instagram_followers CASCADE');
          }

          for (const f of followersList) {
            await client.query(`
              INSERT INTO instagram_followers (
                username, profile_url, status, first_seen_at, last_seen_at,
                last_followed_at, last_unfollowed_at, last_import_id, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (username) DO UPDATE SET
                status = EXCLUDED.status,
                last_seen_at = EXCLUDED.last_seen_at,
                last_followed_at = COALESCE(EXCLUDED.last_followed_at, instagram_followers.last_followed_at),
                last_unfollowed_at = EXCLUDED.last_unfollowed_at,
                last_import_id = EXCLUDED.last_import_id,
                updated_at = EXCLUDED.updated_at
            `, [
              f.key, f.href, f.status, f.firstSeenAt, f.lastSeenAt,
              f.lastFollowedAt, f.lastUnfollowedAt, f.lastImportId, f.updatedAt
            ]);
          }

          for (const ev of newEvents) {
            await client.query(`
              INSERT INTO follower_events (id, username, event_type, import_id, event_time, notes)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [ev.id, ev.username, ev.eventType, ev.importId, ev.eventTime, ev.notes]);
          }

          await client.query(`
            INSERT INTO follower_imports (
              id, timestamp, mode, total_submitted, valid_unique, retained_followers,
              new_followers, new_unfollowers, invalid_or_duplicate, status, operator, summary_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [
            importSummary.id, importSummary.timestamp, importSummary.mode,
            importSummary.totalSubmitted, importSummary.validUnique, importSummary.retainedFollowers,
            importSummary.newFollowers, importSummary.newUnfollowers, importSummary.invalidOrDuplicate,
            importSummary.status, importSummary.operator, JSON.stringify(importSummary)
          ]);

          await client.query('COMMIT');
        } catch (dbTxErr) {
          await client.query('ROLLBACK');
          console.error('PostgreSQL reconciliation transaction rolled back:', dbTxErr.message);
        } finally {
          client.release();
        }
      } catch (poolErr) {
        console.warn('PostgreSQL pool connection error during reconciliation:', poolErr.message);
      }
    }

    return importSummary;
  } finally {
    isReconciliationLocked = false;
  }
}

/**
 * Execute Reset Follower Database (Clean Baseline Reset)
 */
async function executeResetFollowerDatabase(operator = 'Administrator') {
  if (isReconciliationLocked) {
    throw new Error('An import is currently running. Please wait.');
  }

  isReconciliationLocked = true;
  try {
    const previousTotal = FOLLOWERS_MAP.size;

    // 1. Clear in-memory followers
    FOLLOWERS_MAP.clear();

    // 2. Clear follower file & history
    fs.writeFileSync(FOLLOWERS_FILE, JSON.stringify([]), 'utf8');
    saveStoredImports([]);
    saveStoredEvents([]);

    // 3. Reset submission statuses to 'Pending Submission' (preserving employee records & submissions)
    const submissions = getStoredSubmissions();
    let resetCount = 0;
    const nowIso = new Date().toISOString();
    for (const sub of submissions) {
      if (sub.status !== 'Pending Submission') {
        sub.status = 'Pending Submission';
        sub.isValid = false;
        sub.isFollower = false;
        sub.unfollowedAt = null;
        sub.reFollowedAt = null;
        sub.verificationBadge = 'Pending Follow Sync';
        sub.verificationNote = 'Reset baseline: awaiting clean follower baseline upload';
        sub.lastReconciledAt = nowIso;
        resetCount++;
      }
    }
    if (resetCount > 0) {
      saveStoredSubmissions(submissions);
    }

    // 4. Clear PostgreSQL tables if connected
    if (isDbConnected) {
      try {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('TRUNCATE TABLE instagram_followers CASCADE');
          await client.query('TRUNCATE TABLE follower_imports CASCADE');
          await client.query('TRUNCATE TABLE follower_events CASCADE');
          await client.query(`
            UPDATE submissions
            SET status = 'Pending Submission', is_valid = FALSE, is_follower = FALSE,
                verification_badge = 'Pending Follow Sync',
                verification_note = 'Reset baseline: awaiting clean follower baseline upload'
          `);
          await client.query('COMMIT');
        } catch (dbErr) {
          await client.query('ROLLBACK');
          console.error('PostgreSQL reset rollback:', dbErr.message);
        } finally {
          client.release();
        }
      } catch (poolErr) {
        console.warn('PostgreSQL pool error during reset:', poolErr.message);
      }
    }

    // 5. Audit Log
    const audit = logAuditAction(
      'RESET_FOLLOWER_DATABASE',
      operator,
      {
        previousFollowersCleared: previousTotal,
        submissionsPreservedAndReset: submissions.length,
        submissionsStatusUpdated: resetCount,
        note: 'Follower baseline cleared. Ready for Mode A: Initial Baseline Import.'
      }
    );

    return {
      success: true,
      message: 'Follower database successfully reset. You may now upload the complete follower list to establish a clean baseline.',
      previousTotal,
      submissionsPreserved: submissions.length,
      auditId: audit.id
    };
  } finally {
    isReconciliationLocked = false;
  }
}

function upsertFollowersData(incomingData, mode = 'RECONCILIATION', operator = 'Admin') {
  // Synchronous fallback or wrap executeReconciliationCommit
  const items = extractItemsFromParsedJson(incomingData);
  let countAdded = 0;
  let countUpdated = 0;

  for (const item of items) {
    const norm = parseFollowerItem(item);
    if (!norm) continue;

    const existing = FOLLOWERS_MAP.get(norm.key);
    const effTimestamp = norm.timestamp || (existing ? existing.timestamp : Math.floor(Date.now() / 1000));
    const nowIso = new Date().toISOString();

    const record = {
      username: norm.username,
      key: norm.key,
      href: norm.href,
      status: 'active',
      firstSeenAt: existing ? existing.firstSeenAt : nowIso,
      lastSeenAt: nowIso,
      lastFollowedAt: nowIso,
      lastUnfollowedAt: existing ? existing.lastUnfollowedAt : null,
      timestamp: effTimestamp,
      followedAtFormatted: formatFollowerTimestamp(effTimestamp),
      updatedAt: nowIso
    };

    if (!existing || existing.status === 'unfollowed') {
      countAdded++;
    } else {
      countUpdated++;
    }
    FOLLOWERS_MAP.set(norm.key, record);
  }

  try {
    const list = Array.from(FOLLOWERS_MAP.values());
    fs.writeFileSync(FOLLOWERS_FILE, JSON.stringify(list), 'utf8');
  } catch (err) {
    console.error('Error saving followers file:', err.message);
  }

  const activeCount = Array.from(FOLLOWERS_MAP.values()).filter(f => f.status === 'active').length;
  return {
    total: activeCount,
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

// Build Fast O(1) Staff Token & ID Lookup Map (Dynamic & Persisted)
const STAFF_LOOKUP = new Map();
let CURRENT_STAFF_LIST = [];

function loadStaffFromDisk() {
  try {
    if (fs.existsSync(EMPLOYEES_FILE)) {
      const raw = fs.readFileSync(EMPLOYEES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed reading EMPLOYEES_FILE, using PAT_STAFF_OCTOBER_2026 seed:', err.message);
  }
  return [...PAT_STAFF_OCTOBER_2026];
}

function refreshStaffLookup(staffList) {
  CURRENT_STAFF_LIST = staffList;
  STAFF_LOOKUP.clear();
  staffList.forEach(staff => {
    const mainId = staff.id || staff.supportCode || staff.assemblyCode;
    const token = generateLinkToken('TASK-INSTA-001', mainId);
    const staffObj = { ...staff, token };
    
    STAFF_LOOKUP.set(token.toLowerCase(), staffObj);
    if (staff.id) STAFF_LOOKUP.set(String(staff.id).toLowerCase(), staffObj);
    if (staff.supportCode) STAFF_LOOKUP.set(String(staff.supportCode).toLowerCase(), staffObj);
    if (staff.staffId) STAFF_LOOKUP.set(String(staff.staffId).toLowerCase(), staffObj);
    if (staff.assemblyCode) STAFF_LOOKUP.set(String(staff.assemblyCode).toLowerCase(), staffObj);
    if (staff.mobilePersonal) STAFF_LOOKUP.set(String(staff.mobilePersonal).trim(), staffObj);
    if (staff.mobileOffice) STAFF_LOOKUP.set(String(staff.mobileOffice).trim(), staffObj);
    if (staff.mobile) STAFF_LOOKUP.set(String(staff.mobile).trim(), staffObj);
  });
}

function saveStaffToDisk(staffList) {
  try {
    fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(staffList, null, 2), 'utf8');
    refreshStaffLookup(staffList);
    return true;
  } catch (err) {
    console.error('Error writing employees to disk:', err);
    return false;
  }
}

// Initial boot load
CURRENT_STAFF_LIST = loadStaffFromDisk();
refreshStaffLookup(CURRENT_STAFF_LIST);

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
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS unfollowed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS re_followed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMP WITH TIME ZONE;

      CREATE TABLE IF NOT EXISTS instagram_followers (
        username VARCHAR(150) PRIMARY KEY,
        profile_url TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_followed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_unfollowed_at TIMESTAMP WITH TIME ZONE,
        last_import_id VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS follower_imports (
        id VARCHAR(100) PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        mode VARCHAR(30) NOT NULL,
        total_submitted INT DEFAULT 0,
        valid_unique INT DEFAULT 0,
        retained_followers INT DEFAULT 0,
        new_followers INT DEFAULT 0,
        new_unfollowers INT DEFAULT 0,
        invalid_or_duplicate INT DEFAULT 0,
        status VARCHAR(30) DEFAULT 'COMPLETED',
        operator VARCHAR(100),
        summary_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS follower_events (
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(150) NOT NULL,
        event_type VARCHAR(20) NOT NULL,
        import_id VARCHAR(100),
        event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id VARCHAR(100) PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        operator VARCHAR(100),
        details TEXT,
        result VARCHAR(50),
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

// Biometric Fingerprint / WebAuthn Disabled Handler (for legacy cached clients)
app.use('/api/webauthn', (req, res) => {
  res.status(200).json({ success: false, disabled: true, error: 'Biometric fingerprint login is disabled. Please use password login.' });
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
      // Check if this exact employee already submitted this handle on the server
      const existingSameEmpSub = Array.from(map.values()).find(s => 
        s.taskId === norm.taskId &&
        s.employeeId === norm.employeeId &&
        String(s.username).toLowerCase() === norm.username.toLowerCase()
      );

      if (existingSameEmpSub) {
        // Same employee, update status if client has newer verification
        if (existingSameEmpSub.status === 'Pending Submission' && (norm.status === 'Valid Submission' || norm.status === 'Already Followed')) {
          map.set(existingSameEmpSub.id, { ...existingSameEmpSub, ...norm, id: existingSameEmpSub.id });
          updatedCount++;
        }
        return;
      }

      // Check if another staff member already submitted this handle (cross-staff duplicate)
      const existingOtherSub = Array.from(map.values()).find(s => 
        s.taskId === norm.taskId &&
        String(s.username).toLowerCase() === norm.username.toLowerCase()
      );

      if (existingOtherSub) {
        // Tag as duplicate submission, but KEEP the record so staff entry is never lost!
        norm.isDuplicate = true;
        norm.duplicateOf = existingOtherSub.id;
        if (!norm.verificationBadge || norm.status === 'Valid Submission') {
          norm.status = 'Already Followed';
          norm.isValid = false;
          norm.verificationBadge = 'Duplicate Submission';
          norm.verificationNote = `Already submitted by ${existingOtherSub.employeeName || existingOtherSub.employeeId}`;
        }
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

// GET All Employees (Live, disk-backed & synced)
app.get('/api/employees', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    if (isDbConnected) {
      try {
        const result = await pool.query('SELECT * FROM employees ORDER BY id ASC');
        if (result.rows.length > 0) {
          return res.json(result.rows);
        }
      } catch (dbErr) {
        console.warn('PostgreSQL employees fetch error, using disk staff:', dbErr.message);
      }
    }
    // Return live list from disk
    if (!CURRENT_STAFF_LIST || CURRENT_STAFF_LIST.length === 0) {
      CURRENT_STAFF_LIST = loadStaffFromDisk();
    }
    res.json(CURRENT_STAFF_LIST);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees - Update or batch override employees
app.post('/api/employees', async (req, res) => {
  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) {}
    }
    const incoming = Array.isArray(payload) ? payload : [payload];
    if (!incoming.length) {
      return res.status(400).json({ success: false, error: 'No employee data provided' });
    }

    const currentList = CURRENT_STAFF_LIST.length > 0 ? [...CURRENT_STAFF_LIST] : loadStaffFromDisk();
    let updatedCount = 0;

    incoming.forEach(newItem => {
      if (!newItem) return;
      const targetId = String(newItem.id || newItem.supportCode || newItem.code || '').trim().toUpperCase();
      const targetAsm = String(newItem.assemblyCode || '').trim().toUpperCase();

      const idx = currentList.findIndex(e => {
        if (!e) return false;
        const eId = String(e.id || '').toUpperCase();
        const eSupp = String(e.supportCode || '').toUpperCase();
        const eAsm = String(e.assemblyCode || '').toUpperCase();
        if (targetId && (eId === targetId || eSupp === targetId)) return true;
        if (targetAsm && eAsm === targetAsm) return true;
        return false;
      });

      if (idx !== -1) {
        currentList[idx] = { ...currentList[idx], ...newItem };
        updatedCount++;
      } else {
        currentList.push({
          id: targetId || `EMP-${Date.now()}`,
          supportCode: targetId,
          name: newItem.name || 'Staff Member',
          level: newItem.level || 'Assembly',
          parliamentCode: newItem.parliamentCode || 'APP13',
          parliamentName: newItem.parliamentName || 'Guntur',
          assemblyCode: newItem.assemblyCode || null,
          assemblyName: newItem.assemblyName || null,
          department: newItem.department || 'Outreach Staff',
          mobilePersonal: newItem.mobilePersonal || newItem.mobile || '',
          mobileOffice: newItem.mobileOffice || '',
          mobile: newItem.mobilePersonal || newItem.mobileOffice || newItem.mobile || '',
          password: newItem.password || 'password123',
          status: newItem.status || 'Active',
          ...newItem
        });
        updatedCount++;
      }
    });

    saveStaffToDisk(currentList);

    // If PostgreSQL connected, sync into DB table
    if (isDbConnected) {
      for (const emp of incoming) {
        try {
          const empId = emp.id || emp.supportCode;
          await pool.query(`
            INSERT INTO employees (id, name, level, parliament_code, parliament_name, assembly_code, assembly_name, mobile, password, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              mobile = EXCLUDED.mobile,
              password = EXCLUDED.password,
              status = EXCLUDED.status
          `, [
            empId,
            emp.name,
            emp.level || 'Assembly',
            emp.parliamentCode || 'APP13',
            emp.parliamentName || 'Guntur',
            emp.assemblyCode || null,
            emp.assemblyName || null,
            emp.mobilePersonal || emp.mobile || '9999999999',
            emp.password || 'password123',
            emp.status || 'Active'
          ]);
        } catch (dbErr) {
          console.warn('PostgreSQL employee upsert error:', dbErr.message);
        }
      }
    }

    res.json({ success: true, count: updatedCount, totalEmployees: currentList.length });
  } catch (err) {
    console.error('Error saving employees:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/employees/:id - Update specific employee by ID or support code
app.put('/api/employees/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const targetId = String(rawId || '').trim().toUpperCase();
    const updateData = req.body;

    const currentList = CURRENT_STAFF_LIST.length > 0 ? [...CURRENT_STAFF_LIST] : loadStaffFromDisk();
    const idx = currentList.findIndex(e => {
      if (!e) return false;
      return (e.id && e.id.toUpperCase() === targetId) || 
             (e.supportCode && e.supportCode.toUpperCase() === targetId);
    });

    if (idx === -1) {
      return res.status(404).json({ success: false, error: `Employee ${rawId} not found` });
    }

    currentList[idx] = { ...currentList[idx], ...updateData };
    saveStaffToDisk(currentList);

    res.json({ success: true, employee: currentList[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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

// ==========================================
// Instagram Followers Verification & Management APIs
// ==========================================

// Get follower stats & count (active only by default for accurate counts)
app.get('/api/instagram/followers/stats', (req, res) => {
  try {
    const list = Array.from(FOLLOWERS_MAP.values());
    const activeList = list.filter(f => f.status === 'active' || !f.status);
    const unfollowedList = list.filter(f => f.status === 'unfollowed');

    const latestFollower = activeList.reduce((latest, f) => {
      return (!latest || f.timestamp > latest.timestamp) ? f : latest;
    }, null);

    const imports = getStoredImports();
    const latestImport = imports.length > 0 ? imports[0] : null;

    res.json({
      success: true,
      total: activeList.length,
      activeCount: activeList.length,
      unfollowedCount: unfollowedList.length,
      totalEverTracked: list.length,
      latestFollower: latestFollower ? {
        username: latestFollower.username,
        followedAtFormatted: latestFollower.followedAtFormatted,
        timestamp: latestFollower.timestamp
      } : null,
      latestImport,
      lastUpdated: fs.existsSync(FOLLOWERS_FILE) ? fs.statSync(FOLLOWERS_FILE).mtime : new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Comprehensive Reconciliation & Audit Statistics
app.get('/api/instagram/followers/reconciliation/stats', (req, res) => {
  try {
    const list = Array.from(FOLLOWERS_MAP.values());
    const activeFollowers = list.filter(f => f.status === 'active' || !f.status);
    const unfollowedFollowers = list.filter(f => f.status === 'unfollowed');

    const imports = getStoredImports();
    const latestImport = imports.length > 0 ? imports[0] : null;

    const submissions = getStoredSubmissions();
    const activeSubs = submissions.filter(s => s.status === 'Valid Submission' || s.status === 'active' || s.isValid);
    const unfollowedSubs = submissions.filter(s => s.status === 'unfollowed' || s.status === 'Unfollowed');
    const pendingSubs = submissions.filter(s => s.status === 'Pending Submission' || s.status === 'pending_verification');

    const statsObj = {
      currentActiveFollowers: activeFollowers.length,
      unfollowedFollowers: unfollowedFollowers.length,
      unfollowedFollowersCount: unfollowedFollowers.length,
      totalTrackedFollowers: list.length,
      totalEverTracked: list.length,
      activeSubmissionsCount: activeSubs.length,
      totalActiveSubmissions: activeSubs.length,
      unfollowedSubmissionsCount: unfollowedSubs.length,
      totalUnfollowedSubmissions: unfollowedSubs.length,
      pendingSubmissionsCount: pendingSubs.length,
      pendingSubmissions: pendingSubs.length,
      totalSubmissionsCount: submissions.length,
      totalHistoricalSubmissions: submissions.length,
      latestImport,
      lastReconciliationTime: latestImport?.timestamp || null,
      baselineEstablished: imports.some(imp => imp.mode === 'BASELINE') || list.length > 0
    };

    res.json({
      success: true,
      stats: statsObj,
      ...statsObj
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Preview of Reconciliation (Non-destructive)
app.post('/api/instagram/followers/reconcile-preview', (req, res) => {
  try {
    const rawPayload = req.body?.payload !== undefined ? req.body.payload : (req.body?.data !== undefined ? req.body.data : req.body);
    const mode = req.body?.mode || 'RECONCILIATION';
    if (!rawPayload) {
      return res.status(400).json({ success: false, error: 'No follower data provided in request body' });
    }
    const preview = generateReconciliationPreview(rawPayload, mode);
    if (!preview.success) {
      return res.status(400).json(preview);
    }
    res.json(preview);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Commit Reconciliation Atomically
app.post('/api/instagram/followers/reconcile-commit', async (req, res) => {
  try {
    const rawPayload = req.body?.payload !== undefined ? req.body.payload : (req.body?.data !== undefined ? req.body.data : req.body);
    const mode = req.body?.mode || 'RECONCILIATION';
    const operator = req.body?.operator || 'Admin';
    if (!rawPayload) {
      return res.status(400).json({ success: false, error: 'No follower data provided in request body' });
    }
    const result = await executeReconciliationCommit(rawPayload, mode, operator);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Protected Admin Reset Endpoint
app.post('/api/admin/reset-followers-database', async (req, res) => {
  try {
    const { password, confirmation, operator } = req.body || {};
    const configuredPassword = process.env.ADMIN_RESET_PASSWORD || 'Magni@3939';

    if (!password || password !== configuredPassword) {
      logAuditAction('UNAUTHORIZED_RESET_ATTEMPT', operator || 'Unknown', { ip: req.ip }, 'DENIED');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid Administrator Reset Password.'
      });
    }

    if (confirmation !== 'RESET') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation mismatch. You must confirm by providing confirmation string "RESET".'
      });
    }

    const result = await executeResetFollowerDatabase(operator || 'Administrator');
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Import History Snapshots
app.get('/api/instagram/followers/imports', (req, res) => {
  try {
    const imports = getStoredImports();
    res.json({ success: true, imports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Follow / Unfollow Event Log
app.get('/api/instagram/followers/events', (req, res) => {
  try {
    const limit = Math.min(500, parseInt(req.query.limit, 10) || 100);
    const events = getStoredEvents().slice(0, limit);
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Unfollowed Accounts List with Linked Submissions
app.get('/api/instagram/followers/unfollowed', (req, res) => {
  try {
    const search = (req.query.search || '').trim().toLowerCase().replace(/^@+/, '');
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

    let list = Array.from(FOLLOWERS_MAP.values()).filter(f => f.status === 'unfollowed');
    if (search) {
      list = list.filter(f => f.key.includes(search) || f.username.toLowerCase().includes(search));
    }

    list.sort((a, b) => new Date(b.lastUnfollowedAt || 0) - new Date(a.lastUnfollowedAt || 0));

    const total = list.length;
    const startIndex = (page - 1) * limit;
    const items = list.slice(startIndex, startIndex + limit);

    // Cross-reference with submissions
    const submissions = getStoredSubmissions();
    const subsByUsername = new Map();
    submissions.forEach(s => {
      if (s.username) {
        subsByUsername.set(s.username.toLowerCase().trim().replace(/^@+/, ''), s);
      }
    });

    const enrichedItems = items.map(f => {
      const linkedSub = subsByUsername.get(f.key);
      return {
        ...f,
        linkedSubmission: linkedSub ? {
          id: linkedSub.id,
          employeeId: linkedSub.employeeId,
          employeeName: linkedSub.employeeName,
          submittedAt: linkedSub.submittedAt
        } : null
      };
    });

    res.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      unfollowed: enrichedItems,
      unfollowers: enrichedItems
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Admin Audit Logs
app.get('/api/admin/audit-logs', (req, res) => {
  try {
    const logs = getStoredAuditLogs();
    res.json({ success: true, logs });
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
      const isActive = follower.status === 'active' || !follower.status;
      const formattedDate = follower.followedAtFormatted || formatFollowerTimestamp(follower.timestamp);
      const subTime = req.query.submittedAt ? new Date(req.query.submittedAt).getTime() : Date.now();
      const followTime = Number(follower.timestamp) * 1000;
      const WINDOW_MS = 24 * 60 * 60 * 1000;
      const isPreExisting = followTime < (subTime - WINDOW_MS);
      const isInsideWindow = followTime >= (subTime - WINDOW_MS) && followTime <= (subTime + WINDOW_MS);

      return res.json({
        success: true,
        exists: true,
        isFollower: isActive,
        isUnfollowed: !isActive,
        status: follower.status || 'active',
        isPreExisting,
        isInsideWindow,
        follower: {
          username: follower.username,
          href: follower.href,
          timestamp: follower.timestamp,
          status: follower.status || 'active',
          followedAtFormatted: formattedDate,
          lastUnfollowedAt: follower.lastUnfollowedAt
        }
      });
    }

    return res.json({
      success: true,
      exists: false,
      isFollower: false,
      isUnfollowed: false,
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

      if (follower.status === 'unfollowed') {
        return {
          username: clean,
          exists: true,
          isFollower: false,
          isUnfollowed: true,
          status: 'unfollowed',
          follower: {
            username: follower.username,
            href: follower.href,
            timestamp: follower.timestamp,
            status: 'unfollowed',
            lastUnfollowedAt: follower.lastUnfollowedAt,
            followedAtFormatted: follower.followedAtFormatted || formatFollowerTimestamp(follower.timestamp)
          }
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
          status: 'active',
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

// Upsert / Import new Instagram followers JSON (backward-compatible wrapper)
app.post('/api/instagram/followers/upsert', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, error: 'No follower data provided in request body' });
    }

    const mode = req.query.mode || 'RECONCILIATION';
    const result = await executeReconciliationCommit(payload, mode, req.body.operator || 'Admin');
    res.json({
      success: true,
      message: `Successfully reconciled ${result.validUnique} followers (+${result.newFollowers} new, -${result.newUnfollowers} unfollowed).`,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Search & Paginate Followers (supports ?status=active|unfollowed|all)
app.get('/api/instagram/followers', (req, res) => {
  try {
    const search = (req.query.search || '').trim().toLowerCase().replace(/^@+/, '');
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const statusFilter = (req.query.status || 'active').toLowerCase();

    let list = Array.from(FOLLOWERS_MAP.values());
    if (statusFilter === 'active') {
      list = list.filter(f => f.status === 'active' || !f.status);
    } else if (statusFilter === 'unfollowed') {
      list = list.filter(f => f.status === 'unfollowed');
    }

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
      totalPages: Math.ceil(total / limit) || 1,
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
