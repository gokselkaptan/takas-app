// ❌ KALDIRILDI - Scope çakışması önlendi
// (Firebase messaging importu artık burada yok)

// Service Worker for Takas-A PWA
const CACHE_NAME = 'takas-a-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        urlsToCache.map(url => cache.add(url).catch(() => null))
      )
    })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  let title = 'Takas-A';
  let options = {
    body: 'Yeni bildirim',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      url: '/'
    }
  };

  // JSON payload varsa parse et
  if (event.data) {
    try {
      const payload = event.data.json();
      title = payload.title || title;
      options.body = payload.body || options.body;
      if (payload.icon) options.icon = payload.icon;
      if (payload.badge) options.badge = payload.badge;
      if (payload.tag) options.tag = payload.tag;
      options.data = {
        ...options.data,
        ...(payload.data || {}),
        url: payload.url || (payload.data && payload.data.url) || '/'
      };
    } catch (e) {
      // JSON parse başarısızsa text olarak kullan
      options.body = event.data.text() || options.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        // Açık sekmelere bildir → anında yenileme
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      })
      .then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'REFRESH_SWAPS' })
        })
      })
  );
});

// Notification click event — deep link routing
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});