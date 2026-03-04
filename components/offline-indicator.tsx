'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, Wifi, RefreshCw } from 'lucide-react'

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)
  const [showReconnected, setShowReconnected] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    // İlk yükleme kontrolü
    setIsOffline(!navigator.onLine)

    const handleOnline = () => {
      setIsOffline(false)
      if (wasOffline) {
        setShowReconnected(true)
        setTimeout(() => setShowReconnected(false), 3000)
      }
    }

    const handleOffline = () => {
      setIsOffline(true)
      setWasOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline])

  const handleRetry = () => {
    if (navigator.onLine) {
      window.location.reload()
    }
  }

  return (
    <AnimatePresence>
      {/* Offline Banner */}
      {isOffline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-3 shadow-lg"
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <WifiOff className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">İnternet Bağlantısı Yok</p>
                <p className="text-xs text-white/80">Bazı özellikler çalışmayabilir</p>
              </div>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Tekrar Dene</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Reconnected Toast */}
      {showReconnected && !isOffline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-3 shadow-lg"
        >
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <Wifi className="w-5 h-5" />
            </div>
            <p className="font-semibold text-sm">Bağlantı Yeniden Sağlandı!</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
