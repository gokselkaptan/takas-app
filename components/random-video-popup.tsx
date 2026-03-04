'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { X, Volume2, VolumeX } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// "Nasıl Görünür" tanıtım videoları - sadece 2 video
const promoVideos = [
  {
    id: 'ai-tanitim-kiz',
    src: '/videos/ai-tanitim-kiz.mp4',
    title: 'AI ile Görselleştir',
    description: 'Ürünler evinde nasıl görünür? AI ile anında gör!',
  },
  {
    id: 'ai-visualization-demo',
    src: '/videos/ai-visualization-demo.mp4',
    title: 'Koltuk Nasıl Görünür?',
    description: 'Mobilyalar evinde nasıl durur? Hemen dene!',
  },
]

export function RandomVideoPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentVideo, setCurrentVideo] = useState<typeof promoVideos[0] | null>(null)
  const [isMuted, setIsMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pathname = usePathname()
  const lastPathRef = useRef('')

  // Sayfa değişiminde video gösterme mantığı - GÜNDE 1 KEZ, SADECE MASAÜSTÜ
  useEffect(() => {
    // Mobilde video popup gösterme - performans için
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    if (isMobile) {
      return
    }
    
    // Admin veya login sayfalarında gösterme
    if (pathname.includes('/admin') || pathname.includes('/giris') || pathname.includes('/kayit')) {
      lastPathRef.current = pathname
      return
    }

    // İlk yükleme kontrolü
    const isFirstLoad = lastPathRef.current === ''
    const isPageChange = pathname !== lastPathRef.current
    
    lastPathRef.current = pathname

    // İlk yükleme değilse gösterme (sadece ilk girişte göster)
    if (!isFirstLoad) {
      return
    }

    // LocalStorage'da bugün gösterilip gösterilmediğini kontrol et
    const lastShownDate = localStorage.getItem('videoPopupLastDate')
    const today = new Date().toDateString()
    
    // Bugün zaten gösterildiyse gösterme
    if (lastShownDate === today) {
      return
    }

    // %40 ihtimalle video göster (azaltılmış sıklık)
    const shouldShow = Math.random() < 0.40
    
    if (shouldShow) {
      // Rastgele video seç
      const randomIndex = Math.floor(Math.random() * promoVideos.length)
      setCurrentVideo(promoVideos[randomIndex])
      setIsOpen(true)
      localStorage.setItem('videoPopupLastDate', today)
    }
  }, [pathname])

  // Video otomatik kapatma (15 saniye sonra)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setIsOpen(false)
      }, 15000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleClose = () => {
    setIsOpen(false)
    if (videoRef.current) {
      videoRef.current.pause()
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
    }
  }

  return (
    <AnimatePresence>
      {isOpen && currentVideo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 25 }}
            className="relative w-full max-w-sm bg-gradient-to-br from-sky-900 to-blue-900 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 p-3 bg-gradient-to-b from-black/60 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 flex items-center justify-center">
                    <span className="text-white font-bold text-xs">TA</span>
                  </div>
                  <span className="text-white font-semibold text-sm">{currentVideo.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleClose}
                    className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Video */}
            <div className="aspect-[9/16] relative">
              <video
                ref={videoRef}
                src={currentVideo.src}
                autoPlay
                muted={isMuted}
                playsInline
                loop
                className="w-full h-full object-cover"
              />
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-white/90 text-sm mb-3">{currentVideo.description}</p>
              <button
                onClick={handleClose}
                className="w-full py-2.5 bg-gradient-to-r from-sky-400 to-blue-500 text-white font-semibold rounded-xl hover:from-sky-500 hover:to-blue-600 transition-all shadow-lg"
              >
                Keşfet →
              </button>
            </div>

            {/* Progress bar */}
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 15, ease: 'linear' }}
              className="absolute bottom-0 left-0 h-1 bg-sky-400"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
