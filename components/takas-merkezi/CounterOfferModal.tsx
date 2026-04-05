'use client'

import { useState, useEffect } from 'react'

interface CounterOfferModalProps {
  isOpen: boolean
  swapRequestId: string
  currentPrice?: number
  productTitle?: string
  onClose: () => void
  onSuccess: () => void
}

export function CounterOfferModal({
  isOpen,
  swapRequestId,
  currentPrice,
  productTitle,
  onClose,
  onSuccess
}: CounterOfferModalProps) {
  const [price, setPrice] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal açılınca price ve error sıfırla
  useEffect(() => {
    if (isOpen) {
      setPrice(currentPrice?.toString() || '')
      setError(null)
    }
  }, [isOpen, currentPrice])

  if (!isOpen) return null

  // Loading varsa kapatmayı engelle
  const handleClose = () => {
    if (!loading) onClose()
  }

  const handleSubmit = async () => {
    const numPrice = parseInt(price)
    if (!numPrice || numPrice <= 0) {
      setError('Geçerli bir fiyat girin')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/swap-requests/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapId: swapRequestId,
          action: 'counter',
          proposedPrice: numPrice
        })
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Bir hata oluştu')
        return
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError('Bağlantı hatası')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold">💰 Karşı Teklif</h3>
            {productTitle && (
              <p className="text-xs text-gray-400 mt-0.5">📦 {productTitle}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-white text-xl disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Mevcut fiyat */}
        {currentPrice != null && currentPrice > 0 && (
          <div className="bg-gray-800 rounded-xl px-4 py-2 mb-4 flex items-center justify-between">
            <span className="text-xs text-gray-400">Mevcut teklif:</span>
            <span className="text-yellow-400 font-bold">{currentPrice} V</span>
          </div>
        )}

        {/* Fiyat girişi */}
        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-2 block">
            Yeni teklifiniz (VALOR)
          </label>
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              min="1"
              className="flex-1 bg-transparent text-white text-lg font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
            />
            <span className="text-yellow-400 font-medium text-sm">V</span>
          </div>
        </div>

        {/* Hata */}
        {error && (
          <p className="text-red-400 text-xs mb-3">{error}</p>
        )}

        {/* Butonlar */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50 transition text-sm"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !price}
            className="flex-1 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium transition text-sm"
          >
            {loading ? '...' : '💰 Teklif Gönder'}
          </button>
        </div>
      </div>
    </div>
  )
}
