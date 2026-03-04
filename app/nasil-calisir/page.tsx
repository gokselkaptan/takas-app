'use client'

import { motion } from 'framer-motion'
import { UserPlus, Tags, Search, Users, QrCode, CheckCircle2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { FeaturesSection } from '@/components/home/features-section'
import { VideoGallery } from '@/components/home/video-gallery'

const steps = [
  {
    icon: UserPlus,
    number: '01',
    title: 'Kayıt Ol ve Ürünlerini Listele',
    description: 'Hesabını oluştur, takas etmek istediğin ürünleri fotoğrafla ve ekle.',
  },
  {
    icon: Tags,
    number: '02',
    title: 'Valor Değeri Belirlenir',
    description: 'Her ürüne adil bir Valor değeri atanır. Bu değer takaslarda denge sağlar.',
  },
  {
    icon: Search,
    number: '03',
    title: 'İstediğin Ürünü Bul',
    description: 'Binlerce ürün arasından istediğini bul ve takas teklifi gönder.',
  },
  {
    icon: Users,
    number: '04',
    title: 'Çoklu Takas Eşleşmesi',
    description: 'Akıllı sistem 3, 4, 5 kişilik takas zincirleri oluşturarak en uygun eşleşmeyi bulur.',
  },
  {
    icon: QrCode,
    number: '05',
    title: 'QR Kod ile Teslim Al',
    description: 'Teslim noktasına git, QR kodunu okut ve ürününü al!',
  },
]

export default function NasilCalisirPage() {
  return (
    <div className="pt-20">
      {/* Hero */}
      <section className="py-20 gradient-frozen">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Nasıl Çalışır?
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              TAKAS-A ile para ödemeden takas yapmanın adımlarını keşfet
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features Section - Neden TAKAS-A */}
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

      {/* Video Gallery */}
      <VideoGallery />

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
              <span className="text-gradient-frozen">Çoklu Takas</span> Nasıl Çalışır?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              3, 4 veya 5 kişilik takas zincirleri ile herkes istediği ürünü alır, 
              kimse para ödemez!
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
                alt="Çoklu Takas - 4 kişilik takas döngüsü örneği"
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
                <h4 className="font-semibold text-gray-900 mb-1">Ahmet</h4>
                <p className="text-sm text-gray-600">
                  Spor ayakkabısını veriyor → Merve'nin bilgisayar çantasını alıyor
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
                <h4 className="font-semibold text-gray-900 mb-1">Merve</h4>
                <p className="text-sm text-gray-600">
                  Bilgisayar çantasını veriyor → Selin'in dantelli masa örtüsünü alıyor
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
                <h4 className="font-semibold text-gray-900 mb-1">Selin</h4>
                <p className="text-sm text-gray-600">
                  Dantelli masa örtüsünü veriyor → Hamit'in vintage saatini alıyor
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
                <h4 className="font-semibold text-gray-900 mb-1">Hamit</h4>
                <p className="text-sm text-gray-600">
                  Vintage saatini veriyor → Ahmet'in spor ayakkabısını alıyor
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
                    <h4 className="font-semibold text-gray-900">Çoklu Takas Bonusu</h4>
                    <p className="text-sm text-gray-600">
                      Her başarılı çoklu takasta tüm katılımcılar 25 Valor bonus kazanır!
                    </p>
                  </div>
                </div>
                <Link
                  href="/takas-firsatlari"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-frozen-500 text-white hover:bg-frozen-600 transition-all whitespace-nowrap"
                >
                  Takas Fırsatlarını Gör
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
                <span className="text-gradient-frozen">Valor</span> Sistemi Nedir?
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Valor, TAKAS-A'ın adil takas sisteminin temelidir. Her ürüne, durumuna ve piyasa değerine göre bir Valor puanı atanır.
              </p>
              <ul className="space-y-4">
                {[
                  'Adil ve şeffaf değerleme',
                  'Eşit değerde takas garantisi',
                  'Çoklu takaslarda denge sağlar',
                  'Para kullanımına gerek yok',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-frozen-500" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-video rounded-2xl overflow-hidden shadow-xl">
                <video
                  src="/videos/41cb31cc-f373-4358-86bc-b479c47a24ec.mp4"
                  controls
                  className="w-full h-full object-cover"
                />
              </div>
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
              Hazır mısın?
            </h2>
            <Link
              href="/kayit"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold bg-frozen-500 text-white hover:bg-frozen-600 transition-all"
            >
              Hemen Başla
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
