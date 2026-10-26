/**
 * BRK Social - Authentication Service
 * Manages user login sessions, password authentication, and session persistence.
 */
import { dbService } from './db.js';

const SESSION_KEY = 'brk_auth_session_v1';

export const authService = {
  // Get active session
  getSession() {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  // Save active session
  setSession(sessionData) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  },

  // Logout current user
  logout() {
    localStorage.removeItem(SESSION_KEY);
  },

  // Login Employee by Support Code, Staff ID, Personal Mobile, or Office Mobile
  loginEmployee(identifier, password) {
    dbService.init();
    const emps = dbService.getEmployees();
    const cleanId = (identifier || '').trim();
    const upperId = cleanId.toUpperCase();
    const digitsOnly = cleanId.replace(/\D/g, '');

    const emp = emps.find(e => {
      if (!e) return false;
      // 1. Support Code / ID / Assembly Code (e.g. APP01, APP01A01)
      if (e.id && e.id.toUpperCase() === upperId) return true;
      if (e.supportCode && e.supportCode.toUpperCase() === upperId) return true;
      if (e.assemblyCode && e.assemblyCode.toUpperCase() === upperId) return true;

      // 2. Staff ID (e.g. Palakonda_010)
      if (e.staffId && e.staffId.toUpperCase() === upperId) return true;

      // 3. Personal Mobile (e.g. 9030738656)
      if (digitsOnly && e.mobilePersonal && e.mobilePersonal.replace(/\D/g, '') === digitsOnly) return true;

      // 4. Office Mobile (e.g. 7997955186)
      if (digitsOnly && e.mobileOffice && e.mobileOffice.replace(/\D/g, '') === digitsOnly) return true;

      // 5. Fallback primary mobile or email
      if (digitsOnly && e.mobile && e.mobile.replace(/\D/g, '') === digitsOnly) return true;
      if (e.email && e.email.toLowerCase() === cleanId.toLowerCase()) return true;

      return false;
    });

    if (!emp) {
      return {
        success: false,
        error: 'Staff identifier not found. Please enter your Support Code (e.g. APP01), Staff ID, Personal Mobile, or Office Mobile.'
      };
    }

    if (emp.status === 'Inactive') {
      return {
        success: false,
        error: 'Your employee account is currently inactive. Please contact Admin.'
      };
    }

    // Verify Password (default password is 'password123' if not modified)
    const expectedPass = emp.password || 'password123';
    if (password !== expectedPass) {
      return {
        success: false,
        error: 'Invalid password. Please check your credentials.'
      };
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

    this.setSession(session);
    return {
      success: true,
      session
    };
  },

  // Login Admin by Username & Password
  loginAdmin(username, password) {
    dbService.init();
    const admin = dbService.getAdminAccount();

    if (username.trim() !== admin.username) {
      return {
        success: false,
        error: 'Invalid Admin username.'
      };
    }

    if (password !== admin.password) {
      return {
        success: false,
        error: 'Invalid Admin password.'
      };
    }

    const session = {
      role: 'Admin',
      username: admin.username,
      name: admin.name,
      email: admin.email,
      loginTime: new Date().toISOString()
    };

    this.setSession(session);
    return {
      success: true,
      session
    };
  },

  // Refresh active employee session with latest credentials
  refreshSession() {
    const currentSession = this.getSession();
    if (!currentSession || currentSession.role !== 'Employee') return currentSession;
    const empId = currentSession.employeeId || currentSession.supportCode || currentSession.id;
    const emp = dbService.getEmployeeById(empId);
    if (emp) {
      const updated = {
        ...currentSession,
        name: emp.name,
        staffId: emp.staffId || '',
        supportCode: emp.supportCode || emp.id,
        mobilePersonal: emp.mobilePersonal || emp.mobile,
        mobileOffice: emp.mobileOffice || '',
        mobile: emp.mobilePersonal || emp.mobileOffice || emp.mobile
      };
      this.setSession(updated);
      return updated;
    }
    return currentSession;
  }
};
