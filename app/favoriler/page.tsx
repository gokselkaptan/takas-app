'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Package, Loader2, Trash2, Eye } from 'lucide-react'
import { FavoriteButton } from '@/components/favorite-button'
import { useLanguage } from '@/lib/language-context'

interface Product {
  id: string
  title: string
  images: string[]
  valorPrice: number
  condition: string
  category: { name: string }
  user: { name: string }
}

export default function FavorilerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t } = useLanguage()
  const [favorites, setFavorites] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/giris')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user) {
      fetchFavorites()
    }
  }, [session])

  const fetchFavorites = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/favorites')
      if (res.ok) {
        const data = await res.json()
        setFavorites(data.favorites || [])
      }
    } catch (error) {
      console.error('Favoriler yüklenemedi:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveFavorite = async (productId: string) => {
    try {
      const res = await fetch('/api/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      })
      if (res.ok) {
        setFavorites(prev => prev.filter(f => f.id !== productId))
      }
    } catch (error) {
      console.error('Favori kaldırılamadı:', error)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen pt-16 pb-24 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-16 pb-24 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Heart className="w-8 h-8 fill-white" />
            <div>
              <h1 className="text-2xl font-bold">Favorilerim</h1>
              <p className="text-white/80 text-sm">{favorites.length} ürün</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {favorites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <Heart className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Henüz favori ürün yok
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Beğendiğin ürünleri favorilere ekle, sonra kolayca ulaş!
            </p>
            <Link
              href="/urunler"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              <Package className="w-5 h-5" />
              {t('exploreProducts')}
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <AnimatePresence>
              {favorites.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  <Link href={`/urun/${product.id}`} className="block">
                    <div className="relative aspect-square">
                      <Image
                        src={product.images?.[0] || '/images/placeholder.jpg'}
                        alt={product.title}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute top-2 right-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleRemoveFavorite(product.id)
                          }}
                          className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2 mb-1">
                        {product.title}
                      </h3>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {product.category?.name}
                        </span>
                        <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                          {product.valorPrice} V
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
