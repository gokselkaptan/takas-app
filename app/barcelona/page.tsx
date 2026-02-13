'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Building2, Sparkles, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'

const architecturalLandmarks = [
  {
    id: 'sagrada-familia',
    image: '/images/barcelona/sagrada_familia.jpg',
    titleKey: 'sagradaFamilia',
    descKey: 'sagradaFamiliaDesc',
  },
  {
    id: 'park-guell',
    image: '/images/barcelona/park_guell.jpg',
    titleKey: 'parkGuell',
    descKey: 'parkGuellDesc',
  },
  {
    id: 'casa-batllo',
    image: '/images/barcelona/casa_batllo.jpg',
    titleKey: 'casaBatllo',
    descKey: 'casaBatlloDesc',
  },
  {
    id: 'la-pedrera',
    image: '/images/barcelona/la_pedrera.jpg',
    titleKey: 'laPedrera',
    descKey: 'laPedreraDesc',
  },
  {
    id: 'gothic-quarter',
    image: '/images/barcelona/gothic_quarter.jpg',
    titleKey: 'gothicQuarter',
    descKey: 'gothicQuarterDesc',
  },
  {
    id: 'panorama',
    image: '/images/barcelona/barcelona_panorama.jpg',
    titleKey: 'barcelonaPanorama',
    descKey: 'barcelonaPanoramaDesc',
  },
]

export default function BarcelonaPage() {
  const { t, language } = useLanguage()
  
  // Show Spanish/Catalan content when those languages are selected
  const isSpanishOrCatalan = language === 'es' || language === 'ca'

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-amber-50/30">
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-72 h-72 bg-amber-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-500 rounded-full blur-3xl" />
        </div>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            {/* Pilot Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-800 text-sm font-medium mb-6"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t('pilotRegion' as any)}</span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              <span className="text-gradient-frozen">TAKAS-A</span>
              <span className="text-gray-800"> Barcelona</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8">
              {t('barcelonaSubtitle' as any)}
            </p>

            <p className="text-gray-500 max-w-2xl mx-auto mb-10">
              {t('barcelonaDesc' as any)}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/kayit"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl gradient-frozen text-white font-semibold hover:opacity-90 transition-all shadow-lg"
              >
                {t('joinBarcelona' as any)}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/urunler"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white border-2 border-amber-200 text-amber-800 font-semibold hover:bg-amber-50 transition-all"
              >
                <MapPin className="w-5 h-5" />
                {t('products' as any)}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Architecture Gallery Section */}
      <section className="py-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-800 text-sm font-medium mb-4">
              <Building2 className="w-4 h-4" />
              <span>{t('barcelonaArchitecture' as any)}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4">
              {isSpanishOrCatalan ? (
                language === 'ca' ? 'L\'arquitectura única de Barcelona' : 'La arquitectura única de Barcelona'
              ) : (
                language === 'tr' ? 'Barcelona\'nın Eşsiz Mimarisi' : 'Barcelona\'s Unique Architecture'
              )}
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              {t('barcelonaArchitectureDesc' as any)}
            </p>
          </motion.div>

          {/* Image Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {architecturalLandmarks.map((landmark, index) => (
              <motion.div
                key={landmark.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative aspect-[4/3] rounded-2xl overflow-hidden shadow-lg"
              >
                <Image
                  src={landmark.image}
                  alt={t(landmark.titleKey as any)}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="text-xl font-bold text-white mb-1">
                    {t(landmark.titleKey as any)}
                  </h3>
                  <p className="text-white/80 text-sm">
                    {t(landmark.descKey as any)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Info Section for Spanish/Catalan */}
      {isSpanishOrCatalan && (
        <section className="py-16 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-3xl p-8 md:p-12 shadow-xl"
            >
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-4">
                    {language === 'ca' 
                      ? 'Benvingut a TAKAS-A Barcelona' 
                      : 'Bienvenido a TAKAS-A Barcelona'
                    }
                  </h2>
                  <p className="text-gray-600 mb-6">
                    {language === 'ca'
                      ? 'TAKAS-A és una plataforma innovadora d\'intercanvi sense diners. A Barcelona, estem provant el nostre sistema amb la comunitat local. Uneix-te a nosaltres i forma part de l\'economia col·laborativa del futur.'
                      : 'TAKAS-A es una plataforma innovadora de intercambio sin dinero. En Barcelona, estamos probando nuestro sistema con la comunidad local. Únete a nosotros y forma parte de la economía colaborativa del futuro.'
                    }
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-frozen-100 flex items-center justify-center">
                        <span className="text-lg">🔄</span>
                      </div>
                      <span className="text-gray-700">
                        {language === 'ca' ? 'Intercanvia sense diners' : 'Intercambia sin dinero'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-frozen-100 flex items-center justify-center">
                        <span className="text-lg">📍</span>
                      </div>
                      <span className="text-gray-700">
                        {language === 'ca' ? 'Punts de lliurament a tota la ciutat' : 'Puntos de entrega en toda la ciudad'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-frozen-100 flex items-center justify-center">
                        <span className="text-lg">🤖</span>
                      </div>
                      <span className="text-gray-700">
                        {language === 'ca' ? 'Valoració intel·ligent amb IA' : 'Valoración inteligente con IA'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="relative aspect-square rounded-2xl overflow-hidden">
                  <Image
                    src="/images/barcelona/barcelona_panorama.jpg"
                    alt="Barcelona"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl gradient-frozen p-8 md:p-12 text-center"
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {isSpanishOrCatalan
                  ? (language === 'ca' ? 'Uneix-te a la comunitat TAKAS-A' : 'Únete a la comunidad TAKAS-A')
                  : (language === 'tr' ? 'TAKAS-A Topluluğuna Katıl' : 'Join the TAKAS-A Community')
                }
              </h2>
              <p className="text-white/90 mb-8 max-w-xl mx-auto">
                {isSpanishOrCatalan
                  ? (language === 'ca' 
                      ? 'Comença a intercanviar avui mateix. Registra\'t gratuïtament i descobreix una nova manera de consumir.' 
                      : 'Comienza a intercambiar hoy mismo. Regístrate gratis y descubre una nueva forma de consumir.')
                  : (language === 'tr'
                      ? 'Bugün takas yapmaya başlayın. Ücretsiz kayıt olun ve tüketmenin yeni yolunu keşfedin.'
                      : 'Start swapping today. Register for free and discover a new way to consume.')
                }
              </p>
              <Link
                href="/kayit"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-frozen-600 font-bold hover:bg-gray-100 transition-all shadow-lg"
              >
                {t('register' as any)}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  )
}
