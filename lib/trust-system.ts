/**
 * TAKAS-A Güven Sistemi
 * 
 * 1. Kimlik Doğrulama - Telefon veya belge ile doğrulama
 * 2. Depozito Sistemi - Takas öncesi Valor kilitleme
 * 3. Escrow - Çift taraflı onay sistemi
 */

import prisma from './db'

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
 */
export async function lockDeposit(
  userId: string,
  amount: number,
  swapRequestId: string,
  role: 'requester' | 'owner'
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { valorBalance: true, lockedValor: true }
  })

  if (!user) {
    return { success: false, error: 'Kullanıcı bulunamadı' }
  }

  const availableBalance = user.valorBalance - user.lockedValor
  if (availableBalance < amount) {
    return { 
      success: false, 
      error: `Yetersiz bakiye. Gerekli: ${amount} Valor, Mevcut: ${availableBalance} Valor` 
    }
  }

  // Kullanıcının Valor'unu kilitle
  await prisma.user.update({
    where: { id: userId },
    data: { lockedValor: { increment: amount } }
  })

  // Swap request'i güncelle
  const updateData = role === 'requester' 
    ? { requesterDeposit: amount }
    : { ownerDeposit: amount }

  await prisma.swapRequest.update({
    where: { id: swapRequestId },
    data: updateData
  })

  return { success: true }
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
 */
export async function releaseEscrow(swapRequestId: string): Promise<void> {
  const swap = await prisma.swapRequest.findUnique({
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
    await prisma.user.update({
      where: { id: swap.requesterId },
      data: { lockedValor: { decrement: swap.requesterDeposit } }
    })
  }

  if (swap.ownerDeposit) {
    await prisma.user.update({
      where: { id: swap.ownerId },
      data: { lockedValor: { decrement: swap.ownerDeposit } }
    })
  }

  await prisma.swapRequest.update({
    where: { id: swapRequestId },
    data: { escrowStatus: 'released' }
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
 */
export async function applyPenalty(
  userId: string,
  swapRequestId: string,
  penaltyPercent: number = 0.5 // Depozitonun %50'si varsayılan ceza
): Promise<void> {
  const swap = await prisma.swapRequest.findUnique({
    where: { id: swapRequestId },
    select: { requesterId: true, ownerId: true, requesterDeposit: true, ownerDeposit: true }
  })

  if (!swap) return

  const isRequester = swap.requesterId === userId
  const deposit = isRequester ? swap.requesterDeposit : swap.ownerDeposit

  if (!deposit) return

  const penaltyAmount = Math.round(deposit * penaltyPercent)
  const returnAmount = deposit - penaltyAmount

  // Kilitli Valor'u azalt
  await prisma.user.update({
    where: { id: userId },
    data: {
      lockedValor: { decrement: deposit },
      valorBalance: { decrement: penaltyAmount }, // Cezayı bakiyeden düş
      trustScore: { decrement: 5 } // Trust score düşür
    }
  })

  // Cezayı sistem havuzuna ekle
  await prisma.valorTransaction.create({
    data: {
      fromUserId: userId,
      amount: penaltyAmount,
      netAmount: penaltyAmount,
      type: 'penalty',
      description: `Takas ihlali cezası`,
      swapRequestId
    }
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
