import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { calculateProgressiveFee, giveProductBonusOnSwap } from '@/lib/valor-system'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'
import { calculateNewTrustScore, TRUST_POINTS } from '@/lib/swap-config'

export const dynamic = 'force-dynamic'

// POST: Teslimatı onayla ve Valor transferini gerçekleştir
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }
    
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    const { swapRequestId, action } = await request.json()

    if (!swapRequestId) {
      return NextResponse.json({ error: 'Takas ID gerekli' }, { status: 400 })
    }

    if (!action || !['confirm', 'auto_confirm'].includes(action)) {
      return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      include: {
        product: { select: { id: true, title: true, valorPrice: true, userId: true } },
        offeredProduct: { select: { id: true, title: true, valorPrice: true } },
        owner: { select: { id: true, name: true, valorBalance: true, trustScore: true } },
        requester: { select: { id: true, name: true, valorBalance: true, trustScore: true } },
      },
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas isteği bulunamadı' }, { status: 404 })
    }

    // ═══════════════════════════════════════════════════════════════════
    // BUG 2 FIX: Ürüne karşı ürün takası için çift taraflı kontrol
    // ═══════════════════════════════════════════════════════════════════
    const isProductToProductSwap = !!swapRequest.offeredProductId
    
    if (isProductToProductSwap) {
      // Ürüne karşı ürün takası - her iki taraf da ürününü teslim etmeli
      const bothPartiesDelivered = swapRequest.ownerReceivedProduct && swapRequest.requesterReceivedProduct
      
      if (!bothPartiesDelivered) {
        // Hangi taraf eksik?
        const ownerStatus = swapRequest.ownerReceivedProduct ? '✅ Teslim aldı' : '⏳ Bekliyor'
        const requesterStatus = swapRequest.requesterReceivedProduct ? '✅ Teslim aldı' : '⏳ Bekliyor'
        
        return NextResponse.json({ 
          error: 'Ürüne karşı ürün takası henüz tamamlanmadı',
          partialDelivery: true,
          ownerReceivedProduct: swapRequest.ownerReceivedProduct,
          requesterReceivedProduct: swapRequest.requesterReceivedProduct,
          message: `Takas tamamlanması için her iki tarafın da ürünlerini teslim alması gerekiyor.\n\nÜrün sahibi: ${ownerStatus}\nTeklif eden: ${requesterStatus}`,
          hint: 'Her iki taraf da QR kodlarını taratıp ürünleri teslim aldığında takas otomatik tamamlanacaktır.'
        }, { status: 400 })
      }
    }

    // Sadece "delivered" durumundaki takaslar onaylanabilir
    if (swapRequest.status !== 'delivered') {
      // Ürüne karşı ürün takasında partially_delivered olabilir
      if (isProductToProductSwap && (swapRequest.ownerReceivedProduct || swapRequest.requesterReceivedProduct)) {
        return NextResponse.json({ 
          error: 'Kısmen teslim alındı - diğer tarafı bekliyor',
          partialDelivery: true,
          ownerReceivedProduct: swapRequest.ownerReceivedProduct,
          requesterReceivedProduct: swapRequest.requesterReceivedProduct,
        }, { status: 400 })
      }
      return NextResponse.json({ error: 'Bu takas henüz teslim alınmamış' }, { status: 400 })
    }

    // Alıcı (requester) onay verebilir veya sistem otomatik onay yapabilir
    // Ürüne karşı ürün takasında her iki taraf da onay verebilir
    if (action === 'confirm') {
      const isOwner = swapRequest.ownerId === currentUser.id
      const isRequester = swapRequest.requesterId === currentUser.id
      
      if (!isOwner && !isRequester) {
        return NextResponse.json({ error: 'Bu takasa erişim yetkiniz yok' }, { status: 403 })
      }
    }

    // Zaten onaylanmışsa
    if (swapRequest.receiverConfirmed || swapRequest.valorReleased) {
      return NextResponse.json({ error: 'Bu takas zaten onaylanmış' }, { status: 400 })
    }

    // Otomatik onay kontrolü (24 saat geçmişse)
    if (action === 'auto_confirm') {
      const now = new Date()
      if (swapRequest.deliveryConfirmDeadline && now < swapRequest.deliveryConfirmDeadline) {
        return NextResponse.json({ error: 'Otomatik onay süresi henüz dolmadı' }, { status: 400 })
      }
    }

    // Valor miktarı
    const valorAmount = swapRequest.pendingValorAmount || swapRequest.product.valorPrice

    // Ücret hesapla
    const feeResult = calculateProgressiveFee(valorAmount)
    const totalFee = feeResult.total

    // Transaction başlat
    const result = await prisma.$transaction(async (tx) => {
      // 1. Alıcıdan Valor düş (eğer düşülecekse - ürün takası değilse)
      // Not: Ürün takasında her iki taraf da ürün veriyor, Valor düşülmüyor
      // Sadece Valor ile alım varsa düşülür
      
      // 2. Satıcıya Valor ekle (ücret kesildikten sonra)
      const netAmount = valorAmount - totalFee
      
      await tx.user.update({
        where: { id: swapRequest.ownerId },
        data: {
          valorBalance: { increment: netAmount },
          totalValorEarned: { increment: netAmount },
        },
      })

      // 3. Ürünlerin durumunu güncelle
      await tx.product.update({
        where: { id: swapRequest.productId },
        data: { status: 'swapped' },
      })

      if (swapRequest.offeredProductId) {
        await tx.product.update({
          where: { id: swapRequest.offeredProductId },
          data: { status: 'swapped' },
        })
      }

      // 4. SwapRequest'i güncelle
      const updated = await tx.swapRequest.update({
        where: { id: swapRequestId },
        data: {
          status: 'completed',
          receiverConfirmed: true,
          receiverConfirmedAt: new Date(),
          valorReleased: true,
        },
      })

      // 5. Valor Transaction kaydı oluştur
      await tx.valorTransaction.create({
        data: {
          fromUserId: swapRequest.requesterId,
          toUserId: swapRequest.ownerId,
          amount: valorAmount,
          fee: totalFee,
          netAmount: netAmount,
          type: 'swap_completed',
          swapRequestId: swapRequestId,
          description: `Takas tamamlandı: ${swapRequest.product.title}`,
          feeBreakdown: JSON.stringify(feeResult),
        },
      })

      // 5b. EscrowLedger — settle (requester)
      if (swapRequest.requesterDeposit) {
        const reqUser = await tx.user.findUnique({ where: { id: swapRequest.requesterId }, select: { lockedValor: true } })
        await tx.escrowLedger.create({
          data: {
            swapRequestId: swapRequestId,
            userId: swapRequest.requesterId,
            type: 'settle',
            amount: swapRequest.requesterDeposit,
            balanceBefore: (reqUser?.lockedValor ?? 0) + swapRequest.requesterDeposit,
            balanceAfter: reqUser?.lockedValor ?? 0,
            reason: 'Takas tamamlandı — depozito serbest bırakıldı'
          }
        })
      }
      // EscrowLedger — settle (owner)
      if (swapRequest.ownerDeposit) {
        const ownUser = await tx.user.findUnique({ where: { id: swapRequest.ownerId }, select: { lockedValor: true } })
        await tx.escrowLedger.create({
          data: {
            swapRequestId: swapRequestId,
            userId: swapRequest.ownerId,
            type: 'settle',
            amount: swapRequest.ownerDeposit,
            balanceBefore: (ownUser?.lockedValor ?? 0) + swapRequest.ownerDeposit,
            balanceAfter: ownUser?.lockedValor ?? 0,
            reason: 'Takas tamamlandı — depozito serbest bırakıldı'
          }
        })
      }

      // 6. System config güncelle
      await tx.systemConfig.update({
        where: { id: 'main' },
        data: {
          totalSwapsCompleted: { increment: 1 },
          totalFeesCollected: { increment: BigInt(totalFee) },
          communityPoolValor: { increment: BigInt(Math.floor(totalFee / 2)) },
        },
      })

      // 7. Satıcının trust score'unu artır (max 100 sınırıyla)
      const newOwnerTrustScore = calculateNewTrustScore(
        swapRequest.owner.trustScore || 100, 
        TRUST_POINTS.completedSwap
      )
      await tx.user.update({
        where: { id: swapRequest.ownerId },
        data: {
          trustScore: newOwnerTrustScore, // SET, increment değil! Max 100
        },
      })

      // 8. Activity feed'e ekle
      await tx.activityFeed.create({
        data: {
          type: 'swap_completed',
          userId: swapRequest.requesterId,
          userName: swapRequest.requester.name,
          productId: swapRequest.productId,
          productTitle: swapRequest.product.title,
          targetUserId: swapRequest.ownerId,
          targetUserName: swapRequest.owner.name,
          city: 'İzmir',
          metadata: JSON.stringify({
            swapRequestId,
            valorAmount,
            netAmount,
            fee: totalFee,
          }),
        },
      })

      return { updated, netAmount, fee: totalFee }
    }) as { updated: unknown; netAmount: number; fee: number }

    // Her iki tarafa da takas tamamlandı bildirimi gönder
    const confirmerName = swapRequest.requester.name || 'Alıcı'
    
    // Ürün sahibine bildirim - Teslimat onaylandı ve Valor aktarıldı
    sendPushToUser(swapRequest.ownerId, NotificationTypes.SWAP_COMPLETED, {
      productTitle: swapRequest.product.title,
      swapId: swapRequestId,
      valorAmount: result.netAmount
    }).catch(err => console.error('Push notification error:', err))
    
    // Alıcıya da bildirim - Takas tamamlandı
    sendPushToUser(swapRequest.requesterId, NotificationTypes.SWAP_CONFIRMED, {
      productTitle: swapRequest.product.title,
      swapId: swapRequestId,
      confirmerName
    }).catch(err => console.error('Push notification error:', err))

    // 🎁 Takas tamamlama bonusu - Her iki tarafa da (bekleyen bonus varsa)
    const [ownerBonus, requesterBonus] = await Promise.all([
      giveProductBonusOnSwap(swapRequest.ownerId),
      giveProductBonusOnSwap(swapRequest.requesterId)
    ])

    return NextResponse.json({
      success: true,
      message: 'Takas başarıyla tamamlandı!',
      swapRequestId,
      valorTransferred: result.netAmount,
      fee: result.fee,
      sellerTrustScoreBonus: 2,
      bonuses: {
        owner: ownerBonus.bonus || 0,
        requester: requesterBonus.bonus || 0
      }
    })
  } catch (error) {
    console.error('Confirm delivery error:', error)
    return NextResponse.json({ error: 'Onay işlemi başarısız' }, { status: 500 })
  }
}
