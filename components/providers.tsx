'use client'

import { useEffect } from 'react'
import { SessionProvider, useSession } from 'next-auth/react'
import { LanguageProvider } from '@/lib/language-context'
import { ToastProvider } from '@/lib/toast-context'
import { LanguagePrompt } from '@/components/language-prompt'
import dynamic from 'next/dynamic'

// PWA Provider - lazy load (~34KB tasarruf)
const PWAProvider = dynamic(
  () => import('@/components/pwa-provider').then(m => ({ default: m.PWAProvider })),
  { ssr: false }
)

// FCM Token Kayıt Bileşeni
function FCMTokenRegistration() {
  const { data: session, status } = useSession()

  useEffect(() => {
    // Sadece oturum açıkken ve tarayıcıda çalışıyorken
    if (status !== 'authenticated' || !session?.user || typeof window === 'undefined') {
      return
    }

    // FCM token alma işlemini başlat
    const registerFCMToken = async () => {
      try {
        // Dinamik import - sadece gerektiğinde yükle
        const { getFCMToken } = await import('@/lib/firebase-client')
        const token = await getFCMToken()

        if (token) {
          // Token'ı sunucuya kaydet
          await fetch('/api/user/fcm-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fcmToken: token })
          })
        }
      } catch (error) {
        // FCM hatası kritik değil, sessizce devam et
        console.warn('FCM token kaydedilemedi:', error)
      }
    }

    // 3 saniye gecikmeyle çalıştır (sayfa yüklenme performansını etkilememesi için)
    const timeoutId = setTimeout(registerFCMToken, 3000)

    return () => clearTimeout(timeoutId)
  }, [session, status])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchOnWindowFocus={true}
      refetchInterval={0}
      refetchWhenOffline={false}
    >
      <LanguageProvider>
        <LanguagePrompt />
        <FCMTokenRegistration />
        <ToastProvider>
          <PWAProvider>
            {children}
          </PWAProvider>
        </ToastProvider>
      </LanguageProvider>
    </SessionProvider>
  )
}
