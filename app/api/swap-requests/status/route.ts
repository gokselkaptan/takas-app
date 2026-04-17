import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

/**
 * Status endpoint artık yalnızca dispute işlemlerini tutar.
 * verify_code ve QR bağımlı geçişler legacy kabul edilip kapatılmıştır.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, nickname: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const { swapRequestId, action } = await req.json()

    if (!swapRequestId || !action) {
      return NextResponse.json({ error: 'swapRequestId ve action gerekli' }, { status: 400 })
    }

    if (action === 'verify_code') {
      return NextResponse.json(
        {
          success: false,
          legacy: true,
          error: 'verify_code akışı kaldırıldı. Teslim doğrulama artık Shape Code ile yapılır.',
          next: {
            generate: '/api/swap-requests/shape-code/generate',
            verify: '/api/swap-requests/shape-code/verify',
          },
        },
        { status: 410 }
      )
    }

    if (action !== 'dispute') {
      return NextResponse.json({ error: 'Geçersiz action. Sadece dispute destekleniyor.' }, { status: 400 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      include: {
        product: { select: { id: true, title: true } },
      },
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    const isRequester = swapRequest.requesterId === user.id
    const isOwner = swapRequest.ownerId === user.id
    if (!isRequester && !isOwner) {
      return NextResponse.json({ error: 'Bu takas size ait değil' }, { status: 403 })
    }

    const disputableStatuses = new Set(['accepted', 'delivery_proposed', 'awaiting_delivery', 'delivered'])
    if (!disputableStatuses.has(swapRequest.status)) {
      return NextResponse.json({ error: 'Bu aşamada sorun bildirilemez' }, { status: 400 })
    }

    const otherUserId = isRequester ? swapRequest.ownerId : swapRequest.requesterId
    const userName = user.nickname || user.name || 'Kullanıcı'

    await prisma.swapRequest.update({
      where: { id: swapRequestId },
      data: { status: 'disputed' },
    })

    await prisma.message.create({
      data: {
        senderId: user.id,
        receiverId: otherUserId,
        content: `⚠️ ${userName} bir sorun bildirdi. Destek ekibi inceleme başlatacak.`,
        productId: swapRequest.productId,
        swapRequestId,
        isModerated: true,
        moderationResult: 'approved',
      },
    })

    sendPushToUser(otherUserId, NotificationTypes.SWAP_DISPUTE, {
      productTitle: swapRequest.product.title,
      swapId: swapRequestId,
    }).catch(console.error)

    return NextResponse.json({ success: true, message: 'Sorun bildirildi' })
  } catch (error) {
    console.error('Swap status error:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
