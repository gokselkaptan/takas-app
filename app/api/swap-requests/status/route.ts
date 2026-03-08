import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

/**
 * REFACTOR: Sadeleştirilmiş takas akışı
 * pending → accepted → awaiting_delivery → completed
 * 
 * Bu endpoint sadece 2 action'ı destekler:
 * 1. verify_code - 6 haneli kod doğrulama → takas tamamla
 * 2. dispute - Sorun bildirme
 */

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, nickname: true, email: true }
    })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const { swapRequestId, action, code } = await req.json()

    if (!swapRequestId || !action) {
      return NextResponse.json({ error: 'swapRequestId ve action gerekli' }, { status: 400 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      include: {
        product: { select: { id: true, title: true } },
        offeredProduct: { select: { id: true, title: true } },
        owner: { select: { id: true, name: true, nickname: true, email: true } },
        requester: { select: { id: true, name: true, nickname: true, email: true } },
      }
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    const isRequester = swapRequest.requesterId === user.id
    const isOwner = swapRequest.ownerId === user.id
    if (!isRequester && !isOwner) {
      return NextResponse.json({ error: 'Bu takas size ait değil' }, { status: 403 })
    }

    const otherUserId = isRequester ? swapRequest.ownerId : swapRequest.requesterId
    const userName = user.nickname || user.name || 'Kullanıcı'

    // ═══ VERIFY_CODE — 6 haneli kodu doğrula → TAMAMLA ═══
    if (action === 'verify_code') {
      // awaiting_delivery durumunda olmalı
      if (swapRequest.status !== 'awaiting_delivery') {
        return NextResponse.json({ error: 'Takas teslimat aşamasında değil' }, { status: 400 })
      }

      if (!code) {
        return NextResponse.json({ error: '6 haneli kodu girin' }, { status: 400 })
      }

      // Doğrulama kodu kontrolü
      const validCode = swapRequest.deliveryVerificationCode
      if (code !== validCode) {
        return NextResponse.json({ error: 'Doğrulama kodu yanlış!' }, { status: 400 })
      }

      // Takası tamamla
      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: { 
          status: 'completed'
          // Not: updatedAt otomatik güncellenir, ayrı completedAt alanına gerek yok
        }
      })

      // Ürünleri swapped olarak işaretle
      await prisma.product.update({
        where: { id: swapRequest.productId },
        data: { status: 'swapped' }
      })
      
      if (swapRequest.offeredProduct?.id) {
        await prisma.product.update({
          where: { id: swapRequest.offeredProduct.id },
          data: { status: 'swapped' }
        })
      }

      // Valor transferi
      const valorAmt = swapRequest.pendingValorAmount || 0
      if (valorAmt > 0) {
        await prisma.user.update({
          where: { id: swapRequest.ownerId },
          data: {
            valorBalance: { increment: valorAmt },
            totalValorEarned: { increment: valorAmt },
          }
        })
        await prisma.swapRequest.update({
          where: { id: swapRequestId },
          data: { pendingValorAmount: 0 }
        })
      }

      // Her iki tarafa tamamlanma mesajı
      const completionMsg = `🎉 TAKAS GÜVENLİ BİR ŞEKİLDE TAMAMLANDI!\n\n📦 Ürün: ${swapRequest.product.title}\n✅ Doğrulama kodu eşleşti.\n\n⭐ Lütfen karşı tarafı değerlendirmeyi unutmayın!\n\nTeşekkürler, TAKAS-A 💜`

      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: swapRequest.ownerId,
          content: completionMsg,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: swapRequest.requesterId,
          content: completionMsg,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      // Push bildirimi
      sendPushToUser(otherUserId, NotificationTypes.SWAP_COMPLETED, {
        productTitle: swapRequest.product.title,
        swapId: swapRequestId,
      }).catch(console.error)

      return NextResponse.json({ success: true, message: 'Takas tamamlandı!' })
    }

    // ═══ DISPUTE — Sorun bildirildi ═══
    if (action === 'dispute') {
      // awaiting_delivery durumunda dispute açılabilir
      if (swapRequest.status !== 'awaiting_delivery') {
        return NextResponse.json({ error: 'Bu aşamada sorun bildirilemez' }, { status: 400 })
      }

      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: { status: 'disputed' }
      })

      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: otherUserId,
          content: `⚠️ ${userName} bir sorun bildirdi. Destek ekibi inceleme başlatacak.`,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      sendPushToUser(otherUserId, NotificationTypes.SWAP_DISPUTE, {
        productTitle: swapRequest.product.title,
        swapId: swapRequestId,
      }).catch(console.error)

      return NextResponse.json({ success: true, message: 'Sorun bildirildi' })
    }

    return NextResponse.json({ error: 'Geçersiz action. Sadece verify_code ve dispute destekleniyor.' }, { status: 400 })

  } catch (error) {
    console.error('Swap status error:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
