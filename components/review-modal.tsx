'use client'

import { useState } from 'react'
import { Star, X, Check, ThumbsUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/language-context'
import { Button } from '@/components/ui/button'

interface ReviewModalProps {
  isOpen: boolean
  onClose: () => void
  swapId: string
  otherUser: {
    id: string
    name: string | null
    image: string | null
  }
  productTitle: string
  onSuccess?: () => void
}

const TAG_OPTIONS = [
  { id: 'fast_delivery', tr: 'Hızlı Teslimat', en: 'Fast Delivery' },
  { id: 'accurate_description', tr: 'Doğru Açıklama', en: 'Accurate Description' },
  { id: 'good_communication', tr: 'İyi İletişim', en: 'Good Communication' },
  { id: 'friendly', tr: 'Samimi', en: 'Friendly' },
  { id: 'professional', tr: 'Profesyonel', en: 'Professional' },
  { id: 'punctual', tr: 'Dakik', en: 'Punctual' }
]

export function ReviewModal({ 
  isOpen, 
  onClose, 
  swapId, 
  otherUser, 
  productTitle,
  onSuccess 
}: ReviewModalProps) {
  const { language } = useLanguage()
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  const texts = {
    tr: {
      title: 'Değerlendirme Yap',
      rateExperience: 'Deneyiminizi değerlendirin',
      selectTags: 'Bu takası en iyi tanımlayan özellikleri seçin',
      comment: 'Yorum (isteğe bağlı)',
      commentPlaceholder: 'Deneyiminizi paylaşın...',
      submit: 'Değerlendirmeyi Gönder',
      submitting: 'Gönderiliyor...',
      success: 'Değerlendirmeniz kaydedildi!',
      error: 'Bir hata oluştu',
      selectRating: 'Lütfen bir puan seçin',
      swapWith: 'Takas:'
    },
    en: {
      title: 'Leave a Review',
      rateExperience: 'Rate your experience',
      selectTags: 'Select tags that best describe this swap',
      comment: 'Comment (optional)',
      commentPlaceholder: 'Share your experience...',
      submit: 'Submit Review',
      submitting: 'Submitting...',
      success: 'Your review has been saved!',
      error: 'An error occurred',
      selectRating: 'Please select a rating',
      swapWith: 'Swap:'
    }
  }
  const t = texts[language as keyof typeof texts] || texts.tr
  
  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    )
  }
  
  const handleSubmit = async () => {
    if (rating === 0) {
      setError(t.selectRating)
      return
    }
    
    setIsSubmitting(true)
    setError('')
    
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapRequestId: swapId,
          rating,
          comment: comment.trim() || null,
          tags: selectedTags
        })
      })
      
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => {
          onSuccess?.()
          onClose()
        }, 1500)
      } else {
        const data = await res.json()
        setError(data.error || t.error)
      }
    } catch {
      setError(t.error)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const ratingLabels = {
    1: { tr: 'Kötü', en: 'Poor' },
    2: { tr: 'Fena Değil', en: 'Fair' },
    3: { tr: 'İyi', en: 'Good' },
    4: { tr: 'Çok İyi', en: 'Very Good' },
    5: { tr: 'Mükemmel', en: 'Excellent' }
  }
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{t.title}</h2>
              <button 
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {success ? (
              <div className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <Check className="w-8 h-8 text-green-600" />
                </motion.div>
                <p className="text-lg font-medium text-gray-900">{t.success}</p>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {/* Kullanıcı bilgisi */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    {otherUser.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {otherUser.name || 'Kullanıcı'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {t.swapWith} {productTitle}
                    </div>
                  </div>
                </div>
                
                {/* Yıldız seçimi */}
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-3">{t.rateExperience}</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={cn(
                            'w-10 h-10 transition-colors',
                            (hoveredRating || rating) >= star
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'fill-gray-200 text-gray-200'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  {(hoveredRating || rating) > 0 && (
                    <p className="text-sm font-medium text-gray-700 mt-2">
                      {ratingLabels[(hoveredRating || rating) as keyof typeof ratingLabels]?.[language as 'tr' | 'en'] || ''}
                    </p>
                  )}
                </div>
                
                {/* Etiket seçimi */}
                <div>
                  <p className="text-sm text-gray-600 mb-2">{t.selectTags}</p>
                  <div className="flex flex-wrap gap-2">
                    {TAG_OPTIONS.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                          selectedTags.includes(tag.id)
                            ? 'bg-green-100 text-green-700 border-2 border-green-300'
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                        )}
                      >
                        {selectedTags.includes(tag.id) && (
                          <ThumbsUp className="w-3 h-3 inline mr-1" />
                        )}
                        {tag[language as 'tr' | 'en'] || tag.tr}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Yorum */}
                <div>
                  <label className="text-sm text-gray-600 block mb-2">
                    {t.comment}
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t.commentPlaceholder}
                    className="w-full px-3 py-2 border rounded-lg resize-none h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">
                    {comment.length}/500
                  </p>
                </div>
                
                {/* Hata */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {error}
                  </div>
                )}
                
                {/* Gönder butonu */}
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || rating === 0}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:shadow-lg transition disabled:opacity-50"
                >
                  {isSubmitting ? t.submitting : t.submit}
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
