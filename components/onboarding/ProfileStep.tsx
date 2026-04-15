'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, User, Check, Loader2 } from 'lucide-react'

interface ProfileStepProps {
  onNext: (data: { nickname?: string; interests: string[]; image?: string }) => void
  onBack: () => void
  onSkip: () => void
}

const INTEREST_OPTIONS = [
  { id: 'electronics', label: 'Elektronik', emoji: '📱' },
  { id: 'clothing', label: 'Giyim', emoji: '👗' },
  { id: 'books', label: 'Kitaplar', emoji: '📚' },
  { id: 'home', label: 'Ev Eşyası', emoji: '🏠' },
  { id: 'sports', label: 'Spor', emoji: '⚽' },
  { id: 'kids', label: 'Bebek/Çocuk', emoji: '🧸' },
  { id: 'hobby', label: 'Hobi', emoji: '🎨' },
  { id: 'garden', label: 'Bahçe', emoji: '🌱' },
]

export function ProfileStep({ onNext, onBack, onSkip }: ProfileStepProps) {
  const [nickname, setNickname] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleInterest = (id: string) => {
    setInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview göster
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleContinue = () => {
    onNext({
      nickname: nickname.trim() || undefined,
      interests,
      image: imagePreview || undefined
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="px-4"
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
        Profilini Özelleştir ✨
      </h2>
      <p className="text-gray-600 mb-6 text-center text-sm">
        Diğer kullanıcılar seni daha iyi tanısın
      </p>

      {/* Profil Fotoğrafı */}
      <div className="flex justify-center mb-6">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="relative w-28 h-28 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 border-4 border-white shadow-lg cursor-pointer group"
        >
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Profil"
              className="rounded-full object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-12 h-12 text-gray-400" />
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Camera className="w-8 h-8 text-white" />
          </div>
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-white/80 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="hidden"
        />
      </div>

      {/* Takma Ad */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Takma Ad (opsiyonel)
        </label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Örn: TakasciAhmet"
          maxLength={20}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">Diğer kullanıcılar bu adı görecek</p>
      </div>

      {/* İlgi Alanları */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          İlgi Alanların (en az 1 seç)
        </label>
        <div className="grid grid-cols-2 gap-2">
          {INTEREST_OPTIONS.map((interest) => (
            <button
              key={interest.id}
              onClick={() => toggleInterest(interest.id)}
              className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-all ${
                interests.includes(interest.id)
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">{interest.emoji}</span>
              <span className="text-sm font-medium">{interest.label}</span>
              {interests.includes(interest.id) && (
                <Check className="w-4 h-4 ml-auto text-purple-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Butonlar */}
      <div className="space-y-3">
        <button
          onClick={handleContinue}
          disabled={interests.length === 0}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Devam Et
        </button>
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
      </div>
    </motion.div>
  )
}
