import admin from 'firebase-admin'

// Firebase Admin SDK — Server-side FCM gönderimi için
// Environment variables gerekli:
// - FIREBASE_PROJECT_ID
// - FIREBASE_CLIENT_EMAIL
// - FIREBASE_PRIVATE_KEY (JSON'dan alınan private_key, \\n karakterleri korunmalı)

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

// Firebase Admin SDK'yı başlat (eğer daha önce başlatılmamışsa)
if (!admin.apps.length) {
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    })
  } else {
    console.warn('Firebase Admin SDK: Eksik environment variables. FCM çalışmayacak.')
  }
}

/**
 * FCM ile push notification gönder
 * @param token - Kullanıcının FCM token'ı
 * @param title - Bildirim başlığı
 * @param body - Bildirim içeriği
 * @param url - Tıklandığında açılacak URL
 * @param badge - Okunmamış bildirim sayısı (iOS/Android badge)
 */
export async function sendFCMNotification(
  fcmToken: string,
  title: string,
  body: string,
  url: string = '/',
  badge?: number
): Promise<boolean> {
  if (!admin.apps.length) {
    console.warn('Firebase Admin SDK başlatılmamış. FCM gönderilemedi.')
    return false
  }

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title,
        body
      },
      webpush: {
        fcmOptions: { link: url },
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          vibrate: [200, 100, 200],
          requireInteraction: true
        }
      },
      data: {
        url,
        badge: String(badge || 0)
      },
      // Android için yüksek öncelik
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'takas_messages',
          priority: 'high' as const,
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      // Apple için yüksek öncelik
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: badge || 0
          }
        },
        headers: {
          'apns-priority': '10'
        }
      }
    }

    const response = await admin.messaging().send(message)
    console.log('FCM gönderildi:', response)
    return true
  } catch (error: any) {
    // Token geçersizse veya süresi dolmuşsa
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      console.warn('FCM token geçersiz veya süresi dolmuş:', fcmToken.substring(0, 20) + '...')
      throw error
    }
    console.error('FCM gönderim hatası:', error)
    throw error
  }
}

/**
 * Birden fazla kullanıcıya FCM gönder
 * @param tokens - FCM token dizisi
 * @param title - Bildirim başlığı
 * @param body - Bildirim içeriği
 * @param url - Tıklandığında açılacak URL
 */
export async function sendFCMToMultiple(
  tokens: string[],
  title: string,
  body: string,
  url: string = '/'
): Promise<{ success: number; failed: number }> {
  if (!admin.apps.length || tokens.length === 0) {
    return { success: 0, failed: tokens.length }
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title,
        body
      },
      webpush: {
        fcmOptions: {
          link: url
        },
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-96x96.png'
        }
      },
      data: {
        url
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'high',
          channelId: 'takas-a-notifications'
        }
      }
    }

    const response = await admin.messaging().sendEachForMulticast(message)
    return {
      success: response.successCount,
      failed: response.failureCount
    }
  } catch (error) {
    console.error('FCM multicast hatası:', error)
    return { success: 0, failed: tokens.length }
  }
}

export default admin
