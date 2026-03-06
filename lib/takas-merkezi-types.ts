// ═══ TAKAS MERKEZİ TYPE DEFINITIONS ═══

export interface SwapParticipant {
  userId: string
  userName: string
  productId: string
  productTitle: string
  productImage: string | null
  productValorPrice: number
  productLocation: string | null
  wantsProductId: string
  wantsProductOwnerId: string
  wantsProductValorPrice: number
}

export interface SwapChain {
  participants: SwapParticipant[]
  chainLength: number
  isValueBalanced: boolean
  valueBalanceScore: number
  locationScore: number
  totalScore: number
  averageValorPrice: number
  valueDifference: number
}

export interface SwapStats {
  totalFound: number
  balanced: number
  unbalanced: number
  averageScore: number
}

export interface MultiSwap {
  id: string
  status: string
  createdAt: string
  participants: {
    id: string
    userId: string
    confirmed: boolean
    user: { id: string; name: string | null; image: string | null }
    givesProduct: { id: string; title: string; images: string[]; valorPrice: number }
  }[]
}

export interface PendingSwapRequest {
  id: string
  productId: string
  message: string | null
  status: string
  createdAt: string
  qrCode?: string | null
  qrCodeB?: string | null
  customLocation?: string | null
  deliveryMethod?: string | null
  deliveryPointId?: string | null
  deliveryPoint?: { id: string; name: string; address: string } | null
  requesterId: string
  ownerId: string
  lastProposedBy?: string | null
  pendingValorAmount?: number | null
  agreedPriceRequester?: number | null
  ownerArrived?: boolean
  requesterArrived?: boolean
  ownerReceivedProduct?: boolean
  requesterReceivedProduct?: boolean
  deliveryType?: string | null
  dropOffDeadline?: string | null
  droppedOffAt?: string | null
  pickedUpAt?: string | null
  packagingPhotos?: string[]
  deliveryPhotos?: string[]
  receivingPhotos?: string[]
  disputeWindowEndsAt?: string | null
  product: {
    id: string
    title: string
    images: string[]
    valorPrice: number
    user: { id: string; name: string | null }
  }
  requester: { id: string; name: string | null; email: string; image?: string | null }
  offeredProduct?: {
    id: string
    title: string
    images: string[]
    valorPrice: number
  } | null
}

export interface Message {
  id: string
  content: string
  senderId: string
  receiverId: string
  createdAt: string
  isRead: boolean
  imageUrl?: string | null
  swapRequestId?: string | null
}

export interface DeliveryPoint {
  id: string
  name: string
  address: string
}

// ═══ 10 ADIMLI TAKAS AKIŞI — İKİ YÖNTEMLİ ═══

// BULUŞMA (face_to_face)
export const SWAP_STEPS_FACE_TO_FACE = [
  { key: 'pending',           label: 'Teklif Gönderildi',           icon: '📩', shortLabel: 'Teklif' },
  { key: 'negotiating',       label: 'Pazarlık',                    icon: '💬', shortLabel: 'Pazarlık' },
  { key: 'accepted',          label: 'Anlaşma Sağlandı',            icon: '🤝', shortLabel: 'Anlaşma' },
  { key: 'delivery_proposed', label: 'Buluşma Noktası Önerildi',    icon: '📍', shortLabel: 'Konum' },
  { key: 'qr_generated',      label: 'Buluşma Planlandı',           icon: '📱', shortLabel: 'QR Kod' },
  { key: 'arrived',           label: 'İki Taraf da Geldi',          icon: '🚶', shortLabel: 'Varış' },
  { key: 'qr_scanned',        label: 'QR Kod Okutuldu',             icon: '✅', shortLabel: 'Taratıldı' },
  { key: 'inspection',        label: 'Ürün Kontrol Ediliyor',       icon: '🔍', shortLabel: 'Kontrol' },
  { key: 'code_sent',         label: '6 Haneli Kod İletildi',       icon: '🔑', shortLabel: 'Kod' },
  { key: 'completed',         label: 'Takas Tamamlandı',            icon: '🎉', shortLabel: 'Tamam' },
]

// TESLİM NOKTASINA BIRAKMA (drop_off)
export const SWAP_STEPS_DROP_OFF = [
  { key: 'pending',           label: 'Teklif Gönderildi',           icon: '📩', shortLabel: 'Teklif' },
  { key: 'negotiating',       label: 'Pazarlık',                    icon: '💬', shortLabel: 'Pazarlık' },
  { key: 'accepted',          label: 'Anlaşma Sağlandı',            icon: '🤝', shortLabel: 'Anlaşma' },
  { key: 'delivery_proposed', label: 'Teslim Noktası Belirlendi',   icon: '📍', shortLabel: 'Nokta' },
  { key: 'qr_generated',      label: 'Teslim Planlandı',            icon: '📱', shortLabel: 'QR Kod' },
  { key: 'dropped_off',       label: 'Ürün Bırakıldı',              icon: '📦', shortLabel: 'Bırakıldı' },
  { key: 'qr_scanned',        label: 'Ürün Alındı',                 icon: '✅', shortLabel: 'Alındı' },
  { key: 'inspection',        label: 'Ürün Kontrol Ediliyor',       icon: '🔍', shortLabel: 'Kontrol' },
  { key: 'completed',         label: 'Takas Tamamlandı',            icon: '🎉', shortLabel: 'Tamam' },
]

export function getSwapSteps(deliveryType?: string | null) {
  return deliveryType === 'drop_off' ? SWAP_STEPS_DROP_OFF : SWAP_STEPS_FACE_TO_FACE
}

export function getStepIndex(status: string, deliveryType?: string | null): number {
  const steps = getSwapSteps(deliveryType)
  const idx = steps.findIndex(s => s.key === status)
  return idx >= 0 ? idx : 0
}

// Status badge colors
export function getStatusBadge(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'pending':
      return { label: 'Bekliyor', color: 'text-yellow-700', bg: 'bg-yellow-100' }
    case 'negotiating':
      return { label: 'Pazarlık', color: 'text-blue-700', bg: 'bg-blue-100' }
    case 'accepted':
    case 'delivery_proposed':
    case 'qr_generated':
    case 'arrived':
    case 'qr_scanned':
    case 'inspection':
    case 'code_sent':
    case 'dropped_off':
      return { label: 'Aktif', color: 'text-green-700', bg: 'bg-green-100' }
    case 'completed':
      return { label: 'Tamamlandı', color: 'text-emerald-700', bg: 'bg-emerald-100' }
    case 'rejected':
    case 'cancelled':
      return { label: 'İptal', color: 'text-red-700', bg: 'bg-red-100' }
    case 'disputed':
      return { label: 'Sorunlu', color: 'text-orange-700', bg: 'bg-orange-100' }
    default:
      return { label: status, color: 'text-gray-700', bg: 'bg-gray-100' }
  }
}

// Active statuses
export const ACTIVE_STATUSES = [
  'accepted', 'delivery_proposed', 'qr_generated', 'arrived',
  'qr_scanned', 'inspection', 'code_sent', 'dropped_off'
]

// Filter types for swap list
export type SwapFilter = 'offers' | 'active' | 'multi' | 'completed'
