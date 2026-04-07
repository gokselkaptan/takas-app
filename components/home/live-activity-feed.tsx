'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Package, Users, Sparkles } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'

interface Activity {
  id: string
  type: string
  userName: string
  productId?: string | null
  productTitle: string
  targetUserName?: string
  targetProductTitle?: string
  city?: string
  metadata?: string
  createdAt: string
}



export function LiveActivityFeed() {
  const router = useRouter()
  const { t } = useLanguage()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(5)
  const [isVisible, setIsVisible] = useState(false)
  
  // Tek veya çift tıklama ile ürün sayfasına git
  const handleClick = (activity: Activity) => {
    if (activity.productId && activity.type === 'product_added') {
      router.push(`/urun/${activity.productId}`)
    }
  }
  
  // Lazy load - sadece görünür olduğunda yükle
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true)
        }
      },
      { rootMargin: '100px' }
    )
    
    const element = document.getElementById('live-activity-section')
    if (element) observer.observe(element)
    
    return () => observer.disconnect()
  }, [isVisible])
  
  useEffect(() => {
    if (!isVisible) return
    
    fetchActivities()
    
    // Mobilde 60 saniye, masaüstünde 30 saniye güncelleme
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    const interval = setInterval(fetchActivities, isMobile ? 120000 : 60000) // 60-120 saniye - performans için
    return () => clearInterval(interval)
  }, [isVisible])
  
  const fetchActivities = async () => {
    try {
      const res = await fetch('/api/activity?limit=15')
      const data = await res.json()
      setActivities(data.activities || [])
    } catch (error) {
      console.error('Activity fetch error:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    
    if (hours > 0) return `${hours} ${t('laHoursAgo')}`
    if (minutes > 0) return `${minutes} ${t('laMinsAgo')}`
    return t('laJustNow')
  }
  
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'swap_completed':
        return <RefreshCw className="w-4 h-4 text-green-500" />
      case 'multi_swap':
        return <Users className="w-4 h-4 text-purple-500" />
      case 'product_added':
        return <Package className="w-4 h-4 text-blue-500" />
      default:
        return <Sparkles className="w-4 h-4 text-yellow-500" />
    }
  }
  
  const getActivityText = (activity: Activity) => {
    switch (activity.type) {
      case 'swap_completed':
        return (
          <>
            <span className="font-semibold text-gray-900 dark:text-white">{activity.userName}</span>
            {' '}↔{' '}
            <span className="font-semibold text-gray-900 dark:text-white">{activity.targetUserName}</span>
            <span className="text-gray-500 dark:text-gray-400"> {t('laSwapped')}</span>
          </>
        )
      case 'multi_swap':
        const metadata = activity.metadata ? JSON.parse(activity.metadata) : {}
        return (
          <>
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              {metadata.participantCount || 3} {t('laMultiSwapPeople')}
            </span>
            <span className="text-gray-500 dark:text-gray-400"> {t('laMultiSwapDone')}</span>
          </>
        )
      case 'product_added':
        return (
          <>
            <span className="font-semibold text-gray-900 dark:text-white">{activity.userName}</span>
            <span className="text-gray-500 dark:text-gray-400"> {t('laAddedProduct')} </span>
            <span className="font-medium text-blue-600 dark:text-blue-400">{activity.productTitle}</span>
          </>
        )
      default:
        return <span className="text-gray-500 dark:text-gray-400">{t('laNewActivity')}</span>
    }
  }
  
  const getActivityBg = (type: string) => {
    switch (type) {
      case 'swap_completed':
        return 'bg-green-50 dark:bg-green-900/30 border-green-100 dark:border-green-800'
      case 'multi_swap':
        return 'bg-purple-50 dark:bg-purple-900/30 border-purple-100 dark:border-purple-800'
      case 'product_added':
        return 'bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800'
      default:
        return 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700'
    }
  }
  
  if (loading || !isVisible) {
    return (
      <section id="live-activity-section" className="py-8 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    )
  }
  
  return (
    <section id="live-activity-section" className="py-8 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-50" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('laTitle')}</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('laSubtitle')}</span>
        </div>
        
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {activities.slice(0, visibleCount).map((activity, index) => {
              const isClickable = activity.type === 'product_added' && activity.productId
              
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleClick(activity)}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${getActivityBg(activity.type)} ${
                    isClickable ? 'cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200' : ''
                  }`}
                  title={isClickable ? t('laClickViewProduct') : undefined}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {getActivityText(activity)}
                    </p>
                    {isClickable && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{t('laClickViewProduct')}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {activity.city && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
                        📍 {activity.city}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatTimeAgo(activity.createdAt)}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
        
        {activities.length > visibleCount && (
          <button
            onClick={() => setVisibleCount(prev => prev + 5)}
            className="mt-4 w-full py-2 text-sm text-frozen-600 hover:text-frozen-700 font-medium transition-colors"
          >
            {t('laShowMore')}
          </button>
        )}
      </div>
    </section>
  )
}
