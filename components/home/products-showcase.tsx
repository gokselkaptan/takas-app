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
  isPopular?: boolean
  views?: number
  _count?: {
    favorites: number
  }
  category: {
    name: string
    nameEn: string
    translatedName?: string
    icon: string
    slug?: string
  }
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
  good: { tr: 'İyi', en: 'Good', es: 'Bueno', ca: 'Bo' },
  fair: { tr: 'Orta', en: 'Fair', es: 'Regular', ca: 'Regular' }
}

export function ProductsShowcase() {
  const { t, language } = useLanguage()
  const { data: session } = useSession() || {}
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null)

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
              {language === 'tr' ? 'Popüler' : language === 'es' ? 'Productos' : language === 'ca' ? 'Productes' : 'Popular'}{' '}
              <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
                {t('products')}
              </span>
            </h2>
            <p className="text-gray-600">
              {language === 'tr' ? 'Hemen takas yapabileceğin ürünler' : 
               language === 'es' ? 'Productos disponibles para intercambiar' :
               language === 'ca' ? 'Productes disponibles per intercanviar' :
               'Products available for swap'}
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
                        {language === 'tr' ? 'Popüler' : 'Popular'}
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
                  
                  {/* Valor Badge */}
                  <div className="absolute top-3 right-3">
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-600 to-blue-500 text-white text-xs font-bold shadow-lg">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{product.valorPrice}</span>
                    </div>
                  </div>
                  
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
                  
                  {/* Views Counter */}
                  {product.views && product.views > 0 && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm">
                      <Eye className="w-3 h-3 text-white/80" />
                      <span className="text-xs text-white/90 font-medium">{product.views}</span>
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <h3 className="font-bold text-gray-800 mb-1 line-clamp-1 group-hover:text-purple-600 transition-colors">
                    {product.translatedTitle || product.title}
                  </h3>
                  <p className="text-gray-500 text-sm line-clamp-2 mb-3 h-10">
                    {product.translatedDescription || product.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-gray-400 text-xs">
                      <MapPin className="w-3 h-3" />
                      <span>{product.district}</span>
                    </div>
                    <div className="flex items-center gap-1 text-purple-600">
                      <Tag className="w-3 h-3" />
                      <span className="text-xs font-medium">
                        {product.translatedCategory || product.category?.translatedName || product.category?.name}
                      </span>
                    </div>
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
    </section>
  )
}
