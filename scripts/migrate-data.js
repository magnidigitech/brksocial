/**
 * BRK Social - Complete Migration Script (VPS -> Neon PostgreSQL)
 * 
 * Supports:
 *  1. node scripts/migrate-data.js import-local   -> Imports local data/*.json files into Neon
 *  2. node scripts/migrate-data.js export         -> Dumps tables from SOURCE_DATABASE_URL to backup_dump/
 *  3. node scripts/migrate-data.js import-dump    -> Loads backup_dump/ into TARGET_DATABASE_URL (Neon)
 *  4. node scripts/migrate-data.js verify         -> Verifies row counts and data integrity in Neon
 */

import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DUMP_DIR = path.join(ROOT_DIR, 'backup_dump');

const TARGET_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const SOURCE_URL = process.env.SOURCE_DATABASE_URL;

function getPool(connString) {
  if (!connString) {
    throw new Error('No connection string provided.');
  }
  return new pg.Pool({
    connectionString: connString,
    ssl: connString.includes('sslmode=require') || connString.includes('neon.tech') ? { rejectUnauthorized: false } : false,
    max: 10,
    connectionTimeoutMillis: 10000
  });
}

/**
 * Verify row counts across all tables in Neon
 */
async function verifyDatabase(pool) {
  const client = await pool.connect();
  try {
    console.log('\n============================================================');
    console.log(' NEON DATABASE VERIFICATION REPORT');
    console.log('============================================================\n');

    const tables = [
      'admin_users',
      'employees',
      'tasks',
      'submissions',
      'instagram_followers',
      'follower_imports',
      'follower_events',
      'admin_audit_logs',
      'link_clicks',
      'tracking_links'
    ];

    for (const table of tables) {
      try {
        const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(res.rows[0].count, 10);
        console.log(`  ✓ Table '${table}': ${count.toLocaleString()} rows`);
      } catch (err) {
        console.log(`  ✗ Table '${table}': Error querying (${err.message})`);
      }
    }
    console.log('\n============================================================\n');
  } finally {
    client.release();
  }
}

/**
 * Import from data/*.json into Neon
 */
async function importLocalData(pool) {
  const client = await pool.connect();
  try {
    console.log('\n============================================================');
    console.log(' STARTING DATA IMPORT INTO NEON POSTGRESQL');
    console.log('============================================================\n');

    // 1. Employees (Staff logins & directory)
    const empFile = path.join(DATA_DIR, 'employees.json');
    if (fs.existsSync(empFile)) {
      const emps = JSON.parse(fs.readFileSync(empFile, 'utf8')) || [];
      console.log(`Importing ${emps.length} employees...`);
      let empCount = 0;
      for (const e of emps) {
        const id = String(e.id || e.supportCode).trim().toUpperCase();
        if (!id) continue;
        await client.query(`
          INSERT INTO employees (id, name, level, parliament_code, parliament_name, assembly_code, assembly_name, mobile, password, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            level = EXCLUDED.level,
            parliament_code = EXCLUDED.parliament_code,
            parliament_name = EXCLUDED.parliament_name,
            assembly_code = EXCLUDED.assembly_code,
            assembly_name = EXCLUDED.assembly_name,
            mobile = EXCLUDED.mobile,
            password = EXCLUDED.password,
            status = EXCLUDED.status
        `, [
          id,
          e.name || 'Staff Member',
          e.level || 'Assembly',
          e.parliamentCode || 'APP13',
          e.parliamentName || 'Guntur',
          e.assemblyCode || null,
          e.assemblyName || null,
          e.mobilePersonal || e.mobile || '9999999999',
          e.password || 'password123',
          e.status || 'Active'
        ]);
        empCount++;
      }
      console.log(`  ✓ Successfully imported ${empCount} employees.`);
    }

    // 2. Tasks
    const tasksFile = path.join(DATA_DIR, 'tasks.json');
    if (fs.existsSync(tasksFile)) {
      const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8')) || [];
      console.log(`Importing ${tasks.length} tasks...`);
      for (const t of tasks) {
        await client.query(`
          INSERT INTO tasks (id, title, description, target_date, campaign_name, target_per_staff, target_url, url_slug, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            target_date = EXCLUDED.target_date,
            campaign_name = EXCLUDED.campaign_name,
            target_per_staff = EXCLUDED.target_per_staff,
            target_url = EXCLUDED.target_url,
            url_slug = EXCLUDED.url_slug,
            status = EXCLUDED.status
        `, [
          t.id,
          t.title || t.name || 'Outreach Task',
          t.description || '',
          t.targetDate || new Date().toISOString().split('T')[0],
          t.campaignName || 'Staff Outreach',
          Number(t.targetPerStaff || t.dailyTarget) || 10,
          t.targetUrl || 'https://www.instagram.com/ramakrishnabhashyam/',
          t.urlSlug || 'instagram',
          t.status || 'Active'
        ]);
      }
      console.log(`  ✓ Successfully imported ${tasks.length} tasks.`);
    }

    // 3. Submissions (Batch UNNEST)
    const subsFile = path.join(DATA_DIR, 'submissions.json');
    if (fs.existsSync(subsFile)) {
      const subs = JSON.parse(fs.readFileSync(subsFile, 'utf8')) || [];
      const validSubs = subs.filter(s => s && s.id && s.username);
      console.log(`Importing ${validSubs.length.toLocaleString()} submissions in batches of 250...`);
      const BATCH = 250;
      let subCount = 0;
      for (let i = 0; i < validSubs.length; i += BATCH) {
        const chunk = validSubs.slice(i, i + BATCH);
        await client.query(`
          INSERT INTO submissions (
            id, task_id, employee_id, employee_name, support_code, staff_id,
            parliament_code, parliament_name, assembly_code, assembly_name,
            platform, username, raw_input, status, is_valid, is_follower,
            is_duplicate, duplicate_of, followed_at_formatted, followed_at_timestamp,
            verification_badge, verification_note, submitted_at, date, time_formatted_ist
          )
          SELECT * FROM UNNEST(
            $1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[], $6::varchar[],
            $7::varchar[], $8::varchar[], $9::varchar[], $10::varchar[],
            $11::varchar[], $12::varchar[], $13::text[], $14::varchar[], $15::boolean[], $16::boolean[],
            $17::boolean[], $18::varchar[], $19::varchar[], $20::bigint[],
            $21::varchar[], $22::text[], $23::timestamptz[], $24::date[], $25::varchar[]
          )
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            is_valid = EXCLUDED.is_valid,
            is_follower = EXCLUDED.is_follower,
            verification_badge = EXCLUDED.verification_badge,
            verification_note = EXCLUDED.verification_note
        `, [
          chunk.map(s => String(s.id)),
          chunk.map(s => s.taskId || 'TASK-INSTA-001'),
          chunk.map(s => s.employeeId || 'UNKNOWN'),
          chunk.map(s => s.employeeName || 'Staff Member'),
          chunk.map(s => s.supportCode || s.employeeId || ''),
          chunk.map(s => s.staffId || ''),
          chunk.map(s => s.parliamentCode || 'APP13'),
          chunk.map(s => s.parliamentName || 'Guntur'),
          chunk.map(s => s.assemblyCode || null),
          chunk.map(s => s.assemblyName || null),
          chunk.map(s => s.platform || 'Instagram'),
          chunk.map(s => String(s.username).trim().toLowerCase().replace(/^@+/, '')),
          chunk.map(s => String(s.rawInput || s.username || '')),
          chunk.map(s => s.status || 'Valid Submission'),
          chunk.map(s => s.isValid !== undefined ? Boolean(s.isValid) : true),
          chunk.map(s => Boolean(s.isFollower)),
          chunk.map(s => Boolean(s.isDuplicate)),
          chunk.map(s => s.duplicateOf || null),
          chunk.map(s => s.followedAtFormatted || null),
          chunk.map(s => s.followedAtTimestamp ? Number(s.followedAtTimestamp) : null),
          chunk.map(s => s.verificationBadge || null),
          chunk.map(s => s.verificationNote || null),
          chunk.map(s => s.submittedAt || new Date().toISOString()),
          chunk.map(s => (s.date && s.date.includes('-')) ? s.date : new Date().toISOString().split('T')[0]),
          chunk.map(s => s.timeFormattedIST || '')
        ]);
        subCount += chunk.length;
      }
      console.log(`  ✓ Successfully imported ${subCount.toLocaleString()} submissions.`);
    }

    // 4. Instagram Followers (Fast chunked UNNEST batching)
    const folFile = path.join(DATA_DIR, 'instagram_followers.json');
    if (fs.existsSync(folFile)) {
      console.log('Loading Instagram followers JSON from disk...');
      const followers = JSON.parse(fs.readFileSync(folFile, 'utf8')) || [];
      console.log(`Importing ${followers.length.toLocaleString()} Instagram followers in batches of 500...`);

      const nowIso = new Date().toISOString();
      const BATCH = 500;
      let imported = 0;

      for (let i = 0; i < followers.length; i += BATCH) {
        const chunk = followers.slice(i, i + BATCH);
        await client.query(`
          INSERT INTO instagram_followers (
            username, profile_url, status, first_seen_at, last_seen_at,
            last_followed_at, last_unfollowed_at, last_import_id, updated_at
          )
          SELECT * FROM UNNEST(
            $1::varchar[], $2::text[], $3::varchar[], $4::timestamptz[], $5::timestamptz[],
            $6::timestamptz[], $7::timestamptz[], $8::varchar[], $9::timestamptz[]
          )
          ON CONFLICT (username) DO UPDATE SET
            status = EXCLUDED.status,
            last_seen_at = EXCLUDED.last_seen_at,
            last_followed_at = COALESCE(EXCLUDED.last_followed_at, instagram_followers.last_followed_at),
            last_unfollowed_at = EXCLUDED.last_unfollowed_at,
            last_import_id = EXCLUDED.last_import_id,
            updated_at = EXCLUDED.updated_at
        `, [
          chunk.map(f => (f.key || f.username || '').toLowerCase().replace(/^@+/, '').trim()),
          chunk.map(f => f.href || `https://www.instagram.com/${f.username}`),
          chunk.map(f => f.status || 'active'),
          chunk.map(f => f.firstSeenAt || nowIso),
          chunk.map(f => f.lastSeenAt || nowIso),
          chunk.map(f => f.lastFollowedAt || f.firstSeenAt || nowIso),
          chunk.map(f => f.lastUnfollowedAt || null),
          chunk.map(f => f.lastImportId || 'INITIAL_IMPORT'),
          chunk.map(f => f.updatedAt || nowIso)
        ]);
        imported += chunk.length;
        if (imported % 5000 === 0 || imported === followers.length) {
          console.log(`  ... ${imported.toLocaleString()} / ${followers.length.toLocaleString()} followers imported`);
        }
      }
      console.log(`  ✓ Successfully imported ${imported.toLocaleString()} Instagram followers.`);
    }

    // 5. Follower Imports
    const importsFile = path.join(DATA_DIR, 'follower_imports.json');
    if (fs.existsSync(importsFile)) {
      const imports = JSON.parse(fs.readFileSync(importsFile, 'utf8')) || [];
      console.log(`Importing ${imports.length} follower import logs...`);
      for (const imp of imports) {
        await client.query(`
          INSERT INTO follower_imports (
            id, timestamp, mode, total_submitted, valid_unique, retained_followers,
            new_followers, new_unfollowers, invalid_or_duplicate, status, operator, summary_notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [
          imp.id || imp.import_id,
          imp.timestamp || new Date().toISOString(),
          imp.mode || 'BASELINE',
          imp.totalSubmitted || 0,
          imp.validUnique || 0,
          imp.retainedFollowers || 0,
          imp.newFollowers || 0,
          imp.newUnfollowers || 0,
          imp.invalidOrDuplicate || 0,
          imp.status || 'COMPLETED',
          imp.operator || 'Admin',
          JSON.stringify(imp)
        ]);
      }
      console.log(`  ✓ Successfully imported ${imports.length} follower import records.`);
    }

    // 6. Link Clicks (Batch UNNEST)
    const clicksFile = path.join(DATA_DIR, 'link_clicks.json');
    if (fs.existsSync(clicksFile)) {
      const clicks = JSON.parse(fs.readFileSync(clicksFile, 'utf8')) || [];
      const validClicks = clicks.filter(c => c && c.id);
      console.log(`Importing ${validClicks.length.toLocaleString()} link click analytics records in batches of 500...`);
      const BATCH = 500;
      let clickCount = 0;
      for (let i = 0; i < validClicks.length; i += BATCH) {
        const chunk = validClicks.slice(i, i + BATCH);
        await client.query(`
          INSERT INTO link_clicks (
            id, token, task_id, employee_id, parliament_code, assembly_code,
            ip_address, user_agent, referrer, device_type, is_bot, bot_name,
            is_duplicate, is_valid, created_at
          )
          SELECT * FROM UNNEST(
            $1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[], $6::varchar[],
            $7::varchar[], $8::text[], $9::text[], $10::varchar[], $11::boolean[], $12::varchar[],
            $13::boolean[], $14::boolean[], $15::timestamptz[]
          )
          ON CONFLICT (id) DO NOTHING
        `, [
          chunk.map(c => String(c.id)),
          chunk.map(c => c.token || ''),
          chunk.map(c => c.taskId || 'TASK-INSTA-001'),
          chunk.map(c => c.employeeId || 'UNKNOWN'),
          chunk.map(c => c.parliamentCode || ''),
          chunk.map(c => c.assemblyCode || ''),
          chunk.map(c => c.ip || c.ip_address || '127.0.0.1'),
          chunk.map(c => c.userAgent || c.user_agent || ''),
          chunk.map(c => c.referrer || ''),
          chunk.map(c => c.deviceType || c.device_type || 'Mobile'),
          chunk.map(c => Boolean(c.isBot)),
          chunk.map(c => c.botName || null),
          chunk.map(c => Boolean(c.isDuplicate)),
          chunk.map(c => c.isValid !== undefined ? Boolean(c.isValid) : true),
          chunk.map(c => c.timestamp || c.created_at || new Date().toISOString())
        ]);
        clickCount += chunk.length;
      }
      console.log(`  ✓ Successfully imported ${clickCount.toLocaleString()} link clicks.`);
    }

    // 7. Follower Events
    const eventsFile = path.join(DATA_DIR, 'follower_events.json');
    if (fs.existsSync(eventsFile)) {
      const events = JSON.parse(fs.readFileSync(eventsFile, 'utf8')) || [];
      console.log(`Importing ${events.length} follower events in batches of 500...`);
      const BATCH = 500;
      let evtCount = 0;
      for (let i = 0; i < events.length; i += BATCH) {
        const chunk = events.slice(i, i + BATCH);
        await client.query(`
          INSERT INTO follower_events (id, username, event_type, import_id, event_time, notes)
          SELECT * FROM UNNEST(
            $1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::timestamptz[], $6::text[]
          )
          ON CONFLICT (id) DO NOTHING
        `, [
          chunk.map(e => e.id || `EVT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
          chunk.map(e => (e.username || '').toLowerCase().replace(/^@+/, '').trim()),
          chunk.map(e => e.eventType || 'FOLLOW'),
          chunk.map(e => e.importId || null),
          chunk.map(e => e.eventTime || new Date().toISOString()),
          chunk.map(e => e.notes || null)
        ]);
        evtCount += chunk.length;
      }
      console.log(`  ✓ Successfully imported ${evtCount} follower events.`);
    }

    // 8. Admin Audit Logs
    const auditFile = path.join(DATA_DIR, 'admin_audit_logs.json');
    if (fs.existsSync(auditFile)) {
      const logs = JSON.parse(fs.readFileSync(auditFile, 'utf8')) || [];
      console.log(`Importing ${logs.length} audit logs...`);
      for (const a of logs) {
        await client.query(`
          INSERT INTO admin_audit_logs (id, action, operator, details, result, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING
        `, [
          a.id,
          a.action,
          a.operator || 'Admin',
          typeof a.details === 'object' ? JSON.stringify(a.details) : String(a.details || ''),
          a.result || 'SUCCESS',
          a.createdAt || a.created_at || new Date().toISOString()
        ]);
      }
      console.log(`  ✓ Successfully imported ${logs.length} audit logs.`);
    }

    console.log('\n IMPORT COMPLETED SUCCESSFULLY!\n');
  } finally {
    client.release();
  }
}

async function main() {
  const mode = process.argv[2] || 'import-local';

  if (!TARGET_URL) {
    console.error('ERROR: No DATABASE_URL or DATABASE_URL_UNPOOLED found in .env');
    process.exit(1);
  }

  const targetPool = getPool(TARGET_URL);

  try {
    if (mode === 'import-local') {
      await importLocalData(targetPool);
      await verifyDatabase(targetPool);
    } else if (mode === 'import-sql') {
      const sqlFile = process.argv[3] || path.join(ROOT_DIR, 'vps_data_dump.sql');
      if (!fs.existsSync(sqlFile)) {
        console.error(`ERROR: File not found: ${sqlFile}`);
        process.exit(1);
      }
      console.log(`Executing SQL dump from ${sqlFile} into Neon...`);
      const sqlContent = fs.readFileSync(sqlFile, 'utf8');
      const client = await targetPool.connect();
      try {
        await client.query(sqlContent);
        console.log('✓ SQL dump executed successfully into Neon!');
      } finally {
        client.release();
      }
      await verifyDatabase(targetPool);
    } else if (mode === 'verify') {
      await verifyDatabase(targetPool);
    } else {
      console.log(`Unknown mode: ${mode}`);
      console.log('Usage:');
      console.log('  node scripts/migrate-data.js import-local');
      console.log('  node scripts/migrate-data.js verify');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await targetPool.end();
  }
}

main();
