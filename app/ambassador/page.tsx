'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Award, Users, TrendingUp, Star, Globe, CheckCircle2, 
  Send, Sparkles, Building2, Heart, Zap, Shield
} from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { toast } from 'sonner'

const allCities = [
  // Türkiye
  { country: 'Türkiye', city: 'İstanbul' },
  { country: 'Türkiye', city: 'Ankara' },
  { country: 'Türkiye', city: 'Antalya' },
  { country: 'Türkiye', city: 'Bursa' },
  { country: 'Türkiye', city: 'Adana' },
  // Avrupa
  { country: 'İspanya', city: 'Madrid' },
  { country: 'İspanya', city: 'Valencia' },
  { country: 'İspanya', city: 'Sevilla' },
  { country: 'Portekiz', city: 'Lizbon' },
  { country: 'Portekiz', city: 'Porto' },
  { country: 'İtalya', city: 'Milano' },
  { country: 'İtalya', city: 'Roma' },
  { country: 'Yunanistan', city: 'Atina' },
  { country: 'Almanya', city: 'Berlin' },
  { country: 'Almanya', city: 'Münih' },
  { country: 'Almanya', city: 'Hamburg' },
  { country: 'Hollanda', city: 'Amsterdam' },
  { country: 'Fransa', city: 'Paris' },
  { country: 'Fransa', city: 'Lyon' },
  { country: 'İngiltere', city: 'Londra' },
  { country: 'İngiltere', city: 'Manchester' },
  { country: 'İsveç', city: 'Stockholm' },
  { country: 'Danimarka', city: 'Kopenhag' },
  // Dünya
  { country: 'ABD', city: 'New York' },
  { country: 'ABD', city: 'Los Angeles' },
  { country: 'ABD', city: 'San Francisco' },
  { country: 'Brezilya', city: 'São Paulo' },
  { country: 'Japonya', city: 'Tokyo' },
  { country: 'Avustralya', city: 'Sydney' },
  { country: 'Diğer', city: 'Diğer (Belirtin)' },
]

const translations = {
  tr: {
    title: 'Takas Elçisi Ol',
    subtitle: 'Şehrinde sürdürülebilir takas hareketini başlat',
    benefits: 'Elçi Avantajları',
    benefit1Title: 'İlk Ol',
    benefit1Desc: 'Şehrinde TAKAS-A\'yı başlatan ilk kişi ol',
    benefit2Title: 'Gelir Payı',
    benefit2Desc: 'Her takasta %5 komisyon kazan',
    benefit3Title: '+500 Valor',
    benefit3Desc: 'Anında 500 Valor bonus hesabına',
    benefit4Title: 'VIP Destek',
    benefit4Desc: 'Özel destek hattı ve öncelikli yanıt',
    requirements: 'Gereksinimler',
    req1: '18 yaş ve üzeri',
    req2: 'Şehirde aktif yaşıyor olmak',
    req3: 'Sosyal medya hesapları (opsiyonel)',
    req4: 'Topluluk oluşturma motivasyonu',
    formTitle: 'Başvuru Formu',
    fullName: 'Ad Soyad',
    email: 'E-posta',
    phone: 'Telefon',
    city: 'Şehir',
    selectCity: 'Şehir seçin',
    otherCity: 'Diğer şehir (belirtin)',
    socialMedia: 'Sosyal Medya (Instagram, Twitter vb.)',
    motivation: 'Neden Takas Elçisi olmak istiyorsunuz?',
    motivationPlaceholder: 'Şehrinizde nasıl bir topluluk oluşturmak istediğinizi anlatın...',
    submit: 'Başvuruyu Gönder',
    submitting: 'Gönderiliyor...',
    success: 'Başvurunuz alındı! En kısa sürede size dönüş yapacağız.',
    required: 'Bu alan zorunludur',
  },
  en: {
    title: 'Become an Ambassador',
    subtitle: 'Start the sustainable swap movement in your city',
    benefits: 'Ambassador Benefits',
    benefit1Title: 'Be First',
    benefit1Desc: 'Be the first to launch TAKAS-A in your city',
    benefit2Title: 'Revenue Share',
    benefit2Desc: 'Earn 5% commission on every swap',
    benefit3Title: '+500 Valor',
    benefit3Desc: 'Instant 500 Valor bonus to your account',
    benefit4Title: 'VIP Support',
    benefit4Desc: 'Dedicated support line and priority response',
    requirements: 'Requirements',
    req1: '18 years or older',
    req2: 'Actively living in the city',
    req3: 'Social media accounts (optional)',
    req4: 'Motivation to build community',
    formTitle: 'Application Form',
    fullName: 'Full Name',
    email: 'Email',
    phone: 'Phone',
    city: 'City',
    selectCity: 'Select city',
    otherCity: 'Other city (specify)',
    socialMedia: 'Social Media (Instagram, Twitter etc.)',
    motivation: 'Why do you want to be an Ambassador?',
    motivationPlaceholder: 'Tell us about the community you want to build in your city...',
    submit: 'Submit Application',
    submitting: 'Submitting...',
    success: 'Application received! We will get back to you soon.',
    required: 'This field is required',
  },
  es: {
    title: 'Sé Embajador',
    subtitle: 'Inicia el movimiento de intercambio sostenible en tu ciudad',
    benefits: 'Beneficios del Embajador',
    benefit1Title: 'Sé el Primero',
    benefit1Desc: 'Sé el primero en lanzar TAKAS-A en tu ciudad',
    benefit2Title: 'Participación',
    benefit2Desc: 'Gana 5% de comisión en cada intercambio',
    benefit3Title: '+500 Valor',
    benefit3Desc: '500 Valor bonus instantáneo en tu cuenta',
    benefit4Title: 'Soporte VIP',
    benefit4Desc: 'Línea de soporte dedicada y respuesta prioritaria',
    requirements: 'Requisitos',
    req1: '18 años o más',
    req2: 'Vivir activamente en la ciudad',
    req3: 'Cuentas de redes sociales (opcional)',
    req4: 'Motivación para construir comunidad',
    formTitle: 'Formulario de Solicitud',
    fullName: 'Nombre Completo',
    email: 'Correo',
    phone: 'Teléfono',
    city: 'Ciudad',
    selectCity: 'Seleccionar ciudad',
    otherCity: 'Otra ciudad (especificar)',
    socialMedia: 'Redes Sociales (Instagram, Twitter etc.)',
    motivation: '¿Por qué quieres ser Embajador?',
    motivationPlaceholder: 'Cuéntanos sobre la comunidad que quieres construir en tu ciudad...',
    submit: 'Enviar Solicitud',
    submitting: 'Enviando...',
    success: '¡Solicitud recibida! Nos pondremos en contacto pronto.',
    required: 'Este campo es obligatorio',
  },
  ca: {
    title: 'Sigues Ambaixador',
    subtitle: 'Inicia el moviment d\'intercanvi sostenible a la teva ciutat',
    benefits: 'Beneficis de l\'Ambaixador',
    benefit1Title: 'Sigues el Primer',
    benefit1Desc: 'Sigues el primer en llançar TAKAS-A a la teva ciutat',
    benefit2Title: 'Participació',
    benefit2Desc: 'Guanya 5% de comissió en cada intercanvi',
    benefit3Title: '+500 Valor',
    benefit3Desc: '500 Valor bonus instantani al teu compte',
    benefit4Title: 'Suport VIP',
    benefit4Desc: 'Línia de suport dedicada i resposta prioritària',
    requirements: 'Requisits',
    req1: '18 anys o més',
    req2: 'Viure activament a la ciutat',
    req3: 'Comptes de xarxes socials (opcional)',
    req4: 'Motivació per construir comunitat',
    formTitle: 'Formulari de Sol·licitud',
    fullName: 'Nom Complet',
    email: 'Correu',
    phone: 'Telèfon',
    city: 'Ciutat',
    selectCity: 'Seleccionar ciutat',
    otherCity: 'Altra ciutat (especificar)',
    socialMedia: 'Xarxes Socials (Instagram, Twitter etc.)',
    motivation: 'Per què vols ser Ambaixador?',
    motivationPlaceholder: 'Explica\'ns sobre la comunitat que vols construir a la teva ciutat...',
    submit: 'Enviar Sol·licitud',
    submitting: 'Enviant...',
    success: 'Sol·licitud rebuda! Ens posarem en contacte aviat.',
    required: 'Aquest camp és obligatori',
  }
}

export default function AmbassadorPage() {
  const { language } = useLanguage()
  const t = translations[language] || translations.tr
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    otherCity: '',
    socialMedia: '',
    motivation: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    const newErrors: Record<string, boolean> = {}
    if (!formData.fullName) newErrors.fullName = true
    if (!formData.email) newErrors.email = true
    if (!formData.city) newErrors.city = true
    if (!formData.motivation) newErrors.motivation = true
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error(t.required)
      return
    }

    setSubmitting(true)
    
    try {
      // API'ye gönder (şimdilik simüle)
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setSubmitted(true)
      toast.success(t.success)
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-orange-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-3xl p-8 md:p-12 shadow-xl text-center max-w-lg"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </motion.div>
          <h2 className="text-2xl font-bold mb-4">🎉 {t.success}</h2>
          <p className="text-gray-600 mb-6">
            {language === 'tr' 
              ? 'Başvurunuz incelemeye alındı. 48 saat içinde e-posta ile dönüş yapacağız.'
              : 'Your application is under review. We will respond via email within 48 hours.'}
          </p>
          <a
            href="/global"
            className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-xl hover:bg-purple-700 transition-colors"
          >
            <Globe className="w-5 h-5" />
            {language === 'tr' ? 'Global Haritaya Dön' : 'Back to Global Map'}
          </a>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-orange-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Award className="w-4 h-4" />
            Ambassador Program
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-purple-600 to-orange-500 bg-clip-text text-transparent">
              {t.title}
            </span>
          </h1>
          <p className="text-xl text-gray-600">{t.subtitle}</p>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12"
        >
          {[
            { icon: Building2, title: t.benefit1Title, desc: t.benefit1Desc, color: 'purple' },
            { icon: TrendingUp, title: t.benefit2Title, desc: t.benefit2Desc, color: 'green' },
            { icon: Sparkles, title: t.benefit3Title, desc: t.benefit3Desc, color: 'orange' },
            { icon: Shield, title: t.benefit4Title, desc: t.benefit4Desc, color: 'blue' },
          ].map((benefit, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className={`w-12 h-12 rounded-xl bg-${benefit.color}-100 flex items-center justify-center mb-4`}>
                <benefit.icon className={`w-6 h-6 text-${benefit.color}-600`} />
              </div>
              <h3 className="font-bold text-lg mb-2">{benefit.title}</h3>
              <p className="text-gray-600 text-sm">{benefit.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Requirements & Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Requirements */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="bg-white rounded-2xl p-6 shadow-lg sticky top-24">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                {t.requirements}
              </h3>
              <ul className="space-y-3">
                {[t.req1, t.req2, t.req3, t.req4].map((req, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-purple-600 text-sm font-bold">{i + 1}</span>
                    </div>
                    <span className="text-gray-700">{req}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-orange-50 rounded-xl">
                <p className="text-sm text-gray-600">
                  <Heart className="w-4 h-4 inline text-red-500 mr-1" />
                  {language === 'tr' 
                    ? '45+ şehirde elçi arıyoruz!'
                    : 'Looking for ambassadors in 45+ cities!'}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-lg">
              <h3 className="font-bold text-xl mb-6 flex items-center gap-2">
                <Send className="w-5 h-5 text-purple-600" />
                {t.formTitle}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t.fullName} *
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => {
                        setFormData({ ...formData, fullName: e.target.value })
                        setErrors({ ...errors, fullName: false })
                      }}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        errors.fullName ? 'border-red-500' : 'border-gray-200'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t.email} *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value })
                        setErrors({ ...errors, email: false })
                      }}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        errors.email ? 'border-red-500' : 'border-gray-200'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t.phone}
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t.city} *
                    </label>
                    <select
                      value={formData.city}
                      onChange={(e) => {
                        setFormData({ ...formData, city: e.target.value })
                        setErrors({ ...errors, city: false })
                      }}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        errors.city ? 'border-red-500' : 'border-gray-200'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                    >
                      <option value="">{t.selectCity}</option>
                      {allCities.map((item, i) => (
                        <option key={i} value={`${item.city}, ${item.country}`}>
                          {item.city} - {item.country}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Other City */}
                {formData.city.includes('Diğer') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t.otherCity}
                    </label>
                    <input
                      type="text"
                      value={formData.otherCity}
                      onChange={(e) => setFormData({ ...formData, otherCity: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Social Media */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.socialMedia}
                  </label>
                  <input
                    type="text"
                    value={formData.socialMedia}
                    onChange={(e) => setFormData({ ...formData, socialMedia: e.target.value })}
                    placeholder="@username"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Motivation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.motivation} *
                  </label>
                  <textarea
                    value={formData.motivation}
                    onChange={(e) => {
                      setFormData({ ...formData, motivation: e.target.value })
                      setErrors({ ...errors, motivation: false })
                    }}
                    rows={4}
                    placeholder={t.motivationPlaceholder}
                    className={`w-full px-4 py-3 rounded-xl border ${
                      errors.motivation ? 'border-red-500' : 'border-gray-200'
                    } focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none`}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-orange-500 text-white py-4 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Zap className="w-5 h-5 animate-pulse" />
                      {t.submitting}
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      {t.submit}
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
