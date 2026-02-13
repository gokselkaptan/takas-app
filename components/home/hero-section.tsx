'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/lib/language-context'

const heroTexts = {
  tr: {
    title1: 'Dünyadaki Tüm Şehirler İçin',
    title2: 'Ücretsiz Takas Platformu',
    subtitle: 'Global çapta ücretsiz takas! Para ödemeden ürünlerini takas et, sürdürülebilir ekonomiye katkıda bulun.',
    button: 'TAKAS-A Başla'
  },
  en: {
    title1: 'Free Swap Platform',
    title2: 'For All Cities Worldwide',
    subtitle: 'Global free swapping! Exchange your items without money, contribute to a sustainable economy.',
    button: 'Start with TAKAS-A'
  },
  es: {
    title1: 'Plataforma de Intercambio Gratis',
    title2: 'Para Todas las Ciudades del Mundo',
    subtitle: '¡Intercambio global gratuito! Intercambia tus artículos sin dinero, contribuye a una economía sostenible.',
    button: 'Empieza con TAKAS-A'
  },
  ca: {
    title1: 'Plataforma d\'Intercanvi Gratuït',
    title2: 'Per a Totes les Ciutats del Món',
    subtitle: 'Intercanvi global gratuït! Intercanvia els teus articles sense diners, contribueix a una economia sostenible.',
    button: 'Comença amb TAKAS-A'
  }
}

export function HeroSection() {
  const { language } = useLanguage()
  const texts = heroTexts[language]
  const [showText, setShowText] = useState(true)
  const [isClient, setIsClient] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Hydration fix
  useEffect(() => {
    setIsClient(true)
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
                <p className="text-base sm:text-lg text-white/90 mb-5 max-w-xl mx-auto">
                  {texts.subtitle}
                </p>
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
              Metni görmek için basılı tutun
            </motion.p>
          )}
        </div>
      </div>
    </section>
  )
}
