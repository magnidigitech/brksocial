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
  ADMIN_USER: 'brk_admin_user_v1'
};

// Generate 200 Structured Staff Members (25 Parliament + 175 Assembly)
function generate200ConstituencyEmployees() {
  return PAT_STAFF_OCTOBER_2026;
}

// Initial Task Specifications
const DEFAULT_TASKS = [
  {
    id: 'TASK-INSTA-001',
    name: 'Instagram Follower Outreach',
    description: 'Connect with local youth and active social media users via Instagram outreach.',
    platform: 'Instagram',
    submissionType: 'Instagram Handle',
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
    }
    if (!localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) {
      const emps = JSON.parse(localStorage.getItem(STORAGE_KEYS.EMPLOYEES));
      const tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS));
      const subs = generateInitialSubmissions(emps, tasks[0]);
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
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

  resetDatabase() {
    localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
    localStorage.removeItem(STORAGE_KEYS.TASKS);
    localStorage.removeItem(STORAGE_KEYS.SUBMISSIONS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    this.init();
  }
};
