'use client'

import { useState } from 'react'

interface MobileSwapActionBarProps {
  swapRequestId: string
  status: string
  isReceiverSide: boolean  // teklifi alan taraf mı? (kabul/reddet yapacak kişi)
  onAction: (action: string, swapRequestId: string) => void | Promise<void>  // async destekli
  className?: string
}

type ActionButton = {
  label: string
  emoji: string
  style: string
  action: string
}

const getActionsByStatus = (status: string, isReceiverSide: boolean): ActionButton[] => {
  switch (status) {
    case 'pending':
      if (isReceiverSide) {
        return [
          { label: 'Kabul Et',     emoji: '✅', style: 'bg-green-600 hover:bg-green-700',   action: 'accept'  },
          { label: 'Karşı Teklif', emoji: '💰', style: 'bg-yellow-600 hover:bg-yellow-700', action: 'counter' },
          { label: 'Reddet',       emoji: '❌', style: 'bg-red-600 hover:bg-red-700',        action: 'reject'  },
        ]
      }
      return [
        { label: 'İptal Et', emoji: '🔴', style: 'bg-red-600 hover:bg-red-700', action: 'cancel' },
      ]

    case 'negotiating':
      return [
        { label: 'Kabul Et',    emoji: '✅', style: 'bg-green-600 hover:bg-green-700',   action: 'accept'  },
        { label: 'Yeni Teklif', emoji: '💰', style: 'bg-yellow-600 hover:bg-yellow-700', action: 'counter' },
        { label: 'İptal Et',    emoji: '🔴', style: 'bg-red-600 hover:bg-red-700',        action: 'cancel'  },
      ]

    case 'accepted':
      return [
        { label: 'Teslimat Ayarla', emoji: '📦', style: 'bg-blue-600 hover:bg-blue-700',  action: 'delivery' },
        { label: 'İptal Et',        emoji: '🔴', style: 'bg-red-600/80 hover:bg-red-700', action: 'cancel'   },
      ]

    case 'in_transit':
      return [
        { label: 'Teslim Aldım', emoji: '📬', style: 'bg-green-600 hover:bg-green-700',    action: 'confirm_delivery' },
        { label: 'QR Doğrula',   emoji: '📱', style: 'bg-indigo-600 hover:bg-indigo-700',  action: 'qr_verify'        },
      ]

    case 'completed':
      return [
        { label: 'Takas Geçmişi', emoji: '🏆', style: 'bg-gray-600 hover:bg-gray-700', action: 'history' },
      ]

    default:
      return []
  }
}

export function MobileSwapActionBar({
  swapRequestId,
  status,
  isReceiverSide,
  onAction,
  className = ''
}: MobileSwapActionBarProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const actions = getActionsByStatus(status, isReceiverSide)

  const handleClick = async (action: string) => {
    if (loadingAction) return
    setLoadingAction(action)
    try {
      await onAction(action, swapRequestId)
    } finally {
      setLoadingAction(null)
    }
  }

  if (actions.length === 0) return null

  return (
    <div className={`
      fixed bottom-0 left-0 right-0 z-50
      bg-gray-900/95 backdrop-blur-sm
      border-t border-gray-700
      px-4 py-3
      pb-[calc(env(safe-area-inset-bottom)+12px)]
      flex gap-2
      md:hidden
      ${className}
    `}>
      {actions.map((action) => (
        <button
          key={action.action}
          onClick={() => handleClick(action.action)}
          disabled={loadingAction === action.action}
          className={`
            flex-1 flex items-center justify-center gap-1.5
            ${action.style}
            text-white text-sm font-medium
            py-2.5 px-3 rounded-xl
            transition-all active:scale-95
            disabled:opacity-60 disabled:cursor-not-allowed
          `}
        >
          <span>{action.emoji}</span>
          <span className="truncate">
            {loadingAction === action.action ? '...' : action.label}
          </span>
        </button>
      ))}
    </div>
  )
}
