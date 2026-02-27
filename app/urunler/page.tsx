'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, Grid, List, ChevronDown, Star, MapPin, Clock, Flame, Loader2, Navigation, X, Instagram } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import Image from 'next/image'
import Link from 'next/link'
import AIVisualizationPromo from '@/components/ai-visualization-promo'
import { usePullToRefresh, useInfiniteScroll, useHapticFeedback } from '@/hooks/use-mobile-ux'
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh'
import { ProductCardSkeleton, ProductListSkeleton } from '@/components/ui/skeleton-loaders'
import { TouchFeedback } from '@/components/ui/touch-feedback'

interface Category {
  id: string
  name: string
  nameEn: string | null
  nameEs: string | null
  nameCa: string | null
  translatedName?: string
  slug: string
  icon: string | null
  _count: { products: number }
}

interface Product {
  id: string
  title: string
  description: string
  translatedTitle?: string
  translatedDescription?: string
  translatedCondition?: string
  translatedCategory?: string
  valorPrice: number
  condition: string
  images: string[]
  category: Category
  district: string | null
  city: string
  views: number
  isPopular?: boolean
  createdAt: string
  user: { id: string; name: string | null }
  distance?: number | null // Kullanıcıya olan mesafe (km)
}

// Ürün çerçeve renkleri belirleme fonksiyonu
function getProductBorderStyle(product: Product) {
  const categorySlug = product.category?.slug || product.category?.name?.toLowerCase() || ''
  
  // Popüler ürünler: Kalın turuncu/kırmızı çerçeve + glow efekti
  if (product.isPopular) {
    return 'border-4 border-orange-500 ring-4 ring-orange-300/60 shadow-lg shadow-orange-400/40 animate-subtle-glow'
  }
  
  // Çocuk ve bebek ürünleri: Naif pastel pembe/mor çerçeve
  if (categorySlug.includes('cocuk') || categorySlug.includes('bebek') || categorySlug.includes('oyuncak') ||
      categorySlug.includes('çocuk') || categorySlug.includes('kids') || categorySlug.includes('toys')) {
    return 'border-2 border-pink-300 ring-2 ring-pink-100 shadow-md shadow-pink-100'
  }
  
  // Diğer ürünler: Doğal ton çerçeve
  return 'border border-gray-200 hover:border-purple-300'
}

const ITEMS_PER_PAGE = 12

export default function UrunlerPage() {
  const { t, language } = useLanguage()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  
  // Mesafe filtreleme state'leri
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [distanceRadius, setDistanceRadius] = useState<number | null>(null) // km cinsinden
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  
  // Infinite scroll state
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalProducts, setTotalProducts] = useState(0)
  
  // Hızlı filtre chip'leri state
  const [selectedCity, setSelectedCity] = useState<string>('all')
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all')
  const [valorRange, setValorRange] = useState<string>('all')
  const [availableCities, setAvailableCities] = useState<Array<{ name: string; count: number }>>([])
  const [districtsByCity, setDistrictsByCity] = useState<Record<string, Array<{ name: string; count: number }>>>({})
  const [currentDistricts, setCurrentDistricts] = useState<Array<{ name: string; count: number }>>([])
  
  // Haptic feedback
  const { trigger: haptic } = useHapticFeedback()
  
  // Kullanıcı konumunu al
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError(language === 'tr' ? 'Tarayıcınız konum özelliğini desteklemiyor' : 'Your browser does not support geolocation')
      return
    }
    
    setIsGettingLocation(true)
    setLocationError(null)
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
        setIsGettingLocation(false)
        haptic('success')
      },
      (error) => {
        setIsGettingLocation(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError(language === 'tr' ? 'Konum izni reddedildi' : 'Location permission denied')
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError(language === 'tr' ? 'Konum bilgisi alınamadı' : 'Location unavailable')
            break
          case error.TIMEOUT:
            setLocationError(language === 'tr' ? 'Konum isteği zaman aşımına uğradı' : 'Location request timed out')
            break
          default:
            setLocationError(language === 'tr' ? 'Konum alınamadı' : 'Could not get location')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }, [language, haptic])
  
  // Mesafe filtresini temizle
  const clearDistanceFilter = useCallback(() => {
    setDistanceRadius(null)
    setUserLocation(null)
    haptic('light')
  }, [haptic])

  // URL'den arama parametresini al
  useEffect(() => {
    const urlSearch = searchParams?.get('search')
    if (urlSearch) {
      setSearchQuery(urlSearch)
    }
  }, [searchParams])

  // Initial load and filter changes
  useEffect(() => {
    fetchCategories()
    // Reset pagination on filter change
    setPage(1)
    setProducts([])
    fetchProducts(1, true)
  }, [selectedCategory, sortBy, searchQuery, language, userLocation, distanceRadius, selectedCity, selectedDistrict, valorRange])
  
  // Filtre verilerini bir kez çek — tüm şehir+semt ilişkisi gelir
  useEffect(() => {
    fetch('/api/products/filters')
      .then(r => r.ok ? r.json() : { cities: [], districtsByCity: {} })
      .then(data => {
        setAvailableCities(data.cities || [])
        setDistrictsByCity(data.districtsByCity || {})
      })
      .catch(() => {})
  }, [])

  // Şehir değiştiğinde semtleri CLIENT-SIDE filtrele (API'ye gitMEZ)
  useEffect(() => {
    if (selectedCity !== 'all') {
      setCurrentDistricts(districtsByCity[selectedCity] || [])
    } else {
      setCurrentDistricts([])
    }
    setSelectedDistrict('all')
  }, [selectedCity, districtsByCity])

  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/categories?lang=${language}`)
      const data = await res.json()
      setCategories(data)
    } catch (error) {
      console.error('Kategori hatası:', error)
    }
  }

  const fetchProducts = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
    try {
      if (reset) setLoading(true)
      
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') params.set('category', selectedCategory)
      if (searchQuery) params.set('search', searchQuery)
      params.set('sort', sortBy)
      params.set('lang', language)
      params.set('page', pageNum.toString())
      params.set('limit', ITEMS_PER_PAGE.toString())
      
      // Mesafe filtreleme parametreleri
      if (userLocation) {
        params.set('lat', userLocation.lat.toString())
        params.set('lng', userLocation.lng.toString())
        if (distanceRadius) {
          params.set('radius', distanceRadius.toString())
        }
      }
      
      // Hızlı filtre chip parametreleri
      if (selectedCity !== 'all') params.set('city', selectedCity)
      if (selectedDistrict !== 'all') params.set('district', selectedDistrict)
      if (valorRange !== 'all') {
        const parts = valorRange.split('-').map(Number)
        if (!isNaN(parts[0])) params.set('valorMin', String(parts[0]))
        if (!isNaN(parts[1])) params.set('valorMax', String(parts[1]))
      }
      
      const res = await fetch(`/api/products?${params.toString()}`)
      const data = await res.json()
      
      const newProducts = data.products || []
      const total = data.total || newProducts.length
      
      setTotalProducts(total)
      
      if (reset) {
        setProducts(newProducts)
      } else {
        setProducts(prev => [...prev, ...newProducts])
      }
      
      // Check if there are more products
      const loadedCount = reset ? newProducts.length : products.length + newProducts.length
      setHasMore(loadedCount < total)
      
    } catch (error) {
      console.error('Ürün hatası:', error)
      if (reset) setProducts([])
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, sortBy, searchQuery, language, products.length, userLocation, distanceRadius, selectedCity, selectedDistrict, valorRange])

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    haptic('medium')
    setPage(1)
    await fetchProducts(1, true)
  }, [fetchProducts, haptic])

  const { pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80
  })

  // Infinite scroll
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loading) return
    const nextPage = page + 1
    setPage(nextPage)
    await fetchProducts(nextPage, false)
  }, [hasMore, loading, page, fetchProducts])

  const { isLoading: isLoadingMore, setLoadMoreElement } = useInfiniteScroll({
    onLoadMore: handleLoadMore,
    hasMore,
    threshold: 300
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    haptic('light')
    setPage(1)
    fetchProducts(1, true)
  }

  const conditionLabels: Record<string, { tr: string; en: string; es: string; ca: string }> = {
    new: { tr: 'Sıfır', en: 'New', es: 'Nuevo', ca: 'Nou' },
    likeNew: { tr: 'Sıfır Gibi', en: 'Like New', es: 'Como Nuevo', ca: 'Com Nou' },
    like_new: { tr: 'Sıfır Gibi', en: 'Like New', es: 'Como Nuevo', ca: 'Com Nou' },
    good: { tr: 'İyi', en: 'Good', es: 'Bueno', ca: 'Bo' },
    Good: { tr: 'İyi', en: 'Good', es: 'Bueno', ca: 'Bo' },
    İyi: { tr: 'İyi', en: 'Good', es: 'Bueno', ca: 'Bo' },
    fair: { tr: 'Orta', en: 'Fair', es: 'Regular', ca: 'Regular' },
    poor: { tr: 'Kötü', en: 'Poor', es: 'Malo', ca: 'Dolent' }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    const todayLabels = { tr: 'Bugün', en: 'Today', es: 'Hoy', ca: 'Avui' }
    const yesterdayLabels = { tr: 'Dün', en: 'Yesterday', es: 'Ayer', ca: 'Ahir' }
    const daysAgoLabels = { tr: 'gün önce', en: 'days ago', es: 'días', ca: 'dies' }
    const locales = { tr: 'tr-TR', en: 'en-US', es: 'es-ES', ca: 'ca-ES' }
    
    if (diffDays === 0) return todayLabels[language]
    if (diffDays === 1) return yesterdayLabels[language]
    if (diffDays < 7) return `${diffDays} ${daysAgoLabels[language]}`
    return date.toLocaleDateString(locales[language])
  }

  return (
    <div className="pt-20 min-h-screen bg-gray-50">
      {/* Pull to Refresh Indicator */}
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
      />
      
      {/* Header */}
      <section className="py-8 bg-gradient-to-br from-orange-50 via-amber-50 to-white border-b border-orange-100">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-6">{t('allProducts')}</h1>
          
          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchProducts')}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-orange-200 bg-orange-50/50 focus:bg-white focus:ring-2 focus:ring-orange-400 focus:border-orange-400 text-gray-700 placeholder-gray-500 transition-all"
                />
              </div>
            </form>

            {/* Category Filter */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none pl-4 pr-10 py-3 rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 min-w-[180px] text-gray-900 dark:text-white transition-all"
              >
                <option value="all">{t('allCategories')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.translatedName || cat.name} ({cat._count.products})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400 pointer-events-none" />
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none pl-4 pr-10 py-3 rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 min-w-[180px] text-gray-900 dark:text-white transition-all"
              >
                <option value="newest">{t('newest')}</option>
                <option value="oldest">{t('oldest')}</option>
                <option value="priceHigh">{t('priceHighToLow')}</option>
                <option value="priceLow">{t('priceLowToHigh')}</option>
                {userLocation && <option value="distance">{language === 'tr' ? 'Yakından Uzağa' : 'Nearest First'}</option>}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400 pointer-events-none" />
            </div>
            
            {/* Mesafe Filtresi */}
            <div className="relative flex items-center gap-2">
              {!userLocation ? (
                <button
                  onClick={getUserLocation}
                  disabled={isGettingLocation}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-orange-200 bg-orange-50/50 hover:bg-orange-100 transition-all text-gray-700 disabled:opacity-50"
                  title={language === 'tr' ? 'Konumunuzu kullanarak yakındaki ürünleri bulun' : 'Find products near you'}
                >
                  {isGettingLocation ? (
                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                  ) : (
                    <Navigation className="w-5 h-5 text-orange-500" />
                  )}
                  <span className="hidden sm:inline text-sm font-medium">
                    {language === 'tr' ? 'Yakınımdakiler' : 'Near Me'}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={distanceRadius || ''}
                    onChange={(e) => setDistanceRadius(e.target.value ? parseInt(e.target.value) : null)}
                    className="appearance-none pl-4 pr-10 py-3 rounded-xl border-2 border-green-300 bg-green-50 focus:bg-white focus:ring-2 focus:ring-green-400 focus:border-green-400 min-w-[140px] text-gray-900 transition-all"
                  >
                    <option value="">{language === 'tr' ? 'Tüm Mesafeler' : 'All Distances'}</option>
                    <option value="1">1 km</option>
                    <option value="3">3 km</option>
                    <option value="5">5 km</option>
                    <option value="10">10 km</option>
                    <option value="25">25 km</option>
                    <option value="50">50 km</option>
                    <option value="100">100 km</option>
                  </select>
                  <ChevronDown className="absolute right-12 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500 pointer-events-none" />
                  <button
                    onClick={clearDistanceFilter}
                    className="p-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-all"
                    title={language === 'tr' ? 'Mesafe filtresini kaldır' : 'Remove distance filter'}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* View Mode */}
            <div className="flex rounded-xl border-2 border-orange-200 overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-3 transition-all ${viewMode === 'grid' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-orange-50'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-3 transition-all ${viewMode === 'list' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-orange-50'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Hızlı Filtre Chip'leri */}
          <div className="mt-4 space-y-2">
            {/* Şehir — horizontal scroll */}
            <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
              <div className="flex gap-2 min-w-max pb-1">
                <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-1 shrink-0">📍</span>
                <button
                  onClick={() => setSelectedCity('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                    selectedCity === 'all' 
                      ? 'bg-orange-500 text-white shadow-md' 
                      : 'bg-white dark:bg-gray-800 border-2 border-orange-400 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                  }`}
                >
                  {language === 'tr' ? 'Tüm Şehirler' : 'All Cities'}
                </button>
                {availableCities.map((city) => (
                  <button
                    key={city.name}
                    onClick={() => setSelectedCity(city.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                      selectedCity === city.name 
                        ? 'bg-orange-500 text-white shadow-md' 
                        : 'bg-white dark:bg-gray-800 border-2 border-orange-300 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-400'
                    }`}
                  >
                    {city.name} <span className="opacity-70">({city.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Semt — sadece şehir seçiliyse, horizontal scroll */}
            {selectedCity !== 'all' && currentDistricts.length > 0 && (
              <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
                <div className="flex gap-2 min-w-max pb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-1 shrink-0">🏘️</span>
                  <button
                    onClick={() => setSelectedDistrict('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                      selectedDistrict === 'all' 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-white dark:bg-gray-800 border-2 border-blue-400 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                  >
                    {language === 'tr' ? 'Tüm Semtler' : 'All Districts'}
                  </button>
                  {currentDistricts.map((dist) => (
                    <button
                      key={dist.name}
                      onClick={() => setSelectedDistrict(dist.name)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                        selectedDistrict === dist.name 
                          ? 'bg-blue-500 text-white shadow-md' 
                          : 'bg-white dark:bg-gray-800 border-2 border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400'
                      }`}
                    >
                      {dist.name} <span className="opacity-70">({dist.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Valor — horizontal scroll */}
            <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
              <div className="flex gap-2 min-w-max pb-1">
                <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-1 shrink-0">⭐</span>
                {[
                  { label: language === 'tr' ? 'Tümü' : 'All', value: 'all' },
                  { label: '0-100', value: '0-100' },
                  { label: '100-500', value: '100-500' },
                  { label: '500-2K', value: '500-2000' },
                  { label: '2K-5K', value: '2000-5000' },
                  { label: '5K+', value: '5000-999999' },
                ].map(range => (
                  <button
                    key={range.value}
                    onClick={() => setValorRange(range.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                      valorRange === range.value 
                        ? 'bg-purple-500 text-white shadow-md' 
                        : 'bg-white dark:bg-gray-800 border-2 border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-400'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-8">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          {/* Konum hatası */}
          {locationError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {locationError}
              <button onClick={() => setLocationError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {/* Mesafe filtresi aktif bilgisi */}
          {userLocation && distanceRadius && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              {language === 'tr' 
                ? `${distanceRadius} km içindeki ürünler gösteriliyor` 
                : `Showing products within ${distanceRadius} km`}
            </div>
          )}
          
          {/* Product count info */}
          {!loading && products.length > 0 && (
            <div className="mb-4 text-sm text-gray-500">
              {language === 'tr' 
                ? `${totalProducts} ürün bulundu` 
                : `${totalProducts} products found`}
            </div>
          )}
          
          {loading ? (
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' 
              : 'space-y-4'
            }>
              {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
                viewMode === 'grid' 
                  ? <ProductCardSkeleton key={i} />
                  : <ProductListSkeleton key={i} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('noProducts')}</h3>
              <p className="text-gray-600">{language === 'tr' ? 'İlk ürünü siz ekleyin!' : 'Be the first to add a product!'}</p>
              <Link href="/urun-ekle" className="inline-block mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-200">
                {t('addProduct')}
              </Link>
            </div>
          ) : (
            <>
              <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' : 'space-y-4'}>
                <AnimatePresence mode="popLayout">
                  {products.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: index < ITEMS_PER_PAGE ? index * 0.03 : 0 }}
                      layout
                    >
                      <TouchFeedback 
                        className="block" 
                        hapticType="light"
                        rippleColor="rgba(139, 92, 246, 0.2)"
                      >
                        <Link href={`/urun/${product.id}`}>
                          <div className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all group ${getProductBorderStyle(product)} ${
                            viewMode === 'list' ? 'flex' : ''
                          }`}>
                            {/* Image */}
                            <div className={`relative ${viewMode === 'list' ? 'w-32 md:w-48 flex-shrink-0' : 'aspect-square'}`}>
                              <div className={`${viewMode === 'list' ? 'aspect-square' : ''} absolute inset-0 bg-gray-100`}>
                                {product.images && product.images.length > 0 ? (
                                  <Image
                                    src={product.images[0]}
                                    alt={product.title}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                                    sizes={viewMode === 'list' ? '(max-width: 768px) 128px, 192px' : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw'}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">
                                    📦
                                  </div>
                                )}
                              </div>
                              {/* Popular or Condition Badge */}
                              {product.isPopular ? (
                                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold shadow">
                                  <Flame className="w-3 h-3" />
                                  {language === 'tr' ? 'Popüler' : language === 'es' ? 'Popular' : language === 'ca' ? 'Popular' : 'Popular'}
                                </div>
                              ) : (
                                <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-semibold shadow-sm ${
                                  product.condition === 'new' ? 'bg-green-500 text-white' :
                                  product.condition === 'like_new' ? 'bg-blue-500 text-white' :
                                  product.condition === 'good' ? 'bg-amber-500 text-white' :
                                  'bg-gray-600 text-white'
                                }`}>
                                  {product.translatedCondition || conditionLabels[product.condition]?.[language] || product.condition}
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className={`p-3 md:p-4 bg-white ${viewMode === 'list' ? 'flex-1' : ''}`}>
                              <h3 className="font-semibold line-clamp-2 mb-1 text-sm md:text-base transition-colors text-gray-900">
                                {product.translatedTitle || product.title}
                              </h3>
                              
                              {viewMode === 'list' && (
                                <p className="text-sm text-gray-600 line-clamp-2 mb-2 hidden md:block">{product.translatedDescription || product.description}</p>
                              )}

                              <div className="flex items-center gap-1 text-xs mb-2 flex-wrap">
                                <MapPin className="w-3 h-3 flex-shrink-0 text-gray-700" />
                                <span className="font-medium truncate text-gray-700">{product.district || product.city}</span>
                                {/* Mesafe bilgisi */}
                                {product.distance !== undefined && product.distance !== null && (
                                  <>
                                    <span className="mx-1 text-gray-600">·</span>
                                    <Navigation className="w-3 h-3 flex-shrink-0 text-green-600" />
                                    <span className="font-semibold text-green-600">{product.distance} km</span>
                                  </>
                                )}
                                <span className="mx-1 hidden sm:inline text-gray-600">·</span>
                                <Clock className="w-3 h-3 flex-shrink-0 hidden sm:block text-gray-700" />
                                <span className="font-medium hidden sm:block text-gray-700">{formatDate(product.createdAt)}</span>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1 rounded-lg px-2 py-1 bg-purple-600 shadow-sm">
                                  <span className="text-base md:text-lg font-bold text-white">{product.valorPrice}</span>
                                  <span className="text-xs md:text-sm font-medium text-white">{t('valorPoints')}</span>
                                </div>
                                {product.category && (
                                  <span className="text-xs px-2 py-1 rounded-full font-medium truncate max-w-[80px] md:max-w-none bg-orange-500 text-white shadow-sm">
                                    {product.translatedCategory || product.category.translatedName || product.category.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </TouchFeedback>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              
              {/* Infinite Scroll Loader */}
              <div 
                ref={setLoadMoreElement}
                className="flex justify-center py-8"
              >
                {(isLoadingMore || (hasMore && !loading)) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-gray-500"
                  >
                    <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                    <span className="text-sm">
                      {language === 'tr' ? 'Yükleniyor...' : 'Loading...'}
                    </span>
                  </motion.div>
                )}
                {!hasMore && products.length > 0 && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {language === 'tr' ? 'Tüm ürünler yüklendi' : 'All products loaded'}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </section>
      <AIVisualizationPromo />
      
      {/* Instagram Section */}
      <section className="py-12 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-orange-500/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-xl font-bold mb-4">
            {language === 'tr' ? '📸 Bizi Instagram\'da Takip Edin!' : '📸 Follow Us on Instagram!'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {language === 'tr' 
              ? 'Takas fırsatları, ipuçları ve topluluk etkinlikleri için bizi takip edin!' 
              : 'Follow us for swap opportunities, tips and community events!'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a
              href="https://instagram.com/takasabarty"
              target="_blank"
              rel="noopener noreferrer"
              className="relative w-40 h-40 rounded-2xl overflow-hidden shadow-xl hover:scale-105 transition-transform"
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
      </section>
    </div>
  )
}
