const CACHE_NAME = 'brk-taskhub-pwa-v6';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  '/favicon-32x32.png',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/images/KutamiLOGO.jpg',
  '/images/ap.svg'
];

// Install: precache essentials and activate immediately without waiting
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Pre-cache partial failure, continuing:', err);
      });
    })
  );
});

// Activate: instantly purge any obsolete cache versions (like v1, v2) and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[PWA SW] Purging obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event handler
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip external APIs or non-http protocols
  if (!url.protocol.startsWith('http')) return;

  // Skip backend API calls and tracking redirect routes completely from cache
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/instagram') ||
    url.pathname.startsWith('/go') ||
    url.pathname.startsWith('/track') ||
    url.pathname.startsWith('/whatsapp') ||
    url.pathname.includes('socket')
  ) {
    return;
  }

  // HTML navigation: Network-first with 2500ms timeout, then fall back to cached /index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      new Promise((resolve) => {
        let didTimeout = false;
        const timer = setTimeout(() => {
          didTimeout = true;
          // Timed out waiting for mobile network; serve cached HTML immediately
          caches.match(req).then((cached) => {
            if (cached) return resolve(cached);
            caches.match('/index.html').then((indexCached) => {
              if (indexCached) return resolve(indexCached);
              fetch(req).then(resolve).catch(() => resolve(new Response('Offline', { status: 503 })));
            });
          });
        }, 2500);

        fetch(req)
          .then((networkRes) => {
            clearTimeout(timer);
            if (networkRes && networkRes.status === 200) {
              const resClone = networkRes.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
            }
            if (!didTimeout) resolve(networkRes);
          })
          .catch(async () => {
            clearTimeout(timer);
            if (!didTimeout) {
              const cached = await caches.match(req);
              if (cached) return resolve(cached);
              const indexCached = await caches.match('/index.html');
              if (indexCached) return resolve(indexCached);
              resolve(new Response('Offline', { status: 503 }));
            }
          });
      })
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts, svgs)
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const contentType = networkRes.headers.get('content-type') || '';
            const isScriptOrStyle = url.pathname.endsWith('.js') || url.pathname.endsWith('.css');

            // CRITICAL SAFEGUARD: Never cache HTML when a script or style was requested!
            if (isScriptOrStyle && contentType.includes('text/html')) {
              console.warn('[PWA SW] Refusing to cache HTML response for script:', url.pathname);
              return cachedRes || new Response('Asset not found', { status: 404, statusText: 'Not Found' });
            }

            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => cachedRes);

      return cachedRes || fetchPromise;
    })
  );
});

// Client communication: support instant cache purge and skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});
