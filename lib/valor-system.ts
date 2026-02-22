import prisma from './db'

// ========================================
// VALOR EKONOMİ SİSTEMİ
// Progresif Kesinti + Akan Nehir Modeli
// ========================================

// ═══ TOTAL SUPPLY ═══
export const TOTAL_VALOR_SUPPLY = 1_000_000_000 // 1 Milyar

// ════════════════════════════════════════════════════════════════════
// PROGRESİF BONUS SİSTEMİ v3.0
// Felsefe: Az başla, her başarıda biraz artır, "kazanıyorum!" hissi
// ════════════════════════════════════════════════════════════════════

// ═══ SEVİYE SİSTEMİ ═══
export interface UserLevel {
  level: number
  name: string
  emoji: string
  minSwaps: number
  minTrust: number
  dailyBonus: number
  productBonus: number
  reviewBonus: number
  referralBonus: number
  swapBonusMin: number
  swapBonusMax: number
  streakEnabled: boolean
  monthlyCap: number
}

export const USER_LEVELS: UserLevel[] = [
  { level: 0, name: 'Yeni Üye',  emoji: '🌱', minSwaps: 0,  minTrust: 0,  dailyBonus: 1, productBonus: 0,  reviewBonus: 0, referralBonus: 0,  swapBonusMin: 0, swapBonusMax: 0,  streakEnabled: false, monthlyCap: 50 },
  { level: 1, name: 'Başlangıç', emoji: '⭐', minSwaps: 1,  minTrust: 0,  dailyBonus: 2, productBonus: 5,  reviewBonus: 2, referralBonus: 3,  swapBonusMin: 3, swapBonusMax: 8,  streakEnabled: false, monthlyCap: 100 },
  { level: 2, name: 'Aktif',     emoji: '🔥', minSwaps: 3,  minTrust: 0,  dailyBonus: 3, productBonus: 8,  reviewBonus: 3, referralBonus: 5,  swapBonusMin: 5, swapBonusMax: 12, streakEnabled: true,  monthlyCap: 150 },
  { level: 3, name: 'Güvenilir', emoji: '🏆', minSwaps: 5,  minTrust: 70, dailyBonus: 4, productBonus: 10, reviewBonus: 5, referralBonus: 8,  swapBonusMin: 5, swapBonusMax: 15, streakEnabled: true,  monthlyCap: 200 },
  { level: 4, name: 'Uzman',     emoji: '💎', minSwaps: 10, minTrust: 80, dailyBonus: 5, productBonus: 12, reviewBonus: 5, referralBonus: 10, swapBonusMin: 5, swapBonusMax: 20, streakEnabled: true,  monthlyCap: 250 },
  { level: 5, name: 'Efsane',    emoji: '👑', minSwaps: 25, minTrust: 90, dailyBonus: 5, productBonus: 15, reviewBonus: 5, referralBonus: 10, swapBonusMin: 8, swapBonusMax: 25, streakEnabled: true,  monthlyCap: 300 },
]

// ═══ IN-MEMORY CACHE (5 dakika TTL) ═══
const userLevelCache = new Map<string, { 
  data: UserLevel & { swapCount: number }
  expiresAt: number 
}>()
const CACHE_TTL = 5 * 60 * 1000 // 5 dakika

export function invalidateUserLevelCache(userId: string) {
  userLevelCache.delete(userId)
}

// ═══ FEATURE FLAG ═══
export const PROGRESSIVE_ECONOMY_ENABLED = 
  process.env.PROGRESSIVE_ECONOMY !== 'false' // default: true

// ═══ getUserLevel FONKSİYONU (cache destekli) ═══
export async function getUserLevel(
  userId: string, 
  useCache = true
): Promise<UserLevel & { swapCount: number }> {
  // Cache kontrolü
  if (useCache) {
    const cached = userLevelCache.get(userId)
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data
    }
  }
  
  const [user, completedSwaps] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { trustScore: true }
    }),
    prisma.swapRequest.count({
      where: {
        OR: [{ requesterId: userId }, { ownerId: userId }],
        status: 'completed'
      }
    })
  ])
  
  const trustScore = user?.trustScore || 0
  
  // En yüksek uygun seviyeyi bul
  let currentLevel = USER_LEVELS[0]
  for (const level of USER_LEVELS) {
    if (completedSwaps >= level.minSwaps && trustScore >= level.minTrust) {
      currentLevel = level
    }
  }
  
  const result = { ...currentLevel, swapCount: completedSwaps }
  
  // Cache'e kaydet
  userLevelCache.set(userId, { 
    data: result, 
    expiresAt: Date.now() + CACHE_TTL 
  })
  
  return result
}

// ═══ AYLIK BONUS KULLANIMI (valorTransaction tabanlı) ═══
export async function getMonthlyBonusUsed(userId: string): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const result = await prisma.valorTransaction.aggregate({
    where: {
      toUserId: userId,
      type: { in: BONUS_TRANSACTION_TYPES.map(t => t.toString()) },
      createdAt: { gte: startOfMonth }
    },
    _sum: { amount: true }
  })
  
  return result._sum.amount || 0
}

export async function canReceiveBonus(
  userId: string, 
  bonusAmount: number
): Promise<{ allowed: boolean; actualAmount: number; reason?: string }> {
  const level = await getUserLevel(userId)
  const monthlyUsed = await getMonthlyBonusUsed(userId)
  const remaining = level.monthlyCap - monthlyUsed
  
  if (remaining <= 0) {
    return { allowed: false, actualAmount: 0, reason: 'Aylık bonus tavanına ulaşıldı' }
  }
  
  return { allowed: true, actualAmount: Math.min(bonusAmount, remaining) }
}

// ═══ SABİT BONUSLAR (seviyeden bağımsız) ═══
export const WELCOME_BONUS = 5                 // Hoşgeldin (küçük ama sembolik)
export const SURVEY_BONUS = 5                  // Anket (profil bilgisi karşılığı)
export const PROFILE_COMPLETE_BONUS = 5        // Profil tamamlama (fotoğraf+bio+şehir)

// ═══ STREAK REWARDS (Seviye 2+ için aktif) ═══
export const STREAK_REWARDS = [
  { days: 3, bonus: 2 },     // 3 gün streak: +2V
  { days: 7, bonus: 5 },     // 7 gün streak: +5V
  { days: 14, bonus: 10 },   // 14 gün streak: +10V
  { days: 30, bonus: 20 },   // 30 gün streak: +20V
] as const

// ═══ MİLESTONE BONUSLARI (tek seferlik, sürpriz) ═══
export const MILESTONE_BONUSES = [
  { id: 'first_swap',      swaps: 1,  bonus: 5,  message: '🎉 İlk takasınız! +5 Valor' },
  { id: 'swap_3',          swaps: 3,  bonus: 10, message: '⭐ 3 takas tamamlandı! Seviye atladınız! +10 Valor' },
  { id: 'swap_5',          swaps: 5,  bonus: 15, message: '🏆 Güvenilir Takaşçı! +15 Valor' },
  { id: 'swap_10',         swaps: 10, bonus: 25, message: '🔥 Takas Uzmanı! +25 Valor' },
  { id: 'swap_25',         swaps: 25, bonus: 50, message: '👑 Takas Efsanesi! +50 Valor' },
  { id: 'swap_50',         swaps: 50, bonus: 100, message: '💎 Elmas Takaşçı! +100 Valor' },
] as const

// ═══ AYLIK TAVAN ═══
export const MONTHLY_BONUS_CAP_BY_LEVEL = [
  50,    // Seviye 0: 50V/ay max
  100,   // Seviye 1: 100V/ay
  150,   // Seviye 2: 150V/ay
  200,   // Seviye 3: 200V/ay
  250,   // Seviye 4: 250V/ay
  300,   // Seviye 5: 300V/ay
]

// ═══ ÜRÜN VE REVIEW LİMİTLERİ ═══
export const MAX_PRODUCT_BONUS_COUNT = 5       // Max ürün bonus sayısı
export const MAX_REVIEW_BONUS_COUNT = 10       // Max review/ay
export const MAX_REFERRAL_COUNT = 5            // Max referral/ay
export const REFERRAL_LOGIN_THRESHOLD = 10     // Aktif referral eşiği
export const MULTI_SWAP_EXTRA_BONUS = 5        // Çoklu takas extra
export const MAX_STREAK_DAYS = 30              // Streak max gün

// Legacy compatibility
export const REFERRAL_BONUS = 5                // Default (seviye 1)
export const REFERRAL_ACTIVE_BONUS = 3         // Davet edilen aktif olursa
export const SWAP_BONUS_MIN = 3                // Default min
export const SWAP_BONUS_MAX = 8                // Default max
export const PRODUCT_BONUS = 5                 // Default (seviye 1)
export const REVIEW_BONUS = 2                  // Default (seviye 1)
export const DAILY_LOGIN_BONUS = 1             // Seviye 0 için

// ========================================
// SPEKÜLASYON ÖNLEYİCİ KURALLAR
// ========================================

// İlk Takas Net Kazanç Limiti
export const FIRST_SWAPS_COUNT = 3 // İlk kaç takas için limit uygulanacak
export const MAX_NET_GAIN_FIRST_SWAPS = 400 // İlk takaslardan maksimum net kazanç (Valor)

// Bonus Valor Kısıtlaması  
export const BONUS_USABLE_PERCENT_BEFORE_FIRST_SWAP = 50 // İlk takas öncesi bonus'un kullanılabilir yüzdesi
export const BONUS_TRANSACTION_TYPES: TransactionType[] = [
  'welcome_bonus',
  'survey_bonus', 
  'referral_bonus',
  'referral_active_bonus',
  'daily_bonus',
  'product_bonus',
  'review_bonus',
  'achievement_bonus',
  'milestone_bonus'
]

// ═══ AYLIK BONUS TAKİBİ ═══
export async function getMonthlyBonusTotal(userId: string): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const monthlyTotal = await prisma.escrowLedger.aggregate({
    where: {
      userId: userId,
      type: { in: BONUS_TRANSACTION_TYPES.map(t => t.toString()) },
      createdAt: { gte: startOfMonth }
    },
    _sum: { amount: true }
  })
  
  return monthlyTotal._sum.amount || 0
}

// Aylık tavan kontrolü ile bonus ver
export async function applyMonthlyCap(userId: string, bonusAmount: number): Promise<number> {
  const level = await getUserLevel(userId)
  const cap = MONTHLY_BONUS_CAP_BY_LEVEL[level.level] || 50
  const currentMonthly = await getMonthlyBonusTotal(userId)
  
  if (currentMonthly >= cap) {
    return 0 // Tavan aşıldı
  }
  
  // Bonus'u kalan tavana göre sınırla
  return Math.min(bonusAmount, cap - currentMonthly)
}

// Progresif Kesinti Dilimleri
export const FEE_BRACKETS = [
  { limit: 200, rate: 0.005 },    // 0-200: %0.5
  { limit: 500, rate: 0.01 },    // 201-500: %1
  { limit: 1000, rate: 0.015 },  // 501-1000: %1.5
  { limit: 2500, rate: 0.02 },   // 1001-2500: %2
  { limit: 5000, rate: 0.025 },  // 2501-5000: %2.5
  { limit: Infinity, rate: 0.03 } // 5001+: %3
]

// İşlem Tipleri
export type TransactionType = 
  | 'welcome_bonus'
  | 'survey_bonus'
  | 'referral_bonus'
  | 'referral_active_bonus' // Davet edilen arkadaş 10+ giriş yaptığında
  | 'swap_complete'
  | 'swap_fee'
  | 'swap_bonus'
  | 'multi_swap_bonus'
  | 'melt'
  | 'melt_return'
  | 'daily_bonus'
  | 'product_bonus'
  | 'review_bonus'
  | 'achievement_bonus'
  | 'milestone_bonus'
  | 'valor_purchase'

// Kesinti Detayları
export interface FeeBreakdown {
  bracket1: number // 0-200
  bracket2: number // 201-500
  bracket3: number // 501-1000
  bracket4: number // 1001-2500
  bracket5: number // 2501-5000
  bracket6: number // 5001+
  total: number
  effectiveRate: number
}

/**
 * Progresif kesinti hesaplama
 * Her dilim kendi oranında kesilir (gelir vergisi gibi)
 */
export function calculateProgressiveFee(valorAmount: number): FeeBreakdown {
  const breakdown: FeeBreakdown = {
    bracket1: 0,
    bracket2: 0,
    bracket3: 0,
    bracket4: 0,
    bracket5: 0,
    bracket6: 0,
    total: 0,
    effectiveRate: 0
  }

  let remaining = valorAmount
  let previousLimit = 0

  FEE_BRACKETS.forEach((bracket, index) => {
    const bracketSize = bracket.limit === Infinity 
      ? remaining 
      : bracket.limit - previousLimit
    
    const taxableInBracket = Math.min(remaining, bracketSize)
    
    if (taxableInBracket <= 0) return

    const feeInBracket = taxableInBracket * bracket.rate
    
    // Dilim numarasına göre kaydet
    const bracketKey = `bracket${index + 1}` as keyof FeeBreakdown
    if (typeof breakdown[bracketKey] === 'number') {
      (breakdown as any)[bracketKey] = Math.round(feeInBracket * 100) / 100
    }

    breakdown.total += feeInBracket
    remaining -= taxableInBracket
    previousLimit = bracket.limit
  })

  // Minimum 1 Valor kesinti
  breakdown.total = Math.max(1, Math.round(breakdown.total))
  breakdown.effectiveRate = valorAmount > 0 
    ? Math.round((breakdown.total / valorAmount) * 10000) / 100 
    : 0

  return breakdown
}

/**
 * Sistem konfigürasyonunu al veya oluştur
 */
export async function getOrCreateSystemConfig() {
  let config = await prisma.systemConfig.findUnique({
    where: { id: 'main' }
  })

  if (!config) {
    config = await prisma.systemConfig.create({
      data: {
        id: 'main',
        totalValorSupply: BigInt(TOTAL_VALOR_SUPPLY),
        distributedValor: BigInt(0),
        communityPoolValor: BigInt(0),
        reserveValor: BigInt(200_000_000), // 200M rezerv
      }
    })
  }

  return config
}

/**
 * Hoşgeldin bonusu ver (kayıt sırasında)
 */
export async function giveWelcomeBonus(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user || user.welcomeBonusGiven) {
    return false
  }

  const config = await getOrCreateSystemConfig()
  const currentDistributed = Number(config.distributedValor)
  const totalSupply = Number(config.totalValorSupply)

  // Toplam arz kontrolü
  if (currentDistributed + WELCOME_BONUS > totalSupply) {
    console.log('Valor arzı tükendi, hoşgeldin bonusu verilemedi')
    return false
  }

  // Transaction ile güvenli güncelleme
  await prisma.$transaction([
    // Kullanıcı bakiyesini güncelle
    prisma.user.update({
      where: { id: userId },
      data: {
        valorBalance: { increment: WELCOME_BONUS },
        welcomeBonusGiven: true,
        lastActiveAt: new Date()
      }
    }),
    // Sistem dağıtımını güncelle
    prisma.systemConfig.update({
      where: { id: 'main' },
      data: {
        distributedValor: { increment: WELCOME_BONUS },
        totalTransactions: { increment: 1 }
      }
    }),
    // İşlem kaydı oluştur
    prisma.valorTransaction.create({
      data: {
        toUserId: userId,
        amount: WELCOME_BONUS,
        fee: 0,
        netAmount: WELCOME_BONUS,
        type: 'welcome_bonus',
        description: 'Hoşgeldin bonusu - TAKAS-A topluluğuna katıldınız!'
      }
    })
  ])

  return true
}

/**
 * Anket tamamlama bonusu ver
 */
export async function giveSurveyBonus(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user || user.surveyCompleted) {
    return false
  }

  const config = await getOrCreateSystemConfig()
  const currentDistributed = Number(config.distributedValor)
  const totalSupply = Number(config.totalValorSupply)

  if (currentDistributed + SURVEY_BONUS > totalSupply) {
    return false
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        valorBalance: { increment: SURVEY_BONUS },
        surveyCompleted: true,
        lastActiveAt: new Date()
      }
    }),
    prisma.systemConfig.update({
      where: { id: 'main' },
      data: {
        distributedValor: { increment: SURVEY_BONUS },
        totalTransactions: { increment: 1 }
      }
    }),
    prisma.valorTransaction.create({
      data: {
        toUserId: userId,
        amount: SURVEY_BONUS,
        fee: 0,
        netAmount: SURVEY_BONUS,
        type: 'survey_bonus',
        description: 'Anket tamamlama bonusu - Görüşleriniz için teşekkürler!'
      }
    })
  ])

  return true
}

/**
 * Takas tamamlama - Progresif kesinti ile
 * Satıcıdan (ürünü veren) kesinti alınır
 */
export async function completeSwapWithFee(
  swapRequestId: string,
  productValorPrice: number,
  offeredProductPrice?: number  // Ürüne karşı ürün takasında teklif edilen ürünün değeri
): Promise<{
  success: boolean
  fee: number
  netAmount: number
  breakdown: FeeBreakdown
  isProductSwap: boolean
  ownerReceives?: { valor: number; product: boolean; fee: number; bonus: number }
  requesterReceives?: { valor: number; product: boolean; fee: number; bonus: number }
  valorDifference?: number
  alreadyProcessed?: boolean
  error?: string
}> {
  // ═══ IDEMPOTENCY KONTROLÜ ═══
  const alreadyProcessed = await prisma.valorTransaction.findFirst({
    where: { 
      swapRequestId: swapRequestId,
      type: 'swap_complete'
    }
  })
  
  if (alreadyProcessed) {
    console.warn(`[IDEMPOTENCY] Swap ${swapRequestId} valor transferi zaten yapılmış, atlanıyor`)
    return { 
      success: true, 
      alreadyProcessed: true, 
      fee: 0, 
      netAmount: 0, 
      breakdown: {} as FeeBreakdown, 
      isProductSwap: false 
    }
  }

  const swapRequest = await prisma.swapRequest.findUnique({
    where: { id: swapRequestId },
    include: {
      product: true,
      requester: true,
      owner: true,
      offeredProduct: true  // Teklif edilen ürünü de al
    }
  })

  if (!swapRequest) {
    return { success: false, fee: 0, netAmount: 0, breakdown: {} as FeeBreakdown, isProductSwap: false, error: 'Takas talebi bulunamadı' }
  }

  if (swapRequest.status !== 'accepted') {
    return { success: false, fee: 0, netAmount: 0, breakdown: {} as FeeBreakdown, isProductSwap: false, error: 'Takas henüz onaylanmamış' }
  }

  // Ürüne karşı ürün takası mı kontrol et
  const isProductSwap = !!swapRequest.offeredProductId
  const actualOfferedPrice = offeredProductPrice || (swapRequest as any).offeredProduct?.valorPrice || 0

  // ═══════════════════════════════════════════════════════════
  // ÜRÜNE KARŞI ÜRÜN TAKASI
  // ═══════════════════════════════════════════════════════════
  if (isProductSwap && actualOfferedPrice > 0) {
    // Owner'ın ürünü (product) → Requester'a gidiyor
    // Requester'ın ürünü (offeredProduct) → Owner'a gidiyor
    
    const ownerProductValue = productValorPrice        // Owner'ın verdiği ürün
    const requesterProductValue = actualOfferedPrice   // Requester'ın verdiği ürün
    const valorDiff = ownerProductValue - requesterProductValue  // Pozitif = Owner'ın ürünü daha değerli
    
    // Her iki tarafa da kendi aldığı ürün üzerinden kesinti
    const ownerFeeBreakdown = calculateProgressiveFee(requesterProductValue)  // Owner, requester'ın ürününü ALIYOR
    const requesterFeeBreakdown = calculateProgressiveFee(ownerProductValue)  // Requester, owner'ın ürününü ALIYOR
    
    const ownerFee = ownerFeeBreakdown.total
    const requesterFee = requesterFeeBreakdown.total
    const totalFee = ownerFee + requesterFee
    
    // SEVİYE BAZLI bonus hesabı — her iki taraf için
    const ownerLevel = await getUserLevel(swapRequest.ownerId)
    const requesterLevel = await getUserLevel(swapRequest.requesterId)
    
    const ownerBonusRate = Math.min(0.1, 0.05 + (requesterProductValue / 50000) * 0.05)
    const ownerBonus = PROGRESSIVE_ECONOMY_ENABLED && ownerLevel.swapBonusMax > 0
      ? Math.min(ownerLevel.swapBonusMax, Math.max(ownerLevel.swapBonusMin, Math.round(requesterProductValue * ownerBonusRate)))
      : Math.min(SWAP_BONUS_MAX, Math.max(SWAP_BONUS_MIN, Math.round(requesterProductValue * ownerBonusRate)))
    
    const requesterBonusRate = Math.min(0.1, 0.05 + (ownerProductValue / 50000) * 0.05)
    const requesterBonus = PROGRESSIVE_ECONOMY_ENABLED && requesterLevel.swapBonusMax > 0
      ? Math.min(requesterLevel.swapBonusMax, Math.max(requesterLevel.swapBonusMin, Math.round(ownerProductValue * requesterBonusRate)))
      : Math.min(SWAP_BONUS_MAX, Math.max(SWAP_BONUS_MIN, Math.round(ownerProductValue * requesterBonusRate)))
    
    // Valor farkı ödemesi (requester'ın ödediği ek Valor)
    const valorPayment = swapRequest.pendingValorAmount || 0
    
    try {
      await prisma.$transaction(async (tx) => {
        // ═══ OPTIMISTIC LOCKING - Version kontrolü ═══
        const currentSwap = await tx.swapRequest.findUnique({
          where: { id: swapRequestId },
          select: { id: true, status: true, version: true }
        })
        
        if (!currentSwap || currentSwap.status !== 'accepted') {
          throw new Error('Takas durumu değişmiş, işlem iptal edildi')
        }
        
        // Version ile güncelle - eğer version değiştiyse 0 row etkilenir
        const updated = await tx.swapRequest.updateMany({
          where: { 
            id: swapRequestId, 
            version: currentSwap.version 
          },
          data: { 
            status: 'completed',
            version: { increment: 1 }
          }
        })
        
        if (updated.count === 0) {
          throw new Error('Başka bir işlem devam ediyor, lütfen tekrar deneyin')
        }

        // Her iki ürünün durumunu güncelle
        await tx.product.update({
          where: { id: swapRequest.productId },
          data: { status: 'swapped' }
        })
        await tx.product.update({
          where: { id: swapRequest.offeredProductId! },
          data: { status: 'swapped' }
        })

        // Owner'a: requester'ın ürün değeri (kesinti sonrası) + bonus + valor farkı
        await tx.user.update({
          where: { id: swapRequest.ownerId },
          data: {
            valorBalance: { increment: (requesterProductValue - ownerFee) + ownerBonus + valorPayment },
            lastActiveAt: new Date()
          }
        })

        // Requester'a: owner'ın ürün değeri (kesinti sonrası) + bonus - valor farkı
        await tx.user.update({
          where: { id: swapRequest.requesterId },
          data: {
            valorBalance: { increment: (ownerProductValue - requesterFee) + requesterBonus - valorPayment },
            lastActiveAt: new Date()
          }
        })

        // Topluluk havuzuna toplam kesinti
        await tx.systemConfig.update({
          where: { id: 'main' },
          data: {
            communityPoolValor: { increment: totalFee },
            totalFeesCollected: { increment: totalFee },
            totalSwapsCompleted: { increment: 1 },
            totalTransactions: { increment: 6 }  // 2 takas + 2 kesinti + 2 bonus
          }
        })

        // İşlem kaydı: Owner tarafı
        await tx.valorTransaction.create({
          data: {
            fromUserId: swapRequest.requesterId,
            toUserId: swapRequest.ownerId,
            amount: requesterProductValue + valorPayment,
            fee: ownerFee,
            netAmount: (requesterProductValue - ownerFee) + valorPayment,
            type: 'swap_complete',
            swapRequestId,
            feeBreakdown: JSON.stringify(ownerFeeBreakdown),
            description: `Ürün takası tamamlandı: ${(swapRequest as any).offeredProduct?.title || 'Teklif ürünü'} alındı`
          }
        })

        // İşlem kaydı: Requester tarafı
        await tx.valorTransaction.create({
          data: {
            fromUserId: swapRequest.ownerId,
            toUserId: swapRequest.requesterId,
            amount: ownerProductValue,
            fee: requesterFee,
            netAmount: ownerProductValue - requesterFee,
            type: 'swap_complete',
            swapRequestId,
            feeBreakdown: JSON.stringify(requesterFeeBreakdown),
            description: `Ürün takası tamamlandı: ${swapRequest.product.title} alındı`
          }
        })

        // Kesinti kayıtları
        await tx.valorTransaction.create({
          data: {
            fromUserId: swapRequest.ownerId,
            toUserId: null,
            amount: ownerFee,
            fee: 0,
            netAmount: ownerFee,
            type: 'swap_fee',
            swapRequestId,
            description: `Topluluk katkısı - Owner (%${ownerFeeBreakdown.effectiveRate})`
          }
        })
        await tx.valorTransaction.create({
          data: {
            fromUserId: swapRequest.requesterId,
            toUserId: null,
            amount: requesterFee,
            fee: 0,
            netAmount: requesterFee,
            type: 'swap_fee',
            swapRequestId,
            description: `Topluluk katkısı - Requester (%${requesterFeeBreakdown.effectiveRate})`
          }
        })

        // Bonus kayıtları
        await tx.valorTransaction.create({
          data: {
            fromUserId: null,
            toUserId: swapRequest.ownerId,
            amount: ownerBonus,
            fee: 0,
            netAmount: ownerBonus,
            type: 'swap_bonus',
            swapRequestId,
            description: 'Ürün takası bonusu (owner)'
          }
        })
        await tx.valorTransaction.create({
          data: {
            fromUserId: null,
            toUserId: swapRequest.requesterId,
            amount: requesterBonus,
            fee: 0,
            netAmount: requesterBonus,
            type: 'swap_bonus',
            swapRequestId,
            description: 'Ürün takası bonusu (requester)'
          }
        })
      })

      // ═══ CACHE İNVALIDATION ═══
      invalidateUserLevelCache(swapRequest.ownerId)
      invalidateUserLevelCache(swapRequest.requesterId)
      
      // ═══ MİLESTONE KONTROLÜ (her iki taraf için) ═══
      if (PROGRESSIVE_ECONOMY_ENABLED) {
        for (const participantId of [swapRequest.ownerId, swapRequest.requesterId]) {
          const participantLevel = await getUserLevel(participantId, false) // cache bypass
          const milestone = MILESTONE_BONUSES.find(m => m.swaps === participantLevel.swapCount)
          
          if (milestone) {
            const alreadyGiven = await prisma.valorTransaction.findFirst({
              where: {
                toUserId: participantId,
                type: 'achievement_bonus',
                description: { contains: milestone.id }
              }
            })
            
            if (!alreadyGiven) {
              await prisma.$transaction([
                prisma.valorTransaction.create({
                  data: {
                    fromUserId: null,
                    toUserId: participantId,
                    amount: milestone.bonus,
                    fee: 0,
                    netAmount: milestone.bonus,
                    type: 'achievement_bonus',
                    description: `Milestone: ${milestone.id} - ${milestone.message}`,
                  }
                }),
                prisma.user.update({
                  where: { id: participantId },
                  data: { valorBalance: { increment: milestone.bonus } }
                })
              ])
            }
          }
        }
      }

      return {
        success: true,
        fee: totalFee,
        netAmount: 0, // Ürün takasında net miktar iki yönlü
        breakdown: ownerFeeBreakdown, // Ana ürün tarafı
        isProductSwap: true,
        ownerReceives: {
          valor: (requesterProductValue - ownerFee) + ownerBonus + valorPayment,
          product: true,
          fee: ownerFee,
          bonus: ownerBonus
        },
        requesterReceives: {
          valor: (ownerProductValue - requesterFee) + requesterBonus - valorPayment,
          product: true,
          fee: requesterFee,
          bonus: requesterBonus
        },
        valorDifference: valorDiff
      }
    } catch (error) {
      console.error('Ürün takası tamamlama hatası:', error)
      return {
        success: false,
        fee: 0,
        netAmount: 0,
        breakdown: {} as FeeBreakdown,
        isProductSwap: true,
        error: 'Ürün takası tamamlanırken hata oluştu'
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SADECE VALOR TAKASI (mevcut mantık)
  // ═══════════════════════════════════════════════════════════
  
  // Progresif kesinti hesapla
  const breakdown = calculateProgressiveFee(productValorPrice)
  const fee = breakdown.total
  const netAmount = productValorPrice - fee

  // SEVİYE BAZLI takas bonus hesabı
  const ownerLevel = await getUserLevel(swapRequest.ownerId)
  const bonusRate = Math.min(0.1, 0.05 + (productValorPrice / 50000) * 0.05)
  const swapBonus = PROGRESSIVE_ECONOMY_ENABLED && ownerLevel.swapBonusMax > 0
    ? Math.min(ownerLevel.swapBonusMax, Math.max(ownerLevel.swapBonusMin, Math.round(productValorPrice * bonusRate)))
    : 0

  try {
    await prisma.$transaction(async (tx) => {
      // ═══ OPTIMISTIC LOCKING - Version kontrolü ═══
      const currentSwap = await tx.swapRequest.findUnique({
        where: { id: swapRequestId },
        select: { id: true, status: true, version: true }
      })
      
      if (!currentSwap || currentSwap.status !== 'accepted') {
        throw new Error('Takas durumu değişmiş, işlem iptal edildi')
      }
      
      // Version ile güncelle - eğer version değiştiyse 0 row etkilenir
      const updated = await tx.swapRequest.updateMany({
        where: { 
          id: swapRequestId, 
          version: currentSwap.version 
        },
        data: { 
          status: 'completed',
          version: { increment: 1 }
        }
      })
      
      if (updated.count === 0) {
        throw new Error('Başka bir işlem devam ediyor, lütfen tekrar deneyin')
      }

      // Ürün durumunu güncelle (takası tamamlandı)
      await tx.product.update({
        where: { id: swapRequest.productId },
        data: { status: 'swapped' }
      })

      // Satıcıya (owner) net miktar ver
      await tx.user.update({
        where: { id: swapRequest.ownerId },
        data: {
          valorBalance: { increment: netAmount + swapBonus },
          lastActiveAt: new Date()
        }
      })

      // Alıcının (requester) aktivitesini güncelle
      await tx.user.update({
        where: { id: swapRequest.requesterId },
        data: {
          lastActiveAt: new Date()
        }
      })

      // Topluluk havuzuna kesinti ekle
      await tx.systemConfig.update({
        where: { id: 'main' },
        data: {
          communityPoolValor: { increment: fee },
          totalFeesCollected: { increment: fee },
          totalSwapsCompleted: { increment: 1 },
          totalTransactions: { increment: 3 }
        }
      })

      // İşlem kaydı: Takas tamamlama
      await tx.valorTransaction.create({
        data: {
          fromUserId: null, // Sistemden
          toUserId: swapRequest.ownerId,
          amount: productValorPrice,
          fee: fee,
          netAmount: netAmount,
          type: 'swap_complete',
          swapRequestId: swapRequestId,
          feeBreakdown: JSON.stringify(breakdown),
          description: `Takas tamamlandı: ${swapRequest.product.title}`
        }
      })

      // İşlem kaydı: Kesinti
      await tx.valorTransaction.create({
        data: {
          fromUserId: swapRequest.ownerId,
          toUserId: null, // Topluluk havuzuna
          amount: fee,
          fee: 0,
          netAmount: fee,
          type: 'swap_fee',
          swapRequestId: swapRequestId,
          feeBreakdown: JSON.stringify(breakdown),
          description: `Topluluk katkısı (%${breakdown.effectiveRate})`
        }
      })

      // İşlem kaydı: Bonus
      await tx.valorTransaction.create({
        data: {
          fromUserId: null,
          toUserId: swapRequest.ownerId,
          amount: swapBonus,
          fee: 0,
          netAmount: swapBonus,
          type: 'swap_bonus',
          swapRequestId: swapRequestId,
          description: 'Başarılı takas bonusu'
        }
      })
    })

    // ═══ CACHE İNVALIDATION ═══
    invalidateUserLevelCache(swapRequest.ownerId)
    invalidateUserLevelCache(swapRequest.requesterId)
    
    // ═══ MİLESTONE KONTROLÜ (her iki taraf için) ═══
    if (PROGRESSIVE_ECONOMY_ENABLED) {
      for (const participantId of [swapRequest.ownerId, swapRequest.requesterId]) {
        const participantLevel = await getUserLevel(participantId, false) // cache bypass
        const milestone = MILESTONE_BONUSES.find(m => m.swaps === participantLevel.swapCount)
        
        if (milestone) {
          const alreadyGiven = await prisma.valorTransaction.findFirst({
            where: {
              toUserId: participantId,
              type: 'achievement_bonus',
              description: { contains: milestone.id }
            }
          })
          
          if (!alreadyGiven) {
            await prisma.$transaction([
              prisma.valorTransaction.create({
                data: {
                  fromUserId: null,
                  toUserId: participantId,
                  amount: milestone.bonus,
                  fee: 0,
                  netAmount: milestone.bonus,
                  type: 'achievement_bonus',
                  description: `Milestone: ${milestone.id} - ${milestone.message}`,
                }
              }),
              prisma.user.update({
                where: { id: participantId },
                data: { valorBalance: { increment: milestone.bonus } }
              })
            ])
          }
        }
      }
    }

    return {
      success: true,
      fee,
      netAmount: netAmount + swapBonus,
      breakdown,
      isProductSwap: false
    }
  } catch (error) {
    console.error('Takas tamamlama hatası:', error)
    return {
      success: false,
      fee: 0,
      netAmount: 0,
      breakdown: {} as FeeBreakdown,
      isProductSwap: false,
      error: 'Takas tamamlanırken hata oluştu'
    }
  }
}

/**
 * Kullanıcının Valor işlem geçmişini getir
 */
export async function getUserValorHistory(
  userId: string,
  limit: number = 20,
  offset: number = 0
) {
  const transactions = await prisma.valorTransaction.findMany({
    where: {
      OR: [
        { fromUserId: userId },
        { toUserId: userId }
      ]
    },
    include: {
      swapRequest: {
        include: {
          product: { select: { title: true, images: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  })

  return transactions.map((tx: { toUserId: string | null; netAmount: number; amount: number; [key: string]: unknown }) => ({
    ...tx,
    isIncoming: tx.toUserId === userId,
    displayAmount: tx.toUserId === userId ? tx.netAmount : -tx.amount
  }))
}

/**
 * Sistem istatistiklerini getir
 */
export async function getSystemStats() {
  const config = await getOrCreateSystemConfig()
  
  const totalUsers = await prisma.user.count()
  const activeUsers = await prisma.user.count({
    where: {
      lastActiveAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Son 30 gün
      }
    }
  })

  return {
    totalSupply: Number(config.totalValorSupply),
    distributed: Number(config.distributedValor),
    communityPool: Number(config.communityPoolValor),
    reserve: Number(config.reserveValor),
    remaining: Number(config.totalValorSupply) - Number(config.distributedValor),
    totalFeesCollected: Number(config.totalFeesCollected),
    totalSwapsCompleted: config.totalSwapsCompleted,
    totalTransactions: config.totalTransactions,
    totalMelted: Number(config.totalMeltedValor),
    totalUsers,
    activeUsers,
    distributionPercent: (Number(config.distributedValor) / Number(config.totalValorSupply) * 100).toFixed(2)
  }
}

/**
 * Takas öncesi kesinti önizlemesi
 */
export function previewSwapFee(valorAmount: number) {
  const breakdown = calculateProgressiveFee(valorAmount)
  
  // Bonus tahmini
  const bonusRate = Math.min(0.1, 0.05 + (valorAmount / 50000) * 0.05)
  const estimatedBonus = Math.min(SWAP_BONUS_MAX, Math.max(SWAP_BONUS_MIN, Math.round(valorAmount * bonusRate)))
  
  return {
    productValue: valorAmount,
    fee: breakdown.total,
    feeBreakdown: breakdown,
    netAfterFee: valorAmount - breakdown.total,
    estimatedBonus,
    totalReceive: valorAmount - breakdown.total + estimatedBonus,
    effectiveRate: breakdown.effectiveRate
  }
}

/**
 * Ürüne karşı ürün takas önizlemesi
 * Her iki tarafın da kesinti + bonus hesabını gösterir
 */
export function previewProductSwapFee(
  ownerProductValue: number,
  requesterProductValue: number,
  valorPayment: number = 0
) {
  const ownerFee = calculateProgressiveFee(requesterProductValue)
  const requesterFee = calculateProgressiveFee(ownerProductValue)
  
  const ownerBonusRate = Math.min(0.1, 0.05 + (requesterProductValue / 50000) * 0.05)
  const ownerBonus = Math.min(SWAP_BONUS_MAX, Math.max(SWAP_BONUS_MIN, Math.round(requesterProductValue * ownerBonusRate)))
  
  const requesterBonusRate = Math.min(0.1, 0.05 + (ownerProductValue / 50000) * 0.05)
  const requesterBonus = Math.min(SWAP_BONUS_MAX, Math.max(SWAP_BONUS_MIN, Math.round(ownerProductValue * requesterBonusRate)))
  
  return {
    ownerProductValue,
    requesterProductValue,
    valorDifference: ownerProductValue - requesterProductValue,
    valorPayment,
    owner: {
      gives: ownerProductValue,
      receives: requesterProductValue + valorPayment,
      fee: ownerFee.total,
      bonus: ownerBonus,
      netValorChange: (requesterProductValue - ownerFee.total) + ownerBonus + valorPayment
    },
    requester: {
      gives: requesterProductValue + valorPayment,
      receives: ownerProductValue,
      fee: requesterFee.total,
      bonus: requesterBonus,
      netValorChange: (ownerProductValue - requesterFee.total) + requesterBonus - valorPayment
    },
    totalFees: ownerFee.total + requesterFee.total,
    totalBonuses: ownerBonus + requesterBonus
  }
}

// ========================================
// YENİ BONUS FONKSİYONLARI
// ========================================

/**
 * Günlük giriş bonusu ver - PROGRESİF SEVİYE SİSTEMİ
 * Seviye arttıkça günlük bonus artar
 * Streak bonusları sadece Seviye 2+ için aktif
 */
export async function giveDailyBonus(userId: string): Promise<{ 
  success: boolean; 
  message: string; 
  bonus?: number;
  streak?: number;
  nextMilestone?: { days: number; bonus: number };
  level?: { level: number; name: string };
  reason?: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      lastDailyBonusAt: true,
      loginStreak: true,
      lastStreakDate: true
    }
  })

  if (!user) {
    return { success: false, message: 'Kullanıcı bulunamadı' }
  }

  // Seviye kontrolü
  const level = await getUserLevel(userId)

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  // Son bonus zamanı kontrolü (aynı gün mü?)
  if (user.lastDailyBonusAt) {
    const lastBonus = new Date(user.lastDailyBonusAt)
    const lastBonusDay = new Date(lastBonus.getFullYear(), lastBonus.getMonth(), lastBonus.getDate())
    
    if (today.getTime() === lastBonusDay.getTime()) {
      return { 
        success: false, 
        message: 'Bugün zaten bonus aldınız. Yarın tekrar gelin!',
        streak: user.loginStreak || 0,
        level: { level: level.level, name: level.name }
      }
    }
  }

  // Streak hesaplama
  let newStreak = 1
  if (user.lastStreakDate) {
    const lastStreakDay = new Date(user.lastStreakDate)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const lastStreakDayNormalized = new Date(lastStreakDay.getFullYear(), lastStreakDay.getMonth(), lastStreakDay.getDate())
    
    if (lastStreakDayNormalized.getTime() === yesterday.getTime()) {
      newStreak = Math.min((user.loginStreak || 0) + 1, MAX_STREAK_DAYS)
    } else if (lastStreakDayNormalized.getTime() < yesterday.getTime()) {
      newStreak = 1
    }
  }

  // SEVİYE BAZLI günlük bonus
  let bonusAmount = level.dailyBonus
  let milestoneBonus = 0
  let milestoneMessage = ''
  
  // Streak bonusları SADECE Seviye 2+ için aktif
  if (level.streakEnabled) {
    for (const reward of STREAK_REWARDS) {
      if (newStreak === reward.days) {
        milestoneBonus = reward.bonus
        milestoneMessage = ` 🎉 ${reward.days} günlük streak! +${reward.bonus}V extra bonus!`
        break
      }
    }
  }
  
  let totalBonus = bonusAmount + milestoneBonus

  // Aylık tavan kontrolü
  const cappedBonus = await applyMonthlyCap(userId, totalBonus)
  if (cappedBonus === 0) {
    return { 
      success: false, 
      message: 'Bu ay için bonus tavanına ulaştınız. Gelecek ay tekrar gelin!',
      reason: 'monthly_cap_reached',
      level: { level: level.level, name: level.name }
    }
  }
  totalBonus = cappedBonus

  const config = await getOrCreateSystemConfig()
  const currentDistributed = Number(config.distributedValor)
  const totalSupply = Number(config.totalValorSupply)

  if (currentDistributed + totalBonus > totalSupply) {
    return { success: false, message: 'Sistem bonusu şu an için tükenmiş durumda' }
  }

  // Sonraki milestone (sadece streak aktifse göster)
  const nextMilestone = level.streakEnabled 
    ? (STREAK_REWARDS.find(r => r.days > newStreak) || null)
    : null

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        valorBalance: { increment: totalBonus },
        lastDailyBonusAt: now,
        loginStreak: newStreak,
        lastStreakDate: today,
        totalValorEarned: { increment: totalBonus },
        lastActiveAt: now
      }
    }),
    prisma.systemConfig.update({
      where: { id: 'main' },
      data: {
        distributedValor: { increment: totalBonus },
        totalTransactions: { increment: 1 }
      }
    }),
    prisma.valorTransaction.create({
      data: {
        toUserId: userId,
        amount: totalBonus,
        fee: 0,
        netAmount: totalBonus,
        type: 'daily_bonus',
        description: milestoneBonus > 0 
          ? `Günlük bonus (Seviye ${level.level}: ${level.name}, ${newStreak}. gün) + Streak ödülü!`
          : `Günlük bonus (Seviye ${level.level}: ${level.name}, ${newStreak}. gün)`
      }
    })
  ])

  return { 
    success: true, 
    message: `+${totalBonus} Valor kazandınız!${milestoneMessage}`, 
    bonus: totalBonus,
    streak: newStreak,
    nextMilestone: nextMilestone ? { days: nextMilestone.days, bonus: nextMilestone.bonus } : undefined,
    level: { level: level.level, name: level.name }
  }
}

/**
 * Ürün ekleme - Bekleyen bonus artır (takas tamamlanınca verilecek)
 * Bot ve sahte ürün eklemeyi önlemek için bonus hemen verilmez
 */
export async function markPendingProductBonus(userId: string): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { productBonusCount: true, pendingProductBonus: true }
  })

  if (!user) {
    return { success: false, message: 'Kullanıcı bulunamadı' }
  }

  // Zaten maksimum bonusa ulaştıysa bekleyen artırmaya gerek yok
  const totalBonusEligible = (user.productBonusCount || 0) + (user.pendingProductBonus || 0)
  if (totalBonusEligible >= MAX_PRODUCT_BONUS_COUNT) {
    return { success: true, message: 'Maksimum bonus limitine ulaşıldı' }
  }

  // Bekleyen bonus sayısını artır
  await prisma.user.update({
    where: { id: userId },
    data: { pendingProductBonus: { increment: 1 } }
  })

  return { 
    success: true, 
    message: 'Ürün eklendi! İlk takasınız tamamlandığında 30 Valor bonus kazanacaksınız.' 
  }
}

/**
 * Ürün takası bonusu ver - TAKAS TAMAMLANINCA TETİKLENİR (PROGRESİF)
 * Hem satıcı hem alıcı için (eğer bekleyen bonusları varsa)
 * Seviye 0'da ürün bonusu YOK - takas yap, seviye atla!
 */
export async function giveProductBonusOnSwap(userId: string): Promise<{ success: boolean; message: string; bonus?: number; reason?: string }> {
  // Seviye kontrolü
  const level = await getUserLevel(userId)
  
  // Seviye 0'da ürün bonusu yok
  if (level.productBonus === 0) {
    return { 
      success: true, 
      message: 'Ürün bonusu Seviye 1\'den itibaren aktif. Takas yaparak seviye atlayın!',
      reason: 'level_too_low',
      bonus: 0
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      id: true,
      productBonusCount: true, 
      pendingProductBonus: true 
    }
  })

  if (!user) {
    return { success: false, message: 'Kullanıcı bulunamadı' }
  }

  // Bekleyen bonus yoksa veya maksimuma ulaşıldıysa
  if ((user.pendingProductBonus || 0) <= 0) {
    return { success: true, message: 'Bekleyen ürün bonusu yok' }
  }

  if ((user.productBonusCount || 0) >= MAX_PRODUCT_BONUS_COUNT) {
    await prisma.user.update({
      where: { id: userId },
      data: { pendingProductBonus: 0 }
    })
    return { success: true, message: 'Maksimum ürün bonusuna zaten ulaşılmış' }
  }

  // SEVİYE BAZLI bonus miktarı
  let bonusAmount = level.productBonus

  // Aylık tavan kontrolü
  bonusAmount = await applyMonthlyCap(userId, bonusAmount)
  if (bonusAmount === 0) {
    return { success: true, message: 'Aylık bonus tavanına ulaşıldı', reason: 'monthly_cap_reached' }
  }

  const config = await getOrCreateSystemConfig()
  const currentDistributed = Number(config.distributedValor)
  const totalSupply = Number(config.totalValorSupply)

  if (currentDistributed + bonusAmount > totalSupply) {
    return { success: false, message: 'Sistem bonusu şu an için tükenmiş durumda' }
  }

  const newBonusCount = (user.productBonusCount || 0) + 1
  const newPendingCount = Math.max(0, (user.pendingProductBonus || 0) - 1)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        valorBalance: { increment: bonusAmount },
        productBonusCount: newBonusCount,
        pendingProductBonus: newPendingCount,
        totalValorEarned: { increment: bonusAmount },
        lastActiveAt: new Date()
      }
    }),
    prisma.systemConfig.update({
      where: { id: 'main' },
      data: {
        distributedValor: { increment: bonusAmount },
        totalTransactions: { increment: 1 }
      }
    }),
    prisma.valorTransaction.create({
      data: {
        toUserId: userId,
        amount: bonusAmount,
        fee: 0,
        netAmount: bonusAmount,
        type: 'product_bonus',
        description: `Takas tamamlama bonusu! Seviye ${level.level} (${newBonusCount}/${MAX_PRODUCT_BONUS_COUNT})`
      }
    })
  ])

  return { 
    success: true, 
    message: `🎉 Takas tamamlama bonusu! +${bonusAmount} Valor (${newBonusCount}/${MAX_PRODUCT_BONUS_COUNT})`, 
    bonus: bonusAmount 
  }
}

/**
 * Ürün ekleme bonusu ver (eski fonksiyon - geriye dönük uyumluluk)
 * @deprecated Artık markPendingProductBonus + giveProductBonusOnSwap kullanılmalı
 */
export async function giveProductBonus(userId: string): Promise<{ success: boolean; message: string; bonus?: number }> {
  // Artık direkt bonus vermiyoruz, sadece bekleyen bonus işaretliyoruz
  const result = await markPendingProductBonus(userId)
  return { ...result, bonus: 0 }
}

/**
 * Değerlendirme bonusu ver (PROGRESİF)
 * Seviye 0'da review bonusu YOK
 */
export async function giveReviewBonus(userId: string): Promise<{ success: boolean; message: string; bonus?: number; reason?: string }> {
  // Seviye kontrolü
  const level = await getUserLevel(userId)
  
  // Seviye 0'da review bonusu yok
  if (level.reviewBonus === 0) {
    return { 
      success: true, 
      message: 'Değerlendirme bonusu Seviye 1\'den itibaren aktif.',
      reason: 'level_too_low',
      bonus: 0
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    return { success: false, message: 'Kullanıcı bulunamadı' }
  }

  // Aylık maksimum review bonusu kontrolü
  if ((user.reviewBonusCount || 0) >= MAX_REVIEW_BONUS_COUNT) {
    return { 
      success: false, 
      message: `Bu ay maksimum ${MAX_REVIEW_BONUS_COUNT} değerlendirme bonusuna ulaştınız` 
    }
  }

  // SEVİYE BAZLI bonus miktarı
  let bonusAmount = level.reviewBonus

  // Aylık tavan kontrolü
  bonusAmount = await applyMonthlyCap(userId, bonusAmount)
  if (bonusAmount === 0) {
    return { success: true, message: 'Aylık bonus tavanına ulaşıldı', reason: 'monthly_cap_reached' }
  }

  const config = await getOrCreateSystemConfig()
  const currentDistributed = Number(config.distributedValor)
  const totalSupply = Number(config.totalValorSupply)

  if (currentDistributed + bonusAmount > totalSupply) {
    return { success: false, message: 'Sistem bonusu şu an için tükenmiş durumda' }
  }

  const newBonusCount = (user.reviewBonusCount || 0) + 1

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        valorBalance: { increment: bonusAmount },
        reviewBonusCount: newBonusCount,
        totalValorEarned: { increment: bonusAmount },
        lastActiveAt: new Date()
      }
    }),
    prisma.systemConfig.update({
      where: { id: 'main' },
      data: {
        distributedValor: { increment: bonusAmount },
        totalTransactions: { increment: 1 }
      }
    }),
    prisma.valorTransaction.create({
      data: {
        toUserId: userId,
        amount: bonusAmount,
        fee: 0,
        netAmount: bonusAmount,
        type: 'review_bonus',
        description: `Değerlendirme bonusu - Seviye ${level.level} (${newBonusCount}/${MAX_REVIEW_BONUS_COUNT} bu ay)`
      }
    })
  ])

  return { 
    success: true, 
    message: `Değerlendirme bonusu alındı! +${bonusAmount}V`, 
    bonus: bonusAmount 
  }
}

// ========================================
// ARKADAŞ DAVET SİSTEMİ
// ========================================

/**
 * Aylık referral sayacını sıfırla (ay başı kontrolü)
 */
export async function resetMonthlyReferralIfNeeded(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastReferralResetAt: true, monthlyReferralCount: true }
  })

  if (!user) return

  const now = new Date()
  const lastReset = user.lastReferralResetAt ? new Date(user.lastReferralResetAt) : null

  // Eğer hiç sıfırlanmamışsa veya farklı ayda isek sıfırla
  if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        monthlyReferralCount: 0,
        lastReferralResetAt: now
      }
    })
  }
}

/**
 * Referral bonusu ver (davet eden kişiye) - PROGRESİF
 * Seviye 0'da referral bonusu YOK
 */
export async function giveReferralBonus(
  referrerId: string, 
  referredUserId: string
): Promise<{ success: boolean; message: string; bonus?: number; reason?: string }> {
  // Seviye kontrolü
  const level = await getUserLevel(referrerId)
  
  // Seviye 0'da referral bonusu yok
  if (level.referralBonus === 0) {
    // Yine de referral kaydı oluştur (bonus olmadan)
    await prisma.referral.create({
      data: {
        referrerId,
        referredUserId,
        bonusGiven: false,
        friendLoginCount: 0,
        activeBonusGiven: false
      }
    })
    return { 
      success: true, 
      message: 'Davet bonusu Seviye 1\'den itibaren aktif. Takas yaparak seviye atlayın!',
      reason: 'level_too_low',
      bonus: 0
    }
  }

  // Önce aylık sayacı kontrol et ve gerekirse sıfırla
  await resetMonthlyReferralIfNeeded(referrerId)

  const referrer = await prisma.user.findUnique({
    where: { id: referrerId },
    select: { monthlyReferralCount: true, valorBalance: true }
  })

  if (!referrer) {
    return { success: false, message: 'Davet eden kullanıcı bulunamadı' }
  }

  // Aylık limit kontrolü
  if (referrer.monthlyReferralCount >= MAX_REFERRAL_COUNT) {
    return { 
      success: false, 
      message: `Bu ay maksimum ${MAX_REFERRAL_COUNT} davet bonusuna ulaştınız.` 
    }
  }

  // SEVİYE BAZLI bonus miktarı
  let bonusAmount = level.referralBonus

  // Aylık tavan kontrolü
  bonusAmount = await applyMonthlyCap(referrerId, bonusAmount)
  if (bonusAmount === 0) {
    // Referral kaydı oluştur (bonus olmadan)
    await prisma.referral.create({
      data: {
        referrerId,
        referredUserId,
        bonusGiven: false,
        friendLoginCount: 0,
        activeBonusGiven: false
      }
    })
    return { success: true, message: 'Aylık bonus tavanına ulaşıldı', reason: 'monthly_cap_reached' }
  }

  const config = await getOrCreateSystemConfig()
  const currentDistributed = Number(config.distributedValor)
  const totalSupply = Number(config.totalValorSupply)

  if (currentDistributed + bonusAmount > totalSupply) {
    return { success: false, message: 'Sistem bonusu şu an için tükenmiş durumda' }
  }

  const newMonthlyCount = referrer.monthlyReferralCount + 1

  await prisma.$transaction([
    // Davet edene bonus ver
    prisma.user.update({
      where: { id: referrerId },
      data: {
        valorBalance: { increment: bonusAmount },
        totalValorEarned: { increment: bonusAmount },
        totalReferrals: { increment: 1 },
        monthlyReferralCount: newMonthlyCount,
        lastReferralAt: new Date(),
        lastActiveAt: new Date()
      }
    }),
    // Referral kaydı oluştur
    prisma.referral.create({
      data: {
        referrerId,
        referredUserId,
        bonusGiven: true,
        friendLoginCount: 0,
        activeBonusGiven: false
      }
    }),
    // Sistem güncelle
    prisma.systemConfig.update({
      where: { id: 'main' },
      data: {
        distributedValor: { increment: bonusAmount },
        totalTransactions: { increment: 1 }
      }
    }),
    // İşlem kaydı
    prisma.valorTransaction.create({
      data: {
        toUserId: referrerId,
        amount: bonusAmount,
        fee: 0,
        netAmount: bonusAmount,
        type: 'referral_bonus',
        description: `Arkadaş davet bonusu - Seviye ${level.level} (${newMonthlyCount}/${MAX_REFERRAL_COUNT} bu ay)`
      }
    })
  ])

  return { 
    success: true, 
    message: `Davet bonusu alındı! +${bonusAmount}V (${newMonthlyCount}/${MAX_REFERRAL_COUNT} bu ay)`, 
    bonus: bonusAmount 
  }
}

/**
 * Davet edilen arkadaşın giriş sayısını güncelle ve aktif bonus kontrolü yap
 */
export async function trackReferredUserLogin(userId: string): Promise<{ activeBonusAwarded: boolean; referrerId?: string }> {
  // Bu kullanıcıyı davet eden referral kaydını bul
  const referral = await prisma.referral.findFirst({
    where: { 
      referredUserId: userId,
      activeBonusGiven: false // Henüz aktif bonus verilmemiş
    },
    include: { referrer: true }
  })

  if (!referral) {
    return { activeBonusAwarded: false }
  }

  // Bu ay içinde mi kontrol et
  const now = new Date()
  const referralDate = new Date(referral.createdAt)
  const isInSameMonth = referralDate.getMonth() === now.getMonth() && referralDate.getFullYear() === now.getFullYear()

  if (!isInSameMonth) {
    // Ay geçmiş, artık aktif bonus verilemez
    return { activeBonusAwarded: false }
  }

  const newLoginCount = referral.friendLoginCount + 1

  // Giriş sayısını güncelle
  await prisma.referral.update({
    where: { id: referral.id },
    data: { friendLoginCount: newLoginCount }
  })

  // 10+ giriş kontrolü
  if (newLoginCount >= REFERRAL_LOGIN_THRESHOLD && !referral.activeBonusGiven) {
    const config = await getOrCreateSystemConfig()
    const currentDistributed = Number(config.distributedValor)
    const totalSupply = Number(config.totalValorSupply)

    if (currentDistributed + REFERRAL_ACTIVE_BONUS <= totalSupply) {
      await prisma.$transaction([
        // Davet edene aktif bonus ver
        prisma.user.update({
          where: { id: referral.referrerId },
          data: {
            valorBalance: { increment: REFERRAL_ACTIVE_BONUS },
            totalValorEarned: { increment: REFERRAL_ACTIVE_BONUS },
            lastActiveAt: new Date()
          }
        }),
        // Referral kaydını güncelle
        prisma.referral.update({
          where: { id: referral.id },
          data: { activeBonusGiven: true }
        }),
        // Sistem güncelle
        prisma.systemConfig.update({
          where: { id: 'main' },
          data: {
            distributedValor: { increment: REFERRAL_ACTIVE_BONUS },
            totalTransactions: { increment: 1 }
          }
        }),
        // İşlem kaydı
        prisma.valorTransaction.create({
          data: {
            toUserId: referral.referrerId,
            amount: REFERRAL_ACTIVE_BONUS,
            fee: 0,
            netAmount: REFERRAL_ACTIVE_BONUS,
            type: 'referral_active_bonus',
            description: `Davet edilen arkadaş ${REFERRAL_LOGIN_THRESHOLD}+ giriş yaptı - Aktif kullanıcı bonusu`
          }
        })
      ])

      return { activeBonusAwarded: true, referrerId: referral.referrerId }
    }
  }

  return { activeBonusAwarded: false }
}

/**
 * Kullanıcının referral durumunu getir
 */
export async function getReferralStatus(userId: string): Promise<{
  monthlyCount: number;
  maxCount: number;
  canInvite: boolean;
  pendingActiveBonus: number; // Aktif bonus bekleyen davetler
}> {
  await resetMonthlyReferralIfNeeded(userId)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { monthlyReferralCount: true }
  })

  // Bu ay yapılan davetlerden aktif bonus bekleyenleri say
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  
  const pendingActiveBonus = await prisma.referral.count({
    where: {
      referrerId: userId,
      createdAt: { gte: startOfMonth },
      activeBonusGiven: false,
      friendLoginCount: { lt: REFERRAL_LOGIN_THRESHOLD }
    }
  })

  const monthlyCount = user?.monthlyReferralCount || 0

  return {
    monthlyCount,
    maxCount: MAX_REFERRAL_COUNT,
    canInvite: monthlyCount < MAX_REFERRAL_COUNT,
    pendingActiveBonus
  }
}

// ========================================
// GÖREV/BAŞARI SİSTEMİ
// ========================================

export interface Achievement {
  id: string
  title: string
  description: string
  reward: number
  icon: string
  requirement: {
    type: 'swaps' | 'products' | 'reviews' | 'referrals' | 'verifications' | 'special'
    count?: number
    condition?: string
  }
}

// Rozet Ödülleri - Progresif v3.0 (Tek seferlik toplam: ~70V)
// Milestone bonuslarıyla birleştiğinde daha dengeli
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_swap',
    title: 'İlk Takas',
    description: 'İlk takasınızı tamamlayın',
    reward: 5,
    icon: '🎯',
    requirement: { type: 'swaps', count: 1 }
  },
  {
    id: 'swap_master_5',
    title: 'Takas Ustası',
    description: '5 takas tamamlayın',
    reward: 10,
    icon: '🏆',
    requirement: { type: 'swaps', count: 5 }
  },
  {
    id: 'swap_legend_10',
    title: 'Takas Efsanesi',
    description: '10 takas tamamlayın',
    reward: 20,
    icon: '👑',
    requirement: { type: 'swaps', count: 10 }
  },
  {
    id: 'first_product',
    title: 'Satıcı',
    description: 'İlk ürününüzü ekleyin',
    reward: 3,
    icon: '📦',
    requirement: { type: 'products', count: 1 }
  },
  {
    id: 'product_collector_5',
    title: 'Koleksiyoncu',
    description: '5 ürün ekleyin',
    reward: 8,
    icon: '🗃️',
    requirement: { type: 'products', count: 5 }
  },
  {
    id: 'first_review',
    title: 'Eleştirmen',
    description: 'İlk değerlendirmenizi yapın',
    reward: 2,
    icon: '⭐',
    requirement: { type: 'reviews', count: 1 }
  },
  {
    id: 'reviewer_5',
    title: 'Güvenilir Değerlendirici',
    description: '5 değerlendirme yapın',
    reward: 5,
    icon: '🌟',
    requirement: { type: 'reviews', count: 5 }
  },
  {
    id: 'first_referral',
    title: 'Davetçi',
    description: 'İlk arkadaşınızı davet edin',
    reward: 3,
    icon: '🤝',
    requirement: { type: 'referrals', count: 1 }
  },
  {
    id: 'referral_master_5',
    title: 'Topluluk Lideri',
    description: '5 arkadaş davet edin',
    reward: 8,
    icon: '👥',
    requirement: { type: 'referrals', count: 5 }
  },
  {
    id: 'phone_verified',
    title: 'Doğrulanmış',
    description: 'Telefon numaranızı doğrulayın',
    reward: 5,
    icon: '📱',
    requirement: { type: 'verifications', condition: 'phone' }
  },
  {
    id: 'identity_verified',
    title: 'Güvenilir Üye',
    description: 'Kimliğinizi doğrulayın',
    reward: 10,
    icon: '🛡️',
    requirement: { type: 'verifications', condition: 'identity' }
  },
  {
    id: 'survey_complete',
    title: 'Anketör',
    description: 'Anket formunu doldurun',
    reward: 3,
    icon: '📋',
    requirement: { type: 'special', condition: 'survey' }
  }
]

/**
 * Kullanıcının başarı durumunu kontrol et
 */
export async function checkAchievements(userId: string): Promise<{
  completed: Achievement[]
  available: Achievement[]
  claimable: Achievement[]
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      products: { select: { id: true } },
      swapRequestsSent: { where: { status: 'completed' }, select: { id: true } },
      swapRequestsReceived: { where: { status: 'completed' }, select: { id: true } },
      reviewsGiven: { select: { id: true } },
      referrals: { select: { id: true } }
    }
  })

  if (!user) {
    return { completed: [], available: [], claimable: [] }
  }

  const completedIds: string[] = user.completedAchievements 
    ? JSON.parse(user.completedAchievements) 
    : []

  const stats = {
    swaps: user.swapRequestsSent.length + user.swapRequestsReceived.length,
    products: user.products.length,
    reviews: user.reviewsGiven.length,
    referrals: user.referrals.length,
    phoneVerified: user.isPhoneVerified,
    identityVerified: user.isIdentityVerified,
    surveyCompleted: user.surveyCompleted
  }

  const completed: Achievement[] = []
  const available: Achievement[] = []
  const claimable: Achievement[] = []

  for (const achievement of ACHIEVEMENTS) {
    if (completedIds.includes(achievement.id)) {
      completed.push(achievement)
      continue
    }

    let isEarned = false

    switch (achievement.requirement.type) {
      case 'swaps':
        isEarned = stats.swaps >= (achievement.requirement.count || 0)
        break
      case 'products':
        isEarned = stats.products >= (achievement.requirement.count || 0)
        break
      case 'reviews':
        isEarned = stats.reviews >= (achievement.requirement.count || 0)
        break
      case 'referrals':
        isEarned = stats.referrals >= (achievement.requirement.count || 0)
        break
      case 'verifications':
        if (achievement.requirement.condition === 'phone') {
          isEarned = stats.phoneVerified
        } else if (achievement.requirement.condition === 'identity') {
          isEarned = stats.identityVerified
        }
        break
      case 'special':
        if (achievement.requirement.condition === 'survey') {
          isEarned = stats.surveyCompleted
        }
        break
    }

    if (isEarned) {
      claimable.push(achievement)
    } else {
      available.push(achievement)
    }
  }

  return { completed, available, claimable }
}

/**
 * Başarı ödülünü talep et
 */
export async function claimAchievement(userId: string, achievementId: string): Promise<{
  success: boolean
  message: string
  bonus?: number
}> {
  const { claimable } = await checkAchievements(userId)
  
  const achievement = claimable.find(a => a.id === achievementId)
  
  if (!achievement) {
    return { success: false, message: 'Bu başarı henüz kazanılmadı veya zaten alındı' }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    return { success: false, message: 'Kullanıcı bulunamadı' }
  }

  const completedIds: string[] = user.completedAchievements 
    ? JSON.parse(user.completedAchievements) 
    : []

  completedIds.push(achievementId)

  const config = await getOrCreateSystemConfig()
  const currentDistributed = Number(config.distributedValor)
  const totalSupply = Number(config.totalValorSupply)

  if (currentDistributed + achievement.reward > totalSupply) {
    return { success: false, message: 'Sistem bonusu şu an için tükenmiş durumda' }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        valorBalance: { increment: achievement.reward },
        completedAchievements: JSON.stringify(completedIds),
        totalValorEarned: { increment: achievement.reward },
        lastActiveAt: new Date()
      }
    }),
    prisma.systemConfig.update({
      where: { id: 'main' },
      data: {
        distributedValor: { increment: achievement.reward },
        totalTransactions: { increment: 1 }
      }
    }),
    prisma.valorTransaction.create({
      data: {
        toUserId: userId,
        amount: achievement.reward,
        fee: 0,
        netAmount: achievement.reward,
        type: 'achievement_bonus',
        description: `Başarı ödülü: ${achievement.title}`
      }
    })
  ])

  return { 
    success: true, 
    message: `${achievement.title} başarısı tamamlandı!`, 
    bonus: achievement.reward 
  }
}

/**
 * Kullanıcının bonus durumunu al
 */
export async function getUserBonusStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lastDailyBonusAt: true,
      productBonusCount: true,
      reviewBonusCount: true,
      totalValorEarned: true,
      surveyCompleted: true,
      welcomeBonusGiven: true
    }
  })

  if (!user) {
    return null
  }

  const now = new Date()
  let canClaimDailyBonus = true
  let hoursUntilDailyBonus = 0

  if (user.lastDailyBonusAt) {
    const hoursSinceLastBonus = (now.getTime() - new Date(user.lastDailyBonusAt).getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastBonus < 24) {
      canClaimDailyBonus = false
      hoursUntilDailyBonus = Math.ceil(24 - hoursSinceLastBonus)
    }
  }

  return {
    dailyBonus: {
      amount: DAILY_LOGIN_BONUS,
      canClaim: canClaimDailyBonus,
      hoursUntilNext: hoursUntilDailyBonus
    },
    productBonus: {
      amount: PRODUCT_BONUS,
      claimed: user.productBonusCount || 0,
      max: MAX_PRODUCT_BONUS_COUNT,
      remaining: MAX_PRODUCT_BONUS_COUNT - (user.productBonusCount || 0)
    },
    reviewBonus: {
      amount: REVIEW_BONUS,
      claimed: user.reviewBonusCount || 0,
      max: MAX_REVIEW_BONUS_COUNT
    },
    surveyBonus: {
      amount: SURVEY_BONUS,
      claimed: user.surveyCompleted
    },
    welcomeBonus: {
      amount: WELCOME_BONUS,
      claimed: user.welcomeBonusGiven
    },
    totalEarned: user.totalValorEarned || 0
  }
}

// ========================================
// SYBIL DİRENCİ PAKETİ
// ========================================

/**
 * Minimum hesap yaşı sabiti (gün)
 */
export const MIN_ACCOUNT_AGE_DAYS = 7

// ========================================
// KÖTÜ NİYETLİ KULLANIM KORUMASI
// Sadece bonus ile takas yapılmasını önler
// ========================================

/**
 * Takas teklifi göndermek için minimum aktif ürün sayısı
 */
export const MIN_PRODUCTS_FOR_SWAP = 1

/**
 * Minimum ürün Valor değeri - Düşük değerli/sahte ürünlerle sistemi atlatmayı önler
 * Bu değerin altındaki ürünler "geçerli ürün" sayılmaz
 */
export const MIN_PRODUCT_VALOR_VALUE = 60

/**
 * Yeni kullanıcı süresi (gün) - Bu süre içinde takas limiti uygulanır
 */
export const NEW_USER_PERIOD_DAYS = 30

/**
 * Yeni kullanıcılar için maksimum takas teklifi sayısı
 */
export const NEW_USER_SWAP_LIMIT = 3

/**
 * Takas teklifi gönderme uygunluğunu kontrol et
 * Kötü niyetli kullanımı önlemek için:
 * 1. En az 1 aktif ürün eklemiş olmalı
 * 2. En az 1 ürün minimum Valor değerini karşılamalı (60V)
 * 3. İlk 30 gün içinde maksimum 3 takas teklifi
 * 4. Mevcut 7 gün / doğrulama şartı korunur
 */
export async function checkSwapEligibility(userId: string): Promise<{
  eligible: boolean
  reason?: string
  details?: {
    activeProductCount: number
    qualifiedProductCount: number
    minProductsRequired: number
    minProductValor: number
    accountAgeDays: number
    isNewUser: boolean
    swapRequestCount: number
    maxSwapRequestsForNewUser: number
    isVerified: boolean
  }
}> {
  // Kullanıcı bilgilerini ve ürünlerini getir
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      isPhoneVerified: true,
      isIdentityVerified: true,
      products: {
        where: { status: 'active' },
        select: {
          id: true,
          valorPrice: true
        }
      }
    }
  })

  if (!user) {
    return { eligible: false, reason: 'Kullanıcı bulunamadı' }
  }

  // 🔓 ADMIN BYPASS: join@takas-a.com için tüm sınırlamaları kaldır
  const ADMIN_EMAILS = ['join@takas-a.com']
  if (user.role === 'admin' || ADMIN_EMAILS.includes(user.email || '')) {
    return {
      eligible: true,
      details: {
        activeProductCount: user.products.length,
        qualifiedProductCount: user.products.length,
        minProductsRequired: 0,
        minProductValor: 0,
        accountAgeDays: 999,
        isNewUser: false,
        swapRequestCount: 0,
        maxSwapRequestsForNewUser: 999,
        isVerified: true
      }
    }
  }

  // Hesap yaşını hesapla
  const now = new Date()
  const accountAgeDays = Math.floor((now.getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
  const isNewUser = accountAgeDays < NEW_USER_PERIOD_DAYS
  const isVerified = user.isPhoneVerified || user.isIdentityVerified
  const activeProductCount = user.products.length
  
  // Minimum Valor değerini karşılayan ürünleri say
  const qualifiedProductCount = user.products.filter(
    p => (p.valorPrice ?? 0) >= MIN_PRODUCT_VALOR_VALUE
  ).length

  // Detay objesi
  const details = {
    activeProductCount,
    qualifiedProductCount,
    minProductsRequired: MIN_PRODUCTS_FOR_SWAP,
    minProductValor: MIN_PRODUCT_VALOR_VALUE,
    accountAgeDays,
    isNewUser,
    swapRequestCount: 0,
    maxSwapRequestsForNewUser: NEW_USER_SWAP_LIMIT,
    isVerified
  }

  // 1. Minimum hesap yaşı veya doğrulama kontrolü (mevcut şart)
  if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS && !isVerified) {
    const daysRemaining = MIN_ACCOUNT_AGE_DAYS - accountAgeDays
    return {
      eligible: false,
      reason: `Takas teklifi gönderebilmek için hesabınızın en az ${MIN_ACCOUNT_AGE_DAYS} günlük olması veya telefon/kimlik doğrulaması yapılması gerekiyor. Kalan süre: ${daysRemaining} gün`,
      details
    }
  }

  // 2. Minimum aktif ürün kontrolü
  if (activeProductCount < MIN_PRODUCTS_FOR_SWAP) {
    return {
      eligible: false,
      reason: `Takas teklifi gönderebilmek için en az ${MIN_PRODUCTS_FOR_SWAP} aktif ürün eklemiş olmanız gerekiyor. Önce bir ürün ekleyin ve takas topluluğuna katılın!`,
      details
    }
  }

  // 3. Minimum ürün Valor değeri kontrolü (yeni kural)
  if (qualifiedProductCount < MIN_PRODUCTS_FOR_SWAP) {
    const maxValorProduct = user.products.reduce((max, p) => 
      (p.valorPrice ?? 0) > (max?.valorPrice ?? 0) ? p : max, 
      user.products[0]
    )
    const currentMaxValor = maxValorProduct?.valorPrice ?? 0
    const neededValor = MIN_PRODUCT_VALOR_VALUE - currentMaxValor
    
    return {
      eligible: false,
      reason: `Takas teklifi gönderebilmek için en az ${MIN_PRODUCT_VALOR_VALUE} Valor değerinde bir ürününüz olması gerekiyor. Mevcut en yüksek ürün değeriniz: ${currentMaxValor} Valor. Daha değerli bir ürün ekleyin veya mevcut ürününüzü güncelleyin.`,
      details
    }
  }

  // 4. Yeni kullanıcı takas limiti kontrolü
  if (isNewUser) {
    // Son 30 gün içinde gönderilen takas tekliflerini say
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - NEW_USER_PERIOD_DAYS)
    
    const swapRequestCount = await prisma.swapRequest.count({
      where: {
        requesterId: userId,
        createdAt: { gte: thirtyDaysAgo }
      }
    })
    
    details.swapRequestCount = swapRequestCount

    if (swapRequestCount >= NEW_USER_SWAP_LIMIT) {
      return {
        eligible: false,
        reason: `Yeni kullanıcı olarak ilk ${NEW_USER_PERIOD_DAYS} gün içinde en fazla ${NEW_USER_SWAP_LIMIT} takas teklifi gönderebilirsiniz. Hesabınız ${NEW_USER_PERIOD_DAYS - accountAgeDays} gün sonra bu limiti aşacak.`,
        details
      }
    }
  }

  // Tüm kontroller geçti
  return {
    eligible: true,
    details
  }
}

/**
 * Kullanıcının takas durumunu getir (UI için)
 */
export async function getSwapEligibilityStatus(userId: string): Promise<{
  canSwap: boolean
  activeProducts: number
  qualifiedProducts: number
  minProducts: number
  minProductValor: number
  isNewUser: boolean
  swapsUsed: number
  maxSwaps: number
  daysUntilUnlimited: number
  message?: string
}> {
  const eligibility = await checkSwapEligibility(userId)
  
  const details = eligibility.details || {
    activeProductCount: 0,
    qualifiedProductCount: 0,
    minProductsRequired: MIN_PRODUCTS_FOR_SWAP,
    minProductValor: MIN_PRODUCT_VALOR_VALUE,
    accountAgeDays: 0,
    isNewUser: true,
    swapRequestCount: 0,
    maxSwapRequestsForNewUser: NEW_USER_SWAP_LIMIT,
    isVerified: false
  }

  return {
    canSwap: eligibility.eligible,
    activeProducts: details.activeProductCount,
    qualifiedProducts: details.qualifiedProductCount,
    minProducts: details.minProductsRequired,
    minProductValor: details.minProductValor,
    isNewUser: details.isNewUser,
    swapsUsed: details.swapRequestCount,
    maxSwaps: details.maxSwapRequestsForNewUser,
    daysUntilUnlimited: Math.max(0, NEW_USER_PERIOD_DAYS - details.accountAgeDays),
    message: eligibility.reason
  }
}

/**
 * Kullanıcının bonus almaya uygun olup olmadığını kontrol et
 * Sybil saldırılarını önlemek için:
 * 1. Minimum hesap yaşı (7 gün) VEYA
 * 2. Telefon/Kimlik doğrulaması yapılmış olmalı
 */
export async function checkBonusEligibility(userId: string): Promise<{
  eligible: boolean
  reason?: string
  accountAgeDays?: number
  isVerified?: boolean
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      role: true,
      createdAt: true,
      isPhoneVerified: true,
      isIdentityVerified: true
    }
  })

  if (!user) {
    return { eligible: false, reason: 'Kullanıcı bulunamadı' }
  }

  // 🔓 ADMIN BYPASS: Admin için bonus eligibility kontrolünü atla
  const ADMIN_EMAILS = ['join@takas-a.com']
  if (user.role === 'admin' || ADMIN_EMAILS.includes(user.email || '')) {
    return { 
      eligible: true, 
      accountAgeDays: 999, 
      isVerified: true 
    }
  }

  // Hesap yaşını hesapla
  const now = new Date()
  const accountAgeDays = Math.floor((now.getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
  
  // Doğrulama durumu
  const isVerified = user.isPhoneVerified || user.isIdentityVerified

  // Minimum hesap yaşı kontrolü
  if (accountAgeDays >= MIN_ACCOUNT_AGE_DAYS) {
    return { 
      eligible: true, 
      accountAgeDays, 
      isVerified 
    }
  }

  // Doğrulama yapılmış mı kontrol et
  if (isVerified) {
    return { 
      eligible: true, 
      accountAgeDays, 
      isVerified 
    }
  }

  // Her iki koşul da sağlanmıyorsa uygun değil
  const daysRemaining = MIN_ACCOUNT_AGE_DAYS - accountAgeDays
  return {
    eligible: false,
    reason: `Bonus almak için hesabınızın en az ${MIN_ACCOUNT_AGE_DAYS} günlük olması veya telefon/kimlik doğrulaması yapılması gerekiyor. Kalan süre: ${daysRemaining} gün`,
    accountAgeDays,
    isVerified
  }
}

/**
 * Güvenli bonus verme - Sybil kontrolü ile
 * Tüm bonus fonksiyonları için kullanılabilir
 */
export async function giveSecureBonus(
  userId: string,
  bonusAmount: number,
  bonusType: TransactionType,
  description: string,
  skipEligibilityCheck: boolean = false
): Promise<{ success: boolean; message: string; bonus?: number }> {
  // Sybil kontrolü (opsiyonel)
  if (!skipEligibilityCheck) {
    const eligibility = await checkBonusEligibility(userId)
    if (!eligibility.eligible) {
      return { success: false, message: eligibility.reason || 'Bonus almaya uygun değilsiniz' }
    }
  }

  const config = await getOrCreateSystemConfig()
  const currentDistributed = Number(config.distributedValor)
  const totalSupply = Number(config.totalValorSupply)

  if (currentDistributed + bonusAmount > totalSupply) {
    return { success: false, message: 'Sistem bonusu şu an için tükenmiş durumda' }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        valorBalance: { increment: bonusAmount },
        totalValorEarned: { increment: bonusAmount },
        lastActiveAt: new Date()
      }
    }),
    prisma.systemConfig.update({
      where: { id: 'main' },
      data: {
        distributedValor: { increment: bonusAmount },
        weeklyDistributedValor: { increment: bonusAmount },
        totalTransactions: { increment: 1 }
      }
    }),
    prisma.valorTransaction.create({
      data: {
        toUserId: userId,
        amount: bonusAmount,
        fee: 0,
        netAmount: bonusAmount,
        type: bonusType,
        description
      }
    })
  ])

  return { success: true, message: description, bonus: bonusAmount }
}

/**
 * Davet edilen kullanıcının ilk takasını tamamladığında referral bonusu ver
 * Yeni Sybil direnci: Bonus artık kayıt anında değil, ilk takas tamamlanınca verilir
 */
export async function markReferralFirstSwapCompleted(
  referredUserId: string
): Promise<{ success: boolean; referrerBonusGiven: boolean; referrerId?: string }> {
  // Bu kullanıcıyı davet eden referral kaydını bul
  const referral = await prisma.referral.findFirst({
    where: { 
      referredUserId,
      firstSwapCompleted: false
    },
    include: { referrer: true }
  })

  if (!referral) {
    return { success: true, referrerBonusGiven: false }
  }

  // İlk takas tamamlandı olarak işaretle
  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      firstSwapCompleted: true,
      firstSwapCompletedAt: new Date()
    }
  })

  // Davet eden kişiye bonus ver (eğer henüz verilmediyse)
  if (!referral.bonusGiven) {
    // Aylık limit kontrolü
    await resetMonthlyReferralIfNeeded(referral.referrerId)
    
    const referrer = await prisma.user.findUnique({
      where: { id: referral.referrerId },
      select: { monthlyReferralCount: true }
    })

    if (referrer && referrer.monthlyReferralCount < MAX_REFERRAL_COUNT) {
      const config = await getOrCreateSystemConfig()
      const currentDistributed = Number(config.distributedValor)
      const totalSupply = Number(config.totalValorSupply)

      if (currentDistributed + REFERRAL_BONUS <= totalSupply) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: referral.referrerId },
            data: {
              valorBalance: { increment: REFERRAL_BONUS },
              totalValorEarned: { increment: REFERRAL_BONUS },
              totalReferrals: { increment: 1 },
              monthlyReferralCount: { increment: 1 },
              lastReferralAt: new Date()
            }
          }),
          prisma.referral.update({
            where: { id: referral.id },
            data: { bonusGiven: true }
          }),
          prisma.systemConfig.update({
            where: { id: 'main' },
            data: {
              distributedValor: { increment: REFERRAL_BONUS },
              weeklyDistributedValor: { increment: REFERRAL_BONUS },
              totalTransactions: { increment: 1 }
            }
          }),
          prisma.valorTransaction.create({
            data: {
              toUserId: referral.referrerId,
              amount: REFERRAL_BONUS,
              fee: 0,
              netAmount: REFERRAL_BONUS,
              type: 'referral_bonus',
              description: `Davet edilen arkadaş ilk takasını tamamladı! 🎉`
            }
          })
        ])

        return { success: true, referrerBonusGiven: true, referrerId: referral.referrerId }
      }
    }
  }

  return { success: true, referrerBonusGiven: false }
}

/**
 * Haftalık enflasyon verilerini sıfırla (her hafta başı)
 */
export async function resetWeeklyInflationIfNeeded(): Promise<boolean> {
  const config = await getOrCreateSystemConfig()
  const now = new Date()
  const lastReset = config.lastWeeklyResetAt ? new Date(config.lastWeeklyResetAt) : null

  // Haftanın başlangıcını hesapla (Pazartesi)
  const dayOfWeek = now.getDay()
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - diffToMonday)
  startOfWeek.setHours(0, 0, 0, 0)

  // Eğer son sıfırlama bu haftanın başından önceyse sıfırla
  if (!lastReset || lastReset < startOfWeek) {
    await prisma.systemConfig.update({
      where: { id: 'main' },
      data: {
        weeklyDistributedValor: BigInt(0),
        lastWeeklyResetAt: now
      }
    })
    return true
  }

  return false
}

/**
 * Enflasyon izleme verilerini getir
 */
export async function getInflationMetrics(): Promise<{
  weekly: {
    distributed: number
    percentOfTotal: number
    percentOfRemaining: number
  }
  monthly: {
    estimated: number
    percentOfTotal: number
  }
  yearly: {
    estimated: number
    percentOfTotal: number
    yearsUntilExhaustion: number
  }
  healthStatus: 'healthy' | 'warning' | 'critical'
  recommendation?: string
}> {
  await resetWeeklyInflationIfNeeded()
  const config = await getOrCreateSystemConfig()
  
  const totalSupply = Number(config.totalValorSupply)
  const distributed = Number(config.distributedValor)
  const remaining = totalSupply - distributed
  const weeklyDistributed = Number(config.weeklyDistributedValor)

  // Haftalık istatistikler
  const weeklyPercentTotal = (weeklyDistributed / totalSupply) * 100
  const weeklyPercentRemaining = remaining > 0 ? (weeklyDistributed / remaining) * 100 : 100

  // Aylık tahmin (haftalık x 4.33)
  const monthlyEstimate = weeklyDistributed * 4.33
  const monthlyPercentTotal = (monthlyEstimate / totalSupply) * 100

  // Yıllık tahmin (haftalık x 52)
  const yearlyEstimate = weeklyDistributed * 52
  const yearlyPercentTotal = (yearlyEstimate / totalSupply) * 100
  const yearsUntilExhaustion = weeklyDistributed > 0 ? remaining / (weeklyDistributed * 52) : Infinity

  // Sağlık durumu
  let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
  let recommendation: string | undefined

  if (yearlyPercentTotal > 15) {
    healthStatus = 'critical'
    recommendation = 'Yıllık enflasyon %15\'i aştı! Bonus miktarlarını azaltmayı veya doğrulama şartlarını sıkılaştırmayı düşünün.'
  } else if (yearlyPercentTotal > 10) {
    healthStatus = 'warning'
    recommendation = 'Yıllık enflasyon %10\'u aştı. Bonus politikalarını gözden geçirin.'
  } else if (yearsUntilExhaustion < 5) {
    healthStatus = 'warning'
    recommendation = `Mevcut hızla Valor arzı ${yearsUntilExhaustion.toFixed(1)} yıl içinde tükenebilir.`
  }

  return {
    weekly: {
      distributed: weeklyDistributed,
      percentOfTotal: Math.round(weeklyPercentTotal * 1000) / 1000,
      percentOfRemaining: Math.round(weeklyPercentRemaining * 1000) / 1000
    },
    monthly: {
      estimated: Math.round(monthlyEstimate),
      percentOfTotal: Math.round(monthlyPercentTotal * 100) / 100
    },
    yearly: {
      estimated: Math.round(yearlyEstimate),
      percentOfTotal: Math.round(yearlyPercentTotal * 100) / 100,
      yearsUntilExhaustion: Math.round(yearsUntilExhaustion * 10) / 10
    },
    healthStatus,
    recommendation
  }
}

/**
 * Dinamik config değerlerini getir
 */
export async function getDynamicConfig(): Promise<{
  welcomeBonusAmount: number
  dailyBonusBase: number
  productBonusAmount: number
  referralBonusAmount: number
  reviewBonusAmount: number
  minAccountAgeDays: number
  requireVerification: boolean
}> {
  const config = await getOrCreateSystemConfig()
  
  return {
    welcomeBonusAmount: config.welcomeBonusAmount || WELCOME_BONUS,
    dailyBonusBase: config.dailyBonusBase || DAILY_LOGIN_BONUS,
    productBonusAmount: config.productBonusAmount || PRODUCT_BONUS,
    referralBonusAmount: config.referralBonusAmount || REFERRAL_BONUS,
    reviewBonusAmount: config.reviewBonusAmount || REVIEW_BONUS,
    minAccountAgeDays: config.minAccountAgeDays || MIN_ACCOUNT_AGE_DAYS,
    requireVerification: config.requireVerification ?? true
  }
}

/**
 * Dinamik config değerlerini güncelle (Admin only)
 */
export async function updateDynamicConfig(updates: {
  welcomeBonusAmount?: number
  dailyBonusBase?: number
  productBonusAmount?: number
  referralBonusAmount?: number
  reviewBonusAmount?: number
  minAccountAgeDays?: number
  requireVerification?: boolean
}): Promise<{ success: boolean; message: string }> {
  try {
    await prisma.systemConfig.update({
      where: { id: 'main' },
      data: {
        ...updates,
        updatedAt: new Date()
      }
    })
    return { success: true, message: 'Konfigürasyon güncellendi' }
  } catch (error) {
    console.error('Config güncelleme hatası:', error)
    return { success: false, message: 'Güncelleme başarısız oldu' }
  }
}

// ========================================
// SPEKÜLASYON ÖNLEME FONKSİYONLARI
// ========================================

/**
 * Kullanıcının tamamladığı takas sayısını getir
 */
export async function getCompletedSwapCount(userId: string): Promise<number> {
  const count = await prisma.swapRequest.count({
    where: {
      OR: [
        { requesterId: userId },
        { product: { userId: userId } }
      ],
      status: 'completed'
    }
  })
  return count
}

/**
 * Kullanıcının toplam bonus Valor miktarını hesapla
 */
export async function getTotalBonusValor(userId: string): Promise<number> {
  const bonusTransactions = await prisma.valorTransaction.aggregate({
    where: {
      toUserId: userId,
      type: { in: BONUS_TRANSACTION_TYPES }
    },
    _sum: { amount: true }
  })
  return bonusTransactions._sum?.amount ?? 0
}

/**
 * Kullanıcının kullanılabilir bonus Valor miktarını hesapla
 * İlk takas tamamlanana kadar bonus'un %50'si kilitli
 */
export async function getUsableBonusValor(userId: string): Promise<{
  totalBonus: number
  usableBonus: number
  lockedBonus: number
  hasCompletedFirstSwap: boolean
}> {
  const [completedSwaps, totalBonus] = await Promise.all([
    getCompletedSwapCount(userId),
    getTotalBonusValor(userId)
  ])
  
  const hasCompletedFirstSwap = completedSwaps > 0
  
  if (hasCompletedFirstSwap) {
    // İlk takas tamamlandıysa tüm bonus kullanılabilir
    return {
      totalBonus,
      usableBonus: totalBonus,
      lockedBonus: 0,
      hasCompletedFirstSwap: true
    }
  }
  
  // İlk takas tamamlanmadıysa bonus'un %50'si kullanılabilir
  const usableBonus = Math.floor(totalBonus * BONUS_USABLE_PERCENT_BEFORE_FIRST_SWAP / 100)
  const lockedBonus = totalBonus - usableBonus
  
  return {
    totalBonus,
    usableBonus,
    lockedBonus,
    hasCompletedFirstSwap: false
  }
}

/**
 * İlk takas net kazanç limiti kontrolü
 * İlk 3 takasta net +400V'dan fazla kazanılamaz
 */
export async function checkFirstSwapGainLimit(
  userId: string,
  proposedGain: number
): Promise<{
  allowed: boolean
  reason?: string
  details?: {
    completedSwaps: number
    currentNetGain: number
    proposedGain: number
    maxAllowedGain: number
    remainingAllowance: number
  }
}> {
  const completedSwaps = await getCompletedSwapCount(userId)
  
  // İlk 3 takası geçtiyse limit yok
  if (completedSwaps >= FIRST_SWAPS_COUNT) {
    return { allowed: true }
  }
  
  // İlk takaslardaki toplam net kazancı hesapla
  // Aldıkları (swap_complete ile gelen net miktar)
  const received = await prisma.valorTransaction.aggregate({
    where: {
      toUserId: userId,
      type: 'swap_complete'
    },
    _sum: { netAmount: true }
  })
  
  // Verdikleri (kesinti + ürün takasında verilen değer)
  const paid = await prisma.valorTransaction.aggregate({
    where: {
      fromUserId: userId,
      type: { in: ['swap_fee', 'swap_complete'] }
    },
    _sum: { amount: true }
  })
  
  const totalReceived = received._sum?.netAmount ?? 0
  const totalPaid = paid._sum?.amount ?? 0
  const currentNetGain = Math.max(0, totalReceived - totalPaid)
  const remainingAllowance = MAX_NET_GAIN_FIRST_SWAPS - currentNetGain
  
  const details = {
    completedSwaps,
    currentNetGain,
    proposedGain,
    maxAllowedGain: MAX_NET_GAIN_FIRST_SWAPS,
    remainingAllowance
  }
  
  // Önerilen kazanç limiti aşıyor mu?
  if (currentNetGain + proposedGain > MAX_NET_GAIN_FIRST_SWAPS) {
    return {
      allowed: false,
      reason: `İlk ${FIRST_SWAPS_COUNT} takasınızda toplam ${MAX_NET_GAIN_FIRST_SWAPS} Valor'dan fazla net kazanç elde edemezsiniz. ` +
        `Mevcut kazancınız: ${currentNetGain}V, kalan hakkınız: ${Math.max(0, remainingAllowance)}V. ` +
        `Bu kural yeni kullanıcıların sistemi tanıması ve adil takas yapması için uygulanmaktadır.`,
      details
    }
  }
  
  return { allowed: true, details }
}

/**
 * Kullanıcının takas yapma kapasitesini kontrol et
 * Bonus kısıtlaması + net kazanç limiti dahil
 */
export async function checkSwapCapacity(
  userId: string,
  requiredValor: number,
  potentialGain: number
): Promise<{
  canSwap: boolean
  reason?: string
  usableBalance: number
  lockedBonus: number
  gainLimitOk: boolean
}> {
  // Kullanıcının mevcut bakiyesini al
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { valorBalance: true }
  })
  
  if (!user) {
    return {
      canSwap: false,
      reason: 'Kullanıcı bulunamadı',
      usableBalance: 0,
      lockedBonus: 0,
      gainLimitOk: false
    }
  }
  
  // Bonus kısıtlamasını hesapla
  const bonusInfo = await getUsableBonusValor(userId)
  
  // Kullanılabilir bakiye = Toplam bakiye - Kilitli bonus
  const usableBalance = Math.max(0, (user.valorBalance ?? 0) - bonusInfo.lockedBonus)
  
  // Net kazanç limiti kontrolü
  const gainCheck = await checkFirstSwapGainLimit(userId, potentialGain)
  
  // Yeterli bakiye var mı?
  if (usableBalance < requiredValor) {
    const shortfall = requiredValor - usableBalance
    return {
      canSwap: false,
      reason: bonusInfo.lockedBonus > 0
        ? `Yeterli kullanılabilir bakiyeniz yok. ${bonusInfo.lockedBonus}V bonus'unuz ilk takasınızı tamamlayana kadar kilitli. ` +
          `Mevcut kullanılabilir bakiye: ${usableBalance}V, gereken: ${requiredValor}V, eksik: ${shortfall}V`
        : `Yeterli Valor bakiyeniz yok. Mevcut: ${usableBalance}V, gereken: ${requiredValor}V`,
      usableBalance,
      lockedBonus: bonusInfo.lockedBonus,
      gainLimitOk: gainCheck.allowed
    }
  }
  
  // Net kazanç limiti aşılıyor mu?
  if (!gainCheck.allowed) {
    return {
      canSwap: false,
      reason: gainCheck.reason,
      usableBalance,
      lockedBonus: bonusInfo.lockedBonus,
      gainLimitOk: false
    }
  }
  
  return {
    canSwap: true,
    usableBalance,
    lockedBonus: bonusInfo.lockedBonus,
    gainLimitOk: true
  }
}

/**
 * Kullanıcının ürün değer durumunu kontrol et (60V uyarısı için)
 */
export async function checkProductValueStatus(userId: string): Promise<{
  hasQualifiedProduct: boolean
  maxProductValue: number
  minRequiredValue: number
  shortfall: number
  recommendation: string
}> {
  const products = await prisma.product.findMany({
    where: {
      userId: userId,
      status: 'available'
    },
    select: { valorPrice: true }
  })
  
  const maxProductValue = products.reduce(
    (max, p) => Math.max(max, p.valorPrice ?? 0), 
    0
  )
  
  const hasQualifiedProduct = maxProductValue >= MIN_PRODUCT_VALOR_VALUE
  const shortfall = Math.max(0, MIN_PRODUCT_VALOR_VALUE - maxProductValue)
  
  let recommendation = ''
  if (!hasQualifiedProduct) {
    if (products.length === 0) {
      recommendation = 'Takas yapabilmek için önce en az 1 ürün eklemeniz gerekiyor. Ürün değeri minimum 60 Valor olmalıdır.'
    } else {
      recommendation = `Mevcut en değerli ürününüz ${maxProductValue} Valor. Takas yapabilmek için en az ${MIN_PRODUCT_VALOR_VALUE} Valor değerinde bir ürün eklemeniz gerekiyor. ` +
        `${shortfall} Valor daha değerli bir ürün ekleyin veya mevcut ürününüzün değerini güncelleyin.`
    }
  }
  
  return {
    hasQualifiedProduct,
    maxProductValue,
    minRequiredValue: MIN_PRODUCT_VALOR_VALUE,
    shortfall,
    recommendation
  }
}

/**
 * Kullanıcının tam ekonomik durumunu getir (UI için)
 */
export async function getUserEconomicStatus(userId: string): Promise<{
  valorBalance: number
  usableBalance: number
  lockedBonus: number
  totalBonus: number
  hasCompletedFirstSwap: boolean
  completedSwapCount: number
  netGainFromSwaps: number
  remainingGainAllowance: number
  isInFirstSwapsPeriod: boolean
  productValueStatus: {
    hasQualifiedProduct: boolean
    maxProductValue: number
    minRequiredValue: number
    shortfall: number
    recommendation: string
  }
}> {
  const [user, bonusInfo, completedSwaps, productStatus] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { valorBalance: true }
    }),
    getUsableBonusValor(userId),
    getCompletedSwapCount(userId),
    checkProductValueStatus(userId)
  ])
  
  const valorBalance = user?.valorBalance ?? 0
  const usableBalance = Math.max(0, valorBalance - bonusInfo.lockedBonus)
  
  // Net kazanç hesapla
  const swapTransactions = await prisma.valorTransaction.aggregate({
    where: { toUserId: userId, type: 'swap_complete' },
    _sum: { amount: true }
  })
  const netGainFromSwaps = swapTransactions._sum?.amount ?? 0
  
  const isInFirstSwapsPeriod = completedSwaps < FIRST_SWAPS_COUNT
  const remainingGainAllowance = isInFirstSwapsPeriod 
    ? Math.max(0, MAX_NET_GAIN_FIRST_SWAPS - netGainFromSwaps)
    : Infinity
  
  return {
    valorBalance,
    usableBalance,
    lockedBonus: bonusInfo.lockedBonus,
    totalBonus: bonusInfo.totalBonus,
    hasCompletedFirstSwap: bonusInfo.hasCompletedFirstSwap,
    completedSwapCount: completedSwaps,
    netGainFromSwaps,
    remainingGainAllowance: remainingGainAllowance === Infinity ? -1 : remainingGainAllowance,
    isInFirstSwapsPeriod,
    productValueStatus: productStatus
  }
}
