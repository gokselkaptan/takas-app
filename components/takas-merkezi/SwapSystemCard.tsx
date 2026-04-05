'use client'

// Future-proof type safety
type SwapSystemType =
  | 'swap_request'
  | 'price_proposal'
  | 'price_agreed'
  | 'price_accepted'
  | 'swap_accepted'
  | 'swap_confirmed'
  | 'swap_completed'
  | 'swap_rejected'
  | 'swap_cancelled'
  | 'delivery_date_proposal'
  | 'delivery_date_accepted'
  | 'verification_code'
  | 'qr_code_info'

interface SwapSystemCardProps {
  content: string
  type?: SwapSystemType | string
  createdAt: string
}

const typeConfig: Record<string, { bg: string; border: string; label: string; emoji: string }> = {
  swap_request:           { bg: 'bg-purple-900/20', border: 'border-purple-500/30', label: 'Takas Talebi',      emoji: '💜' },
  price_proposal:         { bg: 'bg-yellow-900/20', border: 'border-yellow-500/30', label: 'Fiyat Teklifi',     emoji: '💰' },
  price_agreed:           { bg: 'bg-green-900/20',  border: 'border-green-500/30',  label: 'Fiyat Anlaşması',   emoji: '🤝' },
  price_accepted:         { bg: 'bg-green-900/20',  border: 'border-green-500/30',  label: 'Fiyat Kabul',       emoji: '✅' },
  swap_accepted:          { bg: 'bg-green-900/20',  border: 'border-green-500/30',  label: 'Takas Kabul',       emoji: '🟢' },
  swap_confirmed:         { bg: 'bg-blue-900/20',   border: 'border-blue-500/30',   label: 'Takas Onaylandı',   emoji: '🔵' },
  swap_completed:         { bg: 'bg-green-900/20',  border: 'border-green-500/30',  label: 'Takas Tamamlandı',  emoji: '🎉' },
  swap_rejected:          { bg: 'bg-red-900/20',    border: 'border-red-500/30',    label: 'Reddedildi',        emoji: '❌' },
  swap_cancelled:         { bg: 'bg-red-900/20',    border: 'border-red-500/30',    label: 'İptal Edildi',      emoji: '🔴' },
  delivery_date_proposal: { bg: 'bg-blue-900/20',   border: 'border-blue-500/30',   label: 'Teslimat Teklifi',  emoji: '📅' },
  delivery_date_accepted: { bg: 'bg-blue-900/20',   border: 'border-blue-500/30',   label: 'Teslimat Onayı',    emoji: '📦' },
  verification_code:      { bg: 'bg-indigo-900/20', border: 'border-indigo-500/30', label: 'Doğrulama Kodu',    emoji: '🔑' },
  qr_code_info:           { bg: 'bg-indigo-900/20', border: 'border-indigo-500/30', label: 'QR Kod',            emoji: '📱' },
}

const defaultConfig = { bg: 'bg-gray-800/50', border: 'border-gray-600/30', label: 'Sistem', emoji: '⚙️' }

export function SwapSystemCard({ content, type, createdAt }: SwapSystemCardProps) {
  const config = (type && typeConfig[type]) ? typeConfig[type] : defaultConfig

  return (
    <div className="flex justify-center my-2">
      <div className={`${config.bg} border ${config.border} rounded-xl px-3 py-2 max-w-[80%] sm:max-w-[70%]`}>
        <div className="flex items-center gap-1 mb-1 justify-center">
          <span className="text-xs">{config.emoji}</span>
          <span className="text-xs text-gray-400 font-medium">{config.label}</span>
        </div>
        <p className="text-xs text-gray-300 text-center whitespace-pre-line">{content}</p>
        <p className="text-xs text-gray-500 text-center mt-1">
          {new Date(createdAt).toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  )
}
