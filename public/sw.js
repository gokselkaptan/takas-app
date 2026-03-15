importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js')

if (typeof firebase !== 'undefined') {
  firebase.initializeApp({
    apiKey: 'AIzaSyBwo32JmoVm5i7rFw_JSISbA4Qn3bpIYYs',
    authDomain: 'takas-a.firebaseapp.com',
    projectId: 'takas-a',
    messagingSenderId: '279134899856',
    appId: '1:279134899856:web:09d610364b64b327c65215'
  })

  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'Takas-A'
    const body = payload.notification?.body || ''
    const url = payload.fcmOptions?.link || payload.data?.url || '/'

    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: { url }
    })

    // Açık sekmelere bildir
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'REFRESH_SWAPS' })
        })
      })
  })
}

// Service Worker for Takas-A PWA
const CACHE_NAME = 'takas-a-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
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
  const options = {
    body: event.data?.text() || 'Yeni bildirim',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Takas-A', options)
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

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});