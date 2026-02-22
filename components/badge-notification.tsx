'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface NewBadge {
  id: string
  name: string
  icon: string
  tier: string
  valorReward: number
  description: string
}

const TIER_STYLES: Record<string, string> = {
  bronze: 'from-orange-400 to-amber-500',
  silver: 'from-gray-300 to-gray-500',
  gold: 'from-yellow-400 to-amber-500',
  platinum: 'from-purple-400 to-indigo-500',
  diamond: 'from-cyan-300 to-blue-500',
}

export function BadgeNotification() {
  const { data: session } = useSession()
  const [newBadges, setNewBadges] = useState<NewBadge[]>([])
  const [currentBadge, setCurrentBadge] = useState<NewBadge | null>(null)

  const checkNewBadges = useCallback(async () => {
    if (!session?.user) return
    
    try {
      const res = await fetch('/api/badges?check=new')
      if (res.ok) {
        const data = await res.json()
        if (data.newBadges && data.newBadges.length > 0) {
          setNewBadges(data.newBadges)
          setCurrentBadge(data.newBadges[0])
        }
      }
    } catch (error) {
      // Sessiz hata — bildirim gösterilmez, sorun değil
    }
  }, [session])

  // Her 60 saniyede bir yeni rozet kontrolü
  useEffect(() => {
    if (!session?.user) return
    
    // İlk kontrol 5 saniye sonra
    const initialTimer = setTimeout(checkNewBadges, 5000)
    
    // Sonra her 60 saniyede bir
    const interval = setInterval(checkNewBadges, 60000)
    
    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [session, checkNewBadges])

  const dismissBadge = async () => {
    if (currentBadge) {
      // Rozeti "görüldü" olarak işaretle
      try {
        await fetch('/api/badges', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ badgeId: currentBadge.id, action: 'seen' })
        })
      } catch {}
      
      // Sıradaki rozeti göster
      const remaining = newBadges.filter(b => b.id !== currentBadge.id)
      setNewBadges(remaining)
      setCurrentBadge(remaining.length > 0 ? remaining[0] : null)
    }
  }

  if (!currentBadge) return null

  const tierGradient = TIER_STYLES[currentBadge.tier] || TIER_STYLES.bronze

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -100, scale: 0.8 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[90vw] max-w-sm"
      >
        <div className={`bg-gradient-to-r ${tierGradient} rounded-2xl shadow-2xl p-1`}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 relative">
            <button
              onClick={dismissBadge}
              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-4">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-4xl"
              >
                {currentBadge.icon}
              </motion.div>
              
              <div className="flex-1 pr-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-bold text-yellow-600 uppercase">
                    Yeni Rozet Kazandın!
                  </span>
                </div>
                <h3 className="font-bold text-gray-800 dark:text-white">
                  {currentBadge.name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {currentBadge.description}
                </p>
                {currentBadge.valorReward > 0 && (
                  <p className="text-xs font-bold text-green-600 mt-1">
                    +{currentBadge.valorReward} Valor kazandın! 🎉
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
