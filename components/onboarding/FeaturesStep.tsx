'use client'

import { motion } from 'framer-motion'
import { Coins, Shield, Zap, Users, Globe, Gift, CheckCircle } from 'lucide-react'

interface FeaturesStepProps {
  onComplete: () => void
  onBack: () => void
}

const FEATURES = [
  {
    icon: Coins,
    title: 'Valor Sistemi',
    description: 'Para yerine Valor ile takas yap, denge sağla',
    color: 'from-amber-400 to-orange-500'
  },
  {
    icon: Shield,
    title: 'Teminat Koruması',
    description: 'Takas sırasında her iki taraf da güvende',
    color: 'from-green-400 to-emerald-500'
  },
  {
    icon: Zap,
    title: 'Çoklu Takas',
    description: 'A→B→C→A zincir takasları otomatik bulma',
    color: 'from-purple-400 to-pink-500'
  },
  {
    icon: Users,
    title: 'Topluluklar',
    description: 'İlgi alanlarına göre gruplara katıl',
    color: 'from-blue-400 to-cyan-500'
  },
  {
    icon: Globe,
    title: 'Global Erişim',
    description: 'Türkçe, İngilizce, İspanyolca, Katalanca',
    color: 'from-indigo-400 to-violet-500'
  },
  {
    icon: Gift,
    title: 'Ödüller',
    description: 'Aktif kullanıcılara bonus Valor ve rozetler',
    color: 'from-red-400 to-pink-500'
  },
]

export function FeaturesStep({ onComplete, onBack }: FeaturesStepProps) {
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
          className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg"
        >
          <Zap className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Platform Özellikleri 🚀
        </h2>
        <p className="text-gray-600 text-sm">
          TAKAS-A'yı özel yapan şeyler
        </p>
      </div>

      {/* Özellikler Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-2`}>
              <feature.icon className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm mb-1">{feature.title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </div>

      {/* Hazırsın! Mesajı */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 mb-6 border border-green-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-green-800">Hazırsın! 🎉</p>
            <p className="text-sm text-green-700">Artık takas yapmaya başlayabilirsin</p>
          </div>
        </div>
      </motion.div>

      {/* Butonlar */}
      <div className="space-y-3">
        <button
          onClick={onComplete}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
        >
          Keşfetmeye Başla! 🚀
        </button>
        <button
          onClick={onBack}
          className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
        >
          Geri
        </button>
      </div>
    </motion.div>
  )
}
