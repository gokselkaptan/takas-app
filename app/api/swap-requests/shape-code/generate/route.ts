import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { generateShapeCode } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const sessionUserId = (session?.user as any)?.id

    if (!sessionUserId) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const { swapRequestId } = await request.json()

    if (!swapRequestId) {
      return NextResponse.json({ error: 'swapRequestId gerekli' }, { status: 400 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      select: { id: true, ownerId: true, requesterId: true, status: true },
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    // Sadece ürün sahibi (owner) şekil kodu üretebilir
    if (sessionUserId !== swapRequest.ownerId) {
      return NextResponse.json({ error: 'Sadece ürün sahibi şekil kodu üretebilir' }, { status: 403 })
    }

    // Sadece uygun statülerde şekil kodu üretilsin
    if (!['accepted', 'awaiting_delivery'].includes(swapRequest.status)) {
      return NextResponse.json({ error: 'Bu aşamada şekil kodu üretilemez' }, { status: 400 })
    }
    const shapeCode = generateShapeCode()
    const shapeCodeExpiry = new Date(Date.now() + 15 * 60 * 1000)

    await prisma.swapRequest.update({
      where: { id: swapRequestId },
      data: {
        shapeCode,
        shapeCodeExpiry,
        shapeCodeAttempts: 0,
      },
    })

    return NextResponse.json({
      success: true,
      shapeCode,
      shapeCodeExpiry,
      expiresInMinutes: 15,
      maxAttempts: 3,
    })
  } catch (error) {
    console.error('Shape code generate error:', error)
    return NextResponse.json({ error: 'Şekil kodu oluşturulamadı' }, { status: 500 })
  }
}