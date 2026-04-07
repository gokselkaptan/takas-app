'use client'

import { Repeat, QrCode, Leaf } from 'lucide-react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { useLanguage } from '@/lib/language-context'

const features = [
  {
    icon: Repeat,
    titleKey: 'fsMultiSwapTitle',
    descKey: 'fsMultiSwapDesc',
  },
  {
    icon: QrCode,
    titleKey: 'fsQrTitle',
    descKey: 'fsQrDesc',
  },
  {
    icon: Leaf,
    titleKey: 'fsSustainTitle',
    descKey: 'fsSustainDesc',
  },
]

export function FeaturesSection() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })
  const { t } = useLanguage()

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
            {t('featuresTitle').replace('TAKAS-A', '<span class="text-gradient-frozen">TAKAS-A</span>').includes('<span') ? (
              <span dangerouslySetInnerHTML={{ __html: t('featuresTitle').replace('TAKAS-A', '<span class="text-gradient-frozen">TAKAS-A</span>') }} />
            ) : (
              <>{t('featuresTitle')}</>
            )}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('fsSubtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.titleKey}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
            >
              <div className="w-14 h-14 rounded-xl gradient-frozen flex items-center justify-center mb-6">
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                {t(feature.titleKey as any)}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">{t(feature.descKey as any)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
