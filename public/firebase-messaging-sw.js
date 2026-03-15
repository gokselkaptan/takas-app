// Firebase Messaging Service Worker
// Bu dosya public/ klasöründe olmalı — browser'ın FCM push alabilmesi için gerekli

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// Firebase config (client-side env variables kullanılamaz, manuel ayarla)
// ⚠️ Bu değerleri Firebase Console'dan alıp buraya yapıştırın
const firebaseConfig = {
  apiKey: 'AIzaSyBwo32JmoVm5i7rFw_JSISbA4Qn3bpIYYs',
  authDomain: 'takas-a.firebaseapp.com',
  projectId: 'takas-a',
  messagingSenderId: '279134899856',
  appId: '1:279134899856:web:09d610364b64b327c65215'
}

// Firebase'i başlat
firebase.initializeApp(firebaseConfig)

const messaging = firebase.messaging()

// Arka planda gelen mesajları işle
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Arka plan mesajı alındı:', payload)

  const title = payload.notification?.title || 'Takas-A'
  const body = payload.notification?.body || ''
  const url = payload.fcmOptions?.link || payload.data?.url || '/'
  const badge = parseInt(payload.data?.badge || '0', 10)

  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192x192.png',
    badge: badge,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: payload.data?.tag || 'takas-a-notification',
    data: { url },
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
  })

  // Açık sekmelere bildir
  self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'REFRESH_SWAPS' })
      })
    })
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
