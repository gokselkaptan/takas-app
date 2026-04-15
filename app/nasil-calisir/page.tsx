'use client'

import { motion } from 'framer-motion'
import { UserPlus, Tags, Search, Users, QrCode, CheckCircle2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { FeaturesSection } from '@/components/home/features-section'
import { useLanguage } from '@/lib/language-context'

export default function NasilCalisirPage() {
  const { t } = useLanguage()

  const steps = [
    {
      icon: UserPlus,
      number: '01',
      title: t('hwStep01Title'),
      description: t('hwStep01Desc'),
    },
    {
      icon: Tags,
      number: '02',
      title: t('hwStep02Title'),
      description: t('hwStep02Desc'),
    },
    {
      icon: Search,
      number: '03',
      title: t('hwStep03Title'),
      description: t('hwStep03Desc'),
    },
    {
      icon: Users,
      number: '04',
      title: t('hwStep04Title'),
      description: t('hwStep04Desc'),
    },
    {
      icon: QrCode,
      number: '05',
      title: t('hwStep05Title'),
      description: t('hwStep05Desc'),
    },
  ]

  const valorItems = [
    t('hwValorItem1'),
    t('hwValorItem2'),
    t('hwValorItem3'),
    t('hwValorItem4'),
  ]

  return (
    <main className="pt-20" role="main" aria-label={t('hwMainAriaLabel')}>
      {/* Hero */}
      <section className="py-20 gradient-frozen" aria-label={t('hwHeroAriaLabel')}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              {t('hwHeroTitle')}
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              {t('hwHeroSubtitle')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <FeaturesSection />

      {/* Steps */}
      <section className="py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="space-y-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`flex flex-col md:flex-row items-center gap-8 ${
                  index % 2 === 1 ? 'md:flex-row-reverse' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-xl gradient-frozen flex items-center justify-center">
                        <step.icon className="w-7 h-7 text-white" />
                      </div>
                      <span className="text-4xl font-bold text-frozen-400">
                        {step.number}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 text-lg">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block">
                    <ArrowRight className="w-8 h-8 text-frozen-300" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Multi-Swap Infographic */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              <span className="text-gradient-frozen">{t('hwMultiTitleHighlight')}</span> {t('hwMultiTitleSuffix')}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t('hwMultiSubtitle')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* Infographic Image */}
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-100">
              <img
                src="https://cdn.abacus.ai/images/fa1eff1f-13d5-4f0a-8275-3f4f75dedb17.png"
                alt={t('hwInfographicAlt')}
                className="w-full h-auto"
              />
            </div>

            {/* Explanation Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-xl p-4 shadow-md border border-purple-100"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                  <span className="text-blue-600 font-bold">1</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{t('hwPerson1Name')}</h4>
                <p className="text-sm text-gray-600">
                  {t('hwPerson1Desc')}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl p-4 shadow-md border border-purple-100"
              >
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                  <span className="text-purple-600 font-bold">2</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{t('hwPerson2Name')}</h4>
                <p className="text-sm text-gray-600">
                  {t('hwPerson2Desc')}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-xl p-4 shadow-md border border-orange-100"
              >
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mb-3">
                  <span className="text-orange-600 font-bold">3</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{t('hwPerson3Name')}</h4>
                <p className="text-sm text-gray-600">
                  {t('hwPerson3Desc')}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-xl p-4 shadow-md border border-blue-100"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                  <span className="text-blue-600 font-bold">4</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{t('hwPerson4Name')}</h4>
                <p className="text-sm text-gray-600">
                  {t('hwPerson4Desc')}
                </p>
              </motion.div>
            </div>

            {/* Valor Bonus Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="mt-8 bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6 border border-purple-100"
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full gradient-frozen flex items-center justify-center text-white font-bold text-lg">
                    +25
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{t('hwBonusTitle')}</h4>
                    <p className="text-sm text-gray-600">
                      {t('hwBonusDesc')}
                    </p>
                  </div>
                </div>
                <Link
                  href="/takas-firsatlari"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-frozen-500 text-white hover:bg-frozen-600 transition-all whitespace-nowrap"
                >
                  {t('hwBonusCta')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Valor System */}
      <section className="py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                <span className="text-gradient-frozen">{t('hwValorTitleHighlight')}</span> {t('hwValorTitleSuffix')}
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                {t('hwValorDesc')}
              </p>
              <ul className="space-y-4">
                {valorItems.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-frozen-500" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              {t('hwCtaTitle')}
            </h2>
            <Link
              href="/kayit"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold bg-frozen-500 text-white hover:bg-frozen-600 transition-all"
            >
              {t('hwCtaButton')}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  )
}
