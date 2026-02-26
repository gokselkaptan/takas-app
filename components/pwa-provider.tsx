'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { X, Download, Smartphone, Bell, BellOff, Share, PlusSquare } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { unlockAudioContext, playSoundFromSW } from '@/lib/notification-sounds'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// iOS version check - iOS 16.4+ supports push notifications in PWA
function getIOSVersion(): number | null {
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)/)
  if (match) {
    return parseFloat(`${match[1]}.${match[2]}`)
  }
  return null
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const router = useRouter()
  const { t } = useLanguage()
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showIOSInstallBanner, setShowIOSInstallBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [showPushBanner, setShowPushBanner] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [iOSVersion, setIOSVersion] = useState<number | null>(null)
  
  // Ses cache'i (performans için)
  const soundCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const soundsUnlockedRef = useRef(false)
  
  // Ses dosyasını al veya oluştur (cache'li)
  const getAudio = useCallback((soundPath: string): HTMLAudioElement => {
    if (!soundCacheRef.current.has(soundPath)) {
      const audio = new Audio(soundPath)
      audio.preload = 'auto'
      soundCacheRef.current.set(soundPath, audio)
    }
    return soundCacheRef.current.get(soundPath)!
  }, [])
  
  // Mobil autoplay kısıtlamasını aş (ilk dokunuşta)
  const unlockSounds = useCallback(() => {
    if (soundsUnlockedRef.current) return
    
    const sounds = [
      '/sounds/message.mp3',
      '/sounds/notification.mp3',
      '/sounds/swap-offer.mp3',
      '/sounds/coin.mp3',
      '/sounds/match.mp3'
    ]
    
    sounds.forEach(sound => {
      const audio = getAudio(sound)
      audio.volume = 0
      audio.play().then(() => audio.pause()).catch(() => {})
    })
    
    soundsUnlockedRef.current = true
    console.log('[PWA] Sounds unlocked')
  }, [getAudio])
  
  // SW'den gelen mesajları dinle (ses çalma, navigasyon)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    
    const handleSWMessage = (event: MessageEvent) => {
      const { type, sound, url } = event.data || {}
      
      if (type === 'PLAY_SOUND' && sound) {
        console.log('[PWA] Playing sound from SW:', sound)
        // notification-sounds.ts'deki fonksiyonu kullan (vibration fallback dahil)
        playSoundFromSW(sound)
      }
      
      if (type === 'NAVIGATE' && url) {
        console.log('[PWA] Navigating to:', url)
        router.push(url)
      }
    }
    
    navigator.serviceWorker.addEventListener('message', handleSWMessage)
    
    // İlk dokunuşta sesleri unlock et (Android autoplay policy bypass)
    const unlockHandler = () => {
      // Kendi unlock fonksiyonumuz
      unlockSounds()
      // notification-sounds.ts'deki AudioContext unlock'u da çağır
      unlockAudioContext()
      console.log('[PWA] Audio unlocked on user interaction')
      document.removeEventListener('touchstart', unlockHandler)
      document.removeEventListener('click', unlockHandler)
    }
    document.addEventListener('touchstart', unlockHandler, { once: true })
    document.addEventListener('click', unlockHandler, { once: true })
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage)
      document.removeEventListener('touchstart', unlockHandler)
      document.removeEventListener('click', unlockHandler)
    }
  }, [getAudio, router, unlockSounds])

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isInStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    setIsStandalone(isInStandalone)

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIOSDevice)
    
    if (isIOSDevice) {
      const version = getIOSVersion()
      setIOSVersion(version)
      console.log('[PWA] iOS version:', version)
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration.scope)
          
          // Check push support - iOS 16.4+ in standalone mode
          const canPush = 'PushManager' in window && 'Notification' in window
          if (canPush) {
            // iOS'ta sadece PWA olarak kurulduğunda ve iOS 16.4+ push destekleniyor
            if (isIOSDevice) {
              const iosVer = getIOSVersion()
              if (!isInStandalone) {
                console.log('[Push] iOS - Push requires PWA installation first')
                setPushSupported(false)
              } else if (iosVer && iosVer < 16.4) {
                console.log('[Push] iOS - Push requires iOS 16.4+, current:', iosVer)
                setPushSupported(false)
              } else {
                console.log('[Push] iOS PWA - Push supported')
                setPushSupported(true)
                checkPushSubscription(registration)
              }
            } else {
              // Android/Desktop
              console.log('[Push] Push supported (Android/Desktop)')
              setPushSupported(true)
              checkPushSubscription(registration)
            }
          }
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error)
        })
    }

    // Listen for install prompt (Android/Desktop only)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      console.log('[PWA] beforeinstallprompt event received')
      setInstallPrompt(e as BeforeInstallPromptEvent)
      
      // Show banner after 1 second - daha hızlı göster
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      const dismissedTime = dismissed ? parseInt(dismissed) : 0
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60)
      
      // 6 saat geçtiyse veya hiç dismiss edilmediyse göster
      if (!dismissed || hoursSinceDismissed > 6) {
        console.log('[PWA] Showing install banner in 1 second')
        setTimeout(() => setShowInstallBanner(true), 1000)
      } else {
        console.log('[PWA] Install banner dismissed recently, waiting')
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed')
      setShowInstallBanner(false)
      setShowIOSInstallBanner(false)
      setInstallPrompt(null)
      // Yükleme tamamlandı - bottom nav geri gelsin
      window.dispatchEvent(new CustomEvent('pwaInstallEnded'))
    })

    // iOS için ayrı banner mantığı - beforeinstallprompt event'i iOS'ta yok
    if (isIOSDevice && !isInStandalone) {
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      const dismissedTime = dismissed ? parseInt(dismissed) : 0
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60)
      
      // 6 saat geçtiyse veya hiç dismiss edilmediyse göster
      if (!dismissed || hoursSinceDismissed > 6) {
        console.log('[PWA] iOS - Showing install instructions in 1.5 seconds')
        setTimeout(() => setShowIOSInstallBanner(true), 1500)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  // Check push subscription status when user logs in
  useEffect(() => {
    if (session?.user && pushSupported) {
      checkServerSubscription()
    }
  }, [session, pushSupported])

  // Show push banner after install or for logged in users
  useEffect(() => {
    if (session?.user && pushSupported && !pushSubscribed) {
      const dismissed = localStorage.getItem('push-banner-dismissed')
      if (!dismissed) {
        // Show after 5 seconds if not showing install banner
        const timer = setTimeout(() => {
          if (!showInstallBanner) {
            setShowPushBanner(true)
          }
        }, 5000)
        return () => clearTimeout(timer)
      }
    }
  }, [session, pushSupported, pushSubscribed, showInstallBanner])

  const checkPushSubscription = async (registration: ServiceWorkerRegistration) => {
    try {
      const subscription = await registration.pushManager.getSubscription()
      setPushSubscribed(!!subscription)
    } catch (error) {
      console.error('[Push] Check subscription error:', error)
    }
  }

  const checkServerSubscription = async () => {
    try {
      const res = await fetch('/api/push/subscribe')
      const data = await res.json()
      setPushSubscribed(data.subscribed)
    } catch (error) {
      console.error('[Push] Server check error:', error)
    }
  }

  const subscribeToPush = async () => {
    if (!pushSupported || !VAPID_PUBLIC_KEY) return
    
    setSubscribing(true)
    
    try {
      const registration = await navigator.serviceWorker.ready
      
      // Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        console.log('[Push] Permission denied')
        setSubscribing(false)
        return
      }
      
      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
      
      // Send to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent
        })
      })
      
      if (res.ok) {
        setPushSubscribed(true)
        setShowPushBanner(false)
        console.log('[Push] Subscribed successfully')
      }
    } catch (error) {
      console.error('[Push] Subscribe error:', error)
    }
    
    setSubscribing(false)
  }

  const unsubscribeFromPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      if (subscription) {
        await subscription.unsubscribe()
        
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        })
      }
      
      setPushSubscribed(false)
      console.log('[Push] Unsubscribed')
    } catch (error) {
      console.error('[Push] Unsubscribe error:', error)
    }
  }

  const handleInstall = async () => {
    if (!installPrompt) return

    // Bottom nav'ı gizle - yükleme başlıyor
    window.dispatchEvent(new CustomEvent('pwaInstallStarted'))
    
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    
    if (outcome === 'accepted') {
      console.log('[PWA] User accepted install')
    } else {
      // Kullanıcı iptal ettiyse bottom nav'ı geri getir
      window.dispatchEvent(new CustomEvent('pwaInstallEnded'))
    }
    
    setInstallPrompt(null)
    setShowInstallBanner(false)
  }

  const handleDismiss = () => {
    setShowInstallBanner(false)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  const handleIOSDismiss = () => {
    setShowIOSInstallBanner(false)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  const handlePushDismiss = () => {
    setShowPushBanner(false)
    localStorage.setItem('push-banner-dismissed', Date.now().toString())
  }

  // Don't show if already installed
  if (isStandalone) {
    return <>{children}</>
  }

  return (
    <>
      {children}
      
      {/* Install Banner - Android/Desktop - Ekranın ortasında */}
      {showInstallBanner && installPrompt && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleDismiss} />
          
          {/* Banner */}
          <div className="relative bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 text-white rounded-3xl shadow-2xl p-6 w-full max-w-sm animate-scale-in">
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center">
                <Smartphone className="w-10 h-10" />
              </div>
              <div>
                <h3 className="font-bold text-xl">{t('installApp')}</h3>
                <p className="text-sm text-white/90 mt-2">
                  {t('addToHomeDesc')}
                </p>
              </div>
              <button
                onClick={handleInstall}
                className="w-full px-6 py-3 bg-white text-sky-600 font-bold rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2 text-lg shadow-lg"
              >
                <Download className="w-5 h-5" />
                {t('install')}
              </button>
              <button
                onClick={handleDismiss}
                className="text-white/70 text-sm hover:text-white transition-colors"
              >
                {t('notNow')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Install Instructions - Daha detaylı */}
      {showIOSInstallBanner && isIOS && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[420px] bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-2xl shadow-2xl p-4 z-50 animate-slide-up">
          <button
            onClick={handleIOSDismiss}
            className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{t('installOnIphone')}</h3>
              <div className="text-sm text-white/90 mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-white/30 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <span><Share className="w-4 h-4 inline" /> {t('iosStep1')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-white/30 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <span><PlusSquare className="w-4 h-4 inline" /> {t('iosStep2')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-white/30 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <span>{t('iosStep3')}</span>
                </div>
              </div>
              {iOSVersion && iOSVersion >= 16.4 && (
                <p className="text-xs text-white/70 mt-2 bg-white/10 rounded p-2">
                  💡 {t('notificationsAfterInstall')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Push Notification Banner */}
      {showPushBanner && session?.user && pushSupported && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl shadow-2xl p-4 z-50 animate-slide-up">
          <button
            onClick={handlePushDismiss}
            className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Bell className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{t('enableNotifications')}</h3>
              <p className="text-sm text-white/90 mt-1">
                {t('notificationsDesc')}
              </p>
              <button
                onClick={subscribeToPush}
                disabled={subscribing}
                className="mt-3 px-4 py-2 bg-white text-purple-600 font-medium rounded-lg hover:bg-white/90 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Bell className="w-4 h-4" />
                {subscribing ? t('enablingNotifications') : t('enableNotifications')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Push Not Supported Banner - PWA kurulmamışsa */}
      {showPushBanner && session?.user && isIOS && !isStandalone && !pushSupported && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl shadow-2xl p-4 z-50 animate-slide-up">
          <button
            onClick={handlePushDismiss}
            className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Bell className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Bildirimler İçin</h3>
              <p className="text-sm text-white/90 mt-1">
                iPhone&apos;da bildirim almak için önce TAKAS-A&apos;yı ana ekrana eklemelisiniz.
              </p>
              {iOSVersion && iOSVersion < 16.4 && (
                <p className="text-xs text-white/70 mt-2">
                  ⚠️ iOS {iOSVersion} kullanıyorsunuz. Bildirimler için iOS 16.4+ gerekli.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Push notification toggle için export
export function usePushNotifications() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true)
      checkSubscription()
    }
  }, [])

  const checkSubscription = async () => {
    try {
      const res = await fetch('/api/push/subscribe')
      const data = await res.json()
      setSubscribed(data.subscribed)
    } catch (error) {
      console.error('Check subscription error:', error)
    }
  }

  const subscribe = async () => {
    if (!supported || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return false
    
    setLoading(true)
    
    try {
      const registration = await navigator.serviceWorker.ready
      const permission = await Notification.requestPermission()
      
      if (permission !== 'granted') {
        setLoading(false)
        return false
      }
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
      })
      
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent
        })
      })
      
      if (res.ok) {
        setSubscribed(true)
        setLoading(false)
        return true
      }
    } catch (error) {
      console.error('Subscribe error:', error)
    }
    
    setLoading(false)
    return false
  }

  const unsubscribe = async () => {
    setLoading(true)
    
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      if (subscription) {
        await subscription.unsubscribe()
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        })
      }
      
      setSubscribed(false)
    } catch (error) {
      console.error('Unsubscribe error:', error)
    }
    
    setLoading(false)
  }

  return { supported, subscribed, loading, subscribe, unsubscribe, checkSubscription }
}
