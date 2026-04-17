import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'
import { calculateNewTrustScore } from '@/lib/swap-config'

export const dynamic = 'force-dynamic'

// ══════════════════════════════════════════════════════════════════════════════
// GÖREV 9: Takas İptal Ceza Sistemi (Güven Puanı)
// ══════════════════════════════════════════════════════════════════════════════
// İptal nedeni ve zamanlama göre güven puanı cezaları uygulanır
// ══════════════════════════════════════════════════════════════════════════════

// İptal nedenleri ve ceza bilgileri
const CANCELLATION_REASONS: Record<string, {
  label: string
  penaltyTarget: 'other_party' | 'canceller'
  basePenalty: number
}> = {
  // Karşı tarafa ceza uygulanacak nedenler
  other_party_no_communication: {
    label: 'Karşı taraf iletişime geçmiyor',
    penaltyTarget: 'other_party',
    basePenalty: -5
  },
  product_not_as_described: {
    label: 'Ürün tanıma uymuyor',
    penaltyTarget: 'other_party',
    basePenalty: -10
  },
  
  // İptal eden tarafa ceza uygulanacak nedenler
  schedule_conflict: {
    label: 'Teslim tarihi konusunda anlaşamadık',
    penaltyTarget: 'canceller',
    basePenalty: -3
  },
  personal_reasons: {
    label: 'Kişisel nedenler',
    penaltyTarget: 'canceller',
    basePenalty: -3  // Temel ceza, zamanlama ile artabilir
  },
  changed_mind: {
    label: 'Fikrim değişti',
    penaltyTarget: 'canceller',
    basePenalty: -3
  },
  found_better_deal: {
    label: 'Daha iyi bir teklif buldum',
    penaltyTarget: 'canceller',
    basePenalty: -5
  },
  other: {
    label: 'Diğer',
    penaltyTarget: 'canceller',
    basePenalty: -3
  }
}

type CancellationReason = string

// Ceza tablosu — senaryo bazlı
// | Senaryo                              | Ceza     | Açıklama       |
// |--------------------------------------|----------|----------------|
// | Karşı tarafın hatasıyla iptal        | 0 puan   | Ceza yok       |
// | Teslim tarihinden önce iptal         | -3 puan  | Makul iptal    |
// | Teslim tarihi geçtikten sonra iptal  | -10 puan | Ağır ceza      |
// | Teslim alındıktan sonra iptal        | -15 puan | Çok ağır ceza  |

const PENALTY_MULTIPLIERS = {
  before_delivery_date: 1,      // Teslim tarihinden önce: normal ceza
  after_delivery_date: 3.33,    // Teslim tarihi geçtikten sonra: ~-10 puan
  after_received: 5,            // Teslim alındıktan sonra: ~-15 puan
}

/**
 * Ceza miktarını hesapla
 */
function calculatePenalty(
  reason: CancellationReason,
  swap: {
    status: string
    scheduledDeliveryDate: Date | null
    deliveryDateAcceptedBy: string | null
    receiverConfirmed: boolean
    qrScannedAt: Date | null
  }
): { target: 'canceller' | 'other_party' | 'none'; penalty: number } {
  const reasonInfo = CANCELLATION_REASONS[reason]
  
  // Karşı tarafın hatası - ceza karşı tarafa
  if (reasonInfo.penaltyTarget === 'other_party') {
    return { target: 'other_party', penalty: reasonInfo.basePenalty }
  }
  
  // Normal iptal - iptal eden tarafa ceza
  let penalty = reasonInfo.basePenalty
  
  // Zaman bazlı ceza çarpanı
  const now = new Date()
  
  // Teslim alındıktan sonra iptal = Çok ağır ceza
  if (swap.receiverConfirmed || swap.qrScannedAt) {
    penalty = -15
    return { target: 'canceller', penalty }
  }
  
  // Teslim tarihi geçtikten sonra iptal = Ağır ceza
  if (swap.scheduledDeliveryDate && swap.deliveryDateAcceptedBy) {
    const scheduledDate = new Date(swap.scheduledDeliveryDate)
    if (now > scheduledDate) {
      penalty = -10
      return { target: 'canceller', penalty }
    }
  }
  
  // Teslim tarihinden önce iptal = Makul ceza
  return { target: 'canceller', penalty: -3 }
}

/**
 * POST - Takası manuel iptal et
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true, trustScore: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const { swapId, reason, customReason } = body

    if (!swapId || !reason) {
      return NextResponse.json({ error: 'Takas ID ve iptal nedeni gerekli' }, { status: 400 })
    }

    // İptal nedenini doğrula
    if (!Object.keys(CANCELLATION_REASONS).includes(reason)) {
      return NextResponse.json({ error: 'Geçersiz iptal nedeni' }, { status: 400 })
    }

    // Takası bul
    const swap = await prisma.swapRequest.findUnique({
      where: { id: swapId },
      include: {
        product: true,
        owner: { select: { id: true, name: true, email: true, nickname: true, trustScore: true } },
        requester: { select: { id: true, name: true, email: true, nickname: true, trustScore: true } }
      }
    })

    if (!swap) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    // Kullanıcının bu takasta taraf olup olmadığını kontrol et
    const isOwner = swap.ownerId === user.id
    const isRequester = swap.requesterId === user.id

    if (!isOwner && !isRequester) {
      return NextResponse.json({ error: 'Bu takası iptal etme yetkiniz yok' }, { status: 403 })
    }

    // İptal edilebilir durumları kontrol et
    const cancellableStatuses = [
      'pending', 'accepted', 'negotiating', 'delivery_proposed',
      // legacy backward-read status'ler (aktif akışta üretilmez)
      'qr_generated', 'arrived', 'in_delivery',
      'awaiting_delivery'
    ]
    
    if (!cancellableStatuses.includes(swap.status)) {
      if (swap.status === 'delivered' || swap.status === 'completed') {
        return NextResponse.json({ 
          error: 'Teslimat tamamlanmış takaslar iptal edilemez. İtiraz açmak için lütfen destek ile iletişime geçin.' 
        }, { status: 400 })
      }
      if (swap.status === 'qr_scanned' || swap.status === 'inspection' || swap.status === 'code_sent') {
        return NextResponse.json({ 
          error: 'Teslim doğrulama ilerledikten sonra takaslar iptal edilemez. İtiraz açmak için sorun bildir seçeneğini kullanın.' 
        }, { status: 400 })
      }
      return NextResponse.json({ 
        error: `Bu durumdaki takaslar iptal edilemez: ${swap.status}` 
      }, { status: 400 })
    }

    // İptal nedenini hazırla
    const reasonInfo = CANCELLATION_REASONS[reason as CancellationReason]
    const reasonText = reason === 'other' && customReason 
      ? customReason 
      : reasonInfo.label

    // Ceza hesapla
    const penaltyInfo = calculatePenalty(reason as CancellationReason, {
      status: swap.status,
      scheduledDeliveryDate: swap.scheduledDeliveryDate,
      deliveryDateAcceptedBy: swap.deliveryDateAcceptedBy,
      receiverConfirmed: swap.receiverConfirmed,
      qrScannedAt: swap.qrScannedAt
    })

    // Ceza uygulanacak kullanıcıyı belirle
    const otherPartyId = isOwner ? swap.requesterId : swap.ownerId
    const penaltyUserId = penaltyInfo.target === 'other_party' 
      ? otherPartyId 
      : (penaltyInfo.target === 'canceller' ? user.id : null)

    // Transaction ile güvenli iptal işlemi
    const result = await prisma.$transaction(async (tx) => {
      // 1. Takası iptal et
      await tx.swapRequest.update({
        where: { id: swapId },
        data: { 
          status: 'cancelled',
          cancelReason: reason,
          cancelledBy: user.id,
          cancelledAt: new Date()
        }
      })

      // 2. Ürünü tekrar aktif yap
      await tx.product.update({
        where: { id: swap.productId },
        data: { status: 'active' }
      })

      // 3. Güven puanı cezası uygula
      let appliedPenalty = 0
      let penalizedUserId: string | null = null
      
      if (penaltyUserId && penaltyInfo.penalty < 0) {
        const penalizedUser = penaltyUserId === user.id ? user : (isOwner ? swap.requester : swap.owner)
        const currentTrustScore = penalizedUser.trustScore || 100
        const newTrustScore = calculateNewTrustScore(currentTrustScore, penaltyInfo.penalty)
        
        await tx.user.update({
          where: { id: penaltyUserId },
          data: { trustScore: newTrustScore }
        })
        
        appliedPenalty = penaltyInfo.penalty
        penalizedUserId = penaltyUserId
      }

      // 4. Escrow'daki Valor'ları iade et
      let refundedToRequester = 0
      let refundedToOwner = 0

      // Alıcının kilitli Valor'u
      if (swap.requesterDeposit && swap.requesterDeposit > 0) {
        const requesterLockedValor = await getLockedValor(tx, swap.requesterId)
        if (requesterLockedValor >= swap.requesterDeposit) {
          await tx.user.update({
            where: { id: swap.requesterId },
            data: { 
              lockedValor: { decrement: swap.requesterDeposit }
            }
          })
          
          await tx.valorTransaction.create({
            data: {
              type: 'deposit_refund',
              amount: swap.requesterDeposit,
              fee: 0,
              netAmount: swap.requesterDeposit,
              description: `İptal - Teminat iadesi (${swap.product.title})`,
              toUserId: swap.requesterId
            }
          })

          // EscrowLedger — refund (requester)
          await tx.escrowLedger.create({
            data: {
              swapRequestId: swap.id,
              userId: swap.requesterId,
              type: 'refund',
              amount: swap.requesterDeposit,
              balanceBefore: requesterLockedValor,
              balanceAfter: requesterLockedValor - swap.requesterDeposit,
              reason: `Takas iptal edildi — depozito iade edildi`
            }
          })
          
          refundedToRequester = swap.requesterDeposit
        }
      }

      // Satıcının kilitli Valor'u
      if (swap.ownerDeposit && swap.ownerDeposit > 0) {
        const ownerLockedValor = await getLockedValor(tx, swap.ownerId)
        if (ownerLockedValor >= swap.ownerDeposit) {
          await tx.user.update({
            where: { id: swap.ownerId },
            data: { 
              lockedValor: { decrement: swap.ownerDeposit }
            }
          })
          
          await tx.valorTransaction.create({
            data: {
              type: 'deposit_refund',
              amount: swap.ownerDeposit,
              fee: 0,
              netAmount: swap.ownerDeposit,
              description: `İptal - Teminat iadesi (${swap.product.title})`,
              toUserId: swap.ownerId
            }
          })

          // EscrowLedger — refund (owner)
          await tx.escrowLedger.create({
            data: {
              swapRequestId: swap.id,
              userId: swap.ownerId,
              type: 'refund',
              amount: swap.ownerDeposit,
              balanceBefore: ownerLockedValor,
              balanceAfter: ownerLockedValor - swap.ownerDeposit,
              reason: `Takas iptal edildi — depozito iade edildi`
            }
          })
          
          refundedToOwner = swap.ownerDeposit
        }
      }

      // 5. Karşı tarafa mesaj gönder
      const cancellerName = user.name || 'Kullanıcı'
      const cancellerRole = isOwner ? 'Satıcı' : 'Alıcı'
      
      // Ceza bilgisini mesaja ekle
      let penaltyMessage = ''
      if (appliedPenalty < 0) {
        const penalizedParty = penalizedUserId === user.id ? 'İptal eden tarafa' : 'Karşı tarafa'
        penaltyMessage = `\n\n⚠️ ${penalizedParty} ${Math.abs(appliedPenalty)} güven puanı cezası uygulandı.`
      }

      await tx.message.create({
        data: {
          content: `⚠️ ${cancellerRole} (${cancellerName}) takası iptal etti.\n\n📋 İptal Nedeni: ${reasonText}\n\n🔄 "${swap.product.title}" için yapılan takas anlaşması iptal edilmiştir. Teminatlar iade edildi.${penaltyMessage}`,
          senderId: user.id,
          receiverId: otherPartyId,
          productId: swap.productId,
          swapRequestId: swapId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({ 
            type: 'swap_cancelled', 
            cancelReason: reason,
            penalty: appliedPenalty
          })
        }
      })

      // İptal eden tarafa da mesaj gönder
      await tx.message.create({
        data: {
          content: `✅ Takas iptal edildi.\n\n📋 İptal Nedeni: ${reasonText}\n\n🔄 "${swap.product.title}" takasını iptal ettiniz. Teminatınız iade edildi.${penaltyMessage}`,
          senderId: otherPartyId,
          receiverId: user.id,
          productId: swap.productId,
          swapRequestId: swapId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({ 
            type: 'swap_cancelled', 
            cancelReason: reason,
            penalty: appliedPenalty
          })
        }
      })

      return {
        refundedToRequester,
        refundedToOwner,
        appliedPenalty,
        penalizedUserId,
        penaltyTarget: penaltyInfo.target
      }
    })

    // 6. Karşı tarafa push bildirim gönder
    try {
      await sendPushToUser(
        otherPartyId,
        NotificationTypes.SWAP_CANCELLED,
        {
          productTitle: swap.product.title,
          reason: reasonText
        }
      )
    } catch (pushError) {
      console.error('Push bildirim gönderilemedi:', pushError)
    }

    // İptal eden tarafa da push bildirim
    try {
      await sendPushToUser(
        user.id,
        NotificationTypes.SYSTEM,
        {
          title: '✅ Takas İptal Edildi',
          body: `"${swap.product.title}" takasını iptal ettiniz.`,
          url: '/takas-firsatlari'
        }
      )
    } catch (pushError) {
      console.error('İptal eden tarafa push bildirimi gönderilemedi:', pushError)
    }

    return NextResponse.json({
      success: true,
      message: 'Takas başarıyla iptal edildi',
      details: {
        swapId,
        reason: reasonText,
        penalty: result.appliedPenalty,
        penaltyTarget: result.penaltyTarget,
        refundedToRequester: result.refundedToRequester,
        refundedToOwner: result.refundedToOwner
      }
    })

  } catch (error: any) {
    console.error('Takas iptal hatası:', error)
    return NextResponse.json(
      { error: 'Takas iptal edilemedi: ' + error.message },
      { status: 500 }
    )
  }
}

// Yardımcı fonksiyon: Kullanıcının kilitli Valor miktarını al
async function getLockedValor(tx: any, userId: string): Promise<number> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { lockedValor: true }
  })
  return user?.lockedValor || 0
}

// GET - İptal nedenlerini ve ceza tablosunu getir
export async function GET() {
  const reasons = Object.entries(CANCELLATION_REASONS).map(([key, value]) => ({
    key,
    label: value.label,
    penaltyTarget: value.penaltyTarget,
    basePenalty: value.basePenalty
  }))

  return NextResponse.json({
    reasons,
    penaltyTable: {
      otherPartyFault: { penalty: 0, description: 'Karşı tarafın hatasıyla iptal' },
      beforeDeliveryDate: { penalty: -3, description: 'Teslim tarihinden önce iptal' },
      afterDeliveryDate: { penalty: -10, description: 'Teslim tarihi geçtikten sonra iptal' },
      afterReceived: { penalty: -15, description: 'Teslim alındıktan sonra iptal' }
    }
  })
}
