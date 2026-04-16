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
function createTimeoutResponse() {
  return new Response('', { status: 408 });
}

async function putInCacheSafely(request, response) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response);
  } catch (error) {
    // Cache yazma hatası fetch akışını bozmasın
  }
}

async function networkFirstWithSafeFallback(request, { fallbackToHome = false, emptyFallback = false } = {}) {
  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return createTimeoutResponse();
  }

  const isApi = url.origin === self.location.origin && url.pathname.startsWith('/api/');

  try {
    const networkResponse = await fetch(request);

    // Başarılı response'ları cache'e yaz (arka planda, hataya düşürmeden)
    // ✅ /api/* isteklerini cache'leme
    if (networkResponse && networkResponse.ok && !isApi) {
      await putInCacheSafely(request, networkResponse.clone());
    }

    if (networkResponse instanceof Response) {
      return networkResponse;
    }
  } catch (error) {
    console.error('[SW] Fetch error:', error);

    // ✅ /api/* istekleri için cache fallback yok
    if (isApi) {
      return createTimeoutResponse();
    }
  }

  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse instanceof Response) {
      return cachedResponse;
    }

    if (fallbackToHome) {
      const homeFallback = await caches.match('/');
      if (homeFallback instanceof Response) {
        return homeFallback;
      }
    }
  } catch (cacheError) {
    // Cache okuma hatası durumunda timeout response dön
  }

  if (emptyFallback) {
    return createTimeoutResponse();
  }

  return createTimeoutResponse();
}

async function handleFetch(request) {
  try {
    if (!(request instanceof Request)) {
      return createTimeoutResponse();
    }

    let url;
    try {
      url = new URL(request.url);
    } catch (error) {
      return createTimeoutResponse();
    }

    // HTTP/HTTPS dışı protokollerde de daima geçerli Response dön
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return createTimeoutResponse();
    }

    // takas-firsatlari için explicit network-first strategy:
    // 1) network 2) cache 3) 408
    if (url.origin === self.location.origin && url.pathname.startsWith('/takas-firsatlari')) {
      return networkFirstWithSafeFallback(request, { fallbackToHome: false, emptyFallback: true });
    }

    // Diğer GET isteklerde de güvenli network-first
    return networkFirstWithSafeFallback(request, {
      fallbackToHome: request.mode === 'navigate',
      emptyFallback: true
    });
  } catch (error) {
    return createTimeoutResponse();
  }
}

self.addEventListener('fetch', (event) => {
  // ✅ GET olmayan istekleri bypass et
  if (event.request.method !== 'GET') {
    return; // event.respondWith çağrılmasın, doğrudan network'e git
  }

  event.respondWith(
    (async () => {
      try {
        const response = await handleFetch(event.request);
        return response instanceof Response ? response : createTimeoutResponse();
      } catch (error) {
        return createTimeoutResponse();
      }
    })()
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