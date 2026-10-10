import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
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
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted PWA installation');
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="pwa-banner">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
          <Smartphone size={20} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Install BRK TaskHub PWA</div>
          <div className="text-xs text-slate-300">Add app to home screen for faster daily access and offline support.</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleInstallClick} className="btn btn-primary btn-sm">
          <Download size={14} />
          <span>Install</span>
        </button>
        <button onClick={() => setShowPrompt(false)} className="text-slate-400 hover:text-white p-1">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
