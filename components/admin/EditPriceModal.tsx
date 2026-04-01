'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, DollarSign, Calculator, Loader2, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface ProductForModal {
  id: string
  title: string
  valorPrice: number
  condition: string
  adminEstimatedPrice: number | null
  userPriceMin: number | null
  userPriceMax: number | null
  category?: { name: string } | null
  aiValorReason?: string | null
}

interface RevalueResult {
  success: boolean
  valorScore: number
  oldValor: number
  newValor: number
  changePercent: string
  product: {
    estimatedTL: number
    priceSource: string
  }
  assessment: {
    formula: string
    humanExplanation: string
  }
}

interface EditPriceModalProps {
  product: ProductForModal
  isOpen: boolean
  onClose: () => void
  onSuccess: (productId: string, newValor: number, adminPrice: number | null) => void
}

export default function EditPriceModal({ product, isOpen, onClose, onSuccess }: EditPriceModalProps) {
  const [price, setPrice] = useState<string>(product.adminEstimatedPrice?.toString() || '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RevalueResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const body: any = { productId: product.id }
      if (price && parseInt(price) > 0) {
        body.adminEstimatedPrice = parseInt(price)
      }

      const res = await fetch('/api/admin/revalue-single-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bir hata oluştu')

      setResult(data)
      onSuccess(product.id, data.newValor, body.adminEstimatedPrice || null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClearAdminPrice = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/admin/revalue-single-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, adminEstimatedPrice: null }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bir hata oluştu')

      setPrice('')
      setResult(data)
      onSuccess(product.id, data.newValor, null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatTL = (val: number) => val.toLocaleString('tr-TR') + ' ₺'

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">💰 Piyasa Fiyatı Düzenle</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate max-w-[350px]">{product.title}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-5">
            {/* Mevcut Değerler */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Mevcut Valor</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{product.valorPrice} V</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-3">
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Kategori</p>
                <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">{product.category?.name || 'Genel'}</p>
                <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">Durum: {product.condition}</p>
              </div>
            </div>

            {/* Kullanıcı Tahmini */}
            {(product.userPriceMin || product.userPriceMax) && (
              <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-3">
                <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">👤 Kullanıcı Tahmini</p>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                  {product.userPriceMin ? formatTL(product.userPriceMin) : '?'} — {product.userPriceMax ? formatTL(product.userPriceMax) : '?'}
                </p>
              </div>
            )}

            {/* Mevcut Admin Fiyatı */}
            {product.adminEstimatedPrice && (
              <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">🔧 Mevcut Admin Fiyatı</p>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{formatTL(product.adminEstimatedPrice)}</p>
                </div>
                <button
                  onClick={handleClearAdminPrice}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/70 transition font-medium"
                >
                  Sıfırla
                </button>
              </div>
            )}

            {/* Fiyat Girişi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Piyasa Fiyatı (TL)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Örn: 25000"
                  min="1"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₺</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                💡 Boş bırakırsanız otomatik fiyat tahmini (Brave+AI) kullanılır
              </p>
            </div>

            {/* Hata */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Sonuç */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Valor Güncellendi!</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Eski</p>
                    <p className="text-lg font-bold text-gray-600 dark:text-gray-300">{result.oldValor}V</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Yeni</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{result.newValor}V</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Değişim</p>
                    <p className={`text-lg font-bold ${result.newValor > result.oldValor ? 'text-green-500' : result.newValor < result.oldValor ? 'text-red-500' : 'text-gray-500'}`}>
                      {result.changePercent}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                  <p>📊 Kaynak: <span className="font-medium">{result.product.priceSource}</span></p>
                  <p>💰 Tahmini TL: <span className="font-medium">{formatTL(result.product.estimatedTL)}</span></p>
                  <p>📐 {result.assessment.humanExplanation}</p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Kapat
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Hesaplanıyor...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  Kaydet ve Valor Hesapla
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
