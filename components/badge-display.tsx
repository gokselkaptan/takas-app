'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Award, Lock, CheckCircle, Star, Trophy, Sparkles } from 'lucide-react'
import { TIER_COLORS, CATEGORY_NAMES } from '@/lib/badge-constants'
import { useLanguage } from '@/lib/language-context'

interface Badge {
  id: string
  slug: string
  name: string
  nameEn?: string
  description: string
  descriptionEn?: string
  icon: string
  category: string
  tier: string
  valorReward: number
  isSecret?: boolean
  earned?: boolean
  earnedAt?: string
  isDisplayed?: boolean
  progress?: number
}

interface BadgeDisplayProps {
  userId: string
  showAll?: boolean
  onBadgeToggle?: (badgeId: string, isDisplayed: boolean) => void
  compact?: boolean
}

export function BadgeDisplay({ userId, showAll = true, onBadgeToggle, compact = false }: BadgeDisplayProps) {
  const { language } = useLanguage()
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showDetails, setShowDetails] = useState<string | null>(null)
  
  useEffect(() => {
    fetchBadges()
  }, [userId])
  
  const fetchBadges = async () => {
    try {
      const res = await fetch(`/api/badges?userId=${userId}`)
      if (res.ok) {
        const data = await res.json()
        setBadges(data)
      }
    } catch (error) {
      console.error('Failed to fetch badges:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleToggleDisplay = async (badge: Badge) => {
    if (!badge.earned || !onBadgeToggle) return
    
    try {
      const res = await fetch('/api/badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeId: badge.id, isDisplayed: !badge.isDisplayed })
      })
      
      if (res.ok) {
        setBadges(prev => prev.map(b => 
          b.id === badge.id ? { ...b, isDisplayed: !b.isDisplayed } : b
        ))
        onBadgeToggle(badge.id, !badge.isDisplayed)
      }
    } catch (error) {
      console.error('Failed to toggle badge:', error)
    }
  }
  
  const filteredBadges = badges.filter(b => {
    if (!showAll && !b.earned) return false
    if (selectedCategory !== 'all' && b.category !== selectedCategory) return false
    if (!showAll && b.isSecret && !b.earned) return false
    return true
  })
  
  const earnedCount = badges.filter(b => b.earned).length
  const totalCount = badges.filter(b => !b.isSecret || b.earned).length
  
  const categories = ['all', 'swap', 'trust', 'community', 'achievement']
  
  const tierOrder = ['diamond', 'platinum', 'gold', 'silver', 'bronze']
  const sortedBadges = [...filteredBadges].sort((a, b) => {
    // Önce kazanılmışlar
    if (a.earned && !b.earned) return -1
    if (!a.earned && b.earned) return 1
    // Sonra tier'a göre
    return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
  })
  
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>
    )
  }
  
  if (compact) {
    // Kompakt mod - sadece kazanılmış ve gösterilen rozetler
    const displayedBadges = badges.filter(b => b.earned && b.isDisplayed).slice(0, 5)
    
    if (displayedBadges.length === 0) {
      const recentBadges = badges.filter(b => b.earned).slice(0, 3)
      if (recentBadges.length === 0) return null
      
      return (
        <div className="flex items-center gap-2">
          {recentBadges.map(badge => (
            <div
              key={badge.id}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg border ${TIER_COLORS[badge.tier]?.bg || 'bg-gray-100'} ${TIER_COLORS[badge.tier]?.border || 'border-gray-300'}`}
              title={language === 'en' ? badge.nameEn || badge.name : badge.name}
            >
              {badge.icon}
            </div>
          ))}
        </div>
      )
    }
    
    return (
      <div className="flex items-center gap-2">
        {displayedBadges.map(badge => (
          <div
            key={badge.id}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg border ${TIER_COLORS[badge.tier]?.bg || 'bg-gray-100'} ${TIER_COLORS[badge.tier]?.border || 'border-gray-300'}`}
            title={language === 'en' ? badge.nameEn || badge.name : badge.name}
          >
            {badge.icon}
          </div>
        ))}
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {/* Başlık ve İstatistik */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-frozen-500" />
          <h3 className="font-bold text-gray-800">
            {language === 'en' ? 'Badges' : 'Rozetler'}
          </h3>
          <span className="text-sm text-gray-500">
            ({earnedCount}/{totalCount})
          </span>
        </div>
        {earnedCount > 0 && (
          <div className="flex items-center gap-1 text-sm text-green-600">
            <Sparkles className="w-4 h-4" />
            <span>+{badges.filter(b => b.earned).reduce((sum, b) => sum + b.valorReward, 0)} Valor</span>
          </div>
        )}
      </div>
      
      {/* Kategori Filtreleri */}
      {showAll && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-frozen-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat === 'all' 
                ? (language === 'en' ? 'All' : 'Tümü')
                : (language === 'en' ? CATEGORY_NAMES[cat]?.en : CATEGORY_NAMES[cat]?.tr) || cat
              }
            </button>
          ))}
        </div>
      )}
      
      {/* Rozet Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <AnimatePresence>
          {sortedBadges.map((badge, index) => {
            const tierColor = TIER_COLORS[badge.tier] || TIER_COLORS.bronze
            
            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setShowDetails(showDetails === badge.id ? null : badge.id)}
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  badge.earned
                    ? `${tierColor.bg} ${tierColor.border} hover:shadow-md`
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                {/* Tier Badge */}
                {badge.earned && (
                  <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full ${tierColor.bg} ${tierColor.border} border flex items-center justify-center`}>
                    <Star className={`w-3 h-3 ${tierColor.text}`} />
                  </div>
                )}
                
                {/* Lock/Check Icon */}
                {!badge.earned && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center">
                    <Lock className="w-3 h-3 text-gray-500" />
                  </div>
                )}
                
                {/* Display Toggle */}
                {badge.earned && onBadgeToggle && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleDisplay(badge)
                    }}
                    className={`absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                      badge.isDisplayed
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                    }`}
                  >
                    <CheckCircle className="w-3 h-3" />
                  </button>
                )}
                
                {/* Badge Content */}
                <div className="text-center">
                  <div className={`text-3xl mb-2 ${!badge.earned ? 'grayscale' : ''}`}>
                    {badge.icon}
                  </div>
                  <h4 className={`text-sm font-semibold ${badge.earned ? tierColor.text : 'text-gray-500'}`}>
                    {language === 'en' ? badge.nameEn || badge.name : badge.name}
                  </h4>
                  
                  {/* Valor Reward */}
                  {badge.valorReward > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      +{badge.valorReward} Valor
                    </div>
                  )}
                </div>
                
                {/* Detay Panel */}
                <AnimatePresence>
                  {showDetails === badge.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 border-t border-gray-200"
                    >
                      <p className="text-xs text-gray-600">
                        {language === 'en' ? badge.descriptionEn || badge.description : badge.description}
                      </p>
                      {badge.earnedAt && (
                        <p className="text-xs text-green-600 mt-2">
                          ✓ {new Date(badge.earnedAt).toLocaleDateString('tr-TR')}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
      
      {sortedBadges.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{language === 'en' ? 'No badges yet' : 'Henüz rozet yok'}</p>
        </div>
      )}
    </div>
  )
}

// Profil özeti için mini rozet gösterimi
export function BadgeSummary({ userId }: { userId: string }) {
  return <BadgeDisplay userId={userId} compact showAll={false} />
}
