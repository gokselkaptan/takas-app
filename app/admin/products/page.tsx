'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowLeft, Search, Pencil, RefreshCw, Package, Filter, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Minus, Eye, Loader2, DollarSign, SortAsc, SortDesc
} from 'lucide-react'
import EditPriceModal from '@/components/admin/EditPriceModal'

interface ProductItem {
  id: string
  title: string
  valorPrice: number
  condition: string
  status: string
  images: string[]
  createdAt: string
  views: number
  adminEstimatedPrice: number | null
  userPriceMin: number | null
  userPriceMax: number | null
  aiValorReason: string | null
  category: { name: string } | null
  user: { name: string | null; email: string } | null
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'Sıfır',
  like_new: 'Sıfır Gibi',
  good: 'İyi',
  fair: 'Orta',
  poor: 'Kötü',
}

const PAGE_SIZE = 20

export default function AdminProductsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [sortField, setSortField] = useState<string>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [editProduct, setEditProduct] = useState<ProductItem | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/giris')
  }, [status, router])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
        status: statusFilter,
        sort: sortField,
        dir: sortDir,
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/admin/products?${params}`)
      if (!res.ok) throw new Error('Ürünler yüklenemedi')
      const data = await res.json()
      setProducts(data.products || [])
      setTotalCount(data.total || 0)
    } catch (err) {
      console.error('Ürün listesi hatası:', err)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, sortField, sortDir, searchQuery])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProducts()
    }
  }, [status, fetchProducts])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
    setPage(1)
  }

  const handleSearch = () => {
    setPage(1)
    fetchProducts()
  }

  const handleEditSuccess = (productId: string, newValor: number, adminPrice: number | null) => {
    setProducts(prev => prev.map(p =>
      p.id === productId
        ? { ...p, valorPrice: newValor, adminEstimatedPrice: adminPrice }
        : p
    ))
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const formatTL = (val: number) => val.toLocaleString('tr-TR') + ' ₺'

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-6 h-6 text-blue-500" /> Ürün Yönetimi
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {totalCount} ürün · Fiyat düzenle ve Valor hesapla
              </p>
            </div>
          </div>
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ürün adı veya kullanıcı ara..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="active">Aktif</option>
              <option value="swapped">Takas Edildi</option>
              <option value="deleted">Silindi</option>
              <option value="all">Tümü</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm font-medium"
            >
              <Filter className="w-4 h-4 inline mr-1" /> Filtrele
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Ürün</th>
                  <th
                    className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-blue-500 transition"
                    onClick={() => handleSort('valorPrice')}
                  >
                    <span className="flex items-center justify-center gap-1">
                      Valor
                      {sortField === 'valorPrice' && (sortDir === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </span>
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-400">Fiyat Kaynağı</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-400">Durum</th>
                  <th
                    className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-blue-500 transition"
                    onClick={() => handleSort('views')}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <Eye className="w-3 h-3" />
                      {sortField === 'views' && (sortDir === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </span>
                  </th>
                  <th
                    className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-blue-500 transition"
                    onClick={() => handleSort('createdAt')}
                  >
                    <span className="flex items-center justify-center gap-1">
                      Tarih
                      {sortField === 'createdAt' && (sortDir === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </span>
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-400">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                      <p className="text-sm text-gray-500 mt-2">Ürünler yükleniyor...</p>
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Package className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">Ürün bulunamadı</p>
                    </td>
                  </tr>
                ) : products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    {/* Ürün */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 m-2.5 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[250px]">
                            {product.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {product.category?.name || 'Genel'} · {product.user?.name || product.user?.email || '?'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Valor */}
                    <td className="text-center px-3 py-3">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{product.valorPrice}V</span>
                    </td>

                    {/* Fiyat Kaynağı */}
                    <td className="text-center px-3 py-3">
                      <div className="space-y-0.5">
                        {product.adminEstimatedPrice && (
                          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 font-medium">
                            🔧 {formatTL(product.adminEstimatedPrice)}
                          </span>
                        )}
                        {(product.userPriceMin || product.userPriceMax) && (
                          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400">
                            👤 {product.userPriceMin ? formatTL(product.userPriceMin) : '?'} - {product.userPriceMax ? formatTL(product.userPriceMax) : '?'}
                          </span>
                        )}
                        {!product.adminEstimatedPrice && !product.userPriceMin && !product.userPriceMax && (
                          <span className="text-xs text-gray-400">AI/Brave</span>
                        )}
                      </div>
                    </td>

                    {/* Durum */}
                    <td className="text-center px-3 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{
                        backgroundColor: product.condition === 'new' ? '#dcfce7' : product.condition === 'like_new' ? '#dbeafe' : product.condition === 'good' ? '#fef9c3' : '#fecaca',
                        color: product.condition === 'new' ? '#166534' : product.condition === 'like_new' ? '#1e40af' : product.condition === 'good' ? '#854d0e' : '#991b1b',
                      }}>
                        {CONDITION_LABELS[product.condition] || product.condition}
                      </span>
                    </td>

                    {/* Görüntüleme */}
                    <td className="text-center px-3 py-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{product.views}</span>
                    </td>

                    {/* Tarih */}
                    <td className="text-center px-3 py-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(product.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    </td>

                    {/* İşlem */}
                    <td className="text-center px-3 py-3">
                      <button
                        onClick={() => setEditProduct(product)}
                        className="p-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg transition"
                        title="Piyasa Fiyatı Düzenle"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sayfa {page} / {totalPages} · Toplam {totalCount} ürün
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editProduct && (
        <EditPriceModal
          product={editProduct}
          isOpen={!!editProduct}
          onClose={() => setEditProduct(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  )
}
