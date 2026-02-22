'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Search, ArrowLeftRight, MessageCircle, QrCode, Star } from 'lucide-react'

interface TutorialStepProps {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

const TUTORIAL_SLIDES = [
  {
    icon: Search,
    title: 'Ürünleri Keşfet',
    description: 'Binlerce ürün arasında arama yap, kategorilere göz at, yakınındaki fırsatları bul.',
    color: 'from-blue-500 to-cyan-500',
    emoji: '🔍'
  },
  {
    icon: ArrowLeftRight,
    title: 'Takas Teklifi Gönder',
    description: 'Beğendiğin ürüne "Hızlı Takas" ile tek tıkla teklif gönder veya pazarlık yap.',
    color: 'from-purple-500 to-pink-500',
    emoji: '🤝'
  },
  {
    icon: MessageCircle,
    title: 'Satıcıyla İletişim',
    description: 'Güvenli mesajlaşma sistemiyle detayları konuş, anlaşmaya var.',
    color: 'from-green-500 to-emerald-500',
    emoji: '💬'
  },
  {
    icon: QrCode,
    title: 'Güvenli Teslimat',
    description: 'QR kod ile teslimatı doğrula, teminat sistemiyle güvende ol.',
    color: 'from-orange-500 to-red-500',
    emoji: '📦'
  },
  {
    icon: Star,
    title: 'Değerlendir & Kazan',
    description: 'Takası tamamla, Valor kazan, güven puanını artır!',
    color: 'from-amber-500 to-yellow-500',
    emoji: '⭐'
  },
]

export function TutorialStep({ onNext, onBack, onSkip }: TutorialStepProps) {
  const [currentSlide, setCurrentSlide] = useState(0)

  const nextSlide = () => {
    if (currentSlide < TUTORIAL_SLIDES.length - 1) {
      setCurrentSlide(prev => prev + 1)
    } else {
      onNext()
    }
  }

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1)
    }
  }

  const slide = TUTORIAL_SLIDES[currentSlide]

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="px-4"
    >
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          Nasıl Çalışır? 🎓
        </h2>
        <p className="text-gray-500 text-sm">5 adımda takas yapmayı öğren</p>
      </div>

      {/* Slide İçeriği */}
      <div className="relative h-72 mb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${slide.color} flex items-center justify-center shadow-xl mb-4`}>
              <slide.icon className="w-12 h-12 text-white" />
            </div>
            <span className="text-4xl mb-3">{slide.emoji}</span>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{slide.title}</h3>
            <p className="text-gray-600 text-center max-w-xs">{slide.description}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide Göstergeleri */}
      <div className="flex justify-center gap-2 mb-6">
        {TUTORIAL_SLIDES.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              index === currentSlide
                ? 'bg-purple-500 w-8'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
          />
        ))}
      </div>

      {/* Navigasyon Butonları */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-30 hover:bg-gray-200 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>

        <button
          onClick={nextSlide}
          className="flex-1 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all"
        >
          {currentSlide === TUTORIAL_SLIDES.length - 1 ? 'Tamamla' : 'İleri'}
        </button>

        <button
          onClick={nextSlide}
          className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ChevronRight className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {/* Alt Butonlar */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
        >
          Geri
        </button>
        <button
          onClick={onSkip}
          className="flex-1 py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
        >
          Atla
        </button>
      </div>
    </motion.div>
  )
}
