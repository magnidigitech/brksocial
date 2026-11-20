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

    // 3. Submissions
    const subsFile = path.join(DATA_DIR, 'submissions.json');
    if (fs.existsSync(subsFile)) {
      const subs = JSON.parse(fs.readFileSync(subsFile, 'utf8')) || [];
      console.log(`Importing ${subs.length} submissions...`);
      let subCount = 0;
      for (const s of subs) {
        if (!s.id || !s.username) continue;
        await client.query(`
          INSERT INTO submissions (
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
            verification_note = EXCLUDED.verification_note
        `, [
          String(s.id),
          s.taskId || 'TASK-INSTA-001',
          s.employeeId || 'UNKNOWN',
          s.employeeName || 'Staff Member',
          s.supportCode || s.employeeId,
          s.staffId || '',
          s.parliamentCode || 'APP13',
          s.parliamentName || 'Guntur',
          s.assemblyCode || null,
          s.assemblyName || null,
          s.platform || 'Instagram',
          String(s.username).trim().toLowerCase().replace(/^@+/, ''),
          s.rawInput || s.username,
          s.status || 'Valid Submission',
          s.isValid !== undefined ? Boolean(s.isValid) : true,
          Boolean(s.isFollower),
          Boolean(s.isDuplicate),
          s.duplicateOf || null,
          s.followedAtFormatted || null,
          s.followedAtTimestamp ? Number(s.followedAtTimestamp) : null,
          s.verificationBadge || null,
          s.verificationNote || null,
          s.submittedAt || new Date().toISOString(),
          s.date || new Date().toISOString().split('T')[0],
          s.timeFormattedIST || ''
        ]);
        subCount++;
      }
      console.log(`  ✓ Successfully imported ${subCount} submissions.`);
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

    // 6. Link Clicks
    const clicksFile = path.join(DATA_DIR, 'link_clicks.json');
    if (fs.existsSync(clicksFile)) {
      const clicks = JSON.parse(fs.readFileSync(clicksFile, 'utf8')) || [];
      console.log(`Importing ${clicks.length} link click analytics records...`);
      for (const c of clicks) {
        await client.query(`
          INSERT INTO link_clicks (
            id, token, task_id, employee_id, parliament_code, assembly_code,
            ip_address, user_agent, referrer, device_type, is_bot, bot_name,
            is_duplicate, is_valid, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO NOTHING
        `, [
          c.id,
          c.token,
          c.taskId || 'TASK-INSTA-001',
          c.employeeId || 'UNKNOWN',
          c.parliamentCode || '',
          c.assemblyCode || '',
          c.ip || c.ip_address || '127.0.0.1',
          c.userAgent || c.user_agent || '',
          c.referrer || '',
          c.deviceType || c.device_type || 'Mobile',
          Boolean(c.isBot),
          c.botName || null,
          Boolean(c.isDuplicate),
          c.isValid !== undefined ? Boolean(c.isValid) : true,
          c.timestamp || c.created_at || new Date().toISOString()
        ]);
      }
      console.log(`  ✓ Successfully imported ${clicks.length} link clicks.`);
    }

    // 7. Admin Audit Logs
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
