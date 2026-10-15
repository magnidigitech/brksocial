import React, { useState, useEffect, useRef } from 'react';
import { LoginPage } from './pages/LoginPage';
import { EmployeePortal } from './pages/EmployeePortal';
import { AdminDashboard } from './pages/AdminDashboard';
import { authService } from './services/auth';
import { dbService } from './services/db';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

// Ultra-fast client-side redirect handler for /go/:token, /instagram/:token, /track/:slug/:token
function TrackingRedirectHandler({ pathname }) {
  const [targetUrl, setTargetUrl] = useState('https://www.instagram.com/ramakrishnabhashyam/');
  const [matchedStaff, setMatchedStaff] = useState(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    // Prevent any multiple executions or loops on the same page
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    try {
      dbService.init();
      const parts = pathname.split('/').filter(Boolean);
      let token = parts[parts.length - 1] || '';
      if (token.includes('?')) token = token.split('?')[0];
      if (token.includes('#')) token = token.split('#')[0];

      // Session guard to ensure a token is recorded at most once per browser session
      const sessionKey = `brk_redir_done_${token}`;
      const isAlreadyRecorded = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey);

      let dest = 'https://www.instagram.com/ramakrishnabhashyam/';

      if (token && !isAlreadyRecorded) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(sessionKey, '1');
        }

        // Record click with bot/crawler detection & IP deduplication
        const result = dbService.recordLinkClick(token, {
          userAgent: navigator.userAgent,
          referrer: document.referrer || '',
          ip: 'WebClient'
        });

        if (result?.targetUrl) {
          dest = result.targetUrl;
        }

        if (result?.clickRecord?.employeeName && result.clickRecord.employeeName !== 'Unknown Staff') {
          setMatchedStaff(result.clickRecord);
        }
      } else if (token) {
        // Resolve target destination without recording duplicate click
        const resolved = dbService.resolveTrackingToken(token);
        if (resolved?.targetUrl) {
          dest = resolved.targetUrl;
        }
        if (resolved?.employeeName && resolved.employeeName !== 'Unknown Staff') {
          setMatchedStaff(resolved);
        }
      }

      // Safeguard: Ensure destination is an absolute external URL to prevent local self-redirect loops
      if (!dest.startsWith('http://') && !dest.startsWith('https://')) {
        dest = 'https://www.instagram.com/ramakrishnabhashyam/';
      }

      setTargetUrl(dest);

      // Smooth 200ms transition so UI is visible before leaving
      const timer = setTimeout(() => {
        window.location.href = dest;
      }, 200);

      return () => clearTimeout(timer);
    } catch (e) {
      console.error('Tracking redirect failed:', e);
      window.location.href = 'https://www.instagram.com/ramakrishnabhashyam/';
    }
  }, [pathname]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0f172a',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        backgroundColor: '#1e293b',
        borderRadius: '24px',
        border: '1px solid #334155',
        padding: '36px 24px',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 77, 0, 0.12)',
          border: '1.5px solid #ff4d00',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          color: '#ff4d00'
        }}>
          <span style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: '2.5px solid #ff4d00',
            borderTopColor: 'transparent',
            animation: 'fastSpin 0.6s linear infinite',
            display: 'inline-block'
          }} />
        </div>

        <h2 style={{ fontSize: '19px', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.02em', color: '#f8fafc' }}>
          Sri Bhashyam Ramakrishna
        </h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>
          Official Citizen Outreach — Connecting you to Instagram...
        </p>

        {matchedStaff && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '12px',
            color: '#cbd5e1'
          }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
              Staff Outreach Coordinator
            </div>
            <strong style={{ color: '#ffedd5', fontSize: '13px' }}>{matchedStaff.employeeName}</strong>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              {matchedStaff.parliamentName} {matchedStaff.assemblyName ? `• ${matchedStaff.assemblyName}` : ''}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            color: '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            ⚡ Verified Link • Redirecting
          </span>

          <a
            href={targetUrl}
            style={{
              fontSize: '12px',
              color: '#38bdf8',
              textDecoration: 'underline',
              marginTop: '4px',
              cursor: 'pointer'
            }}
          >
            Click here if not redirected automatically
          </a>
        </div>
      </div>
      <style>{`
        @keyframes fastSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(() => {
    dbService.init();
    return authService.getSession();
  });

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isTrackingRoute = pathname.startsWith('/go/') || 
                          pathname.startsWith('/instagram/') || 
                          pathname.startsWith('/whatsapp/') || 
                          pathname.startsWith('/track/');

  if (isTrackingRoute) {
    return <TrackingRedirectHandler pathname={pathname} />;
  }

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialAdminTab = (pathname === '/admin/link-analytics' || searchParams?.get('tab') === 'links')
    ? 'links'
    : 'dashboard';

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
        <AdminDashboard session={session} onLogout={handleLogout} initialTab={initialAdminTab} />
      )}
    </>
  );
}
