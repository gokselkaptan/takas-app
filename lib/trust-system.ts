/**
 * TAKAS-A Güven Sistemi
 * 
 * 1. Kimlik Doğrulama - Telefon veya belge ile doğrulama
 * 2. Depozito Sistemi - Takas öncesi Valor kilitleme
 * 3. Escrow - Çift taraflı onay sistemi
 */

import prisma from './db'
import { calculateNewTrustScore, TRUST_SCORE_DANGER, TRUST_SCORE_SUSPENDED } from './swap-config'

// ============= SABİTLER =============

// Depozito oranları (ürün değerinin yüzdesi)
export const DEPOSIT_RATES = {
  unverified: 0.20,      // Doğrulanmamış kullanıcı: %20 depozito
  phoneVerified: 0.10,   // Telefon doğrulanmış: %10 depozito
  fullyVerified: 0.05,   // Tam doğrulanmış: %5 depozito
  trustedUser: 0.02,     // Güvenilir kullanıcı (10+ başarılı takas): %2 depozito
}

// Trust score eşikleri
export const TRUST_THRESHOLDS = {
  LOW: 50,               // Düşük güven
  MEDIUM: 75,            // Orta güven
  HIGH: 90,              // Yüksek güven
}

// ============= TRUST RESTRICTIONS (AKTİF) =============

export interface TrustRestrictions {
  canSwap: boolean
  isSuspended: boolean
  requiresHigherDeposit: boolean
  depositMultiplier: number
  maxActiveSwaps: number
  limitedSwapsPerDay: number
  requiresPhoneVerification: boolean
  cannotBoostProducts: boolean
  warningMessage: string | null
  message?: string
}

/**
 * Trust score'a göre kısıtlamalar — AKTİF OLARAK UYGULANIR
 */
export function getTrustRestrictions(trustScore: number): TrustRestrictions {
  // 0-30: Askıya alınmış
  if (trustScore < 30) {
    return {
      canSwap: false,
      isSuspended: true,
      requiresHigherDeposit: true,
      depositMultiplier: 2,
      maxActiveSwaps: 0,
      limitedSwapsPerDay: 0,
      requiresPhoneVerification: true,
      cannotBoostProducts: true,
      warningMessage: '🚫 Hesabınız düşük güven puanı nedeniyle askıya alınmıştır. Destek ile iletişime geçin.',
      message: 'Hesabınız düşük güven puanı nedeniyle askıya alındı. Destek ekibiyle iletişime geçin.'
    }
  }
  
  // 30-50: Çok kısıtlı (tehlikeli bölge)
  if (trustScore < TRUST_THRESHOLDS.LOW) {
    return {
      canSwap: true,
      isSuspended: false,
      requiresHigherDeposit: true,
      depositMultiplier: 2.0, // %200 teminat
      maxActiveSwaps: 1,
      limitedSwapsPerDay: 2,
      requiresPhoneVerification: true,
      cannotBoostProducts: true,
      warningMessage: '🔴 Güven puanınız kritik seviyede. Takas haklarınız kısıtlanmıştır.',
      message: 'Düşük güven puanı nedeniyle teminat artırıldı ve tek takas ile sınırlısınız.'
    }
  }
  
  // 50-75: Kısıtlı (uyarı bölgesi)
  if (trustScore < TRUST_THRESHOLDS.MEDIUM) {
    return {
      canSwap: true,
      isSuspended: false,
      requiresHigherDeposit: true,
      depositMultiplier: 1.5, // %150 teminat
      maxActiveSwaps: 3,
      limitedSwapsPerDay: 5,
      requiresPhoneVerification: true,
      cannotBoostProducts: false,
      warningMessage: '⚠️ Güven puanınız düşük. Başarılı takaslar yaparak puanınızı yükseltebilirsiniz.',
    }
  }
  
  // 75-90: Normal
  if (trustScore < TRUST_THRESHOLDS.HIGH) {
    return {
      canSwap: true,
      isSuspended: false,
      requiresHigherDeposit: false,
      depositMultiplier: 1.0,
      maxActiveSwaps: 5,
      limitedSwapsPerDay: 99,
      requiresPhoneVerification: false,
      cannotBoostProducts: false,
      warningMessage: null,
    }
  }
  
  // 90+: Güvenilir
  return {
    canSwap: true,
    isSuspended: false,
    requiresHigherDeposit: false,
    depositMultiplier: 0.8, // %20 indirimli teminat
    maxActiveSwaps: 10,
    limitedSwapsPerDay: 99,
    requiresPhoneVerification: false,
    cannotBoostProducts: false,
    warningMessage: null,
  }
}

// Minimum değerler
export const MIN_DEPOSIT = 5  // Minimum depozito Valor

// ============= TİPLER =============

export interface UserTrustInfo {
  isPhoneVerified: boolean
  isIdentityVerified: boolean
  trustScore: number
  completedSwaps: number
  trustLevel: 'unverified' | 'phoneVerified' | 'fullyVerified' | 'trustedUser'
  depositRate: number
}

export interface DepositCalculation {
  requesterDeposit: number
  ownerDeposit: number
  totalLocked: number
  requesterTrustLevel: string
  ownerTrustLevel: string
}

// ============= YARDIMCI FONKSİYONLAR =============

/**
 * Kullanıcının güven seviyesini hesapla
 */
export async function getUserTrustInfo(userId: string): Promise<UserTrustInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPhoneVerified: true,
      isIdentityVerified: true,
      trustScore: true,
      _count: {
        select: {
          swapRequestsSent: {
            where: { status: 'completed' }
          },
          swapRequestsReceived: {
            where: { status: 'completed' }
          }
        }
      }
    }
  })

  if (!user) {
    return {
      isPhoneVerified: false,
      isIdentityVerified: false,
      trustScore: 0,
      completedSwaps: 0,
      trustLevel: 'unverified',
      depositRate: DEPOSIT_RATES.unverified
    }
  }

  const completedSwaps = user._count.swapRequestsSent + user._count.swapRequestsReceived

  // Trust level belirleme
  let trustLevel: UserTrustInfo['trustLevel'] = 'unverified'
  let depositRate = DEPOSIT_RATES.unverified

  if (completedSwaps >= 10 && user.trustScore >= TRUST_THRESHOLDS.HIGH) {
    trustLevel = 'trustedUser'
    depositRate = DEPOSIT_RATES.trustedUser
  } else if (user.isIdentityVerified) {
    trustLevel = 'fullyVerified'
    depositRate = DEPOSIT_RATES.fullyVerified
  } else if (user.isPhoneVerified) {
    trustLevel = 'phoneVerified'
    depositRate = DEPOSIT_RATES.phoneVerified
  }

  return {
    isPhoneVerified: user.isPhoneVerified,
    isIdentityVerified: user.isIdentityVerified,
    trustScore: user.trustScore,
    completedSwaps,
    trustLevel,
    depositRate
  }
}

/**
 * Takas için gereken depozitoları hesapla
 */
export async function calculateDeposits(
  requesterId: string,
  ownerId: string,
  productValorPrice: number,
  offeredProductValorPrice?: number
): Promise<DepositCalculation> {
  const [requesterInfo, ownerInfo] = await Promise.all([
    getUserTrustInfo(requesterId),
    getUserTrustInfo(ownerId)
  ])

  // Depozito hesaplama
  const requesterDeposit = Math.max(
    MIN_DEPOSIT,
    Math.round(productValorPrice * requesterInfo.depositRate)
  )

  const ownerDeposit = offeredProductValorPrice 
    ? Math.max(MIN_DEPOSIT, Math.round(offeredProductValorPrice * ownerInfo.depositRate))
    : 0 // Sadece Valor takasında owner depozito yatırmaz

  return {
    requesterDeposit,
    ownerDeposit,
    totalLocked: requesterDeposit + ownerDeposit,
    requesterTrustLevel: requesterInfo.trustLevel,
    ownerTrustLevel: ownerInfo.trustLevel
  }
}

/**
 * Depozito kilitle
 * 🔒 Race condition fix: Tüm işlem $transaction() içinde atomik yapılır
 */
export async function lockDeposit(
  userId: string,
  amount: number,
  swapRequestId: string,
  role: 'requester' | 'owner'
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      // Transaction içinde güncel bakiyeyi oku
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { valorBalance: true, lockedValor: true }
      })

      if (!user) {
        throw new Error('Kullanıcı bulunamadı')
      }

      const availableBalance = user.valorBalance - user.lockedValor
      if (availableBalance < amount) {
        throw new Error(`Yetersiz bakiye. Gerekli: ${amount} Valor, Mevcut: ${availableBalance} Valor`)
      }

      // Kullanıcının Valor'unu kilitle
      await tx.user.update({
        where: { id: userId },
        data: { lockedValor: { increment: amount } }
      })

      // Swap request'i güncelle
      const updateData = role === 'requester' 
        ? { requesterDeposit: amount }
        : { ownerDeposit: amount }

      await tx.swapRequest.update({
        where: { id: swapRequestId },
        data: updateData
      })

      // EscrowLedger kaydı — freeze
      await tx.escrowLedger.create({
        data: {
          swapRequestId,
          userId,
          type: 'freeze',
          amount,
          balanceBefore: user.lockedValor,
          balanceAfter: user.lockedValor + amount,
          reason: `Takas teminatı kilitlendi (${role})`
        }
      })
    })

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Depozito kilitleme hatası' }
  }
}

/**
 * Escrow'u etkinleştir (her iki taraf da depozito yatırdığında)
 */
export async function activateEscrow(swapRequestId: string): Promise<boolean> {
  const swap = await prisma.swapRequest.findUnique({
    where: { id: swapRequestId },
    select: { requesterDeposit: true, ownerDeposit: true, offeredProductId: true }
  })

  if (!swap) return false

  // Requester her zaman depozito yatırmalı
  if (!swap.requesterDeposit) return false

  // Ürün takasıysa owner da depozito yatırmalı
  if (swap.offeredProductId && !swap.ownerDeposit) return false

  await prisma.swapRequest.update({
    where: { id: swapRequestId },
    data: {
      escrowStatus: 'locked',
      depositsLocked: true
    }
  })

  return true
}

/**
 * Escrow'u serbest bırak (başarılı takas)
 * 🔒 Race condition fix: Tüm işlem $transaction() içinde atomik yapılır
 */
export async function releaseEscrow(swapRequestId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const swap = await tx.swapRequest.findUnique({
      where: { id: swapRequestId },
      select: {
        requesterId: true,
        ownerId: true,
        requesterDeposit: true,
        ownerDeposit: true,
        escrowStatus: true
      }
    })

    if (!swap || swap.escrowStatus !== 'locked') return

    // Depozitoları serbest bırak
    if (swap.requesterDeposit) {
      const reqUser = await tx.user.findUnique({ where: { id: swap.requesterId }, select: { lockedValor: true } })
      await tx.user.update({
        where: { id: swap.requesterId },
        data: { lockedValor: { decrement: swap.requesterDeposit } }
      })
      await tx.escrowLedger.create({
        data: {
          swapRequestId,
          userId: swap.requesterId,
          type: 'unlock',
          amount: swap.requesterDeposit,
          balanceBefore: reqUser?.lockedValor ?? 0,
          balanceAfter: Math.max(0, (reqUser?.lockedValor ?? 0) - swap.requesterDeposit),
          reason: 'Takas tamamlandı — depozito iade edildi'
        }
      })
    }

    if (swap.ownerDeposit) {
      const ownUser = await tx.user.findUnique({ where: { id: swap.ownerId }, select: { lockedValor: true } })
      await tx.user.update({
        where: { id: swap.ownerId },
        data: { lockedValor: { decrement: swap.ownerDeposit } }
      })
      await tx.escrowLedger.create({
        data: {
          swapRequestId,
          userId: swap.ownerId,
          type: 'unlock',
          amount: swap.ownerDeposit,
          balanceBefore: ownUser?.lockedValor ?? 0,
          balanceAfter: Math.max(0, (ownUser?.lockedValor ?? 0) - swap.ownerDeposit),
          reason: 'Takas tamamlandı — depozito iade edildi'
        }
      })
    }

    await tx.swapRequest.update({
      where: { id: swapRequestId },
      data: { escrowStatus: 'released' }
    })
  })
}

/**
 * Escrow anlaşmazlık durumu
 */
export async function disputeEscrow(
  swapRequestId: string,
  reason: string
): Promise<void> {
  await prisma.swapRequest.update({
    where: { id: swapRequestId },
    data: { escrowStatus: 'disputed' }
  })

  // Dispute kaydı zaten var, sadece escrow durumunu güncelliyoruz
}

/**
 * Ceza uygula (takas iptali/dolandırıcılık durumunda)
 * 🔒 Race condition fix: Tüm işlem $transaction() içinde atomik yapılır
 */
export async function applyPenalty(
  userId: string,
  swapRequestId: string,
  penaltyPercent: number = 0.5 // Depozitonun %50'si varsayılan ceza
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const swap = await tx.swapRequest.findUnique({
      where: { id: swapRequestId },
      select: { requesterId: true, ownerId: true, requesterDeposit: true, ownerDeposit: true }
    })

    if (!swap) return

    const isRequester = swap.requesterId === userId
    const deposit = isRequester ? swap.requesterDeposit : swap.ownerDeposit

    if (!deposit) return

    const penaltyAmount = Math.round(deposit * penaltyPercent)

    // Mevcut kullanıcı bilgilerini al (transaction içinde)
    const currentUser = await tx.user.findUnique({
      where: { id: userId },
      select: { trustScore: true, lockedValor: true, valorBalance: true }
    })
    
    const newTrustScore = calculateNewTrustScore(currentUser?.trustScore || 100, -5)
    const lockedBefore = currentUser?.lockedValor ?? 0

    // Negatif bakiye guard — ceza bakiyeyi aşmasın
    const currentBalance = currentUser?.valorBalance ?? 0
    const safePenaltyAmount = Math.min(penaltyAmount, Math.max(0, currentBalance))

    // Kilitli Valor'u azalt ve trust score güncelle
    await tx.user.update({
      where: { id: userId },
      data: {
        lockedValor: { decrement: deposit },
        valorBalance: { decrement: safePenaltyAmount }, // Bakiye negatif olamaz
        trustScore: newTrustScore // SET, increment/decrement değil!
      }
    })

    // Cezayı sistem havuzuna ekle (güvenli miktar ile)
    await tx.valorTransaction.create({
      data: {
        fromUserId: userId,
        amount: safePenaltyAmount,
        netAmount: safePenaltyAmount,
        type: 'penalty',
        description: `Takas ihlali cezası`,
        swapRequestId
      }
    })

    // EscrowLedger kaydı — penalty
    await tx.escrowLedger.create({
      data: {
        swapRequestId,
        userId,
        type: 'penalty',
        amount: penaltyAmount,
        balanceBefore: lockedBefore,
        balanceAfter: Math.max(0, lockedBefore - deposit),
        reason: `Anlaşmazlık cezası (%${Math.round(penaltyPercent * 100)})`
      }
    })
  })
}

/**
 * Trust level badge bilgisi
 */
export function getTrustBadgeInfo(trustLevel: UserTrustInfo['trustLevel']): {
  label: string
  color: string
  icon: string
  description: string
} {
  switch (trustLevel) {
    case 'trustedUser':
      return {
        label: 'Güvenilir Üye',
        color: 'gold',
        icon: '🏆',
        description: '10+ başarılı takas, yüksek güven puanı'
      }
    case 'fullyVerified':
      return {
        label: 'Kimlik Doğrulanmış',
        color: 'green',
        icon: '✅',
        description: 'Kimlik belgesi onaylanmış'
      }
    case 'phoneVerified':
      return {
        label: 'Telefon Doğrulanmış',
        color: 'blue',
        icon: '📱',
        description: 'Telefon numarası doğrulanmış'
      }
    default:
      return {
        label: 'Doğrulanmamış',
        color: 'gray',
        icon: '⚠️',
        description: 'Henüz doğrulama yapılmamış'
      }
  }
}


