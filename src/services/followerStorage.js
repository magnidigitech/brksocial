/**
 * BRK Social - Hybrid Follower Storage Engine
 * Combines high-performance client-side IndexedDB with an in-memory O(1) Map cache,
 * with seamless background synchronization to the Express server API.
 * 
 * Guarantees zero-hang file uploads, prevents call-stack overflow on large JSON arrays,
 * and handles any Instagram/Meta follower export format.
 */

const DB_NAME = 'BRK_FOLLOWERS_DB';
const DB_VERSION = 1;
const STORE_NAME = 'followers';

// In-memory O(1) cache for sub-millisecond lookups
let memoryMap = new Map();
let isInitialized = false;
let initPromise = null;

// Format timestamp to IST "dd/mm/yyyy hh:mm"
export function formatFollowerTimestamp(ts) {
  if (!ts) return '';
  const num = Number(ts);
  if (!num || isNaN(num)) return '';
  // Convert seconds to ms if needed
  const ms = num < 10000000000 ? num * 1000 : num;
  const date = new Date(ms);
  if (isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);

  const d = parts.find(p => p.type === 'day')?.value || '01';
  const m = parts.find(p => p.type === 'month')?.value || '01';
  const y = parts.find(p => p.type === 'year')?.value || '2026';
  const h = parts.find(p => p.type === 'hour')?.value || '00';
  const min = parts.find(p => p.type === 'minute')?.value || '00';
  return `${d}/${m}/${y} ${h}:${min}`;
}

// Open IndexedDB safely
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('username', 'username', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('IndexedDB open error:', request.error);
      resolve(null);
    };
  });
}

// Extract standard normalized record from any Meta / Instagram JSON structure
export function normalizeFollowerItem(rawItem) {
  if (!rawItem) return null;

  let username = '';
  let href = '';
  let timestamp = 0;

  // 1. Meta / Instagram standard format: { title: "", string_list_data: [ { href, value, timestamp } ] }
  if (rawItem.string_list_data && Array.isArray(rawItem.string_list_data) && rawItem.string_list_data.length > 0) {
    const data = rawItem.string_list_data[0];
    username = data.value || '';
    href = data.href || '';
    timestamp = Number(data.timestamp) || 0;
  }
  // 2. Direct object format: { username, href, timestamp } or { value, href, timestamp }
  else if (typeof rawItem === 'object') {
    username = rawItem.username || rawItem.value || rawItem.name || '';
    href = rawItem.href || rawItem.profile_url || '';
    timestamp = Number(rawItem.timestamp) || 0;
  }
  // 3. Simple string handle
  else if (typeof rawItem === 'string') {
    username = rawItem;
  }

  const cleanUser = String(username).trim().replace(/^@+/, '');
  const cleanKey = cleanUser.toLowerCase();
  if (!cleanKey) return null;

  const effTimestamp = timestamp || Math.floor(Date.now() / 1000);

  return {
    key: cleanKey,
    username: cleanUser,
    href: href || `https://www.instagram.com/${cleanKey}`,
    timestamp: effTimestamp,
    followedAtFormatted: formatFollowerTimestamp(effTimestamp),
    updatedAt: new Date().toISOString()
  };
}

// Extract raw items array from whatever JSON root was parsed
export function extractItemsFromParsedJson(json) {
  const items = [];
  if (!json) return items;

  if (Array.isArray(json)) {
    for (let i = 0; i < json.length; i++) {
      if (json[i]) items.push(json[i]);
    }
  } else if (typeof json === 'object') {
    const candidateArrays = [
      json.followers,
      json.relationships_followers,
      json.data,
      json.items,
      json.users
    ];
    for (const arr of candidateArrays) {
      if (Array.isArray(arr)) {
        for (let i = 0; i < arr.length; i++) {
          if (arr[i]) items.push(arr[i]);
        }
        break;
      }
    }
  }
  return items;
}

export const followerStorage = {
  /**
   * Initialize memory cache from IndexedDB and auto-seed if empty
   */
  async init() {
    if (isInitialized) return memoryMap;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        const db = await openIndexedDB();
        if (db) {
          await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.openCursor();

            req.onsuccess = (e) => {
              const cursor = e.target.result;
              if (cursor) {
                const record = cursor.value;
                if (record && record.key) {
                  memoryMap.set(record.key, record);
                }
                cursor.continue();
              } else {
                resolve();
              }
            };
            req.onerror = () => resolve();
          });
        }

        // If IndexedDB has records, we are initialized!
        if (memoryMap.size > 0) {
          console.log(`[FollowerStorage] Loaded ${memoryMap.size} followers from IndexedDB into memory.`);
          isInitialized = true;
          return memoryMap;
        }

        // Otherwise, check if backend has data (and backend is actually serving JSON)
        let backendCount = 0;
        try {
          const res = await fetch('/api/instagram/followers/stats', { signal: AbortSignal.timeout(3000) });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const stats = await res.json();
            backendCount = stats.total || 0;
          }
        } catch (_) {}

        // If backend does NOT have data or is returning HTML, auto-seed from public/data/
        if (backendCount === 0 && memoryMap.size === 0) {
          await this.autoSeedFromPublicData();
        }

        isInitialized = true;
      } catch (err) {
        console.warn('[FollowerStorage] Init warning:', err.message);
        isInitialized = true;
      }
      return memoryMap;
    })();

    return initPromise;
  },

  /**
   * Auto-seed from static public files /data/followers_1.json and followers_2.json
   */
  async autoSeedFromPublicData(onProgress) {
    const seedFiles = ['/data/followers_1.json', '/data/followers_2.json'];
    const allRecords = [];

    for (const fileUrl of seedFiles) {
      try {
        if (onProgress) onProgress(`Checking ${fileUrl}...`);
        const res = await fetch(fileUrl);
        const contentType = res.headers.get('content-type') || '';
        // If server returns HTML instead of json, skip
        if (!res.ok || contentType.includes('text/html')) continue;

        const json = await res.json();
        const items = extractItemsFromParsedJson(json);
        for (let i = 0; i < items.length; i++) {
          const norm = normalizeFollowerItem(items[i]);
          if (norm) allRecords.push(norm);
        }
      } catch (err) {
        console.warn(`[FollowerStorage] Could not seed from ${fileUrl}:`, err.message);
      }
    }

    if (allRecords.length > 0) {
      console.log(`[FollowerStorage] Auto-seeding ${allRecords.length} records into storage...`);
      await this.saveRecordsToIndexedDB(allRecords, onProgress);
    }
  },

  /**
   * Save records into IndexedDB and memoryMap in non-blocking batches
   */
  async saveRecordsToIndexedDB(records, onProgress) {
    const db = await openIndexedDB();
    let countAdded = 0;
    let countUpdated = 0;

    // 1. Update in-memory Map first (instantaneous)
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec || !rec.key) continue;
      if (!memoryMap.has(rec.key)) {
        countAdded++;
      } else {
        countUpdated++;
      }
      memoryMap.set(rec.key, rec);
    }

    // 2. Batch write to IndexedDB
    if (db && records.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await new Promise((resolve) => {
          try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            for (let j = 0; j < batch.length; j++) {
              store.put(batch[j]);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          } catch (e) {
            resolve();
          }
        });

        if (onProgress) {
          const current = Math.min(i + BATCH_SIZE, records.length);
          const pct = Math.round((current / records.length) * 100);
          onProgress(`Saving to local database: ${current.toLocaleString()} / ${records.length.toLocaleString()} (${pct}%)`);
        }
      }
    }

    return {
      total: memoryMap.size,
      added: countAdded,
      updated: countUpdated
    };
  },

  /**
   * Upsert incoming raw follower data (array or object) safely
   * Calls onProgress(message) during execution.
   */
  async upsertFollowers(rawItems, onProgress) {
    await this.init();

    if (onProgress) onProgress('Parsing and validating records...');
    const items = extractItemsFromParsedJson(rawItems);
    if (!items || items.length === 0) {
      throw new Error('No valid follower entries found.');
    }

    const normalizedRecords = [];
    for (let i = 0; i < items.length; i++) {
      const norm = normalizeFollowerItem(items[i]);
      if (norm) {
        normalizedRecords.push(norm);
      }
    }

    if (normalizedRecords.length === 0) {
      throw new Error('No valid usernames or followers found in the uploaded file(s).');
    }

    if (onProgress) onProgress(`Upserting ${normalizedRecords.length.toLocaleString()} records into database...`);

    // 1. Write to local IndexedDB + memory
    const localResult = await this.saveRecordsToIndexedDB(normalizedRecords, onProgress);

    // 2. Asynchronously sync to backend Express API in chunks of 2,000 (resilient, non-blocking)
    this.syncToBackendInBackground(normalizedRecords);

    return localResult;
  },

  /**
   * Background sync to Node/Express server if available
   */
  async syncToBackendInBackground(records) {
    try {
      const CHUNK_SIZE = 2000;
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        try {
          const res = await fetch('/api/instagram/followers/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunk)
          });
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !ct.includes('application/json')) {
            // Backend endpoint not active / returning HTML, break early
            break;
          }
        } catch (_) {
          break;
        }
      }
    } catch (_) {}
  },

  /**
   * Instant O(1) follower check
   */
  async checkFollower(username) {
    await this.init();
    if (!username) return { exists: false, isFollower: false, username: '' };

    const clean = String(username).trim().toLowerCase().replace(/^@+/, '');
    if (!clean) return { exists: false, isFollower: false, username: '' };

    // Check memory cache first
    const cached = memoryMap.get(clean);
    if (cached) {
      const formatted = cached.followedAtFormatted || formatFollowerTimestamp(cached.timestamp);
      const followerObj = {
        username: cached.username,
        href: cached.href,
        timestamp: cached.timestamp,
        followedAtFormatted: formatted
      };
      return {
        exists: true,
        isFollower: true,
        username: cached.username,
        href: cached.href,
        timestamp: cached.timestamp,
        followedAtFormatted: formatted,
        follower: followerObj
      };
    }

    // Fallback: If memory cache is somehow empty, try backend API if available
    try {
      const res = await fetch(`/api/instagram/followers/check/${encodeURIComponent(clean)}`, {
        signal: AbortSignal.timeout(2000)
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data && data.exists) {
          // Cache it in memory too
          memoryMap.set(clean, {
            key: clean,
            username: data.username || clean,
            href: data.href,
            timestamp: data.timestamp,
            followedAtFormatted: data.followedAtFormatted
          });
        }
        return data;
      }
    } catch (_) {}

    return { exists: false, isFollower: false, username: clean };
  },

  /**
   * Get stats (total count, latest follower, last updated)
   */
  async getStats() {
    await this.init();

    // Check backend first if backend is running with JSON
    try {
      const res = await fetch('/api/instagram/followers/stats', { signal: AbortSignal.timeout(2000) });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data && data.success && data.total > 0) {
          // If backend has more data or same, return backend stats
          return data;
        }
      }
    } catch (_) {}

    // Fallback to local memory / IndexedDB
    let latestFollower = null;
    let maxTimestamp = 0;

    for (const record of memoryMap.values()) {
      if (record.timestamp && record.timestamp > maxTimestamp) {
        maxTimestamp = record.timestamp;
        latestFollower = {
          username: record.username,
          followedAtFormatted: record.followedAtFormatted || formatFollowerTimestamp(record.timestamp),
          timestamp: record.timestamp
        };
      }
    }

    return {
      success: true,
      total: memoryMap.size,
      latestFollower,
      lastUpdated: new Date().toISOString()
    };
  },

  /**
   * Search and Paginate Followers
   */
  async getFollowersList(search = '', page = 1, limit = 50) {
    await this.init();

    // Try backend first if it is available and responding with JSON
    try {
      const params = new URLSearchParams({ search, page, limit });
      const res = await fetch(`/api/instagram/followers?${params.toString()}`, { signal: AbortSignal.timeout(2000) });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data && data.success) {
          return data;
        }
      }
    } catch (_) {}

    // Fallback: Client-side in-memory search & pagination
    const cleanSearch = String(search || '').trim().toLowerCase().replace(/^@+/, '');
    let list = Array.from(memoryMap.values());

    if (cleanSearch) {
      list = list.filter(f => f.key.includes(cleanSearch) || f.username.toLowerCase().includes(cleanSearch));
    }

    // Sort by timestamp descending (newest first)
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const total = list.length;
    const startIndex = (page - 1) * limit;
    const items = list.slice(startIndex, startIndex + limit);

    return {
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      followers: items
    };
  }
};
