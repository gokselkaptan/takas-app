/**
 * TAKAS-A Swap Sistem Konfigürasyonu
 * 
 * Tüm takas ile ilgili sabitler ve ayarlar burada merkezi olarak tutulur.
 * Environment variable override'ları desteklenir.
 */

// ============= ZAMAN AYARLARI =============

/** Dispute penceresi - teslim sonrası itiraz süresi (saat) */
export const DISPUTE_WINDOW_HOURS = parseInt(process.env.DISPUTE_WINDOW_HOURS || '48')

/** Kilit zaman aşımı - depozito ne kadar süre kilitli kalır (saat) */
export const LOCK_TIMEOUT_HOURS = parseInt(process.env.LOCK_TIMEOUT_HOURS || '48')

/** QR kod geçerlilik süresi (saat) */
export const QR_CODE_VALIDITY_HOURS = parseInt(process.env.QR_CODE_VALIDITY_HOURS || '72')

/** Doğrulama kodu geçerlilik süresi (saat) */
export const VERIFICATION_CODE_VALIDITY_HOURS = parseInt(process.env.VERIFICATION_CODE_VALIDITY_HOURS || '24')

// ============= AUTO-COMPLETE AYARLARI =============

/** Düşük riskli ürünlerde otomatik tamamlama aktif mi */
export const AUTO_COMPLETE_LOW_RISK = process.env.AUTO_COMPLETE_LOW_RISK !== 'false'

/** Auto-complete için minimum bekleme süresi (dispute window sonrası, saat) */
export const AUTO_COMPLETE_DELAY_HOURS = parseInt(process.env.AUTO_COMPLETE_DELAY_HOURS || '0')

// ============= SİGORTA HAVUZU AYARLARI =============

/** Temel prim oranı (takas değerinin yüzdesi) */
export const PREMIUM_RATE_BASE = parseFloat(process.env.PREMIUM_RATE_BASE || '0.015')

/** Minimum prim oranı */
export const PREMIUM_RATE_MIN = parseFloat(process.env.PREMIUM_RATE_MIN || '0.01')

/** Maksimum prim oranı */
export const PREMIUM_RATE_MAX = parseFloat(process.env.PREMIUM_RATE_MAX || '0.03')

/** 30 günlük hedef rezerv oranı */
export const TARGET_RESERVE_RATIO_30D = parseFloat(process.env.TARGET_RESERVE_RATIO_30D || '0.05')

/** Havuz yeniden dengeleme adımı (oran değişimi) */
export const POOL_REBALANCE_STEP = parseFloat(process.env.POOL_REBALANCE_STEP || '0.0025')

// ============= RİSK SEVİYELERİ =============

export type RiskTier = 'low' | 'medium' | 'high'

/** Risk seviyesi eşikleri (Valor cinsinden) */
export const RISK_TIER_THRESHOLDS = {
  LOW_MAX: parseInt(process.env.RISK_LOW_MAX || '100'),      // 0-100 Valor = düşük risk
  MEDIUM_MAX: parseInt(process.env.RISK_MEDIUM_MAX || '500'), // 101-500 Valor = orta risk
  // 500+ Valor = yüksek risk
}

/** Ürün kategorisine göre risk çarpanı */
export const CATEGORY_RISK_MULTIPLIERS: Record<string, number> = {
  'Elektronik': 1.5,
  'Bilgisayar': 1.5,
  'Telefon': 1.5,
  'Oyun Konsolu': 1.3,
  'Mücevher': 2.0,
  'Saat': 1.5,
  'Antika': 2.0,
  'Sanat': 2.0,
  'default': 1.0
}

// ============= ESCROW AYARLARI =============

/** Escrow durumları */
export const ESCROW_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  LOCKED: 'locked',
  RELEASED: 'released',
  DISPUTED: 'disputed',
  SETTLED: 'settled',
  REFUNDED: 'refunded'
} as const

export type EscrowStatus = typeof ESCROW_STATUS[keyof typeof ESCROW_STATUS]

// ============= SWAP DURUMLARI =============

/** Tüm swap durumları */
export const SWAP_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  IN_DELIVERY: 'in_delivery',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
  RESOLVED: 'resolved'
} as const

export type SwapStatus = typeof SWAP_STATUS[keyof typeof SWAP_STATUS]

/** Geçerli durum geçişleri */
export const VALID_TRANSITIONS: Record<SwapStatus, SwapStatus[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['in_delivery', 'delivered', 'completed', 'cancelled', 'disputed'],
  rejected: [], // Final state
  in_delivery: ['delivered', 'disputed'],
  delivered: ['completed', 'disputed'],
  completed: [], // Final state
  cancelled: [], // Final state
  disputed: ['resolved', 'completed', 'cancelled'],
  resolved: ['completed', 'cancelled']
}

// ============= NEGOTİASYON AYARLARI =============

/** Pazarlık durumları */
export const NEGOTIATION_STATUS = {
  CHATTING: 'chatting',
  PRICE_PROPOSED: 'price_proposed',
  PRICE_AGREED: 'price_agreed',
  CANCELLED: 'cancelled'
} as const

export type NegotiationStatus = typeof NEGOTIATION_STATUS[keyof typeof NEGOTIATION_STATUS]

// ============= CLAIM TÜRLERİ =============

/** İzin verilen claim sebepleri */
export const ALLOWED_CLAIM_REASONS = [
  'CARRIER_LOST',
  'CARRIER_DAMAGED',
  'SYSTEM_ERROR',
  'CHAIN_BREAK_COMPENSATION'
] as const

export type ClaimReason = typeof ALLOWED_CLAIM_REASONS[number]

// ============= YARDIMCI FONKSİYONLAR =============

/**
 * Ürün değerine göre risk seviyesini hesapla
 */
export function calculateRiskTier(valorAmount: number, categoryName?: string): RiskTier {
  const multiplier = categoryName 
    ? (CATEGORY_RISK_MULTIPLIERS[categoryName] || CATEGORY_RISK_MULTIPLIERS['default'])
    : 1.0
  
  const effectiveAmount = valorAmount * multiplier
  
  if (effectiveAmount <= RISK_TIER_THRESHOLDS.LOW_MAX) return 'low'
  if (effectiveAmount <= RISK_TIER_THRESHOLDS.MEDIUM_MAX) return 'medium'
  return 'high'
}

/**
 * Trust score'a göre prim oranı hesapla
 */
export function calculatePremiumRate(trustScore: number): number {
  let riskAdjustment = 0
  
  if (trustScore >= 90) {
    riskAdjustment = -0.005 // Yüksek güven = düşük prim
  } else if (trustScore >= 70) {
    riskAdjustment = 0
  } else {
    riskAdjustment = 0.01 // Düşük güven = yüksek prim
  }
  
  const rate = PREMIUM_RATE_BASE + riskAdjustment
  return Math.min(PREMIUM_RATE_MAX, Math.max(PREMIUM_RATE_MIN, rate))
}

/**
 * Dispute window bitiş zamanını hesapla
 */
export function calculateDisputeWindowEnd(deliveredAt: Date): Date {
  const endTime = new Date(deliveredAt)
  endTime.setHours(endTime.getHours() + DISPUTE_WINDOW_HOURS)
  return endTime
}

/**
 * Auto-complete için uygun mu kontrol et
 */
export function canAutoComplete(swap: {
  riskTier: RiskTier
  disputeOpened: boolean
  disputeWindowEndsAt: Date | null
}): boolean {
  // Yüksek riskli ürünlerde auto-complete yok
  if (swap.riskTier !== 'low' && !AUTO_COMPLETE_LOW_RISK) {
    return false
  }
  
  // Dispute açılmışsa auto-complete yok
  if (swap.disputeOpened) {
    return false
  }
  
  // Dispute window henüz bitmemişse auto-complete yok
  if (!swap.disputeWindowEndsAt || new Date() < swap.disputeWindowEndsAt) {
    return false
  }
  
  return true
}

/**
 * Durum geçişi geçerli mi kontrol et
 */
export function isValidTransition(currentStatus: SwapStatus, newStatus: SwapStatus): boolean {
  const validNextStates = VALID_TRANSITIONS[currentStatus] || []
  return validNextStates.includes(newStatus)
}

// ============= GÜVEN SKORU AYARLARI (CEZA FELSEFESİ) =============
// 100 = Tam güven (başlangıç). Güven KAZANILMAZ — kaybedilir.
// Her kullanıcı 100 ile başlar. Kötü davranış güveni düşürür.
// İyi davranış güveni GERİ GETİRİR (ama 100'ü ASLA aşmaz).

export const TRUST_POINTS = {
  // ═══ GERİ KAZANIM (max 100'e kadar) ═══
  completedSwap: 2,             // Başarılı takas: +2 (geri kazanım)
  positiveReview: 1,            // Olumlu review: +1 (geri kazanım)
  
  // ═══ CEZALAR (100'den geriye) ═══
  negativeReview: -5,           // Olumsuz review: -5
  disputeLost: -10,             // Dispute kaybetme: -10
  cancelledByUser: -3,          // Onay sonrası iptal: -3
  noShow: -15,                  // Teslimat noktasına gelmeme: -15
  fakeProduct: -25,             // Sahte/yanlış ürün: -25
  reportedAbuse: -20,           // Kötüye kullanım raporu (onaylanan): -20
  
  // ═══ DOĞRULAMA (bir kerelik geri kazanım) ═══
  phoneVerification: 5,         // Telefon doğrulama: +5 (geri kazanım)
  identityVerification: 5,      // Kimlik doğrulama: +5 (geri kazanım)
  
  // ═══ YAŞLANMA ═══
  accountAgePerMonth: 0,        // Artık yaşa göre puan yok
} as const

// ═══ 100 TAVAN SABİTİ ═══
export const TRUST_SCORE_MAX = 100
export const TRUST_SCORE_DANGER = 80    // Bu altı tehlikeli
export const TRUST_SCORE_SUSPENDED = 30 // Bu altı askıya al

/**
 * Güven skoru güncelleme fonksiyonu (her yerde kullan)
 * 0-100 arası sınırlar — ASLA 100'ü aşamaz
 */
export function calculateNewTrustScore(
  currentScore: number, 
  change: number
): number {
  const newScore = currentScore + change
  // 0-100 arası sınırla — ASLA 100'ü aşamaz
  return Math.max(0, Math.min(TRUST_SCORE_MAX, newScore))
}

/**
 * Config'i JSON olarak döndür (admin panel için)
 */
export function getConfigAsJSON() {
  return {
    timeSettings: {
      disputeWindowHours: DISPUTE_WINDOW_HOURS,
      lockTimeoutHours: LOCK_TIMEOUT_HOURS,
      qrCodeValidityHours: QR_CODE_VALIDITY_HOURS,
      verificationCodeValidityHours: VERIFICATION_CODE_VALIDITY_HOURS
    },
    autoComplete: {
      lowRiskEnabled: AUTO_COMPLETE_LOW_RISK,
      delayHours: AUTO_COMPLETE_DELAY_HOURS
    },
    insurancePool: {
      premiumRateBase: PREMIUM_RATE_BASE,
      premiumRateMin: PREMIUM_RATE_MIN,
      premiumRateMax: PREMIUM_RATE_MAX,
      targetReserveRatio30d: TARGET_RESERVE_RATIO_30D,
      poolRebalanceStep: POOL_REBALANCE_STEP
    },
    riskTiers: RISK_TIER_THRESHOLDS,
    categoryRiskMultipliers: CATEGORY_RISK_MULTIPLIERS,
    trustScore: {
      max: TRUST_SCORE_MAX,
      dangerThreshold: TRUST_SCORE_DANGER,
      suspendedThreshold: TRUST_SCORE_SUSPENDED,
      points: TRUST_POINTS
    }
  }
}
