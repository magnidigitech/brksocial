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

// Clean storage initialization - starts with 0 real data (no dummy submissions or fake clicks)
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

    // PURGE ALL DUMMY DATA: Start completely clean with real tracking only
    if (!localStorage.getItem('brk_clean_real_data_v4')) {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.LINK_CLICKS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
      localStorage.setItem('brk_clean_real_data_v4', 'true');
    }

    if (!localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.LINK_CLICKS)) {
      localStorage.setItem(STORAGE_KEYS.LINK_CLICKS, JSON.stringify([]));
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

  processSubmission({ employeeId, taskId, normalizedUsername, rawInput, followerVerification = null }) {
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
      date: todayStr,
      isFollower: !!followerVerification?.isFollower,
      followerStatus: followerVerification?.isFollower ? 'Verified Follower' : 'Pending Verification',
      followedAtFormatted: followerVerification?.follower?.followedAtFormatted || followerVerification?.followedAtFormatted || null,
      followedAtTimestamp: followerVerification?.follower?.timestamp || followerVerification?.timestamp || null,
      followerHref: followerVerification?.follower?.href || followerVerification?.href || null
    };
    allSubs.unshift(validSub);
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(allSubs));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('brk_submission_event', { detail: { timestamp: Date.now() } }));
    }

    let successMsg = 'Submission recorded successfully!';
    const formattedDate = validSub.followedAtFormatted;
    if (validSub.isFollower && formattedDate) {
      successMsg = `Accepted! '${normalizedUsername}' is a verified follower (Followed on ${formattedDate}).`;
    } else if (platform === 'Instagram') {
      successMsg = `Accepted! '${normalizedUsername}' recorded. Note: Profile will be cross-referenced with official followers upon next daily JSON upload.`;
    }

    return {
      success: true,
      status: 'Valid',
      message: successMsg,
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
    let clean = String(tokenOrSlug).trim();
    if (clean.includes('?')) clean = clean.split('?')[0];
    if (clean.includes('#')) clean = clean.split('#')[0];
    if (clean.includes('/')) {
      const parts = clean.split('/').filter(Boolean);
      clean = parts[parts.length - 1] || clean;
    }
    clean = clean.trim();
    if (!clean) return null;

    const links = this.getTrackingLinks();
    
    // 1. Direct match on token (case-insensitive)
    let match = links.find(l => l.token && l.token.toLowerCase() === clean.toLowerCase());
    if (match) return match;

    // 2. Direct match on fullUrl or shortUrl ending
    let urlMatch = links.find(l => (l.fullUrl && l.fullUrl.endsWith('/' + clean)) || (l.shortUrl && l.shortUrl.endsWith('/' + clean)));
    if (urlMatch) return urlMatch;

    // 3. Match on employee ID, support code, staffId, or mobile for fallback readability
    const emps = this.getEmployees();
    const emp = emps.find(e => 
      (e.id && e.id.toLowerCase() === clean.toLowerCase()) ||
      (e.supportCode && e.supportCode.toLowerCase() === clean.toLowerCase()) ||
      (e.staffId && e.staffId.toLowerCase() === clean.toLowerCase()) ||
      (e.mobilePersonal && e.mobilePersonal === clean) ||
      (e.mobileOffice && e.mobileOffice === clean)
    );

    if (emp) {
      const activeTask = this.getActiveTask();
      if (activeTask) {
        return this.getTrackingLinkForEmployee(activeTask.id, emp.id);
      }
    }

    // 4. Match deterministic token across all employees
    const activeTask = this.getActiveTask();
    if (activeTask) {
      for (const e of emps) {
        const expectedToken = this.generateLinkToken(activeTask.id, e.id);
        if (expectedToken.toLowerCase() === clean.toLowerCase()) {
          return this.getTrackingLinkForEmployee(activeTask.id, e.id);
        }
      }
    }

    // Fallback to active task target
    return {
      targetUrl: activeTask?.targetUrl || 'https://www.instagram.com/ramakrishnabhashyam/',
      token: clean,
      taskId: activeTask?.id || 'TASK-INSTA-001',
      taskName: activeTask?.name || 'Instagram Follower Outreach',
      employeeId: 'UNKNOWN',
      employeeName: 'General Visitor',
      supportCode: '',
      staffId: '',
      parliamentCode: '',
      assemblyCode: ''
    };
  },

  getLinkClicks(filter = null) {
    this.init();
    let clicks = JSON.parse(localStorage.getItem(STORAGE_KEYS.LINK_CLICKS)) || [];
    if (filter) {
      if (filter.taskId) clicks = clicks.filter(c => c.taskId === filter.taskId);
      if (filter.employeeId) clicks = clicks.filter(c => c.employeeId && c.employeeId.toUpperCase() === filter.employeeId.toUpperCase());
      if (filter.date) clicks = clicks.filter(c => c.timestamp && c.timestamp.startsWith(filter.date));
      if (filter.isValid !== undefined) clicks = clicks.filter(c => c.isValid === filter.isValid);
    }
    return clicks;
  },

  recordLinkClick(arg1, arg2) {
    this.init();
    let token = '';
    let ip = '';
    let userAgent = '';
    let referrer = '';
    let host = '';

    if (typeof arg1 === 'object' && arg1 !== null) {
      token = arg1.token;
      ip = arg1.ip;
      userAgent = arg1.userAgent;
      referrer = arg1.referrer;
      host = arg1.host;
    } else {
      token = arg1;
      if (arg2 && typeof arg2 === 'object') {
        ip = arg2.ip;
        userAgent = arg2.userAgent;
        referrer = arg2.referrer;
        host = arg2.host;
      }
    }

    token = String(token || '').trim();
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

    // Deduplication check: same token and same IP within 3 seconds
    const now = Date.now();
    const isDuplicate = clicks.some(c => 
      c.token === (resolved?.token || token) &&
      c.ip === clientIp &&
      (now - new Date(c.timestamp).getTime()) < 3000
    );

    if (isDuplicate) {
      return {
        clickRecord: clicks.find(c => c.token === (resolved?.token || token)) || null,
        targetUrl: resolved?.targetUrl || 'https://www.instagram.com/ramakrishnabhashyam/'
      };
    }

    const isValid = !isBot;

    const clickRecord = {
      id: `CLK-${now}-${Math.random().toString(36).substring(2, 7)}`,
      token: resolved?.token || token,
      taskId: resolved?.taskId || 'TASK-INSTA-001',
      taskName: resolved?.taskName || 'Instagram Follower Outreach',
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
    if (clicks.length > 10000) clicks.length = 10000;
    localStorage.setItem(STORAGE_KEYS.LINK_CLICKS, JSON.stringify(clicks));

    // Dispatch event so all open views immediately refresh
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('brk_link_click_event', { detail: clickRecord }));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {}
    }

    // Also dispatch to backend server if reachable (ensures global sync across devices)
    if (typeof fetch !== 'undefined') {
      try {
        fetch('/api/links/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: clickRecord.token,
            taskId: clickRecord.taskId,
            employeeId: clickRecord.employeeId,
            ip: clientIp,
            userAgent: ua,
            referrer: ref
          }),
          keepalive: true
        }).catch(() => {});
      } catch (e) {}
    }

    return {
      success: true,
      clickRecord,
      targetUrl: resolved?.targetUrl || 'https://www.instagram.com/ramakrishnabhashyam/'
    };
  },

  async syncClicksWithServer() {
    if (typeof fetch === 'undefined') return;
    try {
      const res = await fetch('/api/links/analytics');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.clicks) && data.clicks.length > 0) {
          const localClicks = this.getLinkClicks();
          const localIds = new Set(localClicks.map(c => c.id));
          let added = 0;
          data.clicks.forEach(serverClick => {
            if (!localIds.has(serverClick.id)) {
              localClicks.unshift(serverClick);
              added++;
            }
          });
          if (added > 0) {
            localStorage.setItem(STORAGE_KEYS.LINK_CLICKS, JSON.stringify(localClicks));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('brk_link_click_event', { detail: { added } }));
              window.dispatchEvent(new Event('storage'));
            }
          }
        }
      }
    } catch (e) {
      // Offline / standalone mode - ignore
    }
  },

  getLinkAnalytics(filter = {}) {
    this.init();
    const date = filter.date || filter.dateStr;
    const startDate = filter.startDate;
    const taskId = filter.taskId;
    const parliamentCode = filter.parliamentCode;
    const assemblyCode = filter.assemblyCode;

    const allClicks = JSON.parse(localStorage.getItem(STORAGE_KEYS.LINK_CLICKS)) || [];
    const employees = this.getEmployees();
    const tasks = this.getTasks();
    const targetTask = taskId && taskId !== 'ALL' ? (this.getTaskById(taskId) || this.getActiveTask()) : this.getActiveTask();

    let filteredClicks = allClicks;

    // Filter by specific date (e.g. TODAY or YESTERDAY)
    if (date && date !== 'ALL') {
      filteredClicks = filteredClicks.filter(c => c.timestamp && c.timestamp.startsWith(date));
    }
    // Filter by startDate (e.g. Last 7 Days)
    if (startDate) {
      filteredClicks = filteredClicks.filter(c => c.timestamp && c.timestamp >= startDate);
    }
    // Filter by task
    if (targetTask && taskId && taskId !== 'ALL') {
      filteredClicks = filteredClicks.filter(c => c.taskId === targetTask.id);
    }
    // Filter by parliament
    if (parliamentCode && parliamentCode !== 'ALL') {
      filteredClicks = filteredClicks.filter(c => c.parliamentCode === parliamentCode);
    }
    // Filter by assembly
    if (assemblyCode && assemblyCode !== 'ALL') {
      filteredClicks = filteredClicks.filter(c => c.assemblyCode === assemblyCode);
    }

    const totalClicks = filteredClicks.length;
    const validClicks = filteredClicks.filter(c => c.isValid).length;
    const botClicks = filteredClicks.filter(c => c.isBot).length;
    const duplicateClicks = filteredClicks.filter(c => c.isDuplicate).length;

    const uniqueIps = new Set(filteredClicks.filter(c => c.isValid).map(c => c.ip));
    const uniqueVisitors = uniqueIps.size;

    const mobileClicks = filteredClicks.filter(c => c.isValid && c.deviceType === 'Mobile').length;
    const desktopClicks = filteredClicks.filter(c => c.isValid && c.deviceType === 'Desktop').length;

    const dailyTarget = targetTask?.dailyTarget || 10;

    let activeEmployees = employees.filter(e => e.status === 'Active');
    if (parliamentCode && parliamentCode !== 'ALL') {
      activeEmployees = activeEmployees.filter(e => e.parliamentCode === parliamentCode);
    }
    if (assemblyCode && assemblyCode !== 'ALL') {
      activeEmployees = activeEmployees.filter(e => e.assemblyCode === assemblyCode);
    }

    const totalTarget = activeEmployees.length * dailyTarget;

    // Build Staff Leaderboard matching LinkAnalyticsView expectations
    const staffLeaderboard = activeEmployees.map(emp => {
      const empClicks = filteredClicks.filter(c => c.employeeId && c.employeeId.toUpperCase() === emp.id.toUpperCase());
      const empValid = empClicks.filter(c => c.isValid).length;
      const empTotal = empClicks.length;
      const empBots = empClicks.filter(c => c.isBot).length;
      const empUnique = new Set(empClicks.filter(c => c.isValid).map(c => c.ip)).size;
      const token = this.generateLinkToken(targetTask?.id || 'TASK-INSTA-001', emp.id);
      const target = dailyTarget;
      const completionRate = target > 0 ? Math.min(100, Math.round((empValid / target) * 100)) : 0;
      let status = 'Not Started';
      if (empValid >= target) status = 'Completed';
      else if (empValid > 0) status = 'In Progress';

      return {
        employee: emp,
        employeeId: emp.id,
        employeeName: emp.name,
        supportCode: emp.supportCode || emp.id,
        staffId: emp.staffId || '',
        parliamentCode: emp.parliamentCode,
        parliamentName: emp.parliamentName,
        assemblyCode: emp.assemblyCode,
        assemblyName: emp.assemblyName,
        validClicks: empValid,
        totalClicks: empTotal,
        uniqueIps: empUnique,
        botClicks: empBots,
        token,
        target,
        completionRate,
        status,
        lastClickTime: empClicks[0]?.timestamp || null
      };
    });

    // Sort by valid clicks descending
    staffLeaderboard.sort((a, b) => b.validClicks - a.validClicks || a.employeeName.localeCompare(b.employeeName));

    const completedStaffCount = staffLeaderboard.filter(s => s.status === 'Completed').length;
    const inProgressStaffCount = staffLeaderboard.filter(s => s.status === 'In Progress').length;
    const notStartedStaffCount = staffLeaderboard.filter(s => s.status === 'Not Started').length;

    return {
      date: date || 'ALL',
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
      staffPerformance: staffLeaderboard,
      staffLeaderboard,
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
  },

  // ==========================================
  // Instagram Followers Verification & Management
  // ==========================================
  formatFollowerDate(ts) {
    if (!ts) return '';
    const date = new Date(Number(ts) * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const d = pad(date.getDate());
    const m = pad(date.getMonth() + 1);
    const y = date.getFullYear();
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${d}/${m}/${y} ${h}:${min}`;
  },

  async checkInstagramFollower(username) {
    if (!username) return { exists: false, isFollower: false };
    const clean = String(username).trim().toLowerCase().replace(/^@+/, '');
    try {
      const res = await fetch(`/api/instagram/followers/check/${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (err) {
      console.warn('Backend follower check unreachable:', err.message);
    }
    return { exists: false, isFollower: false, username: clean };
  },

  async uploadInstagramFollowers(followersData) {
    try {
      const res = await fetch('/api/instagram/followers/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(followersData)
      });
      if (res.ok) {
        return await res.json();
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to upload followers data');
    } catch (err) {
      console.error('Error uploading followers:', err);
      throw err;
    }
  },

  async getInstagramFollowerStats() {
    try {
      const res = await fetch('/api/instagram/followers/stats');
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Error fetching follower stats:', err.message);
    }
    return { success: false, total: 0, latestFollower: null };
  },

  async getInstagramFollowersList(search = '', page = 1, limit = 50) {
    try {
      const params = new URLSearchParams({ search, page, limit });
      const res = await fetch(`/api/instagram/followers?${params.toString()}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Error fetching followers list:', err.message);
    }
    return { success: false, total: 0, followers: [] };
  }
};
