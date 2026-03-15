'use client'

import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, Messaging, isSupported } from 'firebase/messaging'

// Firebase Client SDK — Browser'da FCM token almak için
// Environment variables gerekli:
// - NEXT_PUBLIC_FIREBASE_API_KEY
// - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
// - NEXT_PUBLIC_FIREBASE_PROJECT_ID
// - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
// - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
// - NEXT_PUBLIC_FIREBASE_APP_ID
// - NEXT_PUBLIC_FIREBASE_VAPID_KEY (Cloud Messaging > Web configuration'dan)

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
}

let app: FirebaseApp | null = null
let messaging: Messaging | null = null

/**
 * Firebase uygulamasını başlat
 */
function initializeFirebase(): FirebaseApp | null {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('Firebase config eksik, FCM çalışmayacak')
    return null
  }

  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig)
  } else {
    app = getApps()[0]
  }
  return app
}

/**
 * FCM token al
 * firebase-messaging-sw.js'i ayrı scope ile register eder
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null
    if (!('Notification' in window)) return null
    if (!('serviceWorker' in navigator)) return null

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    // firebase-messaging-sw.js'i direkt register et — ayrı scope
    let swRegistration: ServiceWorkerRegistration
    try {
      swRegistration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js'
      )
    } catch {
      // Zaten kayıtlıysa mevcut kaydı al
      const registrations = await navigator.serviceWorker.getRegistrations()
      const fcmReg = registrations.find(r => 
        r.active?.scriptURL.includes('firebase-messaging-sw')
      )
      swRegistration = fcmReg || await navigator.serviceWorker.ready
    }

    const { getMessaging, getToken } = await import('firebase/messaging')
    const { initializeApp, getApps } = await import('firebase/app')
    
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    }

    const app = getApps().length === 0 
      ? initializeApp(firebaseConfig) 
      : getApps()[0]
    
    messaging = getMessaging(app)
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration
    })

    return token || null
  } catch (error) {
    console.error('FCM token alınamadı:', error)
    return null
  }
}

/**
 * Mevcut FCM token'ı sil (çıkış yaparken kullanılabilir)
 */
export async function deleteFCMToken(): Promise<boolean> {
  if (!messaging) {
    return false
  }

  try {
    const { deleteToken } = await import('firebase/messaging')
    await deleteToken(messaging)
    return true
  } catch (error) {
    console.error('FCM token silme hatası:', error)
    return false
  }
}
