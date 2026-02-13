'use client'

import { useState, useEffect } from 'react'
import { Star, MessageSquare, ThumbsUp, Clock, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/language-context'

interface ReviewStats {
  averageRating: number
  totalReviews: number
  ratingDistribution: Record<number, number>
  topTags: { tag: string; count: number }[]
}

interface Review {
  id: string
  rating: number
  comment: string | null
  tags: string[]
  response: string | null
  responseAt: string | null
  createdAt: string
  author: {
    id: string
    name: string | null
    image: string | null
  }
  swapRequest: {
    product: {
      id: string
      title: string
      images: string[]
    }
  }
}

const TAG_LABELS: Record<string, Record<string, string>> = {
  fast_delivery: {
    tr: 'Hızlı Teslimat',
    en: 'Fast Delivery',
    es: 'Entrega Rápida',
    ca: 'Lliurament Ràpid'
  },
  accurate_description: {
    tr: 'Doğru Açıklama',
    en: 'Accurate Description',
    es: 'Descripción Precisa',
    ca: 'Descripció Precisa'
  },
  good_communication: {
    tr: 'İyi İletişim',
    en: 'Good Communication',
    es: 'Buena Comunicación',
    ca: 'Bona Comunicació'
  },
  friendly: {
    tr: 'Samimi',
    en: 'Friendly',
    es: 'Amigable',
    ca: 'Amigable'
  },
  professional: {
    tr: 'Profesyonel',
    en: 'Professional',
    es: 'Profesional',
    ca: 'Professional'
  },
  punctual: {
    tr: 'Dakik',
    en: 'Punctual',
    es: 'Puntual',
    ca: 'Puntual'
  }
}

// Yıldız gösterimi
export function StarRating({ 
  rating, 
  size = 'md',
  showValue = false 
}: { 
  rating: number
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean 
}) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }
  
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            sizeClasses[size],
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200'
          )}
        />
      ))}
      {showValue && (
        <span className="ml-1 text-sm font-medium text-gray-700">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}

// Güvenilirlik rozeti
export function TrustBadge({ 
  trustScore, 
  reviewCount,
  size = 'md'
}: { 
  trustScore: number
  reviewCount?: number
  size?: 'sm' | 'md' | 'lg' 
}) {
  const { language } = useLanguage()
  
  const getLevel = () => {
    if (trustScore >= 90) return { label: { tr: 'Çok Güvenilir', en: 'Very Trusted', es: 'Muy Confiable', ca: 'Molt Fiable' }, color: 'bg-green-100 text-green-700 border-green-300' }
    if (trustScore >= 75) return { label: { tr: 'Güvenilir', en: 'Trusted', es: 'Confiable', ca: 'Fiable' }, color: 'bg-blue-100 text-blue-700 border-blue-300' }
    if (trustScore >= 60) return { label: { tr: 'İyi', en: 'Good', es: 'Bueno', ca: 'Bo' }, color: 'bg-yellow-100 text-yellow-700 border-yellow-300' }
    return { label: { tr: 'Yeni', en: 'New', es: 'Nuevo', ca: 'Nou' }, color: 'bg-gray-100 text-gray-600 border-gray-300' }
  }
  
  const level = getLevel()
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  }
  
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-medium',
      level.color,
      sizeClasses[size]
    )}>
      <CheckCircle className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      <span>{level.label[language as keyof typeof level.label] || level.label.tr}</span>
      {reviewCount !== undefined && reviewCount > 0 && (
        <span className="opacity-70">({reviewCount})</span>
      )}
    </div>
  )
}

// Kullanıcı puanı özeti
export function UserRatingSummary({ userId }: { userId: string }) {
  const { language } = useLanguage()
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchStats()
  }, [userId])
  
  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/reviews?userId=${userId}`)
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Stats fetch error:', error)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return <div className="animate-pulse h-20 bg-gray-100 rounded-lg" />
  }
  
  if (!stats || stats.totalReviews === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">
          {language === 'tr' ? 'Henüz değerlendirme yok' : 'No reviews yet'}
        </p>
      </div>
    )
  }
  
  const labels = {
    tr: { reviews: 'değerlendirme', basedOn: 'üzerinden' },
    en: { reviews: 'reviews', basedOn: 'based on' },
    es: { reviews: 'reseñas', basedOn: 'basado en' },
    ca: { reviews: 'ressenyes', basedOn: 'basat en' }
  }
  const t = labels[language as keyof typeof labels] || labels.tr
  
  return (
    <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border">
      <div className="flex items-center gap-4">
        {/* Ana puan */}
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">
            {stats.averageRating.toFixed(1)}
          </div>
          <StarRating rating={Math.round(stats.averageRating)} size="sm" />
          <div className="text-xs text-gray-500 mt-1">
            {stats.totalReviews} {t.reviews}
          </div>
        </div>
        
        {/* Dağılım */}
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = stats.ratingDistribution[star] || 0
            const percentage = stats.totalReviews > 0 
              ? (count / stats.totalReviews) * 100 
              : 0
            
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-3">{star}</span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-400 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-6">{count}</span>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Popüler etiketler */}
      {stats.topTags.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex flex-wrap gap-1.5">
            {stats.topTags.map(({ tag, count }) => (
              <span 
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full"
              >
                <ThumbsUp className="w-3 h-3" />
                {TAG_LABELS[tag]?.[language] || tag}
                <span className="opacity-60">({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Yorum listesi
export function ReviewList({ userId }: { userId: string }) {
  const { language } = useLanguage()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchReviews()
  }, [userId])
  
  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/reviews?userId=${userId}`)
      if (res.ok) {
        const data = await res.json()
        setReviews(data.reviews)
      }
    } catch (error) {
      console.error('Reviews fetch error:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }
  
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-gray-100 h-32 rounded-lg" />
        ))}
      </div>
    )
  }
  
  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>{language === 'tr' ? 'Henüz yorum yok' : 'No reviews yet'}</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="bg-white rounded-lg border p-4">
          {/* Üst kısım */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {review.author.name?.charAt(0) || '?'}
              </div>
              <div>
                <div className="font-medium text-gray-900">
                  {review.author.name || 'Anonim'}
                </div>
                <div className="flex items-center gap-2">
                  <StarRating rating={review.rating} size="sm" />
                  <span className="text-xs text-gray-400">
                    {formatDate(review.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Etiketler */}
          {review.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {review.tags.map((tag) => (
                <span 
                  key={tag}
                  className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                >
                  {TAG_LABELS[tag]?.[language] || tag}
                </span>
              ))}
            </div>
          )}
          
          {/* Yorum */}
          {review.comment && (
            <p className="text-gray-700 text-sm mb-2">
              "{review.comment}"
            </p>
          )}
          
          {/* İlgili ürün */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>
              {language === 'tr' ? 'Takas:' : 'Swap:'} {review.swapRequest.product.title}
            </span>
          </div>
          
          {/* Yanıt */}
          {review.response && (
            <div className="mt-3 pl-4 border-l-2 border-blue-200 bg-blue-50/50 py-2 px-3 rounded-r">
              <div className="text-xs text-blue-600 font-medium mb-1">
                {language === 'tr' ? 'Satıcı Yanıtı' : 'Seller Response'}
              </div>
              <p className="text-sm text-gray-700">{review.response}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
