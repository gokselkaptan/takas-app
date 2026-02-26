const SW_VERSION = '7.2.0';
const CACHE_NAME = 'takas-a-v7-2';
const STATIC_CACHE = 'takas-a-static-v7-2';
const OFFLINE_URL = '/offline.html';
const MAX_CACHE_SIZE = 100; // Maksimum cache item sayısı

// Cache boyutunu sınırla - eski itemları temizle
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    console.log(`[SW] Trimming cache ${cacheName}: ${keys.length} -> ${maxItems}`);
    for (let i = 0; i < keys.length - maxItems; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// Critical assets to cache immediately (including sounds)
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/badge-96x96.png',
  // Bildirim sesleri
  '/sounds/message.mp3',
  '/sounds/notification.mp3',
  '/sounds/swap-offer.mp3',
  '/sounds/coin.mp3',
  '/sounds/match.mp3'
];

// ═══════════════════════════════════════════════════════════════════════════════
// BİLDİRİM TİP AYARLARI - Her tip için özel titreşim, ses ve davranış
// ═══════════════════════════════════════════════════════════════════════════════

const NOTIFICATION_TYPES = {
  new_message: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'msg',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    sound: '/sounds/message.mp3',
    actions: [
      { action: 'reply', title: 'Yanıtla' },
      { action: 'view', title: 'Görüntüle' }
    ]
  },
  swap_request: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'swap',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    sound: '/sounds/swap-offer.mp3',
    actions: [
      { action: 'accept', title: 'Kabul Et' },
      { action: 'view', title: 'İncele' }
    ]
  },
  swap_accepted: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'swap-accept',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300],
    sound: '/sounds/match.mp3',
    actions: [{ action: 'view', title: 'Takasa Git' }]
  },
  swap_rejected: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'swap-reject',
    renotify: true,
    requireInteraction: false,
    vibrate: [100, 50, 100],
    sound: '/sounds/notification.mp3',
    actions: [{ action: 'view', title: 'Detaylar' }]
  },
  swap_completed: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'swap-complete',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 400],
    sound: '/sounds/match.mp3',
    actions: [
      { action: 'rate', title: 'Değerlendir' },
      { action: 'view', title: 'Görüntüle' }
    ]
  },
  swap_cancelled: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'swap-cancel',
    renotify: true,
    requireInteraction: false,
    vibrate: [100, 50, 100],
    sound: '/sounds/notification.mp3',
    actions: [{ action: 'view', title: 'Detaylar' }]
  },
  swap_update: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'swap-upd',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    sound: '/sounds/notification.mp3',
    actions: [{ action: 'view', title: 'Görüntüle' }]
  },
  valor_received: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'valor',
    renotify: false,
    requireInteraction: false,
    vibrate: [100, 50, 100],
    sound: '/sounds/coin.mp3',
    actions: []
  },
  product_interest: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'interest',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    sound: '/sounds/notification.mp3',
    actions: [{ action: 'view', title: 'Ürünü Gör' }]
  },
  wish_match: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'wish',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300],
    sound: '/sounds/match.mp3',
    actions: [{ action: 'view', title: 'Eşleşmeyi Gör' }]
  },
  multi_swap: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'multi',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    sound: '/sounds/swap-offer.mp3',
    actions: [{ action: 'view', title: 'Çoklu Takası Gör' }]
  },
  multi_swap_invite: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'multi-invite',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    sound: '/sounds/swap-offer.mp3',
    actions: [
      { action: 'accept', title: 'Katıl' },
      { action: 'view', title: 'İncele' }
    ]
  },
  system: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'system',
    renotify: false,
    requireInteraction: false,
    vibrate: [100],
    sound: '/sounds/notification.mp3',
    actions: []
  },
  general: {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: 'gen',
    renotify: false,
    requireInteraction: false,
    vibrate: [200],
    sound: '/sounds/notification.mp3',
    actions: []
  }
};

// Static assets patterns (cache-first strategy)
const STATIC_PATTERNS = [
  /\/_next\/static\//,
  /\/images\//,
  /\/icons\//,
  /\/videos\//,
  /\/sounds\//,
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot|mp3|wav|ogg)$/
];

// Check if URL matches static patterns
const isStaticAsset = (url) => {
  return STATIC_PATTERNS.some(pattern => pattern.test(url));
};

// iOS PWA detection
const isIOSPWA = () => {
  return (
    'standalone' in navigator &&
    navigator.standalone === true
  );
};

// Install event - precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Precaching critical assets');
        return cache.addAll(PRECACHE_ASSETS);
      }),
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Static cache ready');
      })
    ])
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, STATIC_CACHE];
  event.waitUntil(
    (async () => {
      // Eski cache'leri sil
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
      
      // Mevcut cache'leri trim et (bellek optimizasyonu)
      await trimCache(CACHE_NAME, MAX_CACHE_SIZE);
      await trimCache(STATIC_CACHE, 50);
      
      console.log(`[SW] Activated v${SW_VERSION}, caches trimmed`);
    })()
  );
  self.clients.claim();
});

// Fetch event with optimized caching strategies
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API requests (always fetch from network)
  if (event.request.url.includes('/api/')) return;

  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = event.request.url;

  // Strategy 1: Cache-first for static assets (images, fonts, icons, _next/static)
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          // Return cached immediately, update in background (stale-while-revalidate)
          event.waitUntil(
            fetch(event.request).then((response) => {
              if (response.status === 200) {
                cache.put(event.request, response.clone());
              }
            }).catch(() => {})
          );
          return cachedResponse;
        }
        
        // Not in cache, fetch and cache
        try {
          const response = await fetch(event.request);
          if (response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (error) {
          // Return placeholder for images if offline
          if (url.match(/\.(png|jpg|jpeg|gif|webp)$/)) {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#f3f4f6" width="200" height="200"/><text fill="#9ca3af" x="50%" y="50%" text-anchor="middle" dy=".3em">Offline</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
          throw error;
        }
      })
    );
    return;
  }

  // Strategy 2: Network-first with cache fallback for HTML pages
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        // Clone the response for caching
        const responseClone = response.clone();
        
        // Cache successful responses
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        
        return response;
      })
      .catch(async () => {
        // Network failed, try cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // For navigation requests, show offline page
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        
        // Return a fallback for other requests
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH - Ana bildirim alıcı (tip bazlı yapılandırma ile)
// ═══════════════════════════════════════════════════════════════════════════════

self.addEventListener('push', (event) => {
  console.log('[SW v' + SW_VERSION + '] Push event received at:', new Date().toISOString());
  
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    // iOS bazen text olarak gönderebiliyor
    payload = { type: 'general', title: 'TAKAS-A', body: event.data.text() };
  }

  // Bildirim tipini al (varsayılan: general)
  const type = payload.type || 'general';
  const title = payload.title || 'TAKAS-A';
  const body = payload.body || '';
  const image = payload.image;
  const data = payload.data || {};

  // Tip yapılandırmasını al
  const cfg = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.general;

  // Bildirim seçeneklerini oluştur
  const options = {
    body: body,
    icon: cfg.icon,
    badge: cfg.badge,
    // Benzersiz tag (aynı tip bildirimlerin üst üste binmemesi için)
    tag: cfg.tag + '-' + (data.id || data.threadId || data.swapId || Date.now()),
    renotify: cfg.renotify,
    requireInteraction: cfg.requireInteraction,
    vibrate: cfg.vibrate,
    // ⚠️ KRİTİK: silent:false olmalı, true olursa ses+titreşim devre dışı kalır
    silent: false,
    timestamp: Date.now(),
    data: {
      type: type,
      sound: cfg.sound,
      url: data.url || '/',
      threadId: data.threadId,
      swapId: data.swapId,
      wishId: data.wishId,
      receivedAt: Date.now()
    },
    actions: cfg.actions
  };

  // Büyük görsel varsa ekle
  if (image) options.image = image;

  // Bildirimi göster ve client'lara ses çalma komutu gönder
  const notificationPromise = self.registration.showNotification(title, options)
    .then(() => {
      console.log('[SW] Notification shown successfully:', type);
      
      // Açık sayfalara "ses çal" komutu gönder
      return self.clients.matchAll({ type: 'window' });
    })
    .then((clients) => {
      // Tüm açık pencerelere ses çalma mesajı gönder
      clients.forEach((client) => {
        client.postMessage({ type: 'PLAY_SOUND', sound: cfg.sound });
      });
    })
    .then(() => {
      // App badge güncelle
      if (self.navigator && self.navigator.setAppBadge) {
        return self.navigator.setAppBadge();
      }
    })
    .catch((err) => {
      console.error('[SW] Notification error:', err);
      // Fallback: En azından bir bildirim göster
      return self.registration.showNotification('TAKAS-A', {
        body: 'Yeni bildiriminiz var!',
        icon: '/icons/icon-192x192.png',
        vibrate: [200, 100, 200],
        silent: false
      });
    });

  event.waitUntil(notificationPromise);
});

// Handle push subscription change (iOS ve bazı tarayıcılarda gerekli)
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey
    }).then((subscription) => {
      // Sunucuya yeni subscription'ı gönder
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: 'ServiceWorker-Resubscribe'
        })
      });
    }).catch((err) => {
      console.error('[SW] Resubscription failed:', err);
    })
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION CLICK - Aksiyon bazlı yönlendirme
// ═══════════════════════════════════════════════════════════════════════════════

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const d = event.notification.data || {};
  let url = d.url || '/';

  // Action bazlı yönlendirme
  if (event.action === 'reply' || event.action === 'view') {
    if (d.threadId) url = '/mesajlar?thread=' + d.threadId;
    else if (d.swapId) url = '/takaslarim?id=' + d.swapId;
    else if (d.wishId) url = '/istek-panosu?id=' + d.wishId;
  } else if (event.action === 'accept' && d.swapId) {
    url = '/takaslarim?id=' + d.swapId + '&action=accept';
  }

  // Action yoksa tip bazlı default yönlendirme
  if (!event.action && d.type) {
    if (d.type === 'new_message') url = d.threadId ? '/mesajlar?thread=' + d.threadId : '/mesajlar';
    else if (d.type === 'swap_request') url = d.swapId ? '/teklifler?id=' + d.swapId : '/teklifler';
    else if (d.type === 'swap_accepted' || d.type === 'swap_update') url = d.swapId ? '/takaslarim?id=' + d.swapId : '/takaslarim';
    else if (d.type === 'valor_received') url = '/profil?tab=valor';
    else if (d.type === 'wish_match') url = d.wishId ? '/istek-panosu?id=' + d.wishId : '/istek-panosu';
    else if (d.type === 'multi_swap') url = d.swapId ? '/takaslarim?multi=' + d.swapId : '/takaslarim';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Zaten açık bir pencere varsa ona odaklan ve navigate et
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
            client.postMessage({ type: 'NAVIGATE', url: url });
            return client.focus();
          }
        }
        // Yoksa yeni pencere aç
        return self.clients.openWindow(url);
      })
      .then(() => {
        // Badge temizle
        if (self.navigator && self.navigator.clearAppBadge) {
          return self.navigator.clearAppBadge();
        }
      })
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT MESAJLARI - Skip waiting, badge temizleme vb.
// ═══════════════════════════════════════════════════════════════════════════════

self.addEventListener('message', (event) => {
  if (!event.data) return;
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_BADGE' && self.navigator && self.navigator.clearAppBadge) {
    self.navigator.clearAppBadge();
  }
});
