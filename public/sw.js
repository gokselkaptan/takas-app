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

// Fetch event - Network first, fallback to cache (always returns valid Response)
async function networkFirstWithSafeFallback(request, { fallbackToHome = false } = {}) {
  try {
    const networkResponse = await fetch(request);

    // Başarılı response'ları cache'e yaz (arka planda, hataya düşürmeden)
    if (networkResponse && networkResponse.ok) {
      const responseClone = networkResponse.clone();
      caches.open(CACHE_NAME)
        .then((cache) => cache.put(request, responseClone))
        .catch(() => null);
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (fallbackToHome) {
      const homeFallback = await caches.match('/');
      if (homeFallback) {
        return homeFallback;
      }

      return new Response('<h1>Bağlantı yok</h1><p>Lütfen internet bağlantınızı kontrol edin.</p>', {
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
      });
    }

    return new Response(JSON.stringify({ error: 'Ağ hatası, içerik alınamadı.' }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // GET dışındaki istekleri SW dışında bırak
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // HTTP/HTTPS dışındaki protokolleri SW'de handle etme
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // takas-firsatlari için explicit network-first strategy
  if (url.origin === self.location.origin && url.pathname.startsWith('/takas-firsatlari')) {
    event.respondWith(networkFirstWithSafeFallback(request, { fallbackToHome: true }));
    return;
  }

  // Diğer GET isteklerde de güvenli network-first
  event.respondWith(networkFirstWithSafeFallback(request, { fallbackToHome: request.mode === 'navigate' }));
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