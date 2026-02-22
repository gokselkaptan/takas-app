'use client'

import { Repeat, QrCode, Leaf } from 'lucide-react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'

const features = [
  {
    icon: Repeat,
    title: 'Çoklu Takas Sistemi',
    description:
      'A→B, B→C, C→A: Herkes istediğini alır! AI algoritması en uygun takas zincirini bulur. Direkt eşleşme yoksa bile çoklu döngü çözüm üretir.',
  },
  {
    icon: QrCode,
    title: 'QR + OTP Güvenli Teslimat',
    description:
      'QR kod tara, 6 haneli kod doğrula, fotoğraf çek. Valor teminatı kilitlenir — iki taraf da güvende. Anlaşmazlıkta otomatik arabuluculuk.',
  },
  {
    icon: Leaf,
    title: 'Sürdürülebilir Ekonomi',
    description:
      'Yeni ürün üretimi azalır, karbon salınımı düşer, ürünler çöpe gitmez. Geleceğe yatırım yap.',
  },
]

export function FeaturesSection() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })

  return (
    <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Neden <span className="text-gradient-frozen">TAKAS-A</span>?
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Modern takas platformumuzun sunduğu avantajları keşfet
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
            >
              <div className="w-14 h-14 rounded-xl gradient-frozen flex items-center justify-center mb-6">
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
