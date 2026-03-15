// Firebase Messaging Service Worker
// Bu dosya public/ klasöründe olmalı — browser'ın FCM push alabilmesi için gerekli

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// Firebase config (client-side env variables kullanılamaz, manuel ayarla)
// ⚠️ Bu değerleri Firebase Console'dan alıp buraya yapıştırın
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID'
}

// Firebase'i başlat
firebase.initializeApp(firebaseConfig)

const messaging = firebase.messaging()

// Arka planda gelen mesajları işle
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Arka plan mesajı alındı:', payload)

  const notificationTitle = payload.notification?.title || 'TAKAS-A'
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: payload.data?.tag || 'takas-a-notification',
    data: {
      url: payload.data?.url || payload.fcmOptions?.link || '/'
    },
    // Android benzeri özellikler
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Aç'
      },
      {
        action: 'close',
        title: 'Kapat'
      }
    ]
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Bildirime tıklama işlemi
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Bildirime tıklandı:', event.notification.tag)
  
  event.notification.close()

  // 'close' aksiyonuna tıklandıysa sadece kapat
  if (event.action === 'close') {
    return
  }

  // URL'ye yönlendir
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Açık bir pencere varsa onu kullan
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(urlToOpen)
          return
        }
      }
      // Yoksa yeni pencere aç
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

console.log('[firebase-messaging-sw.js] Service Worker yüklendi')
