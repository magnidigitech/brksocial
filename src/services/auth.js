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

  // Login Employee by Employee ID or Email
  loginEmployee(identifier, password) {
    dbService.init();
    const emps = dbService.getEmployees();
    const cleanId = identifier.trim().toUpperCase();

    const emp = emps.find(e => 
      e.id.toUpperCase() === cleanId || 
      e.email.toLowerCase() === identifier.trim().toLowerCase() ||
      e.mobile === identifier.trim()
    );

    if (!emp) {
      return {
        success: false,
        error: 'Employee ID or Mobile number not found.'
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
      name: emp.name,
      department: emp.department,
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
  }
};
