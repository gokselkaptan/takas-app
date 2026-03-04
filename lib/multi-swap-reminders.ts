// =============================================================================
// TAKAS-A Multi-Swap Timeout Reminder System
// Çoklu takas 48 saat timeout hatırlatma ve otomatik iptal
// =============================================================================

import prisma from './db'
import { sendPushToUser } from './push-notifications'

export interface ReminderResult {
  processed: number
  reminders24h: number
  reminders6h: number
  reminders1h: number
  expired: number
  refunded: number
}

/**
 * Çoklu takas hatırlatmaları gönder ve süresi dolmuş takasları iptal et
 */
export async function sendMultiSwapReminders(): Promise<ReminderResult> {
  const now = new Date()
  const result: ReminderResult = {
    processed: 0,
    reminders24h: 0,
    reminders6h: 0,
    reminders1h: 0,
    expired: 0,
    refunded: 0
  }
  
  // Bekleyen (pending) çoklu takasları al
  const pendingSwaps = await prisma.multiSwap.findMany({
    where: {
      status: 'pending'
    },
    include: {
      participants: { 
        include: { 
          user: { select: { id: true, name: true, valorBalance: true } },
          givesProduct: { select: { id: true, title: true, valorPrice: true } }
        } 
      }
    }
  })
  
  for (const swap of pendingSwaps) {
    result.processed++
    const expiresAt = swap.expiresAt.getTime()
    const remaining = expiresAt - now.getTime()
    
    // 48 saat dolmuşsa iptal et
    if (remaining <= 0) {
      await cancelExpiredMultiSwap(swap)
      result.expired++
      continue
    }
    
    // Onay bekleyen katılımcılar
    const pendingParticipants = swap.participants.filter(p => !p.confirmed)
    
    if (pendingParticipants.length === 0) continue
    
    // 24 saat kaldıysa hatırlatma
    const hours24 = 24 * 60 * 60 * 1000
    if (remaining <= hours24 && !swap.reminder24hSent) {
      for (const participant of pendingParticipants) {
        await sendPushToUser(
          participant.userId,
          'multi_swap_reminder',
          {
            title: '⏰ Çoklu Takas Onayı Bekleniyor!',
            body: `Çoklu takas onayınız için 24 saat kaldı. Onaylamazsanız takas iptal olacak.`,
            multiSwapId: swap.id,
            hoursRemaining: 24,
            url: `/takas-firsatlari?tab=multiSwap&multiSwapId=${swap.id}`
          }
        )
      }
      await prisma.multiSwap.update({
        where: { id: swap.id },
        data: { reminder24hSent: true }
      })
      result.reminders24h++
    }
    
    // 6 saat kaldıysa hatırlatma
    const hours6 = 6 * 60 * 60 * 1000
    if (remaining <= hours6 && !swap.reminder6hSent) {
      for (const participant of pendingParticipants) {
        await sendPushToUser(
          participant.userId,
          'multi_swap_reminder',
          {
            title: '⚠️ Son 6 Saat!',
            body: `Çoklu takas onayınız için sadece 6 saat kaldı! Acele edin!`,
            multiSwapId: swap.id,
            hoursRemaining: 6,
            url: `/takas-firsatlari?tab=multiSwap&multiSwapId=${swap.id}`
          }
        )
      }
      await prisma.multiSwap.update({
        where: { id: swap.id },
        data: { reminder6hSent: true }
      })
      result.reminders6h++
    }
    
    // 1 saat kaldıysa hatırlatma
    const hours1 = 1 * 60 * 60 * 1000
    if (remaining <= hours1 && !swap.reminder1hSent) {
      for (const participant of pendingParticipants) {
        await sendPushToUser(
          participant.userId,
          'multi_swap_reminder',
          {
            title: '🚨 Son 1 Saat!',
            body: `Çoklu takas onayınız için son 1 saat! Hemen onaylayın yoksa takas iptal olacak!`,
            multiSwapId: swap.id,
            hoursRemaining: 1,
            url: `/takas-firsatlari?tab=multiSwap&multiSwapId=${swap.id}`
          }
        )
      }
      await prisma.multiSwap.update({
        where: { id: swap.id },
        data: { reminder1hSent: true }
      })
      result.reminders1h++
    }
  }
  
  return result
}

/**
 * Süresi dolmuş çoklu takası iptal et ve teminatları iade et
 */
async function cancelExpiredMultiSwap(swap: any): Promise<number> {
  let refundedCount = 0
  
  // Takası expired olarak işaretle
  await prisma.multiSwap.update({
    where: { id: swap.id },
    data: { status: 'expired' }
  })
  
  // Her katılımcıya bildirim gönder ve teminat iade et (eğer varsa)
  for (const participant of swap.participants) {
    // Katılımcının kilitli VALOR'u varsa iade et (lockedValor alanı varsa)
    const user = await prisma.user.findUnique({
      where: { id: participant.userId },
      select: { id: true, valorBalance: true, lockedValor: true }
    })
    
    if (user && user.lockedValor && user.lockedValor > 0) {
      // Ürünün değerinin %10'u kadar teminat hesapla
      const depositAmount = Math.floor((participant.givesProduct?.valorPrice || 0) * 0.1)
      
      if (depositAmount > 0 && depositAmount <= user.lockedValor) {
        // Teminatı iade et
        await prisma.user.update({
          where: { id: participant.userId },
          data: {
            valorBalance: { increment: depositAmount },
            lockedValor: { decrement: depositAmount }
          }
        })
        
        // İşlem kaydı oluştur
        await prisma.valorTransaction.create({
          data: {
            toUserId: participant.userId,
            amount: depositAmount,
            netAmount: depositAmount,
            type: 'multi_swap_refund',
            multiSwapId: swap.id,
            description: `Çoklu takas iptal - teminat iadesi (#${swap.id.slice(-6)})`
          }
        })
        
        refundedCount++
      }
    }
    
    // Bildirim gönder
    await sendPushToUser(
      participant.userId,
      'multi_swap_expired',
      {
        title: '❌ Çoklu Takas İptal Edildi',
        body: '48 saat içinde tüm katılımcılardan onay alınamadığı için çoklu takas iptal edildi.',
        multiSwapId: swap.id,
        url: '/takas-firsatlari?tab=multiSwap'
      }
    )
  }
  
  console.log(`⏰ MultiSwap #${swap.id.slice(-6)} süresi dolduğu için iptal edildi. ${refundedCount} teminat iade edildi.`)
  
  return refundedCount
}

/**
 * Belirli bir çoklu takas için kalan süreyi hesapla
 */
export function getTimeRemaining(expiresAt: Date): {
  hours: number
  minutes: number
  isExpired: boolean
  isUrgent: boolean
} {
  const now = new Date()
  const remaining = expiresAt.getTime() - now.getTime()
  
  if (remaining <= 0) {
    return { hours: 0, minutes: 0, isExpired: true, isUrgent: true }
  }
  
  const hours = Math.floor(remaining / (1000 * 60 * 60))
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
  
  return {
    hours,
    minutes,
    isExpired: false,
    isUrgent: hours < 6
  }
}
