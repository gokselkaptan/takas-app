'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronRight, BookOpen, Package, Zap, Shield } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { playPopupSound, unlockAudio } from '@/lib/notification-sounds'

// ═══ EĞİTİCİ İÇERİKLER ═══
const EDUCATIONAL_TIPS = [
  {
    id: 'welcome',
    icon: '👋',
    title: 'TAKAS-A\'ya Hoş Geldiniz!',
    message: 'Para harcamadan ürünlerinizi takas edin. İhtiyacınız olmayanı verin, istediğinizi alın!',
    action: { label: 'Ürünlere Göz At', href: '/urunler' },
    bgColor: 'from-purple-500 to-blue-500',
    priority: 10,
    showOnPages: ['/'],
    showAfterSeconds: 5,
  },
  {
    id: 'valor-nedir',
    icon: '💰',
    title: 'Valor Nedir?',
    message: 'Valor, TAKAS-A\'nın sanal para birimidir. Her ürünün bir Valor değeri var. Takas yaptıkça seviyen yükselir, bonusların artar! Her seviyede daha fazla kazanırsın.',
    action: { label: 'Valor Bakiyem', href: '/profil?tab=valor' },
    bgColor: 'from-amber-500 to-orange-500',
    priority: 9,
    showOnPages: ['/urunler', '/urun'],
    showAfterSeconds: 30,
  },
  {
    id: 'hizli-takas',
    icon: '⚡',
    title: 'Hızlı Takas',
    message: 'Tek tıkla takas teklifi gönderin! Her takas seviyen artırır. Seviye arttıkça günlük bonus, takas bonusu ve daha fazlası açılır.',
    action: { label: 'Ürünlere Göz At', href: '/urunler' },
    bgColor: 'from-green-500 to-emerald-500',
    priority: 8,
    showOnPages: ['/urunler', '/'],
    showAfterSeconds: 60,
  },
  {
    id: 'coklu-takas',
    icon: '🔄',
    title: 'Çoklu Takas',
    message: 'Direkt takas bulamıyor musunuz? 3+ kişi arasında döngüsel takas yapabilirsiniz! A→B→C→A — herkes kazanır. Ne kadar çok ürüne ilgi bildirirseniz, şansınız o kadar artar.',
    action: { label: 'Takas Fırsatları', href: '/takas-firsatlari' },
    bgColor: 'from-purple-500 to-pink-500',
    priority: 7,
    showOnPages: ['/urunler', '/takaslarim', '/'],
    showAfterSeconds: 120,
  },
  {
    id: 'hizmet-takasi',
    icon: '🤝',
    title: 'Hizmet Takası',
    message: 'Sadece ürün değil, hizmetinizi de takas edebilirsiniz! Temizlik, elektrik, özel ders... Emeğinizi listeleyin, karşılığında ürün alın.',
    action: { label: 'Hizmet Takası', href: '/hizmet-takasi' },
    bgColor: 'from-teal-500 to-cyan-500',
    priority: 6,
    showOnPages: ['/urunler', '/kurumsal', '/'],
    showAfterSeconds: 180,
  },
  {
    id: 'global-takas',
    icon: '🌍',
    title: 'Global Takas',
    message: 'TAKAS-A sadece İzmir değil! Dünyanın her yerinden takas yapabilirsiniz. Barcelona, Berlin, Londra... Farklı şehirlerdeki ürünlere göz atın.',
    action: { label: 'Global Sayfası', href: '/global' },
    bgColor: 'from-blue-500 to-indigo-500',
    priority: 5,
    showOnPages: ['/', '/urunler'],
    showAfterSeconds: 240,
  },
  {
    id: 'istek-panosu',
    icon: '🎯',
    title: 'İstek Panosu',
    message: 'Aradığınız ürünü bulamıyor musunuz? İstek panosuna yazın! Diğer kullanıcılar sizin isteğinizi görüp teklif yapabilir.',
    action: { label: 'İstek Panosu', href: '/istek-panosu' },
    bgColor: 'from-rose-500 to-pink-500',
    priority: 4,
    showOnPages: ['/urunler', '/'],
    showAfterSeconds: 300,
  },
  {
    id: 'guven-skoru',
    icon: '🛡️',
    title: 'Güven Skoru',
    message: 'Her kullanıcının bir güven skoru var. Takas tamamlama, değerlendirme ve profil doğrulama ile skorunuzu artırın. Yüksek skor = daha fazla güven!',
    action: { label: 'Profilim', href: '/profil' },
    bgColor: 'from-emerald-500 to-green-600',
    priority: 3,
    showOnPages: ['/profil', '/takaslarim'],
    showAfterSeconds: 360,
  },
  {
    id: 'rozet-sistemi',
    icon: '🏆',
    title: 'Rozet Kazan!',
    message: 'Takas yap, değerlendirme bırak, arkadaş davet et — rozetler kazan! Rozetler seviyen ilerledikçe daha değerli ödüller verir. İlk rozet sembolik, son rozet büyük ödül!',
    action: { label: 'Rozetlerim', href: '/profil?tab=badges' },
    bgColor: 'from-yellow-500 to-amber-500',
    priority: 2,
    showOnPages: ['/profil', '/'],
    showAfterSeconds: 420,
  },
  {
    id: 'topluluk',
    icon: '👥',
    title: 'Topluluk',
    message: 'TAKAS-A bir topluluktur! Diğer kullanıcılarla etkileşime geçin, topluluk etkinliklerine katılın ve sürdürülebilir ekonomiye katkıda bulunun.',
    action: { label: 'Topluluklar', href: '/topluluklar' },
    bgColor: 'from-violet-500 to-purple-600',
    priority: 1,
    showOnPages: ['/topluluk', '/topluluklar', '/'],
    showAfterSeconds: 480,
  },
  {
    id: 'ilk-urun',
    icon: <Package className="w-6 h-6" />,
    title: '🎁 İlk Ürününü Ekle!',
    message: 'Hemen ilk ürününü ekle ve takas dünyasına adım at. Fotoğraf eklemek eşleşme şansını 3x artırıyor!',
    action: { label: 'Ürün Ekle', href: '/urun-ekle' },
    bgColor: 'from-violet-500 to-purple-600',
    priority: 10,
    showOnPages: ['/'],
    showAfterSeconds: 5,
  },
  {
    id: 'profil-tamamla',
    icon: <Shield className="w-6 h-6" />,
    title: '⭐ Profilini Tamamla!',
    message: 'Profil fotoğrafı ve bio ekleyerek +50 Valor kazan. Tamamlanmış profiller 2x daha fazla teklif alıyor!',
    action: { label: 'Profile Git', href: '/profil' },
    bgColor: 'from-amber-500 to-orange-500',
    priority: 9,
    showOnPages: ['/'],
    showAfterSeconds: 8,
  },
  {
    id: 'ilk-teklif',
    icon: <Zap className="w-6 h-6" />,
    title: '🚀 İlk Teklifini Ver!',
    message: 'Beğendiğin bir ürüne teklif ver — ücretsiz, risksiz! İlk teklifini veren kullanıcılar +25 Valor kazanıyor.',
    action: { label: 'Ürünlere Bak', href: '/urunler' },
    bgColor: 'from-green-500 to-emerald-600',
    priority: 8,
    showOnPages: ['/urunler'],
    showAfterSeconds: 6,
  },
]

// ═══ POPUP POZİSYONLARI ═══
type PopupPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'bottom-center'

const POSITIONS: Record<PopupPosition, string> = {
  'bottom-right': 'fixed bottom-20 right-4 md:bottom-6 md:right-6',
  'bottom-left': 'fixed bottom-20 left-4 md:bottom-6 md:left-6',
  'top-right': 'fixed top-20 right-4 md:top-24 md:right-6',
  'bottom-center': 'fixed bottom-20 left-1/2 -translate-x-1/2 md:bottom-6',
}

export default function EducationalPopups() {
  const [currentTip, setCurrentTip] = useState<typeof EDUCATIONAL_TIPS[0] | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [position] = useState<PopupPosition>('bottom-right')
  const [dismissed, setDismissed] = useState(false)

  // Görülmüş popup'ları localStorage'dan al
  const getSeenTips = useCallback((): string[] => {
    try {
      const seen = localStorage.getItem('takas-a-seen-tips')
      return seen ? JSON.parse(seen) : []
    } catch {
      return []
    }
  }, [])

  // Popup'ı görüldü olarak işaretle
  const markAsSeen = useCallback((tipId: string) => {
    try {
      const seen = getSeenTips()
      if (!seen.includes(tipId)) {
        seen.push(tipId)
        localStorage.setItem('takas-a-seen-tips', JSON.stringify(seen))
      }
    } catch {}
  }, [getSeenTips])

  // Son popup zamanını kontrol et (sıkmamak için)
  const canShowPopup = useCallback((): boolean => {
    try {
      // "Bir daha gösterme" seçeneği seçildiyse hiç gösterme
      const permanentDismiss = localStorage.getItem('takas-a-tips-dismissed-permanently')
      if (permanentDismiss === 'true') return false
      
      // Son 24 saatte gösterildiyse tekrar gösterme
      const lastShown = localStorage.getItem('takas-a-last-tip-time')
      if (!lastShown) return true
      const elapsed = Date.now() - parseInt(lastShown)
      return elapsed > 24 * 60 * 60 * 1000 // En az 24 saat arayla
    } catch {
      return true
    }
  }, [])

  // Uygun popup'ı bul
  const findNextTip = useCallback(() => {
    const seen = getSeenTips()
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
    
    // Görülmemiş ve bu sayfada gösterilmesi gereken popup'ları bul
    const available = EDUCATIONAL_TIPS.filter(tip => {
      if (seen.includes(tip.id)) return false
      // Sayfa kontrolü
      return tip.showOnPages.some(page => 
        page === '/' ? pathname === '/' : pathname.startsWith(page)
      )
    })
    
    // Önceliğe göre sırala
    available.sort((a, b) => b.priority - a.priority)
    
    return available[0] || null
  }, [getSeenTips])

  // Popup gösterme zamanlayıcısı
  useEffect(() => {
    if (dismissed) return

    const showTip = () => {
      if (!canShowPopup()) return
      
      const tip = findNextTip()
      if (!tip) return
      
      setCurrentTip(tip)
      
      // Biraz gecikmeyle göster (sayfa yüklensin)
      const delay = Math.min(tip.showAfterSeconds * 1000, 30000)
      setTimeout(() => {
        setIsVisible(true)
        localStorage.setItem('takas-a-last-tip-time', Date.now().toString())
      }, delay)
    }

    // İlk popup: 5 saniye sonra (sayfa yüklensin)
    const initialTimer = setTimeout(showTip, 5000)
    
    // Sonraki popup'lar için interval yok - günde bir kez yeterli
    // Her sayfa geçişinde tekrar kontrol edilecek

    return () => {
      clearTimeout(initialTimer)
    }
  }, [dismissed, isVisible, canShowPopup, findNextTip])

  // Popup'ı kapat
  const closeTip = useCallback(() => {
    setIsVisible(false)
    if (currentTip) {
      markAsSeen(currentTip.id)
    }
    // 300ms sonra state'i temizle (animasyon bitsin)
    setTimeout(() => setCurrentTip(null), 300)
  }, [currentTip, markAsSeen])

  // "Bir daha gösterme" — kalıcı olarak kapat
  const dismissAll = useCallback(() => {
    setIsVisible(false)
    setDismissed(true)
    // Kalıcı olarak tüm popup'ları kapat
    localStorage.setItem('takas-a-tips-dismissed-permanently', 'true')
    EDUCATIONAL_TIPS.forEach(tip => markAsSeen(tip.id))
    setTimeout(() => setCurrentTip(null), 300)
  }, [markAsSeen])

  // Popup gösterildiğinde ses çal
  useEffect(() => {
    if (isVisible) {
      unlockAudio()
      playPopupSound()
    }
  }, [isVisible])

  // Auto-close: 12 saniye sonra otomatik kapat
  useEffect(() => {
    if (!isVisible) return
    const timer = setTimeout(closeTip, 12000)
    return () => clearTimeout(timer)
  }, [isVisible, closeTip])

  if (!currentTip) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`${POSITIONS[position]} z-[9990] max-w-[340px] w-[calc(100vw-2rem)]`}
        >
          <div className={`bg-gradient-to-br ${currentTip.bgColor} rounded-2xl shadow-2xl overflow-hidden`}>
            {/* Üst çubuk — kapat ve "bir daha gösterme" */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-white/70" />
                <span className="text-[10px] text-white/70 font-medium uppercase tracking-wider">
                  Bilgi Köşesi
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={dismissAll}
                  className="text-[10px] text-white/50 hover:text-white/80 transition-colors px-1"
                >
                  Gösterme
                </button>
                <button
                  onClick={closeTip}
                  className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* İçerik */}
            <div className="px-4 pb-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl flex-shrink-0 mt-0.5">{currentTip.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-sm mb-1">
                    {currentTip.title}
                  </h3>
                  <p className="text-white/85 text-xs leading-relaxed">
                    {currentTip.message}
                  </p>
                </div>
              </div>

              {/* Aksiyon butonu */}
              {currentTip.action && (
                <Link
                  href={currentTip.action.href}
                  onClick={closeTip}
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-white text-sm font-semibold transition-colors backdrop-blur-sm"
                >
                  {currentTip.action.label}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>

            {/* Alt progress bar — otokapanma göstergesi */}
            <div className="h-1 bg-white/10">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 12, ease: 'linear' }}
                className="h-full bg-white/40 rounded-full"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
