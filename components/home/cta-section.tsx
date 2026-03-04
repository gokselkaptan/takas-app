'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/language-context'

const ctaTexts = {
  tr: {
    title: 'Takas Yapmaya Hazır mısın?',
    subtitle: "Hemen üye ol, ürünlerini listele ve İzmir'in dört bir yanında takas yapmaya başla!",
    button: 'Ücretsiz Kayıt Ol'
  },
  en: {
    title: 'Ready to Start Swapping?',
    subtitle: 'Sign up now, list your items and start swapping all around Izmir!',
    button: 'Free Sign Up'
  },
  es: {
    title: '¿Listo para Intercambiar?',
    subtitle: '¡Regístrate ahora, lista tus artículos y comienza a intercambiar por todo Izmir!',
    button: 'Registro Gratuito'
  },
  ca: {
    title: 'Preparat per Intercanviar?',
    subtitle: "Registra't ara, llista els teus articles i comença a intercanviar per tot Izmir!",
    button: 'Registre Gratuït'
  }
}

export function CTASection() {
  const { language } = useLanguage()
  const texts = ctaTexts[language]
  
  return (
    <section className="py-20 bg-gradient-to-br from-frozen-600 via-frozen-500 to-frozen-400">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
            {texts.title}
          </h2>
          <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            {texts.subtitle}
          </p>
          <Link
            href="/kayit"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold bg-white text-frozen-600 hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl"
          >
            {texts.button}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
