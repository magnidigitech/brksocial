import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { offlineQueue } from '../services/offlineQueue.js';

export function OfflineStatusIndicator() {
  const [status, setStatus] = useState(() => ({
    isOnline: offlineQueue.isNetworkOnline(),
    pendingCount: offlineQueue.getPendingCount(),
    isFlushing: false
  }));
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [justSyncedCount, setJustSyncedCount] = useState(0);

  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe((state) => {
      setStatus(state);
    });

    const handleSynced = (e) => {
      const count = e.detail?.count || 0;
      if (count > 0) {
        setJustSyncedCount(count);
        setShowSyncSuccess(true);
        setTimeout(() => setShowSyncSuccess(false), 4000);
      }
    };

    window.addEventListener('brk_queue_synced', handleSynced);

    return () => {
      unsubscribe();
      window.removeEventListener('brk_queue_synced', handleSynced);
    };
  }, []);

  const handleManualSync = (e) => {
    e.stopPropagation();
    if (status.isOnline && !status.isFlushing) {
      offlineQueue.flushQueue();
    }
  };

  // If online and no pending items and no recent sync message, don't obstruct the UI
  if (status.isOnline && status.pendingCount === 0 && !status.isFlushing && !showSyncSuccess) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 16px',
        borderRadius: '9999px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        fontSize: '12.5px',
        fontWeight: 600,
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        maxWidth: '92vw',
        animation: 'slideUp 0.3s ease-out',
        backgroundColor: !status.isOnline
          ? '#fff7ed' // orange tint
          : (status.isFlushing ? '#eff6ff' : '#f0fdf4'),
        color: !status.isOnline
          ? '#c2410c'
          : (status.isFlushing ? '#1d4ed8' : '#15803d'),
        border: !status.isOnline
          ? '1.5px solid #fed7aa'
          : (status.isFlushing ? '1.5px solid #bfdbfe' : '1.5px solid #bbf7d0')
      }}
    >
      {!status.isOnline ? (
        <>
          <WifiOff size={16} style={{ color: '#ea580c', flexShrink: 0 }} />
          <span>
            Offline Mode {status.pendingCount > 0 ? `• ${status.pendingCount} queued for auto-sync` : '• Submissions saved locally'}
          </span>
        </>
      ) : status.isFlushing ? (
        <>
          <RefreshCw size={15} className="spin" style={{ color: '#2563eb', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
          <span>
            Reconnected! Syncing {status.pendingCount} queued submission{status.pendingCount !== 1 ? 's' : ''}...
          </span>
        </>
      ) : showSyncSuccess ? (
        <>
          <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
          <span>
            Back online! {justSyncedCount} submission{justSyncedCount !== 1 ? 's' : ''} successfully synced.
          </span>
        </>
      ) : status.pendingCount > 0 ? (
        <>
          <Wifi size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
          <span>
            Online • {status.pendingCount} queued submission{status.pendingCount !== 1 ? 's' : ''} ready to sync
          </span>
          <button
            type="button"
            onClick={handleManualSync}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              marginLeft: '4px'
            }}
          >
            Sync Now
          </button>
        </>
      ) : null}
    </div>
  );
}
