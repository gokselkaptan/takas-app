'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Play, Volume2, VolumeX, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function AIVisualizationPromo() {
  const [isVisible, setIsVisible] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    // Sadece ürün detay sayfalarında göster (/urun/[id])
    const isProductPage = pathname.startsWith('/urun/') && pathname !== '/urun-ekle'
    
    if (!isProductPage) {
      setIsVisible(false)
      return
    }

    // LocalStorage'da bugün bu ürün sayfasında gösterilip gösterilmediğini kontrol et
    const lastShownDate = localStorage.getItem('aiPromoLastDate')
    const today = new Date().toDateString()
    
    // Bugün zaten gösterildiyse gösterme
    if (lastShownDate === today) {
      return
    }

    // Mobilde 5 saniye, masaüstünde 3 saniye sonra göster
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    const delay = isMobile ? 5000 : 3000
    
    const timer = setTimeout(() => {
      setIsVisible(true)
      localStorage.setItem('aiPromoLastDate', today)
    }, delay)
    return () => clearTimeout(timer)
  }, [pathname])

  const handleClose = () => {
    setIsVisible(false)
    // localStorage kaldırıldı - her girişte yeniden açılacak
  }

  const handlePlayVideo = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  if (!isVisible) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.8 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 p-3">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <p className="text-white font-bold text-sm">YENİ! AI Görselleştirme ✨</p>
                <p className="text-white/80 text-xs">Ürün nasıl görünür?</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="absolute top-2 right-2 p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Video Area */}
          <div className="relative aspect-video bg-gray-900">
            <video
              ref={videoRef}
              src="/videos/ai-visualization-demo.mp4"
              className="w-full h-full object-cover"
              loop
              muted={isMuted}
              playsInline
              poster="/images/ai-viz-poster.jpg"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            
            {/* Play Overlay */}
            {!isPlaying && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer"
                onClick={handlePlayVideo}
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg"
                >
                  <Play className="w-6 h-6 text-purple-600 ml-1" />
                </motion.div>
              </motion.div>
            )}

            {/* Video Controls */}
            {isPlaying && (
              <div className="absolute bottom-2 right-2 flex gap-2">
                <button
                  onClick={toggleMute}
                  className="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-white" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
            )}

            {/* Animated Feature Tag */}
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute top-2 left-2 px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
            >
              <p className="text-white text-xs font-medium">🏠 Ürün Nasıl Görünür?</p>
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            <div className="space-y-1">
              <p className="text-gray-800 font-semibold text-sm">
                AI ile ürün nasıl görünür? 🪄
              </p>
              <p className="text-gray-500 text-xs">
                Ortamı tanımla, AI görselleştirsin. 
                <span className="text-purple-600 font-medium"> 3 ücretsiz hak!</span>
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex gap-2">
              <Link
                href="/urunler"
                onClick={handleClose}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white rounded-xl font-semibold text-sm text-center hover:shadow-lg transition-all flex items-center justify-center gap-1"
              >
                Dene! <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={handleClose}
                className="py-2.5 px-4 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Sonra
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
