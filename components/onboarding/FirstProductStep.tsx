'use client'

import { motion } from 'framer-motion'
import { Package, Camera, Tag, MapPin, CheckCircle, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface FirstProductStepProps {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

const TIPS = [
  { icon: Camera, text: 'Net ve aydınlık fotoğraflar çek', color: 'bg-blue-100 text-blue-600' },
  { icon: Tag, text: 'Gerçekçi bir Valor değeri belirle', color: 'bg-purple-100 text-purple-600' },
  { icon: MapPin, text: 'Doğru konum bilgisi ekle', color: 'bg-green-100 text-green-600' },
  { icon: CheckCircle, text: 'Detaylı açıklama yaz', color: 'bg-orange-100 text-orange-600' },
]

export function FirstProductStep({ onNext, onBack, onSkip }: FirstProductStepProps) {
  const router = useRouter()

  const handleAddProduct = () => {
    // Onboarding'i tamamlandı olarak işaretle
    if (typeof window !== 'undefined') {
      localStorage.setItem('takas-a-onboarding-completed', 'true')
    }
    router.push('/urun-ekle')
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="px-4"
    >
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg"
        >
          <Package className="w-10 h-10 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          İlk Ürününü Ekle! 📦
        </h2>
        <p className="text-gray-600 text-sm">
          Takas yapmaya başlamak için en az 1 ürün eklemelisin
        </p>
      </div>

      {/* İpuçları */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span>💡</span> Başarılı İlan İpuçları
        </h3>
        <div className="space-y-3">
          {TIPS.map((tip, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-xl ${tip.color} flex items-center justify-center`}>
                <tip.icon className="w-5 h-5" />
              </div>
              <span className="text-sm text-gray-700">{tip.text}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bonus Bilgisi */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-4 mb-6 border border-amber-200"
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎁</span>
          <div>
            <p className="font-bold text-amber-800">İlk Ürün Bonusu!</p>
            <p className="text-sm text-amber-700">İlk ürününü ekleyince +50 Valor kazan</p>
          </div>
        </div>
      </motion.div>

      {/* Butonlar */}
      <div className="space-y-3">
        <button
          onClick={handleAddProduct}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
        >
          <Package className="w-5 h-5" />
          Ürün Ekle
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={onNext}
          className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
        >
          Şimdilik Atla, Önce Göz Atayım
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
            Daha Sonra
          </button>
        </div>
      </div>
    </motion.div>
  )
}
