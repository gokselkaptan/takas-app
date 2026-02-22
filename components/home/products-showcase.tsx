'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Star, MapPin, Tag, Flame, Heart, Eye } from 'lucide-react'
import { useLanguage } from '@/lib/language-context'
import { useSession } from 'next-auth/react'

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
  district: string
  city?: string
  isPopular?: boolean
  views?: number
  _count?: {
    favorites: number
    swapRequestsForProduct?: number
  }
  user?: {
    trustScore?: number
    isPhoneVerified?: boolean
  }
  category: {
    name: string
    nameEn: string
    translatedName?: string
    icon: string
    slug?: string
  }
}

interface PricePopupData {
  productId: string
  valorPrice: number
  x: number
  y: number
  data: any
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

const conditionLabels: Record<string, Record<string, string>> = {
  new: { tr: 'Sıfır', en: 'New', es: 'Nuevo', ca: 'Nou' },
  likeNew: { tr: 'Sıfır Gibi', en: 'Like New', es: 'Como Nuevo', ca: 'Com Nou' },
  like_new: { tr: 'Sıfır Gibi', en: 'Like New', es: 'Como Nuevo', ca: 'Com Nou' },
  good: { tr: 'İyi', en: 'Good', es: 'Bueno', ca: 'Bo' },
  Good: { tr: 'İyi', en: 'Good', es: 'Bueno', ca: 'Bo' },
  İyi: { tr: 'İyi', en: 'Good', es: 'Bueno', ca: 'Bo' },
  fair: { tr: 'Orta', en: 'Fair', es: 'Regular', ca: 'Regular' },
  poor: { tr: 'Kötü', en: 'Poor', es: 'Malo', ca: 'Dolent' }
}

// Kategori çevirileri (İngilizce → diğer diller)
const categoryTranslations: Record<string, Record<string, string>> = {
  'Electronics': { tr: 'Elektronik', en: 'Electronics', es: 'Electrónica', ca: 'Electrònica' },
  'Clothing': { tr: 'Giyim', en: 'Clothing', es: 'Ropa', ca: 'Roba' },
  'Books': { tr: 'Kitaplar', en: 'Books', es: 'Libros', ca: 'Llibres' },
  'Home': { tr: 'Ev & Yaşam', en: 'Home', es: 'Hogar', ca: 'Llar' },
  'Sports': { tr: 'Spor', en: 'Sports', es: 'Deportes', ca: 'Esports' },
  'Toys': { tr: 'Oyuncak', en: 'Toys', es: 'Juguetes', ca: 'Joguines' },
  'Pet Supplies': { tr: 'Evcil Hayvan', en: 'Pet Supplies', es: 'Mascotas', ca: 'Mascotes' },
  'Music': { tr: 'Müzik', en: 'Music', es: 'Música', ca: 'Música' },
  'Garden': { tr: 'Bahçe', en: 'Garden', es: 'Jardín', ca: 'Jardí' },
  'Art': { tr: 'Sanat', en: 'Art', es: 'Arte', ca: 'Art' },
  'Collectibles': { tr: 'Koleksiyon', en: 'Collectibles', es: 'Coleccionables', ca: 'Col·leccionables' },
  'Vehicles': { tr: 'Araçlar', en: 'Vehicles', es: 'Vehículos', ca: 'Vehicles' },
  'Other': { tr: 'Diğer', en: 'Other', es: 'Otro', ca: 'Altre' },
}

export function ProductsShowcase() {
  const { t, language } = useLanguage()
  const { data: session } = useSession()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null)
  const [pricePopup, setPricePopup] = useState<PricePopupData | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)

  const showPriceBreakdown = async (e: React.MouseEvent, product: Product) => {
    e.preventDefault()
    e.stopPropagation()
    
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPricePopup({
      productId: product.id,
      valorPrice: product.valorPrice,
      x: rect.left,
      y: rect.bottom + 8,
      data: null
    })
    setPriceLoading(true)
    
    try {
      const res = await fetch(`/api/valor/price-breakdown?valor=${product.valorPrice}&city=${encodeURIComponent(product.city || 'İzmir')}`)
      if (res.ok) {
        const data = await res.json()
        setPricePopup(prev => prev ? { ...prev, data } : null)
      }
    } catch {}
    setPriceLoading(false)
  }

  useEffect(() => {
    // Mobilde daha az ürün yükle
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    const limit = isMobile ? 6 : 8
    
    fetch(`/api/products?limit=${limit}&lang=${language}`)
      .then(res => res.json())
      .then(data => {
        setProducts(data.products || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [language])

  // Kullanıcının favorilerini yükle - gecikmeli
  useEffect(() => {
    if (session?.user) {
      // 500ms gecikme ile yükle - ana içerik öncelikli
      const timeout = setTimeout(() => {
        fetch('/api/favorites')
          .then(res => res.json())
          .then(data => {
            if (data.favorites) {
              const favIds = new Set<string>(data.favorites.map((f: any) => f.id))
              setFavorites(favIds)
            }
          })
          .catch(console.error)
      }, 500)
      return () => clearTimeout(timeout)
    }
  }, [session])

  const toggleFavorite = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!session?.user) {
      // Giriş sayfasına yönlendir
      window.location.href = '/giris'
      return
    }
    
    setTogglingFavorite(productId)
    
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      })
      
      const data = await res.json()
      
      if (data.isFavorite) {
        setFavorites(prev => new Set([...prev, productId]))
      } else {
        setFavorites(prev => {
          const newSet = new Set(prev)
          newSet.delete(productId)
          return newSet
        })
      }
    } catch (error) {
      console.error('Favorite toggle error:', error)
    } finally {
      setTogglingFavorite(null)
    }
  }

  if (loading) {
    return (
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded-2xl aspect-[3/4]" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-between mb-10"
        >
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              {t('popular')}{' '}
              <span className="text-purple-600 dark:text-purple-400">
                {t('products')}
              </span>
            </h2>
            <p className="text-gray-600">
              {t('availableForSwap')}
            </p>
          </div>
          <Link
            href="/urunler"
            className="hidden sm:flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-100 text-purple-700 font-bold hover:bg-purple-200 transition-all"
          >
            {t('allProducts')}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className={`group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden ${getProductBorderStyle(product)}`}
            >
              <Link href={`/urun/${product.id}`} className="cursor-pointer block">
                <div className="relative aspect-square overflow-hidden bg-gray-100">
                  {product.images && product.images[0] ? (
                    <Image
                      src={product.images[0]}
                      alt={product.title}
                      fill
                      loading="lazy"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-blue-100">
                      <span className="text-5xl">{product.category?.icon || '📦'}</span>
                    </div>
                  )}
                  
                  {/* Popular Badge */}
                  {product.isPopular && (
                    <div className="absolute top-3 left-3">
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold shadow">
                        <Flame className="w-3 h-3" />
                        {t('popular')}
                      </span>
                    </div>
                  )}
                  
                  {/* Condition Badge */}
                  {!product.isPopular && (
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs font-bold text-purple-700 shadow">
                        {product.translatedCondition || conditionLabels[product.condition]?.[language] || product.condition}
                      </span>
                    </div>
                  )}
                  
                  {/* Valor Badge - Clickable */}
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={(e) => showPriceBreakdown(e, product)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-600 to-blue-500 text-white text-xs font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all"
                    >
                      <Star className="w-3 h-3 fill-current" />
                      <span>{product.valorPrice}</span>
                    </button>
                  </div>
                  
                  {/* Güven Rozeti */}
                  {product.user?.trustScore && product.user.trustScore >= 80 ? (
                    <div className="absolute top-12 right-3 z-10">
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-500/90 backdrop-blur-sm text-white text-[9px] font-bold shadow">
                        ✅ Güvenilir
                      </span>
                    </div>
                  ) : product.user?.isPhoneVerified ? (
                    <div className="absolute top-12 right-3 z-10">
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-500/90 backdrop-blur-sm text-white text-[9px] font-bold shadow">
                        📱 Onaylı
                      </span>
                    </div>
                  ) : null}
                  
                  {/* Favorite Heart Button */}
                  <button
                    onClick={(e) => toggleFavorite(e, product.id)}
                    disabled={togglingFavorite === product.id}
                    className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md hover:scale-110 transition-all disabled:opacity-50"
                  >
                    <Heart 
                      className={`w-5 h-5 transition-colors ${
                        favorites.has(product.id) 
                          ? 'fill-red-500 text-red-500' 
                          : 'text-gray-400 hover:text-red-400'
                      }`} 
                    />
                  </button>
                  
                  {/* Views/Offers Counter */}
                  <div className="absolute bottom-3 left-3">
                    {(product._count?.swapRequestsForProduct || 0) > 0 ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/90 backdrop-blur-sm">
                        <span className="text-xs text-white font-bold">🔥 {product._count?.swapRequestsForProduct}</span>
                      </div>
                    ) : product.views && product.views > 0 ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/90 dark:bg-black/50 backdrop-blur-sm">
                        <Eye className="w-3 h-3 text-gray-500 dark:text-gray-300" />
                        <span className="text-xs text-gray-600 dark:text-gray-200 font-medium">{product.views}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                
                <div className="p-3 bg-white dark:bg-gray-800">
                  {/* Üst: Konum + Durum — ilk bakışta */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1 text-[11px]">
                      <MapPin className="w-3 h-3 text-orange-500" />
                      <span className="font-semibold text-gray-700 dark:text-gray-200">
                        {product.district || product.city || '—'}
                      </span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold">
                      {product.translatedCondition || conditionLabels[product.condition]?.[language] || product.condition || '—'}
                    </span>
                  </div>
                  
                  {/* Başlık — belirgin renk, kontrast düzeltildi */}
                  <h3 className="font-bold text-sm mb-1 line-clamp-1 text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {product.translatedTitle || product.title}
                  </h3>
                  
                  {/* Kategori */}
                  <div className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-purple-600" />
                    <span className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold">
                      {product.translatedCategory || 
                       categoryTranslations[product.category?.name || '']?.[language] || 
                       product.category?.translatedName || 
                       product.category?.name || '—'}
                    </span>
                  </div>
                  
                  {/* Aksiyon Badge'leri */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(product._count?.swapRequestsForProduct || 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-200 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 text-[10px] font-bold">
                        💬 {product._count?.swapRequestsForProduct} Teklif
                      </span>
                    )}
                    {(product.valorPrice || 0) >= 100 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-200 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 text-[10px] font-bold">
                        ⚡ Çoklu Takas
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/urunler"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-100 text-purple-700 font-bold hover:bg-purple-200 transition-all"
          >
            {t('allProducts')}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Valor Fiyat Popup */}
      {pricePopup && (
        <div 
          className="fixed inset-0 z-50"
          onClick={() => setPricePopup(null)}
        >
          <div 
            className="absolute bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 p-4 w-64"
            style={{ 
              left: Math.min(pricePopup.x, typeof window !== 'undefined' ? window.innerWidth - 280 : pricePopup.x), 
              top: pricePopup.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-600 to-blue-500 flex items-center justify-center">
                  <Star className="w-3 h-3 text-white fill-current" />
                </div>
                <span className="font-bold text-gray-900 dark:text-white">{pricePopup.valorPrice} Valor</span>
              </div>
              <button onClick={() => setPricePopup(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>

            {priceLoading ? (
              <p className="text-xs text-gray-500 text-center py-4">Hesaplanıyor...</p>
            ) : pricePopup.data ? (
              <div className="space-y-2">
                {/* Giriş şehri */}
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  📍 {pricePopup.data.city} bölgesi
                </p>
                
                {/* Fiyatlar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <span className="text-xs">🇹🇷 Türk Lirası</span>
                    <span className="text-sm font-bold text-red-700 dark:text-red-300">
                      ≈ {pricePopup.data.localPrices.TRY.toLocaleString('tr-TR')} ₺
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-xs">🇪🇺 Euro</span>
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                      ≈ {pricePopup.data.localPrices.EUR} €
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="text-xs">🇺🇸 Dolar</span>
                    <span className="text-sm font-bold text-green-700 dark:text-green-300">
                      ≈ {pricePopup.data.localPrices.USD} $
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <span className="text-xs">🇬🇧 Sterlin</span>
                    <span className="text-sm font-bold text-yellow-700 dark:text-yellow-300">
                      ≈ {pricePopup.data.localPrices.GBP} £
                    </span>
                  </div>
                </div>
                
                {/* Alt bilgi */}
                <div className="pt-2 border-t dark:border-gray-700">
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>Talep: {pricePopup.data.demandLevel}</span>
                    <span>Endeks: {pricePopup.data.costOfLivingIndex}</span>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1">
                    AI + Piyasa Endeksi bazlı yaklaşık değer
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-500 text-center py-4">Fiyat bilgisi alınamadı</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
