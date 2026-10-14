import React, { useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { EmployeePortal } from './pages/EmployeePortal';
import { AdminDashboard } from './pages/AdminDashboard';
import { authService } from './services/auth';
import { dbService } from './services/db';

import { PWAInstallPrompt } from './components/PWAInstallPrompt';

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

  return (
    <>
      <PWAInstallPrompt />
      {!session ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      ) : session.role === 'Employee' ? (
        <EmployeePortal session={session} onLogout={handleLogout} />
      ) : (
        <AdminDashboard session={session} onLogout={handleLogout} />
      )}
    </>
  );
}

