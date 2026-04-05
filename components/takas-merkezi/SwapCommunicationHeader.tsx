'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'

interface SwapCommunicationHeaderProps {
  productTitle?: string | null
  otherUserName?: string | null
  otherUserImage?: string | null
  status?: string | null
}

const statusMap: Record<string, string> = {
  pending: '🟡 Beklemede',
  negotiating: '🔄 Pazarlık',
  accepted: '🟢 Kabul Edildi',
  completed: '✅ Tamamlandı',
  cancelled: '🔴 İptal',
  rejected: '❌ Reddedildi',
  in_transit: '📦 Yolda',
  delivered: '📬 Teslim Edildi'
}

export function SwapCommunicationHeader({
  productTitle,
  otherUserName,
  otherUserImage,
  status
}: SwapCommunicationHeaderProps) {
  const { t } = useLanguage()
  const statusText = status ? (statusMap[status] || status) : null

  return (
    <div className="border-b border-gray-700 pb-3 mb-3">
      {/* Başlık satırı */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-purple-300 font-semibold flex items-center gap-1 text-sm">
          <span>💜</span>
          <span>{t('swapCommunicationTitle')}</span>
        </h3>
        <Link
          href="/mesajlar"
          className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
        >
          💬 {t('backToMessages')} →
        </Link>
      </div>

      {/* Ürün + Karşı taraf */}
      <div className="bg-gray-800/50 rounded-xl p-2.5 space-y-1.5">
        {productTitle && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">📦</span>
            <span className="text-xs text-white font-medium truncate">{productTitle}</span>
          </div>
        )}

        {otherUserName && (
          <div className="flex items-center gap-2">
            {otherUserImage ? (
              <img src={otherUserImage} className="w-4 h-4 rounded-full object-cover" alt={otherUserName} />
            ) : (
              <span className="text-xs text-gray-400">👤</span>
            )}
            <span className="text-xs text-gray-300">{otherUserName}</span>
          </div>
        )}

        {statusText && (
          <div className="pt-1">
            <span className="text-xs text-gray-400">{statusText}</span>
          </div>
        )}
      </div>

      {/* Açıklama */}
      <p className="text-xs text-gray-400 mt-2">
        {t('swapCommunicationDesc')}
      </p>
    </div>
  )
}
