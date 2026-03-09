// Battuta Huna — Service Worker
// Handles background notifications and offline caching

const CACHE_NAME = 'battuta-huna-v1';
const OFFLINE_URLS = ['/'];

// ── Install: cache the app shell ─────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(OFFLINE_URLS);
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ───────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fall back to network ────────────────────────
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).catch(function() {
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});

// ── Message from app: show notification ──────────────────────────────────
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'NOTIFY') {
    var p = event.data.payload;
    event.waitUntil(
      self.registration.showNotification(p.title, {
        body:     p.body,
        icon:     '/icon-192.png',
        badge:    '/icon-72.png',
        tag:      p.tag,
        renotify: false,
        data:     p.data || {},
        actions: [
          { action: 'view',    title: 'View Site' },
          { action: 'dismiss', title: 'Dismiss'   }
        ]
      })
    );
  }
});

// ── Notification click: open/focus app and show POI detail ───────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;

  var poiId = event.notification.data && event.notification.data.poiId;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clients) {
        for (var i = 0; i < clients.length; i++) {
          var client = clients[i];
          if (client.url.indexOf('battutahuna') !== -1 && 'focus' in client) {
            client.focus();
            if (poiId) client.postMessage({ type: 'NOTIFICATION_CLICK', poiId: poiId });
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('/').then(function(newClient) {
            if (newClient && poiId) {
              setTimeout(function() {
                newClient.postMessage({ type: 'NOTIFICATION_CLICK', poiId: poiId });
              }, 1500);
            }
          });
        }
      })
  );
});

// ── Push event (future: server-side push) ────────────────────────────────
self.addEventListener('push', function(event) {
  if (!event.data) return;
  try {
    var data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Battuta Huna', {
        body:  data.body  || 'A cultural site is nearby.',
        icon:  '/icon-192.png',
        badge: '/icon-72.png',
        tag:   data.tag   || 'battuta-push',
        data:  data.data  || {}
      })
    );
  } catch(e) {
    console.warn('Push parse error:', e);
  }
});
