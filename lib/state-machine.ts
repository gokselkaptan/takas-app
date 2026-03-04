/**
 * TAKAS-A State Machine
 * 
 * Takas durumu geçişlerini yönetir, doğrular ve loglar.
 * Tüm durum geçişleri bu modül üzerinden yapılmalıdır.
 */

import prisma from '@/lib/db'
import { 
  SWAP_STATUS, 
  VALID_TRANSITIONS, 
  NEGOTIATION_STATUS,
  calculateDisputeWindowEnd,
  calculateRiskTier,
  type SwapStatus,
  type NegotiationStatus
} from '@/lib/swap-config'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

// ============= TYPES =============

export interface TransitionResult {
  success: boolean
  error?: string
  newStatus?: string
  swap?: any
}

export interface NegotiationAction {
  type: 'propose' | 'counter' | 'accept' | 'reject'
  userId: string
  proposedPrice?: number
  message?: string
}

export interface NegotiationResult {
  success: boolean
  error?: string
  negotiationStatus?: string
  agreedPrice?: number
  history?: any[]
}

// ============= STATE MACHINE =============

/**
 * Takas durumunu güvenli bir şekilde değiştirir
 * @param swapId - SwapRequest ID
 * @param newStatus - Hedef durum
 * @param userId - Değişikliği yapan kullanıcı
 * @param reason - Değişiklik sebebi
 * @param metadata - Ek bilgiler
 */
export async function transitionSwapStatus(
  swapId: string,
  newStatus: SwapStatus,
  userId: string,
  reason?: string,
  metadata?: Record<string, any>
): Promise<TransitionResult> {
  try {
    // Mevcut takas durumunu al
    const swap = await prisma.swapRequest.findUnique({
      where: { id: swapId },
      include: {
        product: { include: { category: true } },
        requester: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } }
      }
    })

    if (!swap) {
      return { success: false, error: 'Takas bulunamadı' }
    }

    const currentStatus = swap.status as SwapStatus

    // Durum geçişi geçerli mi kontrol et
    const validTransitions = VALID_TRANSITIONS[currentStatus] || []
    if (!validTransitions.includes(newStatus)) {
      return { 
        success: false, 
        error: `Geçersiz durum geçişi: ${currentStatus} → ${newStatus}. İzin verilen: ${validTransitions.join(', ')}` 
      }
    }

    // Ek durum kontrolleri
    const validationError = await validateTransition(swap, newStatus, userId)
    if (validationError) {
      return { success: false, error: validationError }
    }

    // Durum geçişine özel işlemler
    const updateData = await getTransitionUpdateData(swap, newStatus)

    // Transaction içinde güncelle
    const updatedSwap = await prisma.$transaction(async (tx) => {
      // Durumu güncelle
      const updated = await tx.swapRequest.update({
        where: { id: swapId },
        data: {
          status: newStatus,
          ...updateData
        },
        include: {
          product: true,
          requester: { select: { id: true, name: true, email: true } },
          owner: { select: { id: true, name: true, email: true } }
        }
      })

      // Durum geçişi logu oluştur
      await tx.swapStatusLog.create({
        data: {
          swapRequestId: swapId,
          fromStatus: currentStatus,
          toStatus: newStatus,
          changedBy: userId,
          reason,
          metadata: metadata || {}
        }
      })

      return updated
    })

    // Bildirimleri gönder
    await sendTransitionNotifications(updatedSwap, currentStatus, newStatus, userId)

    return { success: true, newStatus, swap: updatedSwap }
  } catch (error) {
    console.error('State transition error:', error)
    return { success: false, error: 'Durum güncellenirken hata oluştu' }
  }
}

/**
 * Durum geçişi için ek doğrulamalar
 */
async function validateTransition(
  swap: any,
  newStatus: SwapStatus,
  userId: string
): Promise<string | null> {
  const isRequester = swap.requesterId === userId
  const isOwner = swap.ownerId === userId

  // Yetki kontrolü
  if (!isRequester && !isOwner) {
    return 'Bu takas işlemi üzerinde yetkiniz yok'
  }

  switch (newStatus) {
    case 'accepted':
      // Sadece ürün sahibi kabul edebilir
      if (!isOwner) return 'Sadece ürün sahibi teklifi kabul edebilir'
      // Fiyat anlaşması zorunlu
      if (swap.negotiationStatus !== 'price_agreed') {
        return 'Fiyat üzerinde anlaşma sağlanmalı'
      }
      break

    case 'rejected':
      // Sadece ürün sahibi reddedebilir
      if (!isOwner) return 'Sadece ürün sahibi teklifi reddedebilir'
      break

    case 'cancelled':
      // Pending durumunda sadece requester iptal edebilir
      if (swap.status === 'pending' && !isRequester) {
        return 'Bekleyen teklifi sadece teklif eden iptal edebilir'
      }
      break

    case 'delivered':
      // Her iki taraf da onaylamalı
      if (!swap.ownerConfirmed || !swap.receiverConfirmed) {
        return 'Her iki taraf da teslimatı onaylamalı'
      }
      break

    case 'completed':
      // Dispute window kontrolü
      if (swap.disputeWindowEndsAt && new Date() < swap.disputeWindowEndsAt) {
        return 'İtiraz süresi henüz dolmadı'
      }
      break

    case 'disputed':
      // Sadece delivered durumunda dispute açılabilir
      if (swap.status !== 'delivered') {
        return 'İtiraz sadece teslim edilmiş takaslar için açılabilir'
      }
      // Dispute window içinde olmalı
      if (swap.disputeWindowEndsAt && new Date() > swap.disputeWindowEndsAt) {
        return 'İtiraz süresi dolmuş'
      }
      break
  }

  return null
}

/**
 * Durum geçişine özel güncelleme verilerini hazırla
 */
async function getTransitionUpdateData(
  swap: any,
  newStatus: SwapStatus
): Promise<Record<string, any>> {
  const updateData: Record<string, any> = {}

  switch (newStatus) {
    case 'accepted':
      // Risk seviyesini hesapla
      const valorAmount = swap.agreedPriceRequester || swap.product?.valorPrice || 0
      const categoryName = swap.product?.category?.name
      updateData.riskTier = calculateRiskTier(valorAmount, categoryName)
      break

    case 'delivered':
      updateData.deliveredAt = new Date()
      // Dispute window başlat
      updateData.disputeWindowEndsAt = calculateDisputeWindowEnd(new Date())
      // Low-risk için auto-complete eligibility
      if (swap.riskTier === 'low') {
        updateData.autoCompleteEligible = true
      }
      break

    case 'completed':
      updateData.valorReleased = true
      break

    case 'disputed':
      updateData.autoCompleteEligible = false
      break
  }

  return updateData
}

/**
 * Durum geçişi bildirimlerini gönder
 */
async function sendTransitionNotifications(
  swap: any,
  fromStatus: string,
  toStatus: string,
  changedBy: string
) {
  try {
    const isChangedByRequester = swap.requesterId === changedBy
    const targetUserId = isChangedByRequester ? swap.ownerId : swap.requesterId

    const statusMessages: Record<string, { title: string; body: string }> = {
      accepted: {
        title: '✅ Teklif Kabul Edildi',
        body: `${swap.product.title} için teklifiniz kabul edildi!`
      },
      rejected: {
        title: '❌ Teklif Reddedildi',
        body: `${swap.product.title} için teklifiniz reddedildi.`
      },
      cancelled: {
        title: '🚫 Takas İptal Edildi',
        body: `${swap.product.title} takası iptal edildi.`
      },
      delivered: {
        title: '📦 Teslimat Onaylandı',
        body: `${swap.product.title} teslimatı tamamlandı. 48 saat itiraz süresi başladı.`
      },
      completed: {
        title: '🎉 Takas Tamamlandı',
        body: `${swap.product.title} takası başarıyla tamamlandı!`
      },
      disputed: {
        title: '⚠️ İtiraz Açıldı',
        body: `${swap.product.title} takası için itiraz açıldı.`
      }
    }

    const notification = statusMessages[toStatus]
    if (notification) {
      await sendPushToUser(targetUserId, NotificationTypes.SWAP_REQUEST, {
        title: notification.title,
        body: notification.body,
        swapId: swap.id,
        productTitle: swap.product.title,
        fromStatus,
        toStatus
      })
    }
  } catch (error) {
    console.error('Failed to send transition notification:', error)
  }
}

// ============= NEGOTIATION SYSTEM =============

/**
 * Pazarlık işlemi yap
 */
export async function processNegotiation(
  swapId: string,
  action: NegotiationAction
): Promise<NegotiationResult> {
  try {
    const swap = await prisma.swapRequest.findUnique({
      where: { id: swapId },
      include: {
        product: true,
        requester: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
        negotiationHistory: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    })

    if (!swap) {
      return { success: false, error: 'Takas bulunamadı' }
    }

    // Yetki kontrolü
    const isRequester = swap.requesterId === action.userId
    const isOwner = swap.ownerId === action.userId
    if (!isRequester && !isOwner) {
      return { success: false, error: 'Bu takas için yetkiniz yok' }
    }

    // Durum kontrolü - pending veya negotiating durumlarında pazarlık yapılabilir
    if (!['pending', 'negotiating'].includes(swap.status)) {
      return { success: false, error: 'Pazarlık sadece bekleyen veya pazarlık aşamasındaki takaslar için yapılabilir' }
    }

    // Negotiation deadline kontrolü
    if (swap.negotiationDeadline && new Date() > swap.negotiationDeadline) {
      return { success: false, error: 'Pazarlık süresi dolmuş' }
    }

    // Action'a göre işlem yap
    switch (action.type) {
      case 'propose':
        return await handlePriceProposal(swap, action, isRequester)

      case 'counter':
        return await handleCounterOffer(swap, action, isRequester)

      case 'accept':
        return await handlePriceAccept(swap, action, isRequester)

      case 'reject':
        return await handleNegotiationReject(swap, action)

      default:
        return { success: false, error: 'Geçersiz işlem tipi' }
    }
  } catch (error) {
    console.error('Negotiation error:', error)
    return { success: false, error: 'Pazarlık işlemi başarısız' }
  }
}

/**
 * Fiyat teklifi
 */
async function handlePriceProposal(
  swap: any,
  action: NegotiationAction,
  isRequester: boolean
): Promise<NegotiationResult> {
  const proposedPrice = action.proposedPrice
  if (!proposedPrice || proposedPrice <= 0) {
    return { success: false, error: 'Geçerli bir fiyat giriniz' }
  }

  const previousPrice = isRequester ? swap.agreedPriceRequester : swap.agreedPriceOwner

  await prisma.$transaction(async (tx) => {
    // Fiyatı güncelle + status'u negotiating yap (eğer pending ise)
    await tx.swapRequest.update({
      where: { id: swap.id },
      data: {
        ...(isRequester 
          ? { agreedPriceRequester: proposedPrice }
          : { agreedPriceOwner: proposedPrice }
        ),
        // pending → negotiating geçişi
        ...(swap.status === 'pending' ? { status: 'negotiating' } : {}),
        negotiationStatus: 'price_proposed',
        lastCounterOfferAt: new Date()
      }
    })

    // Pazarlık geçmişine ekle
    await tx.negotiationHistory.create({
      data: {
        swapRequestId: swap.id,
        userId: action.userId,
        actionType: 'propose',
        proposedPrice,
        previousPrice,
        message: action.message
      }
    })
  })

  // Bildirim gönder
  const targetUserId = isRequester ? swap.ownerId : swap.requesterId
  await sendPushToUser(targetUserId, NotificationTypes.SWAP_REQUEST, {
    title: '💰 Yeni Fiyat Teklifi',
    body: `${swap.product.title} için ${proposedPrice} Valor teklif edildi`,
    swapId: swap.id
  })

  return {
    success: true,
    negotiationStatus: 'price_proposed'
  }
}

/**
 * Karşı teklif
 */
async function handleCounterOffer(
  swap: any,
  action: NegotiationAction,
  isRequester: boolean
): Promise<NegotiationResult> {
  // Counter offer limiti kontrolü
  if (swap.counterOfferCount >= swap.maxCounterOffers) {
    return { 
      success: false, 
      error: `Maksimum karşı teklif sayısına (${swap.maxCounterOffers}) ulaşıldı` 
    }
  }

  const proposedPrice = action.proposedPrice
  if (!proposedPrice || proposedPrice <= 0) {
    return { success: false, error: 'Geçerli bir fiyat giriniz' }
  }

  const previousPrice = isRequester ? swap.agreedPriceOwner : swap.agreedPriceRequester

  await prisma.$transaction(async (tx) => {
    // Karşı teklifi kaydet + status'u negotiating yap (eğer pending ise)
    await tx.swapRequest.update({
      where: { id: swap.id },
      data: {
        ...(isRequester 
          ? { agreedPriceRequester: proposedPrice }
          : { agreedPriceOwner: proposedPrice }
        ),
        // pending → negotiating geçişi
        ...(swap.status === 'pending' ? { status: 'negotiating' } : {}),
        negotiationStatus: 'price_proposed',
        counterOfferCount: { increment: 1 },
        lastCounterOfferAt: new Date()
      }
    })

    // Pazarlık geçmişine ekle
    await tx.negotiationHistory.create({
      data: {
        swapRequestId: swap.id,
        userId: action.userId,
        actionType: 'counter',
        proposedPrice,
        previousPrice,
        message: action.message
      }
    })
  })

  // Bildirim gönder
  const targetUserId = isRequester ? swap.ownerId : swap.requesterId
  await sendPushToUser(targetUserId, NotificationTypes.SWAP_REQUEST, {
    title: '🔄 Karşı Teklif',
    body: `${swap.product.title} için ${proposedPrice} Valor karşı teklif yapıldı`,
    swapId: swap.id
  })

  return {
    success: true,
    negotiationStatus: 'price_proposed'
  }
}

/**
 * Fiyat kabul
 */
async function handlePriceAccept(
  swap: any,
  action: NegotiationAction,
  isRequester: boolean
): Promise<NegotiationResult> {
  // Karşı tarafın teklifini kabul et
  const agreedPrice = isRequester ? swap.agreedPriceOwner : swap.agreedPriceRequester

  if (!agreedPrice) {
    return { success: false, error: 'Kabul edilecek bir teklif yok' }
  }

  await prisma.$transaction(async (tx) => {
    // Her iki tarafın fiyatını eşitle
    await tx.swapRequest.update({
      where: { id: swap.id },
      data: {
        agreedPriceRequester: agreedPrice,
        agreedPriceOwner: agreedPrice,
        negotiationStatus: 'price_agreed',
        priceAgreedAt: new Date()
      }
    })

    // Pazarlık geçmişine ekle
    await tx.negotiationHistory.create({
      data: {
        swapRequestId: swap.id,
        userId: action.userId,
        actionType: 'accept',
        proposedPrice: agreedPrice,
        message: action.message
      }
    })
  })

  // Bildirim gönder
  const targetUserId = isRequester ? swap.ownerId : swap.requesterId
  await sendPushToUser(targetUserId, NotificationTypes.SWAP_ACCEPTED, {
    title: '🤝 Fiyat Kabul Edildi!',
    body: `${swap.product.title} için ${agreedPrice} Valor üzerinde anlaşıldı`,
    swapId: swap.id
  })

  return {
    success: true,
    negotiationStatus: 'price_agreed',
    agreedPrice
  }
}

/**
 * Pazarlık reddi
 */
async function handleNegotiationReject(
  swap: any,
  action: NegotiationAction
): Promise<NegotiationResult> {
  await prisma.$transaction(async (tx) => {
    await tx.swapRequest.update({
      where: { id: swap.id },
      data: {
        negotiationStatus: 'cancelled'
      }
    })

    await tx.negotiationHistory.create({
      data: {
        swapRequestId: swap.id,
        userId: action.userId,
        actionType: 'reject',
        message: action.message
      }
    })
  })

  return {
    success: true,
    negotiationStatus: 'cancelled'
  }
}

/**
 * Pazarlık geçmişini getir
 */
export async function getNegotiationHistory(swapId: string) {
  return await prisma.negotiationHistory.findMany({
    where: { swapRequestId: swapId },
    orderBy: { createdAt: 'asc' }
  })
}

/**
 * Durum geçiş loglarını getir
 */
export async function getStatusLogs(swapId: string) {
  return await prisma.swapStatusLog.findMany({
    where: { swapRequestId: swapId },
    orderBy: { createdAt: 'asc' }
  })
}

// ============= DISPUTE SYSTEM =============

/**
 * Dispute aç
 */
export async function openDispute(
  swapId: string,
  userId: string,
  reason: string,
  description: string
): Promise<TransitionResult> {
  const swap = await prisma.swapRequest.findUnique({
    where: { id: swapId }
  })

  if (!swap) {
    return { success: false, error: 'Takas bulunamadı' }
  }

  // Sadece delivered durumunda dispute açılabilir
  if (swap.status !== 'delivered') {
    return { success: false, error: 'İtiraz sadece teslim edilmiş takaslar için açılabilir' }
  }

  // Dispute window kontrolü
  if (swap.disputeWindowEndsAt && new Date() > swap.disputeWindowEndsAt) {
    return { success: false, error: 'İtiraz süresi dolmuş' }
  }

  // DisputeReport oluştur ve durumu değiştir
  // reportedUserId = karşı tarafın ID'si
  const reportedUserId = swap.requesterId === userId ? swap.ownerId : swap.requesterId
  
  await prisma.$transaction(async (tx) => {
    await tx.disputeReport.create({
      data: {
        swapRequestId: swapId,
        reporterId: userId,
        reportedUserId,
        type: reason, // reason is actually the dispute type
        description,
        status: 'open'
      }
    })
  })

  // State transition
  return await transitionSwapStatus(swapId, 'disputed', userId, reason)
}

/**
 * Dispute window durumunu kontrol et
 */
export async function checkDisputeWindowStatus(swapId: string) {
  const swap = await prisma.swapRequest.findUnique({
    where: { id: swapId },
    select: {
      id: true,
      status: true,
      deliveredAt: true,
      disputeWindowEndsAt: true,
      riskTier: true,
      autoCompleteEligible: true
    }
  })

  if (!swap) return null

  const now = new Date()
  const isInDisputeWindow = swap.disputeWindowEndsAt ? now < swap.disputeWindowEndsAt : false
  const remainingHours = swap.disputeWindowEndsAt 
    ? Math.max(0, Math.ceil((swap.disputeWindowEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60)))
    : 0

  return {
    ...swap,
    isInDisputeWindow,
    remainingHours,
    canOpenDispute: swap.status === 'delivered' && isInDisputeWindow,
    canAutoComplete: swap.autoCompleteEligible && !isInDisputeWindow
  }
}
