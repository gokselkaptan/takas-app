import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'
import { calculateNewTrustScore, TRUST_POINTS } from '@/lib/swap-config'

export const dynamic = 'force-dynamic'

// İptal nedenleri
const CANCELLATION_REASONS = {
  changed_mind: 'Fikrim değişti',
  found_better_deal: 'Daha iyi bir teklif buldum',
  item_unavailable: 'Ürün artık mevcut değil',
  personal_reasons: 'Kişisel nedenler',
  communication_issues: 'İletişim sorunları yaşadım',
  schedule_conflict: 'Zaman uyumsuzluğu',
  other: 'Diğer'
} as const

// Trust score cezası (artık TRUST_POINTS.cancelledByUser kullanılıyor)
const TRUST_PENALTY = {
  after_agreement: TRUST_POINTS.cancelledByUser,  // Onay sonrası iptal: -3 puan
}

/**
 * POST - Takası manuel iptal et
 * Kurallar:
 * 1. Sadece 'accepted' veya 'in_delivery' durumundaki takaslar iptal edilebilir
 * 2. 'delivered' durumuna geçmiş takaslar iptal edilemez (QR kod onaylandı)
 * 3. İptal eden tarafın trust score'u düşürülür
 * 4. Karşı tarafa iptal nedeni mesaj olarak gönderilir
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
        owner: { select: { id: true, name: true, email: true, nickname: true } },
        requester: { select: { id: true, name: true, email: true, nickname: true } }
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
    const cancellableStatuses = ['accepted', 'in_delivery', 'awaiting_delivery']
    if (!cancellableStatuses.includes(swap.status)) {
      if (swap.status === 'delivered') {
        return NextResponse.json({ 
          error: 'Teslimat onaylanmış takaslar iptal edilemez. İtiraz açmak için lütfen destek ile iletişime geçin.' 
        }, { status: 400 })
      }
      if (swap.status === 'completed') {
        return NextResponse.json({ 
          error: 'Tamamlanmış takaslar iptal edilemez.' 
        }, { status: 400 })
      }
      if (swap.status === 'pending') {
        return NextResponse.json({ 
          error: 'Henüz kabul edilmemiş teklifleri iptal etmek yerine reddedebilirsiniz.' 
        }, { status: 400 })
      }
      return NextResponse.json({ 
        error: `Bu durumdaki takaslar iptal edilemez: ${swap.status}` 
      }, { status: 400 })
    }

    // İptal nedenini hazırla
    const reasonText = reason === 'other' && customReason 
      ? customReason 
      : CANCELLATION_REASONS[reason as keyof typeof CANCELLATION_REASONS]

    // Transaction ile güvenli iptal işlemi
    const result = await prisma.$transaction(async (tx) => {
      // 1. Takası iptal et (Not: iptal detayları mesajda saklanıyor)
      await tx.swapRequest.update({
        where: { id: swapId },
        data: { 
          status: 'cancelled'
        }
      })

      // 2. Ürünü tekrar aktif yap
      await tx.product.update({
        where: { id: swap.productId },
        data: { status: 'available' }
      })

      // 3. İptal eden tarafın trust score'unu düşür (max 100 sınırıyla)
      const newTrustScore = calculateNewTrustScore(
        user.trustScore || 100, 
        TRUST_PENALTY.after_agreement // -3 puan
      )
      await tx.user.update({
        where: { id: user.id },
        data: {
          trustScore: newTrustScore // SET, decrement değil!
        }
      })

      // 4. Escrow'daki Valor'ları iade et
      let refundedToRequester = 0
      let refundedToOwner = 0

      // Alıcının escrow'daki Valor'u
      if (swap.pendingValorAmount && swap.pendingValorAmount > 0) {
        await tx.user.update({
          where: { id: swap.requesterId },
          data: { 
            valorBalance: { increment: swap.pendingValorAmount },
            lockedValor: { decrement: Math.min(swap.pendingValorAmount, await getLockedValor(tx, swap.requesterId)) }
          }
        })
        
        await tx.valorTransaction.create({
          data: {
            type: 'escrow_refund',
            amount: swap.pendingValorAmount,
            fee: 0,
            netAmount: swap.pendingValorAmount,
            description: `Manuel iptal - Takas iadesi (${swap.product.title})`,
            toUserId: swap.requesterId
          }
        })
        
        refundedToRequester = swap.pendingValorAmount
      }

      // Satıcının depozito/teminatı varsa iade et
      // (Hesaplanmış depozito miktarı swap'ta saklanmıyorsa, varsayılan olarak ürün fiyatının %10'u)
      const ownerDeposit = Math.round(swap.product.valorPrice * 0.1)
      if (ownerDeposit > 0) {
        // Satıcının locked valorunu kontrol et
        const ownerLockedValor = await getLockedValor(tx, swap.ownerId)
        if (ownerLockedValor >= ownerDeposit) {
          await tx.user.update({
            where: { id: swap.ownerId },
            data: { 
              lockedValor: { decrement: ownerDeposit }
            }
          })
          refundedToOwner = ownerDeposit
        }
      }

      // 5. Karşı tarafa mesaj gönder
      const otherPartyId = isOwner ? swap.requesterId : swap.ownerId
      const cancellerName = isOwner ? swap.owner.name : swap.requester.name
      const cancellerRole = isOwner ? 'Satıcı' : 'Alıcı'

      await tx.message.create({
        data: {
          content: `⚠️ ${cancellerRole} (${cancellerName}) takası iptal etti.\n\n📋 İptal Nedeni: ${reasonText}\n\n🔄 "${swap.product.title}" için yapılan takas anlaşması iptal edilmiştir. Escrow'daki Valor bakiyenize iade edildi.`,
          senderId: user.id,
          receiverId: otherPartyId,
          productId: swap.productId
        }
      })

      return {
        refundedToRequester,
        refundedToOwner,
        otherPartyId,
        cancellerRole
      }
    })

    // 6. Karşı tarafa push bildirim gönder
    const otherPartyId = isOwner ? swap.requesterId : swap.ownerId
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

    return NextResponse.json({
      success: true,
      message: 'Takas başarıyla iptal edildi',
      details: {
        swapId,
        reason: reasonText,
        trustPenalty: TRUST_PENALTY.after_agreement,
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

// GET - İptal nedenlerini getir
export async function GET() {
  return NextResponse.json({
    reasons: CANCELLATION_REASONS,
    trustPenalty: TRUST_PENALTY.after_agreement
  })
}
