'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/lib/language-context'

const heroTexts = {
  tr: {
    title1: 'Parayla Değil,',
    title2: 'Değerle Takas Yap.',
    subtitle: 'Ürünlerini takasla değerlendir. Yapay zeka destekli adil fiyatlama, güvenli teslimat.',
    button: 'Hemen Keşfet',
    stats: '{swaps}+ takas tamamlandı · {active}+ aktif ürün · {cities} şehir'
  },
  en: {
    title1: 'Trade by Value,',
    title2: 'Not by Money.',
    subtitle: 'Swap your items for value. AI-powered fair pricing, secure delivery.',
    button: 'Explore Now',
    stats: '{swaps}+ swaps completed · {active}+ active items · {cities} cities'
  },
  es: {
    title1: 'Intercambia por Valor,',
    title2: 'No por Dinero.',
    subtitle: 'Intercambia tus artículos por valor. Precios justos con IA, entrega segura.',
    button: 'Explorar Ahora',
    stats: '{swaps}+ intercambios · {active}+ artículos activos · {cities} ciudades'
  },
  ca: {
    title1: 'Intercanvia per Valor,',
    title2: 'No per Diners.',
    subtitle: 'Intercanvia els teus articles per valor. Preus justos amb IA, lliurament segur.',
    button: 'Explorar Ara',
    stats: '{swaps}+ intercanvis · {active}+ articles actius · {cities} ciutats'
  }
}

export function HeroSection() {
  const { language, t } = useLanguage()
  const texts = heroTexts[language]
  const [showText, setShowText] = useState(true)
  const [isClient, setIsClient] = useState(false)
  const [liveStats, setLiveStats] = useState({ swaps: 150, active: 140, cities: 41 })
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Hydration fix
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  // Canlı istatistik çek
  useEffect(() => {
    fetch('/api/stats/live')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setLiveStats(data) })
      .catch(() => {}) // Hata olursa default kalır
  }, [])
  
  // 8 saniye sonra metni gizle
  useEffect(() => {
    if (isClient) {
      timerRef.current = setTimeout(() => {
        setShowText(false)
      }, 8000)
      
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }
  }, [isClient])
  
  // Video üzerine basılı tutunca metni göster
  const handlePressStart = useCallback(() => {
    pressTimerRef.current = setTimeout(() => {
      setShowText(true)
      // Yeniden 8 saniye sonra gizle
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setShowText(false)
      }, 8000)
    }, 1500) // 1.5 saniye basılı tutunca
  }, [])
  
  const handlePressEnd = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }, [])
  
  return (
    <section 
      className="relative h-[40vh] min-h-[280px] max-h-[360px] overflow-hidden cursor-pointer"
      aria-label="TAKAS-A tanıtım bölümü"
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
    >
      {/* Background Video - Optimized for performance */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster="/images/takas-a-logo.jpg"
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden="true"
        onLoadedData={(e) => {
          // Remove poster once video loads
          (e.target as HTMLVideoElement).poster = '';
        }}
      >
        <source src="/videos/takas-promo-2024.mp4" type="video/mp4" />
      </video>

      {/* Overlay - daha koyu metin varken */}
      <div 
        className={`absolute inset-0 transition-all duration-500 ${
          showText && isClient
            ? 'bg-gradient-to-b from-black/70 via-black/50 to-black/80'
            : 'bg-gradient-to-b from-black/30 via-black/20 to-black/40'
        }`}
        aria-hidden="true" 
      />

      {/* Content */}
      <div className="relative z-10 h-full flex items-center justify-center">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 text-center">
          <AnimatePresence mode="wait">
            {(showText || !isClient) && (
              <motion.div
                key="hero-text"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6 }}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Globe className="w-6 h-6 text-frozen-400 animate-pulse" />
                  <span className="text-frozen-300 text-sm font-medium uppercase tracking-wider">
                    Global Platform
                  </span>
                  <Globe className="w-6 h-6 text-frozen-400 animate-pulse" />
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 leading-tight">
                  <span className="text-gradient-frozen">{texts.title1}</span>
                  <br className="sm:hidden" />
                  <span className="sm:ml-2">{texts.title2}</span>
                </h1>
                <p className="text-base sm:text-lg text-white/90 mb-3 max-w-xl mx-auto">
                  {texts.subtitle}
                </p>
                
                {/* Canlı İstatistik */}
                <div className="flex items-center justify-center gap-3 text-white/60 text-sm mb-5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    {texts.stats
                      ?.replace('{swaps}', String(liveStats.swaps))
                      .replace('{active}', String(liveStats.active))
                      .replace('{cities}', String(liveStats.cities))
                    }
                  </span>
                </div>
                
                <Link
                  href="/kayit"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-lg font-bold gradient-frozen text-white hover:opacity-90 transition-all shadow-lg hover:shadow-xl min-h-[48px]"
                  aria-label={`${texts.button} - Kayıt sayfasına git`}
                >
                  <Sparkles className="w-5 h-5" aria-hidden="true" />
                  {texts.button}
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Metin gizliyken ipucu */}
          {isClient && !showText && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-white/60 text-sm mt-4"
            >
              {t('holdToSeeText')}
            </motion.p>
          )}
        </div>
      </div>
    </section>
  )
}
