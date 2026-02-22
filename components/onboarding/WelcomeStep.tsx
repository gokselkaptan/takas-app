'use client'

import { motion } from 'framer-motion'
import { Sparkles, ArrowLeftRight, Shield, Users, Gift } from 'lucide-react'

interface WelcomeStepProps {
  userName?: string
  onNext: () => void
  onSkip: () => void
}

export function WelcomeStep({ userName, onNext, onSkip }: WelcomeStepProps) {
  const benefits = [
    { icon: ArrowLeftRight, text: 'Para ödemeden takas yap', color: 'text-purple-500' },
    { icon: Shield, text: 'Güvenli işlem garantisi', color: 'text-green-500' },
    { icon: Users, text: 'Binlerce aktif kullanıcı', color: 'text-blue-500' },
    { icon: Gift, text: 'Hoş geldin bonusu kazan', color: 'text-orange-500' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center px-4"
    >
      {/* Logo ve Başlık */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center shadow-xl"
      >
        <Sparkles className="w-12 h-12 text-white" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-3xl font-bold text-gray-900 mb-2"
      >
        Hoş Geldin{userName ? `, ${userName}` : ''}! 👋
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-gray-600 mb-8 text-lg"
      >
        TAKAS-A ile eşyalarını değerlendir,\nyenilerine kavuş!
      </motion.p>

      {/* Avantajlar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 gap-3 mb-8"
      >
        {benefits.map((benefit, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + index * 0.1 }}
            className="bg-gray-50 rounded-xl p-4 flex flex-col items-center gap-2"
          >
            <benefit.icon className={`w-8 h-8 ${benefit.color}`} />
            <span className="text-sm font-medium text-gray-700 text-center">{benefit.text}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Butonlar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="space-y-3"
      >
        <button
          onClick={onNext}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
        >
          Başlayalım! 🚀
        </button>
        <button
          onClick={onSkip}
          className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
        >
          Daha sonra tamamla
        </button>
      </motion.div>
    </motion.div>
  )
}
