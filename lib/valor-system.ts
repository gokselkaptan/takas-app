import prisma from './db'

// ========================================
// VALOR EKONOMİ SİSTEMİ
// Progresif Kesinti + Akan Nehir Modeli
// ========================================

// Sabitler
export const TOTAL_VALOR_SUPPLY = 1_000_000_000 // 1 Milyar
export const WELCOME_BONUS = 50 // Hoşgeldin bonusu
export const SURVEY_BONUS = 25 // Anket tamamlama bonusu
export const REFERRAL_BONUS = 15 // Arkadaş davet bonusu (davet başına)
export const REFERRAL_ACTIVE_BONUS = 15 // Davet edilen arkadaş 10+ giriş yaparsa ekstra bonus
export const MAX_REFERRAL_COUNT = 5 // Aylık maksimum davet sayısı
export const REFERRAL_LOGIN_THRESHOLD = 10 // Aktif bonus için gereken giriş sayısı
export const SWAP_BONUS_MIN = 25 // Takas bonusu (min)
export const SWAP_BONUS_MAX = 100 // Takas bonusu (max)
export const MULTI_SWAP_EXTRA_BONUS = 50 // Çoklu takas extra bonus

// Yeni Bonus Sabitleri
export const PRODUCT_BONUS = 30 // Ürün ekleme bonusu (ilk 3 ürün için - TAKAS TAMAMLANINCA)
export const MAX_PRODUCT_BONUS_COUNT = 3 // Maksimum ürün bonusu sayısı
export const REVIEW_BONUS = 10 // Değerlendirme bonusu
export const MAX_REVIEW_BONUS_COUNT = 10 // Maksimum review bonusu sayısı (ayda)

// Streak Sistemi - Daily Bonus yerine
export const STREAK_REWARDS = [
  { days: 1, bonus: 3 },    // 1 gün: 3V
  { days: 3, bonus: 10 },   // 3 gün streak: 10V (toplam)
  { days: 7, bonus: 25 },   // 7 gün streak: 25V
  { days: 14, bonus: 50 },  // 14 gün streak: 50V
  { days: 30, bonus: 100 }, // 30 gün streak: 100V (aylık büyük ödül)
] as const
export const MAX_STREAK_DAYS = 30 // Streak maksimum gün sayısı
export const DAILY_LOGIN_BONUS = 3 // Baz günlük bonus (streak'siz)

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
  productValorPrice: number
): Promise<{
  success: boolean
  fee: number
  netAmount: number
  breakdown: FeeBreakdown
  error?: string
}> {
  const swapRequest = await prisma.swapRequest.findUnique({
    where: { id: swapRequestId },
    include: {
      product: true,
      requester: true,
      owner: true
    }
  })

  if (!swapRequest) {
    return { success: false, fee: 0, netAmount: 0, breakdown: {} as FeeBreakdown, error: 'Takas talebi bulunamadı' }
  }

  if (swapRequest.status !== 'accepted') {
    return { success: false, fee: 0, netAmount: 0, breakdown: {} as FeeBreakdown, error: 'Takas henüz onaylanmamış' }
  }

  // Progresif kesinti hesapla
  const breakdown = calculateProgressiveFee(productValorPrice)
  const fee = breakdown.total
  const netAmount = productValorPrice - fee

  // Bonus hesapla (ürün değerine göre %5-10 arası)
  const bonusRate = Math.min(0.1, 0.05 + (productValorPrice / 50000) * 0.05)
  const swapBonus = Math.min(SWAP_BONUS_MAX, Math.max(SWAP_BONUS_MIN, Math.round(productValorPrice * bonusRate)))

  try {
    await prisma.$transaction([
      // Takas durumunu güncelle
      prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: { status: 'completed' }
      }),

      // Ürün durumunu güncelle (takası tamamlandı)
      prisma.product.update({
        where: { id: swapRequest.productId },
        data: { status: 'swapped' }
      }),

      // Satıcıya (owner) net miktar ver
      prisma.user.update({
        where: { id: swapRequest.ownerId },
        data: {
          valorBalance: { increment: netAmount + swapBonus },
          lastActiveAt: new Date()
        }
      }),

      // Alıcının (requester) aktivitesini güncelle
      prisma.user.update({
        where: { id: swapRequest.requesterId },
        data: {
          lastActiveAt: new Date()
        }
      }),

      // Topluluk havuzuna kesinti ekle
      prisma.systemConfig.update({
        where: { id: 'main' },
        data: {
          communityPoolValor: { increment: fee },
          totalFeesCollected: { increment: fee },
          totalSwapsCompleted: { increment: 1 },
          totalTransactions: { increment: 3 }
        }
      }),

      // İşlem kaydı: Takas tamamlama
      prisma.valorTransaction.create({
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
      }),

      // İşlem kaydı: Kesinti
      prisma.valorTransaction.create({
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
      }),

      // İşlem kaydı: Bonus
      prisma.valorTransaction.create({
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
    ])

    return {
      success: true,
      fee,
      netAmount: netAmount + swapBonus,
      breakdown
    }
  } catch (error) {
    console.error('Takas tamamlama hatası:', error)
    return {
      success: false,
      fee: 0,
      netAmount: 0,
      breakdown: {} as FeeBreakdown,
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

// ========================================
// YENİ BONUS FONKSİYONLARI
// ========================================

/**
 * Günlük giriş bonusu ver - STREAK SİSTEMİ
 * Ardışık giriş yapan kullanıcılara artan bonuslar verir
 */
export async function giveDailyBonus(userId: string): Promise<{ 
  success: boolean; 
  message: string; 
  bonus?: number;
  streak?: number;
  nextMilestone?: { days: number; bonus: number };
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
        streak: user.loginStreak || 0
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
    
    // Dün giriş yaptıysa streak devam ediyor
    if (lastStreakDayNormalized.getTime() === yesterday.getTime()) {
      newStreak = Math.min((user.loginStreak || 0) + 1, MAX_STREAK_DAYS)
    }
    // 2+ gün arayla giriş yaptıysa streak sıfırlanır
    else if (lastStreakDayNormalized.getTime() < yesterday.getTime()) {
      newStreak = 1
    }
  }

  // Streak milestone kontrolü ve bonus hesaplama
  let bonusAmount = DAILY_LOGIN_BONUS // Baz bonus (3V)
  let milestoneBonus = 0
  let milestoneMessage = ''
  
  // Milestone'a ulaşıldı mı kontrol et
  for (const reward of STREAK_REWARDS) {
    if (newStreak === reward.days) {
      milestoneBonus = reward.bonus
      milestoneMessage = ` 🎉 ${reward.days} günlük streak! +${reward.bonus}V extra bonus!`
      break
    }
  }
  
  const totalBonus = bonusAmount + milestoneBonus

  const config = await getOrCreateSystemConfig()
  const currentDistributed = Number(config.distributedValor)
  const totalSupply = Number(config.totalValorSupply)

  if (currentDistributed + totalBonus > totalSupply) {
    return { success: false, message: 'Sistem bonusu şu an için tükenmiş durumda' }
  }

  // Sonraki milestone bul
  const nextMilestone = STREAK_REWARDS.find(r => r.days > newStreak) || null

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
          ? `Günlük streak bonusu (${newStreak}. gün) + Milestone ödülü!`
          : `Günlük streak bonusu (${newStreak}. gün)`
      }
    })
  ])

  return { 
    success: true, 
    message: `+${totalBonus} Valor kazandınız!${milestoneMessage}`, 
    bonus: totalBonus,
    streak: newStreak,
    nextMilestone: nextMilestone ? { days: nextMilestone.days, bonus: nextMilestone.bonus } : undefined
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
 * Ürün takası bonusu ver - TAKAS TAMAMLANINCA TETİKLENİR
 * Hem satıcı hem alıcı için (eğer bekleyen bonusları varsa)
 */
export async function giveProductBonusOnSwap(userId: string): Promise<{ success: boolean; message: string; bonus?: number }> {
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
    // Bekleyen bonusu sıfırla
    await prisma.user.update({
      where: { id: userId },
      data: { pendingProductBonus: 0 }
    })
    return { success: true, message: 'Maksimum ürün bonusuna zaten ulaşılmış' }
  }

  const config = await getOrCreateSystemConfig()
  const currentDistributed = Number(config.distributedValor)
  const totalSupply = Number(config.totalValorSupply)

  if (currentDistributed + PRODUCT_BONUS > totalSupply) {
    return { success: false, message: 'Sistem bonusu şu an için tükenmiş durumda' }
  }

  const newBonusCount = (user.productBonusCount || 0) + 1
  const newPendingCount = Math.max(0, (user.pendingProductBonus || 0) - 1)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        valorBalance: { increment: PRODUCT_BONUS },
        productBonusCount: newBonusCount,
        pendingProductBonus: newPendingCount,
        totalValorEarned: { increment: PRODUCT_BONUS },
        lastActiveAt: new Date()
      }
    }),
    prisma.systemConfig.update({
      where: { id: 'main' },
      data: {
        distributedValor: { increment: PRODUCT_BONUS },
        totalTransactions: { increment: 1 }
      }
    }),
    prisma.valorTransaction.create({
      data: {
        toUserId: userId,
        amount: PRODUCT_BONUS,
        fee: 0,
        netAmount: PRODUCT_BONUS,
        type: 'product_bonus',
        description: `Takas tamamlama bonusu! (${newBonusCount}/${MAX_PRODUCT_BONUS_COUNT})`
      }
    })
  ])

  return { 
    success: true, 
    message: `🎉 Takas tamamlama bonusu! +${PRODUCT_BONUS} Valor (${newBonusCount}/${MAX_PRODUCT_BONUS_COUNT})`, 
    bonus: PRODUCT_BONUS 
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
 * Değerlendirme bonusu ver
 */
export async function giveReviewBonus(userId: string): Promise<{ success: boolean; message: string; bonus?: number }> {
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

  const config = await getOrCreateSystemConfig()
  const currentDistributed = Number(config.distributedValor)
  const totalSupply = Number(config.totalValorSupply)

  if (currentDistributed + REVIEW_BONUS > totalSupply) {
    return { success: false, message: 'Sistem bonusu şu an için tükenmiş durumda' }
  }

  const newBonusCount = (user.reviewBonusCount || 0) + 1

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        valorBalance: { increment: REVIEW_BONUS },
        reviewBonusCount: newBonusCount,
        totalValorEarned: { increment: REVIEW_BONUS },
        lastActiveAt: new Date()
      }
    }),
    prisma.systemConfig.update({
      where: { id: 'main' },
      data: {
        distributedValor: { increment: REVIEW_BONUS },
        totalTransactions: { increment: 1 }
      }
    }),
    prisma.valorTransaction.create({
      data: {
        toUserId: userId,
        amount: REVIEW_BONUS,
        fee: 0,
        netAmount: REVIEW_BONUS,
        type: 'review_bonus',
        description: `Değerlendirme bonusu (${newBonusCount}/${MAX_REVIEW_BONUS_COUNT} bu ay)`
      }
    })
  ])

  return { 
    success: true, 
    message: `Değerlendirme bonusu alındı!`, 
    bonus: REVIEW_BONUS 
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
 * Referral bonusu ver (davet eden kişiye)
 */
export async function giveReferralBonus(
  referrerId: string, 
  referredUserId: string
): Promise<{ success: boolean; message: string; bonus?: number }> {
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
      message: `Bu ay maksimum ${MAX_REFERRAL_COUNT} davet bonusuna ulaştınız. Yeni ay başında tekrar davet edebilirsiniz.` 
    }
  }

  const config = await getOrCreateSystemConfig()
  const currentDistributed = Number(config.distributedValor)
  const totalSupply = Number(config.totalValorSupply)

  if (currentDistributed + REFERRAL_BONUS > totalSupply) {
    return { success: false, message: 'Sistem bonusu şu an için tükenmiş durumda' }
  }

  const newMonthlyCount = referrer.monthlyReferralCount + 1

  await prisma.$transaction([
    // Davet edene bonus ver
    prisma.user.update({
      where: { id: referrerId },
      data: {
        valorBalance: { increment: REFERRAL_BONUS },
        totalValorEarned: { increment: REFERRAL_BONUS },
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
        distributedValor: { increment: REFERRAL_BONUS },
        totalTransactions: { increment: 1 }
      }
    }),
    // İşlem kaydı
    prisma.valorTransaction.create({
      data: {
        toUserId: referrerId,
        amount: REFERRAL_BONUS,
        fee: 0,
        netAmount: REFERRAL_BONUS,
        type: 'referral_bonus',
        description: `Arkadaş davet bonusu (${newMonthlyCount}/${MAX_REFERRAL_COUNT} bu ay)`
      }
    })
  ])

  return { 
    success: true, 
    message: `Davet bonusu alındı! (${newMonthlyCount}/${MAX_REFERRAL_COUNT} bu ay)`, 
    bonus: REFERRAL_BONUS 
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

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_swap',
    title: 'İlk Takas',
    description: 'İlk takasınızı tamamlayın',
    reward: 20,
    icon: '🎯',
    requirement: { type: 'swaps', count: 1 }
  },
  {
    id: 'swap_master_5',
    title: 'Takas Ustası',
    description: '5 takas tamamlayın',
    reward: 50,
    icon: '🏆',
    requirement: { type: 'swaps', count: 5 }
  },
  {
    id: 'swap_legend_10',
    title: 'Takas Efsanesi',
    description: '10 takas tamamlayın',
    reward: 100,
    icon: '👑',
    requirement: { type: 'swaps', count: 10 }
  },
  {
    id: 'first_product',
    title: 'Satıcı',
    description: 'İlk ürününüzü ekleyin',
    reward: 15,
    icon: '📦',
    requirement: { type: 'products', count: 1 }
  },
  {
    id: 'product_collector_5',
    title: 'Koleksiyoncu',
    description: '5 ürün ekleyin',
    reward: 40,
    icon: '🗃️',
    requirement: { type: 'products', count: 5 }
  },
  {
    id: 'first_review',
    title: 'Eleştirmen',
    description: 'İlk değerlendirmenizi yapın',
    reward: 10,
    icon: '⭐',
    requirement: { type: 'reviews', count: 1 }
  },
  {
    id: 'reviewer_5',
    title: 'Güvenilir Değerlendirici',
    description: '5 değerlendirme yapın',
    reward: 30,
    icon: '🌟',
    requirement: { type: 'reviews', count: 5 }
  },
  {
    id: 'first_referral',
    title: 'Davetçi',
    description: 'İlk arkadaşınızı davet edin',
    reward: 15,
    icon: '🤝',
    requirement: { type: 'referrals', count: 1 }
  },
  {
    id: 'referral_master_5',
    title: 'Topluluk Lideri',
    description: '5 arkadaş davet edin',
    reward: 50,
    icon: '👥',
    requirement: { type: 'referrals', count: 5 }
  },
  {
    id: 'phone_verified',
    title: 'Doğrulanmış',
    description: 'Telefon numaranızı doğrulayın',
    reward: 15,
    icon: '📱',
    requirement: { type: 'verifications', condition: 'phone' }
  },
  {
    id: 'identity_verified',
    title: 'Güvenilir Üye',
    description: 'Kimliğinizi doğrulayın',
    reward: 50,
    icon: '🛡️',
    requirement: { type: 'verifications', condition: 'identity' }
  },
  {
    id: 'survey_complete',
    title: 'Anketör',
    description: 'Anket formunu doldurun',
    reward: 10,
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
      createdAt: true,
      isPhoneVerified: true,
      isIdentityVerified: true
    }
  })

  if (!user) {
    return { eligible: false, reason: 'Kullanıcı bulunamadı' }
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
