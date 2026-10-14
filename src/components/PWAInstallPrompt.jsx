import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Share2, PlusSquare } from 'lucide-react';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) return;

    // Check if user dismissed recently (within 24 hours)
    const dismissedAt = localStorage.getItem('brk_pwa_dismissed');
    if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 24 * 60 * 60 * 1000) {
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    if (isIosDevice) {
      setIsIOS(true);
      setShowPrompt(true);
      return;
    }

    // Android / Desktop Chrome PWA prompt handler
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(prev => !prev);
      return;
    }

    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User installed BRK TaskHub PWA');
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('brk_pwa_dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      left: '12px',
      right: '12px',
      maxWidth: '480px',
      margin: '0 auto',
      zIndex: 9999,
      backgroundColor: '#18181b',
      color: '#ffffff',
      borderRadius: '18px',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(245, 158, 11, 0.15)',
      padding: '14px 16px',
      boxSizing: 'border-box',
      animation: 'slideUp 0.3s ease-out'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#facc15',
            flexShrink: 0
          }}>
            <Smartphone size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Install BRK TaskHub</span>
              <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 6px', borderRadius: '9999px', backgroundColor: '#fef3c7', color: '#92400e' }}>
                PWA
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isIOS ? 'Add to Home Screen for fast native access' : 'Install app for 1-tap launch & offline mode'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={handleInstallClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '9999px',
              backgroundColor: '#f59e0b',
              color: '#000000',
              fontSize: '12px',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
              transition: 'all 0.15s ease'
            }}
          >
            <Download size={13} />
            <span>{isIOS ? 'How' : 'Install'}</span>
          </button>

          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            style={{
              padding: '6px',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              color: '#71717a',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* iOS Instructions Dropdown */}
      {showIOSInstructions && isIOS && (
        <div style={{
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid #27272a',
          fontSize: '11px',
          color: '#d4d4d8',
          lineHeight: '1.5'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Share2 size={13} style={{ color: '#38bdf8' }} />
            <span>1. Tap the Safari <strong>Share</strong> button at bottom</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PlusSquare size={13} style={{ color: '#facc15' }} />
            <span>2. Scroll down & select <strong>'Add to Home Screen'</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
