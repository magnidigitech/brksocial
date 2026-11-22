/**
 * Offline Submission Queue & Auto-Sync Engine
 * 
 * Enables seamless offline PWA functionality for field staff in low-connectivity areas:
 * 1. Safely queues submissions in localStorage/IndexedDB when offline or when network requests fail.
 * 2. Monitors online/offline network connectivity.
 * 3. Automatically flushes and uploads queued submissions when connection restores.
 * 4. Provides reactive listeners so the UI displays live queued counts and sync status.
 */

import { getBackendUrl } from './apiConfig.js';

const QUEUE_STORAGE_KEY = 'brk_offline_submission_queue_v1';

class OfflineQueueManager {
  constructor() {
    this.listeners = new Set();
    this.isFlushing = false;
    this.online = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.online = true;
        this.notify();
        this.flushQueue();
      });

      window.addEventListener('offline', () => {
        this.online = false;
        this.notify();
      });

      // Periodic check if browser online state didn't fire an event
      setInterval(() => {
        if (typeof navigator !== 'undefined' && navigator.onLine && !this.isFlushing) {
          const queue = this.getQueue();
          if (queue.length > 0) {
            this.flushQueue();
          }
        }
      }, 30000);
    }
  }

  getQueue() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[OfflineQueue] Failed to read queue:', e);
      return [];
    }
  }

  saveQueue(queue) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      this.notify();
    } catch (e) {
      console.warn('[OfflineQueue] Failed to save queue:', e);
    }
  }

  enqueue(submission) {
    if (!submission || !submission.id) return;
    const queue = this.getQueue();
    // Avoid duplicate queueing
    const existingIndex = queue.findIndex(item => item.id === submission.id);
    const queuedItem = {
      ...submission,
      queuedAt: new Date().toISOString(),
      retryCount: existingIndex >= 0 ? (queue[existingIndex].retryCount || 0) + 1 : 0
    };

    if (existingIndex >= 0) {
      queue[existingIndex] = queuedItem;
    } else {
      queue.push(queuedItem);
    }

    this.saveQueue(queue);

    // Try background sync registration if available in ServiceWorker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.sync?.register('brk-sync-submissions').catch(() => {});
      }).catch(() => {});
    }

    return queuedItem;
  }

  dequeue(submissionId) {
    const queue = this.getQueue();
    const updated = queue.filter(item => item.id !== submissionId);
    this.saveQueue(updated);
  }

  getPendingCount() {
    return this.getQueue().length;
  }

  isNetworkOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback({
      isOnline: this.online,
      pendingCount: this.getPendingCount(),
      isFlushing: this.isFlushing
    });
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = {
      isOnline: this.online,
      pendingCount: this.getPendingCount(),
      isFlushing: this.isFlushing
    };
    this.listeners.forEach(cb => {
      try {
        cb(state);
      } catch (err) {
        console.warn('[OfflineQueue] Listener error:', err);
      }
    });
  }

  async flushQueue() {
    if (this.isFlushing) return;
    const queue = this.getQueue();
    if (queue.length === 0) return;

    this.isFlushing = true;
    this.notify();

    let syncedCount = 0;
    const remaining = [];

    for (const item of queue) {
      try {
        const res = await fetch(getBackendUrl('/api/submissions'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify({ submission: item }),
          keepalive: true
        });

        if (res.ok) {
          syncedCount++;
          // Update submission status in main localStorage submissions
          this.markSubmissionSynced(item.id);
        } else {
          remaining.push({ ...item, retryCount: (item.retryCount || 0) + 1 });
        }
      } catch (networkErr) {
        // Still offline or request failed
        remaining.push({ ...item, retryCount: (item.retryCount || 0) + 1 });
      }
    }

    this.saveQueue(remaining);
    this.isFlushing = false;
    this.notify();

    if (syncedCount > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('brk_queue_synced', { 
        detail: { count: syncedCount, remaining: remaining.length } 
      }));
    }

    return { syncedCount, remainingCount: remaining.length };
  }

  markSubmissionSynced(submissionId) {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem('brk_submissions_v1');
      if (!raw) return;
      const subs = JSON.parse(raw);
      if (Array.isArray(subs)) {
        let changed = false;
        const updated = subs.map(s => {
          if (s.id === submissionId) {
            changed = true;
            return { ...s, isOfflineQueued: false, syncStatus: 'synced', syncedAt: new Date().toISOString() };
          }
          return s;
        });
        if (changed) {
          localStorage.setItem('brk_submissions_v1', JSON.stringify(updated));
        }
      }
    } catch (e) {
      console.warn('[OfflineQueue] Failed to mark submission synced:', e);
    }
  }
}

export const offlineQueue = new OfflineQueueManager();
