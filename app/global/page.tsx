'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Globe, MapPin, Users, Clock, Sparkles, Mail, CheckCircle2, 
  ChevronDown, Search, Star, Rocket, Heart, ArrowRight,
  Building2, TrendingUp, Award
} from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import Link from 'next/link'
import { toast } from 'sonner'

// Şehir tipi
interface City {
  name: string
  status: 'active' | 'pilot' | 'coming_soon' | 'planned'
  users: number
  slug: string
  waitlist?: number
}

interface Country {
  name: { tr: string; en: string; es: string; ca: string }
  flag: string
  cities: City[]
}

// Şehir verileri
const cities: Record<string, Country> = {
  // Türkiye - Aktif
  turkey: {
    name: { tr: 'Türkiye', en: 'Turkey', es: 'Turquía', ca: 'Turquia' },
    flag: '🇹🇷',
    cities: [
      { name: 'İzmir', status: 'active', users: 127, slug: 'izmir' },
      { name: 'İstanbul', status: 'coming_soon', users: 0, slug: 'istanbul', waitlist: 234 },
      { name: 'Ankara', status: 'coming_soon', users: 0, slug: 'ankara', waitlist: 156 },
      { name: 'Antalya', status: 'coming_soon', users: 0, slug: 'antalya', waitlist: 89 },
      { name: 'Bursa', status: 'planned', users: 0, slug: 'bursa' },
      { name: 'Adana', status: 'planned', users: 0, slug: 'adana' },
    ]
  },
  // İspanya
  spain: {
    name: { tr: 'İspanya', en: 'Spain', es: 'España', ca: 'Espanya' },
    flag: '🇪🇸',
    cities: [
      { name: 'Barcelona', status: 'pilot', users: 23, slug: 'barcelona' },
      { name: 'Madrid', status: 'planned', users: 0, slug: 'madrid' },
      { name: 'Valencia', status: 'planned', users: 0, slug: 'valencia' },
      { name: 'Sevilla', status: 'planned', users: 0, slug: 'sevilla' },
    ]
  },
  // Portekiz
  portugal: {
    name: { tr: 'Portekiz', en: 'Portugal', es: 'Portugal', ca: 'Portugal' },
    flag: '🇵🇹',
    cities: [
      { name: 'Lizbon', status: 'planned', users: 0, slug: 'lisbon' },
      { name: 'Porto', status: 'planned', users: 0, slug: 'porto' },
    ]
  },
  // İtalya
  italy: {
    name: { tr: 'İtalya', en: 'Italy', es: 'Italia', ca: 'Itàlia' },
    flag: '🇮🇹',
    cities: [
      { name: 'Milano', status: 'planned', users: 0, slug: 'milan' },
      { name: 'Roma', status: 'planned', users: 0, slug: 'rome' },
      { name: 'Napoli', status: 'planned', users: 0, slug: 'naples' },
    ]
  },
  // Yunanistan
  greece: {
    name: { tr: 'Yunanistan', en: 'Greece', es: 'Grecia', ca: 'Grècia' },
    flag: '🇬🇷',
    cities: [
      { name: 'Atina', status: 'planned', users: 0, slug: 'athens' },
      { name: 'Selanik', status: 'planned', users: 0, slug: 'thessaloniki' },
    ]
  },
  // Almanya
  germany: {
    name: { tr: 'Almanya', en: 'Germany', es: 'Alemania', ca: 'Alemanya' },
    flag: '🇩🇪',
    cities: [
      { name: 'Berlin', status: 'planned', users: 0, slug: 'berlin' },
      { name: 'Münih', status: 'planned', users: 0, slug: 'munich' },
      { name: 'Hamburg', status: 'planned', users: 0, slug: 'hamburg' },
      { name: 'Frankfurt', status: 'planned', users: 0, slug: 'frankfurt' },
    ]
  },
  // Hollanda
  netherlands: {
    name: { tr: 'Hollanda', en: 'Netherlands', es: 'Países Bajos', ca: 'Països Baixos' },
    flag: '🇳🇱',
    cities: [
      { name: 'Amsterdam', status: 'planned', users: 0, slug: 'amsterdam' },
      { name: 'Rotterdam', status: 'planned', users: 0, slug: 'rotterdam' },
    ]
  },
  // Fransa
  france: {
    name: { tr: 'Fransa', en: 'France', es: 'Francia', ca: 'França' },
    flag: '🇫🇷',
    cities: [
      { name: 'Paris', status: 'planned', users: 0, slug: 'paris' },
      { name: 'Lyon', status: 'planned', users: 0, slug: 'lyon' },
      { name: 'Marsilya', status: 'planned', users: 0, slug: 'marseille' },
    ]
  },
  // İngiltere
  uk: {
    name: { tr: 'İngiltere', en: 'United Kingdom', es: 'Reino Unido', ca: 'Regne Unit' },
    flag: '🇬🇧',
    cities: [
      { name: 'Londra', status: 'planned', users: 0, slug: 'london' },
      { name: 'Manchester', status: 'planned', users: 0, slug: 'manchester' },
      { name: 'Birmingham', status: 'planned', users: 0, slug: 'birmingham' },
    ]
  },
  // İskandinav
  sweden: {
    name: { tr: 'İsveç', en: 'Sweden', es: 'Suecia', ca: 'Suècia' },
    flag: '🇸🇪',
    cities: [
      { name: 'Stockholm', status: 'planned', users: 0, slug: 'stockholm' },
    ]
  },
  denmark: {
    name: { tr: 'Danimarka', en: 'Denmark', es: 'Dinamarca', ca: 'Dinamarca' },
    flag: '🇩🇰',
    cities: [
      { name: 'Kopenhag', status: 'planned', users: 0, slug: 'copenhagen' },
    ]
  },
  // Amerika
  usa: {
    name: { tr: 'ABD', en: 'United States', es: 'Estados Unidos', ca: 'Estats Units' },
    flag: '🇺🇸',
    cities: [
      { name: 'New York', status: 'planned', users: 0, slug: 'new-york' },
      { name: 'Los Angeles', status: 'planned', users: 0, slug: 'los-angeles' },
      { name: 'San Francisco', status: 'planned', users: 0, slug: 'san-francisco' },
      { name: 'Chicago', status: 'planned', users: 0, slug: 'chicago' },
    ]
  },
  // Brezilya
  brazil: {
    name: { tr: 'Brezilya', en: 'Brazil', es: 'Brasil', ca: 'Brasil' },
    flag: '🇧🇷',
    cities: [
      { name: 'São Paulo', status: 'planned', users: 0, slug: 'sao-paulo' },
      { name: 'Rio de Janeiro', status: 'planned', users: 0, slug: 'rio' },
    ]
  },
  // Japonya
  japan: {
    name: { tr: 'Japonya', en: 'Japan', es: 'Japón', ca: 'Japó' },
    flag: '🇯🇵',
    cities: [
      { name: 'Tokyo', status: 'planned', users: 0, slug: 'tokyo' },
      { name: 'Osaka', status: 'planned', users: 0, slug: 'osaka' },
    ]
  },
  // Avustralya
  australia: {
    name: { tr: 'Avustralya', en: 'Australia', es: 'Australia', ca: 'Austràlia' },
    flag: '🇦🇺',
    cities: [
      { name: 'Sydney', status: 'planned', users: 0, slug: 'sydney' },
      { name: 'Melbourne', status: 'planned', users: 0, slug: 'melbourne' },
    ]
  },
}

const statusConfig = {
  active: {
    label: { tr: 'Aktif', en: 'Active', es: 'Activo', ca: 'Actiu' },
    color: 'bg-green-500',
    textColor: 'text-green-800',
    bgColor: 'bg-green-100',
    icon: CheckCircle2
  },
  pilot: {
    label: { tr: 'Pilot', en: 'Pilot', es: 'Piloto', ca: 'Pilot' },
    color: 'bg-blue-500',
    textColor: 'text-blue-800',
    bgColor: 'bg-blue-100',
    icon: Rocket
  },
  coming_soon: {
    label: { tr: 'Yakında', en: 'Coming Soon', es: 'Próximamente', ca: 'Properament' },
    color: 'bg-orange-500',
    textColor: 'text-orange-800',
    bgColor: 'bg-orange-100',
    icon: Clock
  },
  planned: {
    label: { tr: 'Planlandı', en: 'Planned', es: 'Planificado', ca: 'Planificat' },
    color: 'bg-gray-400',
    textColor: 'text-gray-800',
    bgColor: 'bg-gray-200',
    icon: MapPin
  }
}

const translations = {
  tr: {
    title: 'TAKAS-A Global',
    subtitle: 'Dünya genelinde sürdürülebilir takas hareketi',
    searchPlaceholder: 'Şehir ara...',
    totalCities: 'Toplam Şehir',
    totalCountries: 'Ülke',
    activeUsers: 'Aktif Kullanıcı',
    waitlistUsers: 'Bekleyenler',
    showInterest: 'İlgi Göster',
    interested: 'İlgi Gösterildi!',
    emailPlaceholder: 'E-posta adresiniz',
    notifyMe: 'Beni Bilgilendir',
    subscribed: 'Kaydınız alındı!',
    ambassadorTitle: 'Takas Elçisi Ol',
    ambassadorDesc: 'Şehrinde TAKAS-A\'yı başlat, topluluk oluştur',
    applyNow: 'Hemen Başvur',
    users: 'kullanıcı',
    waiting: 'bekliyor',
    explore: 'Keşfet',
    launchCity: 'Bu şehirde başlat',
    filterAll: 'Tümü',
    filterActive: 'Aktif',
    filterComingSoon: 'Yakında',
    filterPlanned: 'Planlandı',
  },
  en: {
    title: 'TAKAS-A Global',
    subtitle: 'Sustainable swap movement worldwide',
    searchPlaceholder: 'Search city...',
    totalCities: 'Total Cities',
    totalCountries: 'Countries',
    activeUsers: 'Active Users',
    waitlistUsers: 'On Waitlist',
    showInterest: 'Show Interest',
    interested: 'Interest Shown!',
    emailPlaceholder: 'Your email address',
    notifyMe: 'Notify Me',
    subscribed: 'You\'re subscribed!',
    ambassadorTitle: 'Become an Ambassador',
    ambassadorDesc: 'Launch TAKAS-A in your city, build community',
    applyNow: 'Apply Now',
    users: 'users',
    waiting: 'waiting',
    explore: 'Explore',
    launchCity: 'Launch in this city',
    filterAll: 'All',
    filterActive: 'Active',
    filterComingSoon: 'Coming Soon',
    filterPlanned: 'Planned',
  },
  es: {
    title: 'TAKAS-A Global',
    subtitle: 'Movimiento de intercambio sostenible mundial',
    searchPlaceholder: 'Buscar ciudad...',
    totalCities: 'Ciudades Totales',
    totalCountries: 'Países',
    activeUsers: 'Usuarios Activos',
    waitlistUsers: 'En Espera',
    showInterest: 'Mostrar Interés',
    interested: '¡Interés Mostrado!',
    emailPlaceholder: 'Tu correo electrónico',
    notifyMe: 'Notificarme',
    subscribed: '¡Suscrito!',
    ambassadorTitle: 'Sé Embajador',
    ambassadorDesc: 'Lanza TAKAS-A en tu ciudad, crea comunidad',
    applyNow: 'Aplicar Ahora',
    users: 'usuarios',
    waiting: 'esperando',
    explore: 'Explorar',
    launchCity: 'Lanzar en esta ciudad',
    filterAll: 'Todos',
    filterActive: 'Activo',
    filterComingSoon: 'Próximamente',
    filterPlanned: 'Planificado',
  },
  ca: {
    title: 'TAKAS-A Global',
    subtitle: 'Moviment d\'intercanvi sostenible mundial',
    searchPlaceholder: 'Cercar ciutat...',
    totalCities: 'Ciutats Totals',
    totalCountries: 'Països',
    activeUsers: 'Usuaris Actius',
    waitlistUsers: 'En Espera',
    showInterest: 'Mostrar Interès',
    interested: 'Interès Mostrat!',
    emailPlaceholder: 'El teu correu electrònic',
    notifyMe: 'Notifica\'m',
    subscribed: 'Subscrit!',
    ambassadorTitle: 'Sigues Ambaixador',
    ambassadorDesc: 'Llança TAKAS-A a la teva ciutat, crea comunitat',
    applyNow: 'Aplica Ara',
    users: 'usuaris',
    waiting: 'esperant',
    explore: 'Explorar',
    launchCity: 'Llançar en aquesta ciutat',
    filterAll: 'Tots',
    filterActive: 'Actiu',
    filterComingSoon: 'Properament',
    filterPlanned: 'Planificat',
  }
}

export default function GlobalPage() {
  const { language } = useLanguage()
  const t = translations[language] || translations.tr
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [expandedCountry, setExpandedCountry] = useState<string | null>('turkey')
  const [interestedCities, setInterestedCities] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [selectedCityForEmail, setSelectedCityForEmail] = useState<string | null>(null)
  const [submittingEmail, setSubmittingEmail] = useState(false)

  // LocalStorage'dan ilgi gösterilen şehirleri yükle
  useEffect(() => {
    const saved = localStorage.getItem('takas-interested-cities')
    if (saved) {
      setInterestedCities(JSON.parse(saved))
    }
  }, [])

  // İstatistikler
  const stats = {
    totalCities: Object.values(cities).reduce((acc, country) => acc + country.cities.length, 0),
    totalCountries: Object.keys(cities).length,
    activeUsers: Object.values(cities).reduce((acc, country) => 
      acc + country.cities.reduce((cityAcc, city) => cityAcc + city.users, 0), 0),
    waitlistUsers: Object.values(cities).reduce((acc, country) => 
      acc + country.cities.reduce((cityAcc, city) => cityAcc + (city.waitlist || 0), 0), 0),
  }

  // Filtreleme
  const filteredCities = Object.entries(cities).map(([key, country]) => ({
    key,
    ...country,
    cities: country.cities.filter(city => {
      const matchesSearch = city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        country.name[language]?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = selectedFilter === 'all' || city.status === selectedFilter
      return matchesSearch && matchesFilter
    })
  })).filter(country => country.cities.length > 0)

  const handleShowInterest = (citySlug: string) => {
    if (interestedCities.includes(citySlug)) return
    
    const newInterested = [...interestedCities, citySlug]
    setInterestedCities(newInterested)
    localStorage.setItem('takas-interested-cities', JSON.stringify(newInterested))
    toast.success(t.interested)
  }

  const handleEmailSubmit = async (citySlug: string) => {
    if (!email || !email.includes('@')) {
      toast.error('Geçerli bir e-posta adresi girin')
      return
    }
    
    setSubmittingEmail(true)
    
    // Simüle et (gerçek API'ye bağlanabilir)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    handleShowInterest(citySlug)
    setEmail('')
    setSelectedCityForEmail(null)
    setSubmittingEmail(false)
    toast.success(t.subscribed)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-orange-50">
      {/* Hero Section */}
      <section className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-orange-500/10" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto text-center relative z-10"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="inline-block mb-6"
          >
            <Globe className="w-16 h-16 text-purple-600" />
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-purple-600 to-orange-500 bg-clip-text text-transparent">
              {t.title}
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">{t.subtitle}</p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { icon: MapPin, value: stats.totalCities, label: t.totalCities },
              { icon: Globe, value: stats.totalCountries, label: t.totalCountries },
              { icon: Users, value: stats.activeUsers, label: t.activeUsers },
              { icon: Heart, value: stats.waitlistUsers, label: t.waitlistUsers },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg"
              >
                <stat.icon className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-800">{stat.value}+</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Search & Filter */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap justify-center">
              {[
                { key: 'all', label: t.filterAll },
                { key: 'active', label: t.filterActive },
                { key: 'coming_soon', label: t.filterComingSoon },
                { key: 'planned', label: t.filterPlanned },
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setSelectedFilter(filter.key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedFilter === filter.key
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Cities List */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          {filteredCities.map((country) => (
            <motion.div
              key={country.key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-2xl shadow-lg overflow-hidden"
            >
              {/* Country Header */}
              <button
                onClick={() => setExpandedCountry(expandedCountry === country.key ? null : country.key)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{country.flag}</span>
                  <div className="text-left">
                    <h3 className="font-bold text-lg">{country.name[language]}</h3>
                    <p className="text-sm text-gray-500">
                      {country.cities.length} {language === 'tr' ? 'şehir' : 'cities'}
                    </p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
                  expandedCountry === country.key ? 'rotate-180' : ''
                }`} />
              </button>

              {/* Cities */}
              <AnimatePresence>
                {expandedCountry === country.key && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 pt-0">
                      {country.cities.map((city) => {
                        const status = statusConfig[city.status as keyof typeof statusConfig]
                        const StatusIcon = status.icon
                        const isInterested = interestedCities.includes(city.slug)

                        return (
                          <motion.div
                            key={city.slug}
                            whileHover={{ scale: 1.02 }}
                            className={`p-4 rounded-xl border-2 transition-all ${
                              city.status === 'active' 
                                ? 'border-green-300 bg-green-100' 
                                : city.status === 'pilot'
                                ? 'border-blue-300 bg-blue-100'
                                : 'border-gray-200 bg-gray-100'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-bold text-lg text-gray-900">{city.name}</h4>
                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.textColor}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  {status.label[language]}
                                </div>
                              </div>
                              {city.users > 0 && (
                                <div className="text-right">
                                  <p className="text-lg font-bold text-purple-700">{city.users}</p>
                                  <p className="text-xs text-gray-600">{t.users}</p>
                                </div>
                              )}
                            </div>

                            {city.waitlist && city.waitlist > 0 && (
                              <p className="text-sm text-orange-700 font-medium mb-3">
                                <Heart className="w-4 h-4 inline mr-1" />
                                {city.waitlist} {t.waiting}
                              </p>
                            )}

                            {/* Action Buttons */}
                            {city.status === 'active' ? (
                              <Link
                                href="/urunler"
                                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                              >
                                <Sparkles className="w-4 h-4" />
                                {t.explore}
                              </Link>
                            ) : city.status === 'pilot' ? (
                              <Link
                                href={`/${city.slug}`}
                                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                <Rocket className="w-4 h-4" />
                                {t.explore}
                              </Link>
                            ) : isInterested ? (
                              <button
                                disabled
                                className="w-full flex items-center justify-center gap-2 bg-gray-200 text-gray-500 py-2 rounded-lg cursor-not-allowed"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                {t.interested}
                              </button>
                            ) : selectedCityForEmail === city.slug ? (
                              <div className="space-y-2">
                                <input
                                  type="email"
                                  placeholder={t.emailPlaceholder}
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border text-sm"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setSelectedCityForEmail(null)}
                                    className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-600 text-sm"
                                  >
                                    İptal
                                  </button>
                                  <button
                                    onClick={() => handleEmailSubmit(city.slug)}
                                    disabled={submittingEmail}
                                    className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm disabled:opacity-50"
                                  >
                                    {submittingEmail ? '...' : t.notifyMe}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setSelectedCityForEmail(city.slug)}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-orange-500 text-white py-2 rounded-lg hover:opacity-90 transition-opacity"
                              >
                                <Mail className="w-4 h-4" />
                                {t.showInterest}
                              </button>
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Ambassador CTA */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-purple-600 to-orange-500 rounded-3xl p-8 md:p-12 text-white text-center"
          >
            <Award className="w-16 h-16 mx-auto mb-6 opacity-90" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.ambassadorTitle}</h2>
            <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">{t.ambassadorDesc}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto text-left">
              {[
                { icon: Building2, text: language === 'tr' ? 'Şehrinde ilk ol' : 'Be first in your city' },
                { icon: TrendingUp, text: language === 'tr' ? 'Gelir payı kazan' : 'Earn revenue share' },
                { icon: Star, text: language === 'tr' ? 'Elçi Rozeti + Özel Ayrıcalıklar' : 'Ambassador Badge + Exclusive Perks' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/20 rounded-xl p-3">
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.text}</span>
                </div>
              ))}
            </div>

            <Link
              href="/ambassador"
              className="inline-flex items-center gap-2 bg-white text-purple-600 px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-colors"
            >
              {t.applyNow}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
