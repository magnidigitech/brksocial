import React, { useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { EmployeePortal } from './pages/EmployeePortal';
import { AdminDashboard } from './pages/AdminDashboard';
import { authService } from './services/auth';
import { dbService } from './services/db';

export default function App() {
  const [session, setSession] = useState(() => {
    dbService.init();
    return authService.getSession();
  });

  const handleLoginSuccess = (newSession) => {
    setSession(newSession);
  };

  const handleLogout = () => {
    authService.logout();
    setSession(null);
  };

  // If user is not signed in, render Standalone Executive Login Page
  if (!session) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Render simplified Admin Page or Employee Page when signed in
  return session.role === 'Employee' ? (
    <EmployeePortal session={session} onLogout={handleLogout} />
  ) : (
    <AdminDashboard session={session} onLogout={handleLogout} />
  );
}

