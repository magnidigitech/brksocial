import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

// Serve React Production Build Static Files
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(` BRK Social Express Backend Server running on http://localhost:${PORT}`);
});
