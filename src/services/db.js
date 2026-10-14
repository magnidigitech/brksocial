/**
 * BRK Social - Central Data Service & LocalStorage Database
 * Pre-seeds 200 active employees mapped to 25 AP Parliament & 175 Assembly constituencies,
 * initial task "Instagram Follower Outreach", submission engine, settings, and full CRUD helpers.
 */
import { AP_CONSTITUENCIES } from './constituencyData.js';
import { PAT_STAFF_OCTOBER_2026 } from './staffSeedData.js';

const STORAGE_KEYS = {
  EMPLOYEES: 'brk_employees_v3', // bumped to v3 for official PAT Staff Details October 2026 (Support Code, Staff ID, Personal & Office Mobile)
  TASKS: 'brk_tasks_v1',
  SUBMISSIONS: 'brk_submissions_v1',
  AUDIT_LOGS: 'brk_audit_logs_v1',
  SETTINGS: 'brk_settings_v1',
  ADMIN_USER: 'brk_admin_user_v1',
  TRACKING_LINKS: 'brk_tracking_links_v1',
  LINK_CLICKS: 'brk_link_clicks_v1'
};

// Generate 200 Structured Staff Members (25 Parliament + 175 Assembly)
function generate200ConstituencyEmployees() {
  return PAT_STAFF_OCTOBER_2026;
}

// Initial Task Specifications with Dynamic Target Destination URLs
const DEFAULT_TASKS = [
  {
    id: 'TASK-INSTA-001',
    name: 'Instagram Follower Outreach',
    description: 'Connect with local youth and active social media users via Instagram outreach.',
    platform: 'Instagram',
    submissionType: 'Instagram Handle',
    targetUrl: 'https://www.instagram.com/ramakrishnabhashyam/',
    urlSlug: 'instagram',
    dailyTarget: 10,
    frequency: 'Daily',
    assignmentScope: {
      scopeType: 'ALL_STAFF',
      targetCode: null,
      targetName: 'All Constituencies & Staff'
    },
    rules: {
      duplicateScope: 'Entire Campaign',
      allowExtraSubmissions: true,
      requireProof: false
    },
    duplicateScope: 'Entire Campaign',
    allowExtraSubmissions: true,
    requireProof: false,
    status: 'Active',
    createdDate: '2026-09-17'
  },
  {
    id: 'TASK-WA-002',
    name: 'WhatsApp Voter Connect',
    description: 'Gather verified WhatsApp contact numbers of constituency booth leads.',
    platform: 'WhatsApp',
    submissionType: 'Mobile Number',
    targetUrl: 'https://chat.whatsapp.com/',
    urlSlug: 'whatsapp',
    dailyTarget: 15,
    frequency: 'Daily',
    assignmentScope: {
      scopeType: 'SPECIFIC_PARLIAMENT',
      targetCode: 'APP13',
      targetName: 'Guntur Parliament'
    },
    rules: {
      duplicateScope: 'Same Day Only',
      allowExtraSubmissions: true,
      requireProof: false
    },
    duplicateScope: 'Same Day Only',
    allowExtraSubmissions: true,
    requireProof: false,
    status: 'Active',
    createdDate: '2026-09-18'
  }
];

// Seed initial sample submissions for testing duplicate detection & stats
function generateInitialSubmissions(employees, task) {
  const dateStr = new Date().toISOString().split('T')[0];
  const submissions = [];

  // Seed sample valid submissions for APP13 (Guntur Parliament staff)
  const sampleHandlesEmp1 = ['ram123', 'krishna_2026', 'user12345', 'abcde123', 'hyderabad_digital', 'guntur_leads'];
  sampleHandlesEmp1.forEach((handle, idx) => {
    submissions.push({
      id: `SUB-${Date.now()}-${idx}`,
      taskId: task.id,
      employeeId: 'APP13',
      employeeName: employees.find(e => e.id === 'APP13')?.name || 'Ravi Kumar',
      platform: 'Instagram',
      username: handle,
      rawInput: `@${handle}`,
      status: 'Valid',
      submittedAt: new Date(Date.now() - (6 - idx) * 300000).toISOString(),
      date: dateStr
    });
  });

  // Seed sample cross-employee submission for APP13A07 (Guntur East staff)
  submissions.push({
    id: `SUB-${Date.now()}-10`,
    taskId: task.id,
    employeeId: 'APP13A07',
    employeeName: employees.find(e => e.id === 'APP13A07')?.name || 'Suresh Chowdary',
    platform: 'Instagram',
    username: 'sample_lead_002',
    rawInput: 'https://instagram.com/sample_lead_002/',
    status: 'Valid',
    submittedAt: new Date(Date.now() - 100000).toISOString(),
    date: dateStr
  });

  return submissions;
}

// Seed illustrative link clicks matching sample metrics if empty
function generateInitialLinkClicks(employees, task) {
  const dateStr = new Date().toISOString().split('T')[0];
  const clicks = [];
  const now = Date.now();

  // Illustrative top staff mentioned in requirements:
  // Betapudi Rojlin (APP01A01) — 56 clicks
  // Rajaboyina Manjula (APP01A02) — 31 clicks
  // Uusa Nagalakshmi (APP02A01) — 42 clicks
  const featuredStaff = [
    { search: 'Betapudi Rojlin', count: 56, code: 'APP01A01' },
    { search: 'Rajaboyina Manjula', count: 31, code: 'APP01A02' },
    { search: 'Uusa Nagalakshmi', count: 42, code: 'APP02A01' }
  ];

  featuredStaff.forEach(item => {
    const emp = employees.find(e => (e.name && e.name.toLowerCase().includes(item.search.toLowerCase())) || e.assemblyCode === item.code || e.id === item.code);
    if (emp) {
      const token = `token_${emp.id.toLowerCase()}`;
      for (let i = 0; i < item.count; i++) {
        const isBot = i % 15 === 0; // occasional preview crawler
        clicks.push({
          id: `CLK-${now}-${item.code}-${i}`,
          token,
          taskId: task.id,
          taskName: task.name,
          employeeId: emp.id,
          employeeName: emp.name,
          supportCode: emp.supportCode || emp.id,
          staffId: emp.staffId || emp.id,
          parliamentCode: emp.parliamentCode,
          parliamentName: emp.parliamentName,
          assemblyCode: emp.assemblyCode,
          assemblyName: emp.assemblyName,
          targetUrl: task.targetUrl || 'https://www.instagram.com/ramakrishnabhashyam/',
          ip: `49.37.${10 + (i % 20)}.${100 + (i % 150)}`,
          userAgent: isBot ? 'WhatsApp/2.24.18.15 A' : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
          referrer: 'https://api.whatsapp.com/',
          deviceType: 'Mobile',
          isBot,
          botName: isBot ? 'WhatsApp Preview' : null,
          isDuplicate: false,
          isValid: !isBot,
          timestamp: new Date(now - (item.count - i) * 600000).toISOString()
        });
      }
    }
  });

  // Add 15 other random active staff members with 3 to 15 clicks each
  const otherStaff = employees.filter(e => e.status === 'Active' && !featuredStaff.some(f => e.assemblyCode === f.code)).slice(0, 20);
  otherStaff.forEach((emp, sIdx) => {
    const count = 4 + (sIdx % 12);
    const token = `token_${emp.id.toLowerCase()}`;
    for (let j = 0; j < count; j++) {
      const isBot = j === 0 && sIdx % 3 === 0;
      clicks.push({
        id: `CLK-${now}-OTH-${sIdx}-${j}`,
        token,
        taskId: task.id,
        taskName: task.name,
        employeeId: emp.id,
        employeeName: emp.name,
        supportCode: emp.supportCode || emp.id,
        staffId: emp.staffId || emp.id,
        parliamentCode: emp.parliamentCode,
        parliamentName: emp.parliamentName,
        assemblyCode: emp.assemblyCode,
        assemblyName: emp.assemblyName,
        targetUrl: task.targetUrl || 'https://www.instagram.com/ramakrishnabhashyam/',
        ip: `152.57.${10 + (sIdx % 30)}.${50 + (j % 150)}`,
        userAgent: isBot ? 'facebookexternalhit/1.1' : 'Mozilla/5.0 (Linux; Android 14; SM-S928B) Chrome/128.0.0.0 Mobile Safari/537.36',
        referrer: 'Direct',
        deviceType: 'Mobile',
        isBot,
        botName: isBot ? 'Facebook Preview' : null,
        isDuplicate: false,
        isValid: !isBot,
        timestamp: new Date(now - (25 - j) * 900000).toISOString()
      });
    }
  });

  return clicks;
}

export const dbService = {
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.EMPLOYEES)) {
      const emps = generate200ConstituencyEmployees();
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(emps));
    } else {
      // Clean any lingering (SC) / (ST) from existing names while preserving edits
      try {
        const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.EMPLOYEES));
        let modified = false;
        existing.forEach(e => {
          if (e.parliamentName && (e.parliamentName.includes('(SC)') || e.parliamentName.includes('(ST)'))) {
            e.parliamentName = e.parliamentName.replace(/\s*\((SC|ST)\)/gi, '');
            modified = true;
          }
          if (e.assemblyName && (e.assemblyName.includes('(SC)') || e.assemblyName.includes('(ST)'))) {
            e.assemblyName = e.assemblyName.replace(/\s*\((SC|ST)\)/gi, '');
            modified = true;
          }
        });
        if (modified) {
          localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(existing));
        }
      } catch (err) {
        // Fallback seed
        const emps = generate200ConstituencyEmployees();
        localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(emps));
      }
    }
    if (!localStorage.getItem(STORAGE_KEYS.TASKS)) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(DEFAULT_TASKS));
    } else {
      // Ensure all tasks have targetUrl & urlSlug
      try {
        const existingTasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || [];
        let taskModified = false;
        existingTasks.forEach(t => {
          if (!t.targetUrl) {
            t.targetUrl = t.platform === 'WhatsApp' ? 'https://chat.whatsapp.com/' : 'https://www.instagram.com/ramakrishnabhashyam/';
            taskModified = true;
          }
          if (!t.urlSlug) {
            t.urlSlug = t.platform?.toLowerCase() === 'whatsapp' ? 'whatsapp' : 'instagram';
            taskModified = true;
          }
        });
        if (taskModified) {
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(existingTasks));
        }
      } catch (err) {}
    }
    if (!localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) {
      const emps = JSON.parse(localStorage.getItem(STORAGE_KEYS.EMPLOYEES));
      const tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS));
      const subs = generateInitialSubmissions(emps, tasks[0]);
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
    }
    if (!localStorage.getItem(STORAGE_KEYS.LINK_CLICKS)) {
      const emps = JSON.parse(localStorage.getItem(STORAGE_KEYS.EMPLOYEES)) || [];
      const tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || DEFAULT_TASKS;
      const initialClicks = generateInitialLinkClicks(emps, tasks[0]);
      localStorage.setItem(STORAGE_KEYS.LINK_CLICKS, JSON.stringify(initialClicks));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TRACKING_LINKS)) {
      localStorage.setItem(STORAGE_KEYS.TRACKING_LINKS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ADMIN_USER)) {
      localStorage.setItem(STORAGE_KEYS.ADMIN_USER, JSON.stringify({
        username: 'admin',
        password: 'admin123',
        name: 'Bhashyam Admin',
        email: 'admin@bhashyam.in'
      }));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
        duplicateScope: 'Entire Campaign',
        allowExtraSubmissions: true,
        defaultTarget: 10
      }));
    }
  },

  getAdminAccount() {
    this.init();
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ADMIN_USER));
  },

  updateAdminPassword(newPassword) {
    const admin = this.getAdminAccount();
    admin.password = newPassword;
    localStorage.setItem(STORAGE_KEYS.ADMIN_USER, JSON.stringify(admin));
  },

  getEmployees() {
    this.init();
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.EMPLOYEES)) || [];
  },

  getEmployeeById(id) {
    const emps = this.getEmployees();
    return emps.find(e => e.id.toLowerCase() === id.toLowerCase()) || null;
  },

  addEmployee(empData) {
    const emps = this.getEmployees();
    const newEmp = {
      id: empData.id ? empData.id.toUpperCase() : `APP${String(emps.length + 1).padStart(2, '0')}`,
      name: empData.name,
      level: empData.level || (empData.assemblyCode ? 'Assembly' : 'Parliament'),
      parliamentCode: empData.parliamentCode || 'APP13',
      parliamentName: empData.parliamentName || 'Guntur',
      assemblyCode: empData.assemblyCode || null,
      assemblyName: empData.assemblyName || null,
      department: empData.department || 'Outreach Staff',
      mobile: empData.mobile || '9999999999',
      email: empData.email || `${(empData.id || 'emp').toLowerCase()}@bhashyam.in`,
      status: empData.status || 'Active',
      joinedDate: new Date().toISOString().split('T')[0],
      password: empData.password || 'password123'
    };
    emps.unshift(newEmp);
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(emps));
    return newEmp;
  },

  updateEmployee(updatedEmp) {
    const emps = this.getEmployees();
    const idx = emps.findIndex(e => e.id.toUpperCase() === updatedEmp.id.toUpperCase());
    if (idx !== -1) {
      emps[idx] = { ...emps[idx], ...updatedEmp };
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(emps));
      return emps[idx];
    }
    return null;
  },

  batchUpdateEmployees(updatedArray) {
    const emps = this.getEmployees();
    let count = 0;
    updatedArray.forEach(item => {
      const idx = emps.findIndex(e => e.id.toUpperCase() === item.id.toUpperCase());
      if (idx !== -1) {
        emps[idx] = { ...emps[idx], ...item };
        count++;
      } else {
        emps.push(item);
        count++;
      }
    });
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(emps));
    return count;
  },

  updateEmployeePassword(employeeId, newPassword) {
    const emps = this.getEmployees();
    const emp = emps.find(e => e.id.toUpperCase() === employeeId.toUpperCase());
    if (emp) {
      emp.password = newPassword;
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(emps));
      return true;
    }
    return false;
  },

  deleteEmployee(employeeId) {
    const emps = this.getEmployees();
    const filtered = emps.filter(e => e.id.toUpperCase() !== employeeId.toUpperCase());
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(filtered));
    return true;
  },

  importEmployeesFromCSV(csvText) {
    const lines = csvText.split('\n');
    let importedCount = 0;
    const emps = this.getEmployees();
    const existingIds = new Set(emps.map(e => e.id.toUpperCase()));

    lines.forEach((line, index) => {
      if (index === 0 && line.toLowerCase().includes('employee')) return;
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2 && parts[0]) {
        const empId = parts[0].toUpperCase();
        if (!existingIds.has(empId)) {
          emps.push({
            id: empId,
            name: parts[1] || 'Imported Staff',
            level: parts[2] || (empId.includes('A') ? 'Assembly' : 'Parliament'),
            parliamentCode: parts[3] || 'APP13',
            parliamentName: parts[4] || 'Guntur',
            assemblyCode: parts[5] || null,
            assemblyName: parts[6] || null,
            mobile: parts[7] || '9800000000',
            email: `${empId.toLowerCase()}@bhashyam.in`,
            status: 'Active',
            joinedDate: new Date().toISOString().split('T')[0],
            password: 'password123'
          });
          existingIds.add(empId);
          importedCount++;
        }
      }
    });

    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(emps));
    return importedCount;
  },

  getTasks() {
    this.init();
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || [];
  },

  getTaskById(id) {
    const tasks = this.getTasks();
    return tasks.find(t => t.id === id) || null;
  },

  getActiveTask() {
    const tasks = this.getTasks();
    return tasks.find(t => t.status === 'Active') || tasks[0];
  },

  getTasksForEmployee(employeeId) {
    const tasks = this.getTasks();
    const emp = this.getEmployeeById(employeeId);
    if (!emp) return tasks.filter(t => t.status === 'Active');

    return tasks.filter(task => {
      if (task.status !== 'Active') return false;
      const scope = task.assignmentScope || {};
      const scopeType = scope.scopeType || 'ALL_STAFF';
      const targetCode = scope.targetCode;
      const targetCodes = scope.targetCodes || (targetCode ? [targetCode] : []);

      if (scopeType === 'ALL_STAFF') return true;
      if (scopeType === 'ALL_ASSEMBLIES') return true;
      if (scopeType === 'ALL_PARLIAMENTS') return true;

      if (scopeType === 'SPECIFIC_PARLIAMENT' || scopeType === 'SELECTED_PARLIAMENTS') {
        return targetCodes.includes(emp.parliamentCode);
      }
      if (scopeType === 'SPECIFIC_ASSEMBLY' || scopeType === 'SELECTED_ASSEMBLIES') {
        return targetCodes.includes(emp.assemblyCode) || targetCodes.includes(emp.id);
      }
      return true;
    });
  },

  addTask(taskData) {
    const tasks = this.getTasks();
    const newTask = {
      id: `TASK-${Date.now()}`,
      name: taskData.name || 'New Task',
      description: taskData.description || '',
      platform: taskData.platform || 'Instagram',
      submissionType: taskData.submissionType || 'Instagram Handle',
      dailyTarget: Number(taskData.dailyTarget) || 10,
      frequency: taskData.frequency || 'Daily',
      assignmentScope: taskData.assignmentScope || {
        scopeType: 'ALL_STAFF',
        targetCode: null,
        targetName: 'All Constituencies & Staff'
      },
      rules: taskData.rules || {
        duplicateScope: 'Entire Campaign',
        allowExtraSubmissions: true,
        requireProof: false
      },
      duplicateScope: taskData.rules?.duplicateScope || taskData.duplicateScope || 'Entire Campaign',
      allowExtraSubmissions: taskData.rules?.allowExtraSubmissions ?? true,
      requireProof: taskData.rules?.requireProof ?? false,
      status: taskData.status || 'Active',
      createdDate: new Date().toISOString().split('T')[0]
    };
    tasks.unshift(newTask);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    return newTask;
  },

  updateTask(updatedTask) {
    const tasks = this.getTasks();
    const idx = tasks.findIndex(t => t.id === updatedTask.id);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...updatedTask };
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
      return tasks[idx];
    }
    return null;
  },

  updateTaskSettings(updatedTask) {
    return this.updateTask(updatedTask);
  },

  deleteTask(taskId) {
    const tasks = this.getTasks();
    const filtered = tasks.filter(t => t.id !== taskId);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(filtered));
    return true;
  },

  toggleTaskStatus(taskId) {
    const tasks = this.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.status = task.status === 'Active' ? 'Paused' : 'Active';
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
      return task.status;
    }
    return null;
  },

  getSubmissions(dateFilter = null) {
    this.init();
    let subs = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) || [];
    if (dateFilter) {
      subs = subs.filter(s => s.date === dateFilter);
    }
    return subs;
  },

  getAuditLogs() {
    this.init();
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) || [];
  },

  processSubmission({ employeeId, taskId, normalizedUsername, rawInput }) {
    this.init();
    const todayStr = new Date().toISOString().split('T')[0];
    const allSubs = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) || [];
    const auditLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) || [];
    const employees = this.getEmployees();
    const emp = employees.find(e => e.id.toUpperCase() === employeeId.toUpperCase()) || { name: employeeId };
    const task = this.getTaskById(taskId) || this.getActiveTask();
    const platform = task?.platform || 'Instagram';
    const effectiveTaskId = task?.id || taskId;

    const selfExisting = allSubs.find(s => 
      s.taskId === effectiveTaskId && 
      s.employeeId.toUpperCase() === employeeId.toUpperCase() && 
      s.username === normalizedUsername &&
      s.status === 'Valid'
    );

    if (selfExisting) {
      const repeatedSub = {
        id: `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        taskId: effectiveTaskId,
        employeeId: emp.id || employeeId,
        employeeName: emp.name,
        platform,
        username: normalizedUsername,
        rawInput,
        status: 'Repeated',
        duplicateOf: selfExisting.id,
        submittedAt: new Date().toISOString(),
        date: todayStr
      };
      allSubs.unshift(repeatedSub);
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(allSubs));

      auditLogs.unshift({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'REPEATED_SUBMISSION',
        username: normalizedUsername,
        originalEmployeeId: emp.id || employeeId,
        attemptedEmployeeId: emp.id || employeeId,
        message: `Employee ${emp.name} (${emp.id}) attempted submitting entry '${normalizedUsername}' which they previously submitted.`
      });
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));

      return {
        success: false,
        status: 'Repeated',
        message: 'You have already submitted this entry previously.',
        normalizedUsername
      };
    }

    const duplicateScope = task.rules?.duplicateScope || task.duplicateScope || 'Entire Campaign';
    let crossExisting = null;

    if (duplicateScope === 'Same Day') {
      crossExisting = allSubs.find(s => 
        s.taskId === effectiveTaskId && 
        s.date === todayStr &&
        s.username === normalizedUsername &&
        s.status === 'Valid'
      );
    } else if (duplicateScope === 'Same Constituency') {
      crossExisting = allSubs.find(s => {
        if (s.taskId !== effectiveTaskId || s.username !== normalizedUsername || s.status !== 'Valid') return false;
        const otherEmp = employees.find(e => e.id.toUpperCase() === s.employeeId.toUpperCase());
        return otherEmp && (otherEmp.parliamentCode === emp.parliamentCode || otherEmp.assemblyCode === emp.assemblyCode);
      });
    } else if (duplicateScope === 'Entire Campaign') {
      crossExisting = allSubs.find(s => 
        s.taskId === effectiveTaskId && 
        s.username === normalizedUsername &&
        s.status === 'Valid'
      );
    }

    if (crossExisting) {
      const dupSub = {
        id: `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        taskId: effectiveTaskId,
        employeeId: emp.id || employeeId,
        employeeName: emp.name,
        platform,
        username: normalizedUsername,
        rawInput,
        status: 'Duplicate',
        duplicateOf: crossExisting.id,
        originalEmployeeId: crossExisting.employeeId,
        originalEmployeeName: crossExisting.employeeName,
        submittedAt: new Date().toISOString(),
        date: todayStr
      };
      allSubs.unshift(dupSub);
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(allSubs));

      auditLogs.unshift({
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'CROSS_DUPLICATE',
        username: normalizedUsername,
        originalEmployeeId: crossExisting.employeeId,
        originalEmployeeName: crossExisting.employeeName,
        attemptedEmployeeId: emp.id || employeeId,
        attemptedEmployeeName: emp.name,
        message: `Duplicate Attempt: ${emp.name} (${emp.id}) submitted '${normalizedUsername}', originally submitted by ${crossExisting.employeeName} (${crossExisting.employeeId}).`
      });
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));

      return {
        success: false,
        status: 'Duplicate',
        message: `Duplicate detected! This entry was already submitted by ${crossExisting.employeeName} (${crossExisting.employeeId}).`,
        normalizedUsername
      };
    }

    const validSub = {
      id: `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      taskId: effectiveTaskId,
      employeeId: emp.id || employeeId,
      employeeName: emp.name,
      platform,
      username: normalizedUsername,
      rawInput,
      status: 'Valid',
      submittedAt: new Date().toISOString(),
      date: todayStr
    };
    allSubs.unshift(validSub);
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(allSubs));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('brk_submission_event', { detail: { timestamp: Date.now() } }));
    }

    return {
      success: true,
      status: 'Valid',
      message: 'Submission recorded successfully!',
      submission: validSub
    };
  },

  getEmployeeDailyStats(employeeId, dateStr = new Date().toISOString().split('T')[0], taskId = null) {
    const task = taskId ? (this.getTaskById(taskId) || this.getActiveTask()) : this.getActiveTask();
    const subs = this.getSubmissions().filter(s => 
      s.employeeId.toUpperCase() === employeeId.toUpperCase() && 
      s.date === dateStr &&
      (!task || s.taskId === task.id)
    );
    
    const validSubs = subs.filter(s => s.status === 'Valid');
    const dupSubs = subs.filter(s => s.status === 'Duplicate');
    const repeatedSubs = subs.filter(s => s.status === 'Repeated');
    const validCount = validSubs.length;
    const target = task?.dailyTarget || 10;
    const remaining = Math.max(0, target - validCount);
    const progressPercent = Math.min(100, Math.round((validCount / target) * 100));

    let status = 'Not Started';
    if (validCount >= target) {
      status = 'Completed';
    } else if (validCount > 0) {
      status = 'In Progress';
    }

    return {
      task,
      target,
      validCount,
      remaining,
      progressPercent,
      duplicateCount: dupSubs.length + repeatedSubs.length,
      status,
      todaySubmissions: subs
    };
  },

  getAdminDashboardOverview(dateStr = new Date().toISOString().split('T')[0], selectedTaskId = null) {
    const employees = this.getEmployees();
    const activeEmployees = employees.filter(e => e.status === 'Active');
    const tasks = this.getTasks();
    const targetTask = selectedTaskId ? (this.getTaskById(selectedTaskId) || this.getActiveTask()) : this.getActiveTask();

    let todaySubs = this.getSubmissions(dateStr);
    if (targetTask) {
      todaySubs = todaySubs.filter(s => s.taskId === targetTask.id);
    }

    const validSubs = todaySubs.filter(s => s.status === 'Valid');
    const duplicateSubs = todaySubs.filter(s => s.status === 'Duplicate' || s.status === 'Repeated');
    const rejectedSubs = todaySubs.filter(s => s.status === 'Rejected');

    const dailyTargetPerEmp = targetTask ? (targetTask.dailyTarget || 10) : (this.getActiveTask()?.dailyTarget || 10);
    const totalTarget = activeEmployees.length * dailyTargetPerEmp;
    const validCount = validSubs.length;
    const duplicateCount = duplicateSubs.length;
    const remainingCount = Math.max(0, totalTarget - validCount);

    let completedEmpCount = 0;
    let inProgressEmpCount = 0;
    let notStartedEmpCount = 0;

    const empProgressList = activeEmployees.map(emp => {
      const empSubs = todaySubs.filter(s => s.employeeId.toUpperCase() === emp.id.toUpperCase());
      const empValid = empSubs.filter(s => s.status === 'Valid').length;
      const empDup = empSubs.filter(s => s.status === 'Duplicate' || s.status === 'Repeated').length;
      const target = dailyTargetPerEmp;
      const empRemaining = Math.max(0, target - empValid);

      let empStatus = 'Not Started';
      if (empValid >= target) {
        empStatus = 'Completed';
        completedEmpCount++;
      } else if (empValid > 0) {
        empStatus = 'In Progress';
        inProgressEmpCount++;
      } else {
        notStartedEmpCount++;
      }

      return {
        ...emp,
        target,
        valid: empValid,
        duplicate: empDup,
        remaining: empRemaining,
        status: empStatus
      };
    });

    return {
      date: dateStr,
      selectedTask: targetTask,
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
      tasksToday: tasks.length,
      targetSubmissions: totalTarget,
      validSubmissions: validCount,
      duplicates: duplicateCount,
      rejected: rejectedSubs.length,
      remaining: remainingCount,
      completedEmpCount,
      inProgressEmpCount,
      notStartedEmpCount,
      employeeProgressList: empProgressList
    };
  },

  // ==========================================
  // IN-HOUSE LINK TRACKING & ANALYTICS ENGINE
  // ==========================================

  // Generate deterministic base62-style short token from taskId + employeeId
  generateLinkToken(taskId, employeeId) {
    const raw = `${taskId}_${employeeId}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash);
    const chars = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'; // base54 without ambiguous 0/O, 1/l/I
    let str = '';
    let num = absHash;
    while (num > 0) {
      str = chars[num % chars.length] + str;
      num = Math.floor(num / chars.length);
    }
    const empSuffix = employeeId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toLowerCase();
    return `${str}${empSuffix}`.slice(0, 10);
  },

  getTrackingLinks() {
    this.init();
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TRACKING_LINKS)) || [];
  },

  getTrackingLinkForEmployee(arg1, arg2, baseUrl = '') {
    this.init();
    const links = this.getTrackingLinks();

    // Flexible argument detection: support both (taskId, empId) and (empId, taskId)
    let task = null;
    let emp = null;

    if (arg1 && arg2) {
      task = this.getTaskById(arg1);
      emp = this.getEmployeeById(arg2);

      if (!emp || !task) {
        const empCandidate = this.getEmployeeById(arg1);
        const taskCandidate = this.getTaskById(arg2);
        if (empCandidate) emp = empCandidate;
        if (taskCandidate) task = taskCandidate;
      }
    }

    if (!task) {
      task = this.getActiveTask();
    }

    if (!emp) {
      emp = this.getEmployeeById(arg1) || this.getEmployeeById(arg2);
    }

    if (!task || !emp) return null;

    const effectiveBaseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://social.bhashyamramakrishna.in');
    const existing = links.find(l => l.taskId === task.id && l.employeeId.toUpperCase() === emp.id.toUpperCase());

    const slug = task.urlSlug || (task.platform?.toLowerCase() === 'instagram' ? 'instagram' : 'go');
    const targetUrl = task.targetUrl || 'https://www.instagram.com/ramakrishnabhashyam/';

    if (existing) {
      if (existing.targetUrl !== targetUrl || existing.slug !== slug) {
        existing.targetUrl = targetUrl;
        existing.slug = slug;
        existing.fullUrl = `${effectiveBaseUrl}/${slug}/${existing.token}`;
        existing.shortUrl = `${effectiveBaseUrl}/go/${existing.token}`;
        localStorage.setItem(STORAGE_KEYS.TRACKING_LINKS, JSON.stringify(links));
      } else {
        existing.fullUrl = `${effectiveBaseUrl}/${slug}/${existing.token}`;
        existing.shortUrl = `${effectiveBaseUrl}/go/${existing.token}`;
      }
      return existing;
    }

    const token = this.generateLinkToken(task.id, emp.id);
    const newLink = {
      id: `LNK-${task.id}-${emp.id}`,
      token,
      taskId: task.id,
      taskName: task.name,
      employeeId: emp.id,
      employeeName: emp.name,
      supportCode: emp.supportCode || emp.id,
      staffId: emp.staffId || emp.id,
      parliamentCode: emp.parliamentCode,
      parliamentName: emp.parliamentName,
      assemblyCode: emp.assemblyCode,
      assemblyName: emp.assemblyName,
      targetUrl,
      slug,
      fullUrl: `${effectiveBaseUrl}/${slug}/${token}`,
      shortUrl: `${effectiveBaseUrl}/go/${token}`,
      createdAt: new Date().toISOString()
    };

    links.push(newLink);
    localStorage.setItem(STORAGE_KEYS.TRACKING_LINKS, JSON.stringify(links));
    return newLink;
  },

  resolveTrackingToken(tokenOrSlug) {
    this.init();
    if (!tokenOrSlug) return null;
    const clean = tokenOrSlug.trim();
    const links = this.getTrackingLinks();
    
    // 1. Direct match on token
    let match = links.find(l => l.token.toLowerCase() === clean.toLowerCase());
    if (match) return match;

    // 2. Match on employee ID, support code, or staffId for fallback readability
    const emps = this.getEmployees();
    const emp = emps.find(e => 
      e.id.toLowerCase() === clean.toLowerCase() ||
      (e.supportCode && e.supportCode.toLowerCase() === clean.toLowerCase()) ||
      (e.staffId && e.staffId.toLowerCase() === clean.toLowerCase())
    );

    if (emp) {
      const activeTask = this.getActiveTask();
      if (activeTask) {
        return this.getTrackingLinkForEmployee(activeTask.id, emp.id);
      }
    }

    // 3. Fallback to active task target
    const activeTask = this.getActiveTask();
    return {
      targetUrl: activeTask?.targetUrl || 'https://www.instagram.com/ramakrishnabhashyam/',
      token: clean,
      taskId: activeTask?.id || 'TASK-INSTA-001',
      taskName: activeTask?.name || 'Instagram Follower Outreach',
      employeeId: 'UNKNOWN',
      employeeName: 'General Visitor',
      supportCode: '',
      parliamentCode: '',
      assemblyCode: ''
    };
  },

  getLinkClicks(filter = null) {
    this.init();
    let clicks = JSON.parse(localStorage.getItem(STORAGE_KEYS.LINK_CLICKS)) || [];
    if (filter) {
      if (filter.taskId) clicks = clicks.filter(c => c.taskId === filter.taskId);
      if (filter.employeeId) clicks = clicks.filter(c => c.employeeId.toUpperCase() === filter.employeeId.toUpperCase());
      if (filter.date) clicks = clicks.filter(c => c.timestamp.startsWith(filter.date));
      if (filter.isValid !== undefined) clicks = clicks.filter(c => c.isValid === filter.isValid);
    }
    return clicks;
  },

  recordLinkClick({ token, ip, userAgent, referrer, host }) {
    this.init();
    const resolved = this.resolveTrackingToken(token);
    const ua = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
    const ref = referrer || (typeof document !== 'undefined' ? document.referrer : '');
    const clientIp = ip || '127.0.0.1';

    // Bot & WhatsApp Preview Detection
    const isBot = /bot|crawler|spider|crawling|whatsapp|facebookexternalhit|meta-externalagent|twitterbot|telegrambot|slackbot|discordbot|applebot/i.test(ua);
    let botName = null;
    if (isBot) {
      if (/whatsapp/i.test(ua)) botName = 'WhatsApp Preview';
      else if (/facebookexternalhit/i.test(ua)) botName = 'Facebook Preview';
      else if (/twitterbot/i.test(ua)) botName = 'Twitter/X Preview';
      else if (/telegrambot/i.test(ua)) botName = 'Telegram Preview';
      else botName = 'Crawler / Bot';
    }

    const clicks = JSON.parse(localStorage.getItem(STORAGE_KEYS.LINK_CLICKS)) || [];

    // Deduplication check: same token and same IP within 5 seconds
    const now = Date.now();
    const isDuplicate = clicks.some(c => 
      c.token === (resolved?.token || token) &&
      c.ip === clientIp &&
      (now - new Date(c.timestamp).getTime()) < 5000
    );

    const isValid = !isBot && !isDuplicate;

    const clickRecord = {
      id: `CLK-${now}-${Math.random().toString(36).substring(2, 7)}`,
      token: resolved?.token || token,
      taskId: resolved?.taskId || 'TASK-INSTA-001',
      taskName: resolved?.taskName || 'Instagram Outreach',
      employeeId: resolved?.employeeId || 'UNKNOWN',
      employeeName: resolved?.employeeName || 'Unknown Staff',
      supportCode: resolved?.supportCode || '',
      staffId: resolved?.staffId || '',
      parliamentCode: resolved?.parliamentCode || '',
      parliamentName: resolved?.parliamentName || '',
      assemblyCode: resolved?.assemblyCode || '',
      assemblyName: resolved?.assemblyName || '',
      targetUrl: resolved?.targetUrl || 'https://www.instagram.com/ramakrishnabhashyam/',
      ip: clientIp,
      userAgent: ua,
      referrer: ref || 'Direct',
      deviceType: /mobile|android|iphone|ipad/i.test(ua) ? 'Mobile' : 'Desktop',
      isBot,
      botName,
      isDuplicate,
      isValid,
      timestamp: new Date().toISOString()
    };

    clicks.unshift(clickRecord);
    // Keep last 10,000 clicks in local storage
    if (clicks.length > 10000) clicks.length = 10000;
    localStorage.setItem(STORAGE_KEYS.LINK_CLICKS, JSON.stringify(clicks));

    // Dispatch custom event for real-time live sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('brk_link_click_event', { detail: clickRecord }));
      window.dispatchEvent(new CustomEvent('storage', { key: STORAGE_KEYS.LINK_CLICKS }));
    }

    return {
      success: true,
      clickRecord,
      targetUrl: resolved?.targetUrl || 'https://www.instagram.com/ramakrishnabhashyam/'
    };
  },

  getLinkAnalytics({ dateStr, taskId, parliamentCode, assemblyCode } = {}) {
    this.init();
    const effectiveDate = dateStr || new Date().toISOString().split('T')[0];
    const allClicks = JSON.parse(localStorage.getItem(STORAGE_KEYS.LINK_CLICKS)) || [];
    const employees = this.getEmployees();
    const tasks = this.getTasks();
    const targetTask = taskId ? (this.getTaskById(taskId) || this.getActiveTask()) : this.getActiveTask();

    // Filter clicks
    let filteredClicks = allClicks;
    if (effectiveDate && effectiveDate !== 'ALL') {
      filteredClicks = filteredClicks.filter(c => c.timestamp && c.timestamp.startsWith(effectiveDate));
    }
    if (targetTask) {
      filteredClicks = filteredClicks.filter(c => c.taskId === targetTask.id);
    }
    if (parliamentCode && parliamentCode !== 'ALL') {
      filteredClicks = filteredClicks.filter(c => c.parliamentCode === parliamentCode);
    }
    if (assemblyCode && assemblyCode !== 'ALL') {
      filteredClicks = filteredClicks.filter(c => c.assemblyCode === assemblyCode);
    }

    const totalClicks = filteredClicks.length;
    const validClicks = filteredClicks.filter(c => c.isValid).length;
    const botClicks = filteredClicks.filter(c => c.isBot).length;
    const duplicateClicks = filteredClicks.filter(c => c.isDuplicate).length;

    // Unique visitors by IP among valid clicks
    const uniqueIps = new Set(filteredClicks.filter(c => c.isValid).map(c => c.ip));
    const uniqueVisitors = uniqueIps.size;

    const mobileClicks = filteredClicks.filter(c => c.isValid && c.deviceType === 'Mobile').length;
    const desktopClicks = filteredClicks.filter(c => c.isValid && c.deviceType === 'Desktop').length;

    // Daily target per staff
    const dailyTarget = targetTask?.dailyTarget || 10;

    // Scope active employees
    let activeEmployees = employees.filter(e => e.status === 'Active');
    if (parliamentCode && parliamentCode !== 'ALL') {
      activeEmployees = activeEmployees.filter(e => e.parliamentCode === parliamentCode);
    }
    if (assemblyCode && assemblyCode !== 'ALL') {
      activeEmployees = activeEmployees.filter(e => e.assemblyCode === assemblyCode);
    }

    const totalTarget = activeEmployees.length * dailyTarget;

    // Staff Performance Leaderboard
    const staffPerformance = activeEmployees.map(emp => {
      const empClicks = filteredClicks.filter(c => c.employeeId.toUpperCase() === emp.id.toUpperCase());
      const empValid = empClicks.filter(c => c.isValid).length;
      const empTotal = empClicks.length;
      const empBots = empClicks.filter(c => c.isBot).length;
      const target = dailyTarget;
      const completionRate = target > 0 ? Math.min(100, Math.round((empValid / target) * 100)) : 0;
      let status = 'Not Started';
      if (empValid >= target) status = 'Completed';
      else if (empValid > 0) status = 'In Progress';

      return {
        ...emp,
        validClicks: empValid,
        totalClicks: empTotal,
        botClicks: empBots,
        target,
        completionRate,
        status,
        lastClickTime: empClicks[0]?.timestamp || null
      };
    });

    // Sort by valid clicks desc
    staffPerformance.sort((a, b) => b.validClicks - a.validClicks || a.name.localeCompare(b.name));

    const completedStaffCount = staffPerformance.filter(s => s.status === 'Completed').length;
    const inProgressStaffCount = staffPerformance.filter(s => s.status === 'In Progress').length;
    const notStartedStaffCount = staffPerformance.filter(s => s.status === 'Not Started').length;

    return {
      date: effectiveDate,
      selectedTask: targetTask,
      totalClicks,
      validClicks,
      botClicks,
      duplicateClicks,
      uniqueVisitors,
      mobileClicks,
      desktopClicks,
      totalTarget,
      activeEmployeesCount: activeEmployees.length,
      completedStaffCount,
      inProgressStaffCount,
      notStartedStaffCount,
      staffPerformance,
      recentClicks: filteredClicks.slice(0, 50)
    };
  },

  getEmployeeTaskClicks(employeeId, taskId, dateStr) {
    this.init();
    if (!employeeId) return { totalClicks: 0, validClicks: 0, uniqueIps: 0, botClicks: 0, valueOf() { return 0; } };
    const effectiveDate = dateStr || new Date().toISOString().split('T')[0];
    const allClicks = JSON.parse(localStorage.getItem(STORAGE_KEYS.LINK_CLICKS)) || [];
    const empClicks = allClicks.filter(c => 
      c.employeeId && c.employeeId.toUpperCase() === employeeId.toUpperCase() &&
      (!taskId || c.taskId === taskId) &&
      (!effectiveDate || (c.timestamp && c.timestamp.startsWith(effectiveDate)))
    );
    const valid = empClicks.filter(c => c.isValid);
    const bots = empClicks.filter(c => c.isBot);
    const uniqueIps = new Set(valid.map(c => c.ip || c.id)).size;

    return {
      totalClicks: empClicks.length,
      validClicks: valid.length,
      uniqueIps: uniqueIps,
      botClicks: bots.length,
      valueOf() { return valid.length; }
    };
  },

  resetDatabase() {
    localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
    localStorage.removeItem(STORAGE_KEYS.TASKS);
    localStorage.removeItem(STORAGE_KEYS.SUBMISSIONS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.TRACKING_LINKS);
    localStorage.removeItem(STORAGE_KEYS.LINK_CLICKS);
    this.init();
  }
};
