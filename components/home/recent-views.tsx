'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock, ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface RecentProduct {
  id: string
  title: string
  valorPrice: number
  image: string
  viewedAt: number
}

const STORAGE_KEY = 'takas_recent_views'
const MAX_ITEMS = 10

export function addToRecentViews(product: { id: string; title: string; valorPrice: number; images: string[] }) {
  if (typeof window === 'undefined') return
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    let items: RecentProduct[] = stored ? JSON.parse(stored) : []
    
    // Mevcut öğeyi kaldır
    items = items.filter(item => item.id !== product.id)
    
    // Başa ekle
    items.unshift({
      id: product.id,
      title: product.title,
      valorPrice: product.valorPrice,
      image: product.images[0] || '/images/placeholder.jpg',
      viewedAt: Date.now()
    })
    
    // Max sayıyı aşma
    if (items.length > MAX_ITEMS) {
      items = items.slice(0, MAX_ITEMS)
    }
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (quotaError) {
      // QuotaExceededError: localStorage dolu - eski verileri temizle ve tekrar dene
      try {
        // Sadece son 5 öğeyi tut
        items = items.slice(0, 5)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
      } catch {
        // Hala başarısızsa sessizce geç
      }
    }
  } catch {
    // JSON parse hatası veya diğer hatalar - sessizce geç
  }
}

export function RecentViews() {
  const [items, setItems] = useState<RecentProduct[]>([])
  const [scrollPosition, setScrollPosition] = useState(0)
  const [maxScroll, setMaxScroll] = useState(0)
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setItems(parsed)
        // Max scroll hesapla (her kart ~180px)
        setMaxScroll(Math.max(0, (parsed.length - 4) * 180))
      }
    } catch (error) {
      console.error('Error loading recent views:', error)
    }
  }, [])
  
  if (items.length === 0) {
    return null
  }
  
  const scroll = (direction: 'left' | 'right') => {
    const scrollAmount = 360
    if (direction === 'left') {
      setScrollPosition(Math.max(0, scrollPosition - scrollAmount))
    } else {
      setScrollPosition(Math.min(maxScroll, scrollPosition + scrollAmount))
    }
  }
  
  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (days > 0) return `${days} gün önce`
    if (hours > 0) return `${hours} saat önce`
    if (minutes > 0) return `${minutes} dk önce`
    return 'Az önce'
  }
  
  return (
    <section className="py-12 bg-white dark:bg-gray-900">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Son Görüntülenenler</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">İncelediğin ürünlere hızlıca eriş</p>
            </div>
          </div>
          
          {items.length > 4 && (
            <div className="flex gap-2">
              <button
                onClick={() => scroll('left')}
                disabled={scrollPosition === 0}
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={() => scroll('right')}
                disabled={scrollPosition >= maxScroll}
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          )}
        </div>
        
        <div className="overflow-hidden">
          <motion.div
            className="flex gap-4"
            animate={{ x: -scrollPosition }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {items.map((item, index) => (
              <Link
                key={item.id}
                href={`/urun/${item.id}`}
                className="flex-shrink-0 w-[170px] group"
              >
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="relative aspect-square">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
                      <span className="text-xs font-semibold text-frozen-600 dark:text-frozen-400">
                        {item.valorPrice} V
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-1 group-hover:text-frozen-600 dark:group-hover:text-frozen-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatTimeAgo(item.viewedAt)}
                    </p>
                  </div>
                </motion.div>
              </Link>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
