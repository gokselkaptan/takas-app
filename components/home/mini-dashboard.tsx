'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Package, RefreshCw, Eye, Heart, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'

const dashboardTexts = {
  tr: {
    title: 'Trend & İstatistikler',
    subtitle: "TAKAS-A'daki son trendler",
    trendingCategories: 'Trend Kategoriler',
    viewAll: 'Tümünü gör',
    products: 'ürün',
    today: 'Bugün',
    newProducts: 'Yeni Ürün',
    swaps: 'Takas',
    mostViewed: 'En Çok İlgi Gören'
  },
  en: {
    title: 'Trends & Statistics',
    subtitle: 'Latest trends on TAKAS-A',
    trendingCategories: 'Trending Categories',
    viewAll: 'View all',
    products: 'products',
    today: 'Today',
    newProducts: 'New Products',
    swaps: 'Swaps',
    mostViewed: 'Most Viewed'
  },
  es: {
    title: 'Tendencias y Estadísticas',
    subtitle: 'Últimas tendencias en TAKAS-A',
    trendingCategories: 'Categorías Populares',
    viewAll: 'Ver todo',
    products: 'productos',
    today: 'Hoy',
    newProducts: 'Nuevos Productos',
    swaps: 'Intercambios',
    mostViewed: 'Más Vistos'
  },
  ca: {
    title: 'Tendències i Estadístiques',
    subtitle: 'Últimes tendències a TAKAS-A',
    trendingCategories: 'Categories Populars',
    viewAll: 'Veure tot',
    products: 'productes',
    today: 'Avui',
    newProducts: 'Nous Productes',
    swaps: 'Intercanvis',
    mostViewed: 'Més Vistos'
  }
}

interface Stats {
  totals: {
    products: number
    users: number
    swaps: number
  }
  today: {
    newProducts: number
    completedSwaps: number
  }
  trendingCategories: {
    id: string
    name: string
    slug: string
    productCount: number
  }[]
  popularProducts: {
    id: string
    title: string
    valorPrice: number
    views: number
    favoriteCount: number
    image: string
    category: string
  }[]
}

export function MiniDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const { language } = useLanguage()
  const texts = dashboardTexts[language] || dashboardTexts.tr
  
  // Lazy load - sadece görünür olduğunda yükle
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true)
        }
      },
      { rootMargin: '150px' }
    )
    
    const element = document.getElementById('mini-dashboard-section')
    if (element) observer.observe(element)
    
    return () => observer.disconnect()
  }, [isVisible])
  
  useEffect(() => {
    if (!isVisible) return
    fetchStats()
  }, [language, isVisible])
  
  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/stats?lang=${language}`)
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Stats fetch error:', error)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading || !isVisible) {
    return (
      <section id="mini-dashboard-section" className="py-12 bg-gray-50">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="animate-pulse grid md:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-2xl" />
            <div className="h-64 bg-gray-200 rounded-2xl" />
          </div>
        </div>
      </section>
    )
  }
  
  if (!stats) return null
  
  return (
    <section id="mini-dashboard-section" className="py-12 bg-gray-50">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl gradient-frozen flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{texts.title}</h2>
            <p className="text-sm text-gray-500">{texts.subtitle}</p>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Trend Kategoriler */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-frozen-500" />
                {texts.trendingCategories}
              </h3>
              <Link
                href="/urunler"
                className="text-sm text-frozen-600 hover:text-frozen-700 flex items-center gap-1"
              >
                {texts.viewAll} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="space-y-3">
              {stats.trendingCategories.slice(0, 5).map((category, index) => (
                <Link
                  key={category.id}
                  href={`/urunler?category=${category.slug}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-frozen-100 text-frozen-600 text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="font-medium text-gray-700 group-hover:text-frozen-600 transition-colors">
                      {category.name}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    {category.productCount} {texts.products}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
          
          {/* Bugünün İstatistikleri + Popüler Ürünler */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Bugünün İstatistikleri - 0 olan metrikler gizlenir */}
            {(stats.today.newProducts > 0 || stats.today.completedSwaps > 0) && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-green-500" />
                  {texts.today}
                </h3>
                <div className={`grid gap-4 ${stats.today.newProducts > 0 && stats.today.completedSwaps > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {stats.today.newProducts > 0 && (
                    <div className="text-center p-4 rounded-xl bg-blue-50">
                      <div className="text-2xl font-bold text-blue-600">
                        {stats.today.newProducts}
                      </div>
                      <div className="text-sm text-blue-600/70">{texts.newProducts}</div>
                    </div>
                  )}
                  {stats.today.completedSwaps > 0 && (
                    <div className="text-center p-4 rounded-xl bg-green-50">
                      <div className="text-2xl font-bold text-green-600">
                        {stats.today.completedSwaps}
                      </div>
                      <div className="text-sm text-green-600/70">{texts.swaps}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* En Çok İlgi Gören */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-purple-500" />
                {texts.mostViewed}
              </h3>
              <div className="space-y-2">
                {stats.popularProducts.slice(0, 3).map((product) => (
                  <Link
                    key={product.id}
                    href={`/urun/${product.id}`}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      {product.image && (
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate group-hover:text-frozen-600 transition-colors">
                        {product.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> {product.views}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" /> {product.favoriteCount}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-frozen-600">
                      {product.valorPrice} V
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
