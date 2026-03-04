'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import {
  Users, MapPin, Search, Plus, Star, TrendingUp,
  Calendar, MessageCircle, Crown, Shield, Sparkles,
  Filter, ChevronDown, Globe, Building2, Home, Instagram
} from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { toast } from 'sonner'

interface Community {
  id: string
  name: string
  slug: string
  description: string | null
  city: string
  district: string | null
  neighborhood: string | null
  coverImage: string | null
  icon: string | null
  type: string
  isOfficial: boolean
  isPrivate: boolean
  memberCount: number
  swapCount: number
  weeklyActivity: number
  tags: string[]
  isMember: boolean
  myRole: string | null
  postCount: number
  eventCount: number
}

const translations = {
  tr: {
    title: 'Topluluklar',
    subtitle: 'Şehrindeki takasçılarla tanış, yerel topluluklara katıl',
    search: 'Topluluk ara...',
    myGroups: 'Gruplarım',
    allGroups: 'Tüm Gruplar',
    createGroup: 'Grup Oluştur',
    members: 'üye',
    swaps: 'takas',
    posts: 'gönderi',
    events: 'etkinlik',
    join: 'Katıl',
    joined: 'Üye',
    official: 'Resmi',
    private: 'Özel',
    weeklyActive: 'haftalık aktif',
    noResults: 'Topluluk bulunamadı',
    filterCity: 'Şehir',
    filterType: 'Tür',
    allCities: 'Tüm Şehirler',
    allTypes: 'Tüm Türler',
    typeNeighborhood: 'Mahalle',
    typeDistrict: 'İlçe',
    typeCity: 'Şehir',
    typeInterest: 'İlgi Alanı',
    loadMore: 'Daha Fazla Yükle',
    loginRequired: 'Katılmak için giriş yapın',
    joinSuccess: 'Topluluğa katıldınız!',
    popularTags: 'Popüler Etiketler',
  },
  en: {
    title: 'Communities',
    subtitle: 'Meet swappers in your city, join local communities',
    search: 'Search communities...',
    myGroups: 'My Groups',
    allGroups: 'All Groups',
    createGroup: 'Create Group',
    members: 'members',
    swaps: 'swaps',
    posts: 'posts',
    events: 'events',
    join: 'Join',
    joined: 'Joined',
    official: 'Official',
    private: 'Private',
    weeklyActive: 'weekly active',
    noResults: 'No communities found',
    filterCity: 'City',
    filterType: 'Type',
    allCities: 'All Cities',
    allTypes: 'All Types',
    typeNeighborhood: 'Neighborhood',
    typeDistrict: 'District',
    typeCity: 'City',
    typeInterest: 'Interest',
    loadMore: 'Load More',
    loginRequired: 'Login to join',
    joinSuccess: 'You joined the community!',
    popularTags: 'Popular Tags',
  },
  es: {
    title: 'Comunidades',
    subtitle: 'Conoce a los intercambiadores de tu ciudad, únete a comunidades locales',
    search: 'Buscar comunidades...',
    myGroups: 'Mis Grupos',
    allGroups: 'Todos los Grupos',
    createGroup: 'Crear Grupo',
    members: 'miembros',
    swaps: 'intercambios',
    posts: 'publicaciones',
    events: 'eventos',
    join: 'Unirse',
    joined: 'Unido',
    official: 'Oficial',
    private: 'Privado',
    weeklyActive: 'activos semanales',
    noResults: 'No se encontraron comunidades',
    filterCity: 'Ciudad',
    filterType: 'Tipo',
    allCities: 'Todas las Ciudades',
    allTypes: 'Todos los Tipos',
    typeNeighborhood: 'Barrio',
    typeDistrict: 'Distrito',
    typeCity: 'Ciudad',
    typeInterest: 'Interés',
    loadMore: 'Cargar Más',
    loginRequired: 'Inicia sesión para unirte',
    joinSuccess: '¡Te uniste a la comunidad!',
    popularTags: 'Etiquetas Populares',
  },
  ca: {
    title: 'Comunitats',
    subtitle: 'Coneix als intercanviadors de la teva ciutat, uneix-te a comunitats locals',
    search: 'Cercar comunitats...',
    myGroups: 'Els Meus Grups',
    allGroups: 'Tots els Grups',
    createGroup: 'Crear Grup',
    members: 'membres',
    swaps: 'intercanvis',
    posts: 'publicacions',
    events: 'esdeveniments',
    join: 'Unir-se',
    joined: 'Unit',
    official: 'Oficial',
    private: 'Privat',
    weeklyActive: 'actius setmanals',
    noResults: 'No s\'han trobat comunitats',
    filterCity: 'Ciutat',
    filterType: 'Tipus',
    allCities: 'Totes les Ciutats',
    allTypes: 'Tots els Tipus',
    typeNeighborhood: 'Barri',
    typeDistrict: 'Districte',
    typeCity: 'Ciutat',
    typeInterest: 'Interès',
    loadMore: 'Carregar Més',
    loginRequired: 'Inicia sessió per unir-te',
    joinSuccess: 'T\'has unit a la comunitat!',
    popularTags: 'Etiquetes Populars',
  }
}

const typeIcons: Record<string, any> = {
  neighborhood: Home,
  district: Building2,
  city: Globe,
  interest: Star
}

export default function CommunitiesPage() {
  const { data: session } = useSession()
  const { language } = useLanguage()
  const router = useRouter()
  const t = translations[language] || translations.tr

  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showMyOnly, setShowMyOnly] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [joiningId, setJoiningId] = useState<string | null>(null)

  const cities = ['İzmir', 'İstanbul', 'Ankara', 'Barcelona', 'Madrid']
  const types = [
    { value: 'neighborhood', label: t.typeNeighborhood },
    { value: 'district', label: t.typeDistrict },
    { value: 'city', label: t.typeCity },
    { value: 'interest', label: t.typeInterest }
  ]

  const fetchCommunities = async (reset = false) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (cityFilter) params.set('city', cityFilter)
      if (typeFilter) params.set('type', typeFilter)
      if (showMyOnly) params.set('my', 'true')
      params.set('limit', '12')
      params.set('offset', reset ? '0' : String(offset))

      const res = await fetch(`/api/communities?${params}`)
      if (!res.ok) throw new Error('Fetch failed')
      
      const data = await res.json()
      
      if (reset) {
        setCommunities(data.communities || [])
        setOffset(12)
      } else {
        setCommunities(prev => [...prev, ...(data.communities || [])])
        setOffset(prev => prev + 12)
      }
      setHasMore(data.hasMore || false)
    } catch (error) {
      console.error('Communities fetch error:', error)
      toast.error('Topluluklar yüklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCommunities(true)
  }, [search, cityFilter, typeFilter, showMyOnly])

  const handleJoin = async (communityId: string) => {
    if (!session) {
      toast.error(t.loginRequired)
      router.push('/giris')
      return
    }

    setJoiningId(communityId)
    try {
      const res = await fetch(`/api/communities/${communityId}/join`, {
        method: 'POST'
      })
      const data = await res.json()
      
      if (res.ok) {
        toast.success(t.joinSuccess)
        setCommunities(prev => prev.map(c => 
          c.id === communityId 
            ? { ...c, isMember: true, memberCount: c.memberCount + 1, myRole: 'member' }
            : c
        ))
      } else {
        toast.error(data.error || 'Hata oluştu')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setJoiningId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-orange-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            <span className="bg-gradient-to-r from-purple-600 to-orange-500 bg-clip-text text-transparent">
              {t.title}
            </span>
          </h1>
          <p className="text-gray-600">{t.subtitle}</p>
        </motion.div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.search}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* City Filter */}
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
            >
              <option value="">{t.allCities}</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
            >
              <option value="">{t.allTypes}</option>
              {types.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            {/* My Groups Toggle */}
            {session && (
              <button
                onClick={() => setShowMyOnly(!showMyOnly)}
                className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
                  showMyOnly 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.myGroups}
              </button>
            )}

            {/* Create Group - Coming Soon */}
            <button
              disabled
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-300 text-gray-500 rounded-xl font-medium cursor-not-allowed opacity-50"
              title="Yakında"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">{t.createGroup}</span>
            </button>
          </div>
        </div>

        {/* Communities Grid */}
        {loading && communities.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-32 bg-gray-200 rounded-xl mb-4" />
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : communities.length === 0 ? (
          <div className="text-center py-16">
            <Users className="mx-auto text-gray-300 mb-4" size={64} />
            <p className="text-gray-500 text-lg">{t.noResults}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {communities.map((community, index) => {
                  const TypeIcon = typeIcons[community.type] || Users
                  return (
                    <motion.div
                      key={community.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                    >
                      {/* Cover Image */}
                      <div className="relative h-32 bg-gradient-to-r from-purple-400 to-orange-400">
                        {community.coverImage && (
                          <Image
                            src={community.coverImage}
                            alt={community.name}
                            fill
                            className="object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        
                        {/* Badges */}
                        <div className="absolute top-3 left-3 flex gap-2">
                          {community.isOfficial && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
                              <Crown size={12} />
                              {t.official}
                            </span>
                          )}
                          {community.isPrivate && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-gray-700 text-white text-xs rounded-full">
                              <Shield size={12} />
                              {t.private}
                            </span>
                          )}
                        </div>

                        {/* Type Icon */}
                        <div className="absolute top-3 right-3 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                          <TypeIcon size={20} className="text-purple-600" />
                        </div>

                        {/* Location */}
                        <div className="absolute bottom-3 left-3 flex items-center gap-1 text-white text-sm">
                          <MapPin size={14} />
                          <span>{community.district || community.city}</span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <Link href={`/topluluklar/${community.slug}`}>
                          <h3 className="font-bold text-lg mb-1 hover:text-purple-600 transition-colors line-clamp-1">
                            {community.name}
                          </h3>
                        </Link>
                        
                        {community.description && (
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {community.description}
                          </p>
                        )}

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                          <span className="flex items-center gap-1">
                            <Users size={14} />
                            {community.memberCount} {t.members}
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp size={14} />
                            {community.swapCount} {t.swaps}
                          </span>
                        </div>

                        {/* Tags */}
                        {community.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {community.tags.slice(0, 3).map((tag, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Action Button */}
                        {community.isMember ? (
                          <Link
                            href={`/topluluklar/${community.slug}`}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-100 text-green-700 rounded-xl font-medium hover:bg-green-200 transition-colors"
                          >
                            <Sparkles size={18} />
                            {t.joined} {community.myRole === 'admin' && '(Admin)'}
                          </Link>
                        ) : (
                          <button
                            onClick={() => handleJoin(community.id)}
                            disabled={joiningId === community.id}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                          >
                            {joiningId === community.id ? (
                              <span className="animate-spin">⏳</span>
                            ) : (
                              <Plus size={18} />
                            )}
                            {t.join}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={() => fetchCommunities()}
                  disabled={loading}
                  className="px-6 py-3 bg-white text-purple-600 rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50"
                >
                  {loading ? '⏳' : t.loadMore}
                </button>
              </div>
            )}
          </>
        )}
        
        {/* Instagram Section */}
        <div className="mt-16 p-8 bg-white/10 backdrop-blur-md rounded-2xl text-center">
          <h3 className="text-xl font-bold text-white mb-4">
            📸 {language === 'tr' ? 'Bizi Instagram\'da Takip Edin!' : 'Follow Us on Instagram!'}
          </h3>
          <p className="text-white/80 mb-6">
            {language === 'tr' 
              ? 'Topluluk etkinlikleri, takas hikayeleri ve daha fazlası için!' 
              : 'For community events, swap stories and more!'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a
              href="https://instagram.com/takasabarty"
              target="_blank"
              rel="noopener noreferrer"
              className="relative w-36 h-36 rounded-2xl overflow-hidden shadow-xl hover:scale-105 transition-transform bg-white"
            >
              <Image
                src="/instagram-qr.png"
                alt="Instagram QR Code"
                fill
                className="object-cover"
              />
            </a>
            <a
              href="https://instagram.com/takasabarty"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500 text-white font-semibold rounded-xl hover:scale-105 transition-transform shadow-lg"
            >
              <Instagram className="w-5 h-5" />
              @takasabarty
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
