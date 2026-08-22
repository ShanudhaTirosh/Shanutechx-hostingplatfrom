// Service Worker for ShanuTechX Dashboard
// Provides offline support and faster subsequent loads

const CACHE_NAME = 'shanutechx-dashboard-v2';
const API_CACHE = 'shanutechx-api-v2';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/login',
  '/dashboard',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).catch(() => {})
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first for API, cache first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass API requests, non-GET requests, Next.js static chunks, and cross-origin calls
  if (
    request.method !== 'GET' ||
    url.hostname.includes('api.shanutechx.com') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/')
  ) {
    return;
  }

  // Static assets - cache first with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update in background safely
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok && networkResponse.type === 'basic' && url.origin === location.origin) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback
        return caches.match('/');
      });
    })
  );
});
