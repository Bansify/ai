// =============================================================================
// Bansify AI service worker.
//
// Two rules, learned the hard way:
//
// 1. NEVER touch /api/. Those are the Bansify AI Worker calls: chat (a streaming
//    SSE response), the session check and the conversation list. A cache-first
//    worker was serving an old 401 for /v1/me and old history for
//    /v1/conversations, so the app looked broken after every deploy.
//
// 2. Navigations are network-first. Cache-first on /index.html means a returning
//    visitor keeps the previous build (with its old API base) until the worker
//    happens to update — the site "stays broken" even though the deploy is fine.
//    Offline is the only time the cached shell is used.
//
// Hashed build assets keep cache-first: their names change with every build, so
// a cached copy can never be stale.
// =============================================================================

const CACHE_NAME = 'bansify-ai-v2';

const PRECACHE = [
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only same-origin GETs; never a POST/PATCH/DELETE (chat, rename, delete).
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);

  // Rule 1: the API is never cached, never replayed.
  if (url.pathname.startsWith('/api/')) return;

  // Rule 2: a page load always asks the network first.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached ?? Response.error()))
    );
    return;
  }

  // Hashed assets and icons: cache-first is safe.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
