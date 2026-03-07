'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Globe, Play } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/lib/language-context'

// Hero görselleri - S3
const heroImages = [
  'https://upload.wikimedia.org/wikipedia/commons/b/ba/Barcelona_panorma_banner.jpg',
  'https://static.vecteezy.com/system/resources/previews/070/528/767/large_2x/man-presenting-a-global-network-connection-a-digital-world-map-with-glowing-nodes-representing-people-and-connections-in-his-hands-symbolizing-global-communication-and-networking-photo.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/d/d6/Izmir_banner.jpg',
  'https://images.pexels.com/photos/28985476/pexels-photo-28985476/free-photo-of-modern-london-skyline-with-iconic-landmarks.jpeg',
  'https://upload.wikimedia.org/wikipedia/commons/4/43/Moscow-City_%2836211143494%29_%28crop%29.jpg',
  'https://i.ytimg.com/vi/vdu897KK-mo/maxresdefault.jpg',
]

// Post-it notları verileri
const NOTES = [
  { emoji: "♻️", title: "150+ Takas", desc: "Tamamlanan takas sayısı" },
  { emoji: "🌍", title: "41 Şehir", desc: "Aktif şehir sayımız" },
  { emoji: "💰", title: "Parasız Takas", desc: "Para harcamadan değiştir" },
  { emoji: "🤖", title: "AI Fiyatlandırma", desc: "Yapay zeka ile adil değer" },
  { emoji: "📦", title: "Güvenli Teslimat", desc: "QR kodlu güvenli sistem" },
  { emoji: "🏆", title: "Ambassador Ol", desc: "Şehrini sen yönet" },
  { emoji: "🔄", title: "Multi-Swap", desc: "3+ kişilik zincir takas" },
  { emoji: "⭐", title: "Güven Puanı", desc: "Topluluk güven sistemi" },
]

// Post-it renkleri
const POST_IT_COLORS = [
  { bg: "#FFE066", shadow: "#D4B840", text: "#4A3F00" },
  { bg: "#FF8FA3", shadow: "#C96A7E", text: "#5A0018" },
  { bg: "#8BD3DD", shadow: "#6AA8B0", text: "#003840" },
  { bg: "#B8F0A8", shadow: "#8CC07E", text: "#1A4000" },
  { bg: "#D4A5FF", shadow: "#A87FCC", text: "#2A0050" },
  { bg: "#FFB347", shadow: "#CC8E38", text: "#4A2800" },
  { bg: "#FF6B6B", shadow: "#CC5555", text: "#500000" },
  { bg: "#87CEEB", shadow: "#6BA3BB", text: "#002840" },
]

// Rastgele eğim açıları
const ROTATIONS = [-8, -5, -3, 3, 5, 8, -6, 4]

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

type Phase = 'image' | 'postit'

export function HeroSection() {
  const { language, t } = useLanguage()
  const texts = heroTexts[language]
  const [isClient, setIsClient] = useState(false)
  const [liveStats, setLiveStats] = useState({ swaps: 150, active: 140, cities: 41 })
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('image')
  const [opacity, setOpacity] = useState(1)
  const [flyingNotes, setFlyingNotes] = useState<Set<number>>(new Set())
  const [visibleNotes, setVisibleNotes] = useState<boolean[]>(new Array(8).fill(false))
  const [score, setScore] = useState(0)
  
  // Hydration fix
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  // Canlı istatistik çek
  useEffect(() => {
    fetch('/api/stats/live')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setLiveStats(data) })
      .catch(() => {})
  }, [])
  
  // Phase geçiş zamanlayıcısı
  useEffect(() => {
    if (!isClient) return
    
    let timer: NodeJS.Timeout
    
    if (phase === 'image') {
      // 4.5sn sonra opacity 0 yap
      timer = setTimeout(() => {
        setOpacity(0)
        // 0.5sn sonra postit phase'e geç ve opacity 1 yap
        setTimeout(() => {
          setPhase('postit')
          setOpacity(1)
        }, 500)
      }, 4500)
    } else if (phase === 'postit') {
      // 2.5sn sonra opacity 0 yap
      timer = setTimeout(() => {
        setOpacity(0)
        // 0.5sn sonra image phase'e geç (sonraki index), opacity 1 yap
        setTimeout(() => {
          setCurrentImageIndex(prev => (prev + 1) % heroImages.length)
          setPhase('image')
          setOpacity(1)
        }, 500)
      }, 2500)
    }
    
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [isClient, phase, currentImageIndex])
  
  // Notes phase'ine geçince notları sırayla göster
  useEffect(() => {
    if (phase === 'postit') {
      setFlyingNotes(new Set())
      setScore(0)
      
      // Notları sırayla göster
      NOTES.forEach((_, index) => {
        setTimeout(() => {
          setVisibleNotes(prev => {
            const newState = [...prev]
            newState[index] = true
            return newState
          })
        }, index * 100)
      })
    }
  }, [phase])
  
  // Not uçurma
  const handleNoteClick = useCallback((index: number) => {
    if (flyingNotes.has(index)) return
    
    setFlyingNotes(prev => new Set([...prev, index]))
    setScore(prev => prev + 1)
  }, [flyingNotes])
  
  // Rastgele uçuş yönü hesapla
  const getFlyDirection = (index: number) => ({
    x: (Math.random() - 0.5) * 400,
    y: -200 - Math.random() * 150,
    rotate: (Math.random() - 0.5) * 720,
  })
  
  return (
    <section 
      className="relative h-[40vh] min-h-[280px] max-h-[360px] overflow-hidden"
      aria-label="TAKAS-A tanıtım bölümü"
    >
      {/* Ken Burns Slideshow Background */}
      <div 
        className="absolute inset-0 transition-opacity duration-500"
        style={{ opacity: phase === 'image' ? opacity : 0 }}
      >
        <img
          key={currentImageIndex}
          src={heroImages[currentImageIndex]}
          alt={`TAKAS-A Hero ${currentImageIndex + 1}`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            animation: 'kenBurns 5s ease-out forwards',
          }}
        />
        {/* Overlay */}
        <div 
          className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60"
          aria-hidden="true" 
        />
      </div>

      {/* Post-it Notes Background */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100 transition-opacity duration-500"
        style={{ opacity: phase === 'postit' ? opacity : 0 }}
      />

      {/* Image Phase Content */}
      <AnimatePresence>
        {phase === 'image' && (
          <motion.div 
            className="relative z-10 h-full flex items-center justify-center transition-opacity duration-500"
            style={{ opacity }}
          >
            <div className="max-w-[1000px] mx-auto px-4 sm:px-6 text-center">
              <motion.div
                key="hero-text"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
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
                
                <div className="flex items-center justify-center gap-3 text-white/80 text-sm mb-5">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post-it Notes Phase */}
      <AnimatePresence>
        {phase === 'postit' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity }}
            exit={{ opacity: 0 }}
            className="relative z-10 h-full flex flex-col items-center justify-center px-4 transition-opacity duration-500"
          >
            {/* Score */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg text-lg font-bold font-caveat"
            >
              🎯 {score}/8
            </motion.div>
            
            {/* Notes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
              {NOTES.map((note, index) => {
                const color = POST_IT_COLORS[index]
                const rotation = ROTATIONS[index]
                const isFlying = flyingNotes.has(index)
                const isVisible = visibleNotes[index]
                const flyDir = getFlyDirection(index)
                
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.5, y: 50 }}
                    animate={isFlying ? {
                      opacity: 0,
                      x: flyDir.x,
                      y: flyDir.y,
                      rotate: flyDir.rotate,
                      scale: 0.3,
                    } : isVisible ? {
                      opacity: 1,
                      scale: 1,
                      y: 0,
                      rotate: rotation,
                    } : {
                      opacity: 0,
                      scale: 0.5,
                      y: 50,
                    }}
                    transition={isFlying ? {
                      duration: 0.8,
                      ease: "easeOut"
                    } : {
                      duration: 0.4,
                      ease: "backOut"
                    }}
                    onClick={() => handleNoteClick(index)}
                    className={`relative cursor-pointer select-none ${isFlying ? 'pointer-events-none' : ''}`}
                    style={{ 
                      transformOrigin: 'center center',
                    }}
                    whileHover={!isFlying ? { scale: 1.05, rotate: 0 } : undefined}
                    whileTap={!isFlying ? { scale: 0.95 } : undefined}
                  >
                    {/* Post-it Note */}
                    <div
                      className="relative p-3 sm:p-4 rounded-sm shadow-lg"
                      style={{
                        backgroundColor: color.bg,
                        boxShadow: `3px 3px 8px rgba(0,0,0,0.15), inset 0 -2px 4px ${color.shadow}`,
                        minWidth: 'clamp(100px, 20vw, 150px)',
                        minHeight: 'clamp(80px, 15vw, 100px)',
                      }}
                    >
                      {/* Tape effect */}
                      <div 
                        className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-4 opacity-60"
                        style={{
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(200,200,200,0.4) 100%)',
                          borderRadius: '2px',
                        }}
                      />
                      
                      {/* Content */}
                      <div className="text-center pt-1">
                        <span className="text-2xl sm:text-3xl block mb-1">{note.emoji}</span>
                        <h3 
                          className="text-sm sm:text-base font-bold mb-0.5 font-caveat"
                          style={{ 
                            color: color.text,
                            fontSize: 'clamp(14px, 3vw, 18px)',
                          }}
                        >
                          {note.title}
                        </h3>
                        <p 
                          className="text-xs opacity-80 font-caveat"
                          style={{ 
                            color: color.text,
                            fontSize: 'clamp(10px, 2vw, 12px)',
                          }}
                        >
                          {note.desc}
                        </p>
                      </div>
                      
                      {/* Curled corner effect */}
                      <div 
                        className="absolute bottom-0 right-0 w-6 h-6"
                        style={{
                          background: `linear-gradient(135deg, transparent 50%, ${color.shadow} 50%)`,
                          borderRadius: '0 0 4px 0',
                        }}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </div>
            
            {/* Instruction */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4 text-gray-600 text-sm font-caveat"
            >
              👆 Notlara dokun ve uçur!
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ken Burns CSS */}
      <style jsx>{`
        @keyframes kenBurns {
          0% {
            transform: scale(1.0) translate(0%, 0%);
          }
          100% {
            transform: scale(1.08) translate(-1%, -1%);
          }
        }
      `}</style>
    </section>
  )
}
