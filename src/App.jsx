import React, { useState, useEffect, useRef } from 'react';
import { Instagram, ExternalLink, ShieldCheck } from 'lucide-react';
import { LoginPage } from './pages/LoginPage';
import { EmployeePortal } from './pages/EmployeePortal';
import { AdminDashboard } from './pages/AdminDashboard';
import { authService } from './services/auth';
import { dbService } from './services/db';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { OfflineStatusIndicator } from './components/OfflineStatusIndicator';
import { offlineQueue } from './services/offlineQueue';

// Smart Instagram App Deep-Linking Redirect Handler
function TrackingRedirectHandler({ pathname }) {
  const [targetUrl, setTargetUrl] = useState('https://www.instagram.com/ramakrishnabhashyam/');
  const [matchedStaff, setMatchedStaff] = useState(null);
  const [hasAttempted, setHasAttempted] = useState(false);
  const hasTriggeredRef = useRef(false);

  const getIgUsername = (url) => {
    if (!url) return 'ramakrishnabhashyam';
    const match = url.match(/(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9._]+)/i);
    return match && match[1] ? match[1] : 'ramakrishnabhashyam';
  };

  const igUsername = getIgUsername(targetUrl);
  const appSchemeUrl = `instagram://user?username=${igUsername}`;
  const androidIntentUrl = `intent://instagram.com/_u/${igUsername}/#Intent;package=com.instagram.android;scheme=https;end`;

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isMobile = isAndroid || isIOS;
  const primaryDeepLink = isAndroid ? androidIntentUrl : appSchemeUrl;

  useEffect(() => {
    // Prevent multiple executions on same page
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

      if (!dest.startsWith('http://') && !dest.startsWith('https://')) {
        dest = 'https://www.instagram.com/ramakrishnabhashyam/';
      }

      setTargetUrl(dest);

      const targetUser = getIgUsername(dest);
      const appScheme = `instagram://user?username=${targetUser}`;
      const androidIntent = `intent://instagram.com/_u/${targetUser}/#Intent;package=com.instagram.android;scheme=https;end`;

      // Smart Deep Linking Auto-Launcher:
      // 1. On Android: androidIntent breaks out of WhatsApp/Facebook WebView directly into native Instagram App
      if (isAndroid) {
        window.location.replace(androidIntent);
        setTimeout(() => {
          try { window.location.href = appScheme; } catch (_) {}
          setHasAttempted(true);
        }, 500);
      } 
      // 2. On iOS: triggers native Instagram app open
      else if (isIOS) {
        window.location.href = appScheme;
        setTimeout(() => {
          setHasAttempted(true);
        }, 700);
      } 
      // 3. On Desktop: smooth redirect to web profile
      else {
        const desktopTimer = setTimeout(() => {
          window.location.href = dest;
        }, 500);
        return () => clearTimeout(desktopTimer);
      }
    } catch (e) {
      console.error('Tracking redirect failed:', e);
      window.location.href = 'https://www.instagram.com/ramakrishnabhashyam/';
    }
  }, [pathname, isAndroid, isIOS]);

  const handleManualAppLaunch = () => {
    if (isAndroid) {
      window.location.href = androidIntentUrl;
      setTimeout(() => {
        try { window.location.href = appSchemeUrl; } catch (_) {}
      }, 400);
    } else {
      window.location.href = appSchemeUrl;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#090d16',
      backgroundImage: 'radial-gradient(circle at 50% 18%, rgba(225, 48, 108, 0.18) 0%, rgba(15, 23, 42, 0) 70%)',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        backgroundColor: 'rgba(30, 41, 59, 0.78)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: '28px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        padding: '36px 24px',
        textAlign: 'center',
        boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.7)'
      }}>
        {/* Profile Avatar with Instagram Gradient Ring */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          padding: '3.5px',
          background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
          margin: '0 auto 16px auto',
          boxShadow: '0 8px 24px rgba(225, 48, 108, 0.35)',
          position: 'relative'
        }}>
          <img
            src="/images/KutamiLOGO.jpg"
            alt="Sri Bhashyam Ramakrishna"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              objectFit: 'cover',
              backgroundColor: '#ffffff'
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement.querySelector('.fallback-icon');
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div
            className="fallback-icon"
            style={{
              display: 'none',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              backgroundColor: '#1d1d1f',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}
          >
            <Instagram size={38} />
          </div>
        </div>

        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '-0.02em', color: '#f8fafc' }}>
          Sri Bhashyam Ramakrishna
        </h1>
        <div style={{ fontSize: '13px', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700, margin: '0 0 12px 0' }}>
          @{igUsername}
        </div>

        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.45 }}>
          Official Citizen Outreach — Tap below to follow directly in the native Instagram app.
        </p>

        {matchedStaff && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '14px',
            padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '12px',
            color: '#cbd5e1',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textAlign: 'left'
          }}>
            <ShieldCheck size={20} style={{ color: '#38bdf8', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                Verified Outreach Coordinator
              </div>
              <strong style={{ color: '#ffedd5', fontSize: '13px' }}>{matchedStaff.employeeName}</strong>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                {matchedStaff.parliamentName} {matchedStaff.assemblyName ? `• ${matchedStaff.assemblyName}` : ''}
              </div>
            </div>
          </div>
        )}

        {/* Primary 1-Tap App Deep-Link CTA Button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          <a
            href={primaryDeepLink}
            onClick={handleManualAppLaunch}
            style={{
              width: '100%',
              padding: '15px 20px',
              borderRadius: '980px',
              background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              textDecoration: 'none',
              boxShadow: '0 6px 20px rgba(225, 48, 108, 0.45)',
              cursor: 'pointer'
            }}
          >
            <Instagram size={20} />
            <span>Open in Instagram App</span>
          </a>

          <a
            href={targetUrl}
            style={{
              fontSize: '12.5px',
              color: '#94a3b8',
              textDecoration: 'none',
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.textDecoration = 'none'; }}
          >
            <span>Continue in Web Browser</span>
            <ExternalLink size={12} />
          </a>

          <div style={{
            fontSize: '11px',
            color: '#64748b',
            marginTop: '8px',
            lineHeight: 1.4
          }}>
            ⚡ 1-Tap App Deep-Link: Bypasses in-app browser login so you can follow directly without typing passwords.
          </div>
        </div>
      </div>
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
                          pathname.startsWith('/track/') ||
                          pathname.startsWith('/ig/') ||
                          pathname === '/ig' ||
                          pathname === '/go' ||
                          pathname === '/follow' ||
                          pathname.startsWith('/follow/');

  if (isTrackingRoute) {
    return <TrackingRedirectHandler pathname={pathname} />;
  }

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const validAdminTabs = ['dashboard', 'links', 'followers', 'rules', 'staff', 'audit', 'reports'];

  const getInitialAdminTab = () => {
    const queryTab = searchParams?.get('tab');
    if (queryTab && validAdminTabs.includes(queryTab)) return queryTab;

    if (pathname === '/admin/link-analytics' || pathname === '/admin/links') return 'links';
    if (pathname === '/admin/followers' || pathname === '/admin/instagram') return 'followers';
    if (pathname === '/admin/staff' || pathname === '/admin/employees') return 'staff';
    if (pathname === '/admin/rules' || pathname === '/admin/tasks') return 'rules';
    if (pathname === '/admin/audit') return 'audit';
    if (pathname === '/admin/reports') return 'reports';

    if (typeof localStorage !== 'undefined') {
      const savedTab = localStorage.getItem('brk_active_admin_tab');
      if (savedTab && validAdminTabs.includes(savedTab)) return savedTab;
    }
    return 'dashboard';
  };

  const initialAdminTab = getInitialAdminTab();

  const handleLoginSuccess = (newSession) => {
    setSession(newSession);
  };

  const handleLogout = () => {
    authService.logout();
    setSession(null);
  };

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const handleMessage = (event) => {
        if (event.data?.type === 'FLUSH_OFFLINE_QUEUE') {
          offlineQueue.flushQueue();
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, []);

  return (
    <>
      <PWAInstallPrompt />
      <OfflineStatusIndicator />
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
