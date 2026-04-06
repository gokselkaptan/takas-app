'use client'

import { useState, useEffect } from 'react'
import { Ban, Flag, X, Loader2 } from 'lucide-react'
import { useToast } from '@/lib/toast-context'

interface BlockReportActionsProps {
  targetUserId: string
  targetUserName?: string
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Taciz' },
  { value: 'fake_product', label: 'Sahte Ürün' },
  { value: 'fraud', label: 'Dolandırıcılık' },
  { value: 'inappropriate_content', label: 'Uygunsuz İçerik' },
  { value: 'other', label: 'Diğer' }
]

export function BlockReportActions({ targetUserId, targetUserName }: BlockReportActionsProps) {
  const [isBlocked, setIsBlocked] = useState(false)
  const [isBlockLoading, setIsBlockLoading] = useState(false)
  const [isCheckingBlock, setIsCheckingBlock] = useState(true)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [isReportLoading, setIsReportLoading] = useState(false)
  
  const { showSuccess, showError } = useToast()

  // Engel durumunu kontrol et
  useEffect(() => {
    const checkBlockStatus = async () => {
      try {
        setIsCheckingBlock(true)
        const res = await fetch(`/api/users/${targetUserId}/block`)
        const data = await res.json()
        setIsBlocked(data.isBlocked || false)
      } catch (error) {
        console.error('Block status check error:', error)
      } finally {
        setIsCheckingBlock(false)
      }
    }

    if (targetUserId) {
      checkBlockStatus()
    }
  }, [targetUserId])

  // Engelleme/engeli kaldırma
  const handleBlockToggle = async () => {
    try {
      setIsBlockLoading(true)
      
      const method = isBlocked ? 'DELETE' : 'POST'
      const res = await fetch(`/api/users/${targetUserId}/block`, { method })

      // 403 kontrolü — korumalı kullanıcı
      if (res.status === 403) {
        showError('Bu işlem gerçekleştirilemez')
        return
      }

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'İşlem başarısız')
      }

      setIsBlocked(!isBlocked)
      showSuccess(isBlocked ? 'Engel kaldırıldı' : 'Kullanıcı engellendi')
    } catch (error: any) {
      showError(error.message || 'Bir hata oluştu')
    } finally {
      setIsBlockLoading(false)
    }
  }

  // Şikayet gönder
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!reportReason) {
      showError('Lütfen bir neden seçin')
      return
    }

    try {
      setIsReportLoading(true)
      
      const res = await fetch(`/api/users/${targetUserId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reportReason,
          description: reportDescription || undefined
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Şikayet gönderilemedi')
      }

      showSuccess('Şikayetiniz alındı')
      setShowReportModal(false)
      setReportReason('')
      setReportDescription('')
    } catch (error: any) {
      showError(error.message || 'Bir hata oluştu')
    } finally {
      setIsReportLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Engelle Butonu */}
        <button
          onClick={handleBlockToggle}
          disabled={isBlockLoading || isCheckingBlock}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800"
          title={isBlocked ? 'Engeli Kaldır' : 'Engelle'}
        >
          {isBlockLoading || isCheckingBlock ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Ban className={`w-4 h-4 ${isBlocked ? 'text-red-500' : ''}`} />
          )}
          <span className="hidden sm:inline">
            {isBlocked ? 'Engeli Kaldır' : 'Engelle'}
          </span>
        </button>

        {/* Şikayet Et Butonu */}
        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Şikayet Et"
        >
          <Flag className="w-4 h-4" />
          <span className="hidden sm:inline">Şikayet Et</span>
        </button>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Kullanıcıyı Şikayet Et</h2>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {targetUserName && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {targetUserName} kullanıcısını şikayet ediyorsunuz
              </p>
            )}

            <form onSubmit={handleReportSubmit} className="space-y-4">
              {/* Neden */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Şikayet Nedeni *
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seçiniz</option>
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Açıklama */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Açıklama (Opsiyonel)
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value.slice(0, 500))}
                  placeholder="Detaylı açıklama yazabilirsiniz..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {reportDescription.length}/500 karakter
                </p>
              </div>

              {/* Butonlar */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isReportLoading || !reportReason}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isReportLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gönderiliyor...
                    </>
                  ) : (
                    'Şikayet Gönder'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
