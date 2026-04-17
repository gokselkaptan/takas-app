import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { normalizeShapeCode } from '@/lib/utils'
export const dynamic = 'force-dynamic'

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

    const { swapRequestId, code } = await request.json()

    if (!swapRequestId || !code) {
      return NextResponse.json({ error: 'swapRequestId ve code gerekli' }, { status: 400 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      select: {
        id: true,
        ownerId: true,
        requesterId: true,
        status: true,
        shapeCode: true,
        shapeCodeExpiry: true,
        shapeCodeAttempts: true,
      },
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    if (swapRequest.requesterId !== currentUser.id) {
      return NextResponse.json({ error: 'Sadece teklif eden şekil kodunu doğrulayabilir' }, { status: 403 })
    }

    if (swapRequest.status !== 'awaiting_delivery') {
      return NextResponse.json({ error: 'Bu aşamada şekil kodu doğrulanamaz' }, { status: 400 })
    }

    if (!swapRequest.shapeCode || !swapRequest.shapeCodeExpiry) {
      return NextResponse.json({ error: 'Aktif şekil kodu yok' }, { status: 400 })
    }

    if (swapRequest.shapeCodeAttempts >= 3) {
      return NextResponse.json({
        error: 'Maksimum deneme sayısına ulaşıldı',
        attemptsLeft: 0,
      }, { status: 429 })
    }

    const normalizedCode = normalizeShapeCode(String(code).trim())
    const storedNormalizedCode = normalizeShapeCode(swapRequest.shapeCode)

    if (!normalizedCode || normalizedCode !== storedNormalizedCode) {
      const updated = await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: {
          shapeCodeAttempts: { increment: 1 },
        },
        select: {
          shapeCodeAttempts: true,
        },
      })

      const attemptsLeft = Math.max(0, 3 - updated.shapeCodeAttempts)

      return NextResponse.json({
        success: false,
        error: 'Şekil kodu eşleşmiyor',
        attemptsLeft,
      }, { status: 400 })
    }

    if (swapRequest.shapeCodeExpiry && new Date() > swapRequest.shapeCodeExpiry) {
      return NextResponse.json({ error: 'Şekil kodunun süresi dolmuş' }, { status: 400 })
    }

    const deliveredAt = new Date()
    const disputeWindowEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const updatedSwap = await prisma.swapRequest.update({
      where: { id: swapRequestId },
      data: {
        status: 'delivered',
        deliveredAt,
        disputeWindowEndsAt,
        deliveryConfirmDeadline: disputeWindowEndsAt,
        shapeCode: null,
        shapeCodeExpiry: null,
        shapeCodeAttempts: 0,
      },
      select: {
        id: true,
        status: true,
        deliveredAt: true,
        disputeWindowEndsAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Şekil kodu doğrulandı',
      swapRequest: updatedSwap,
    })
  } catch (error) {
    console.error('Shape code verify error:', error)
    return NextResponse.json({ error: 'Şekil kodu doğrulanamadı' }, { status: 500 })
  }
}
