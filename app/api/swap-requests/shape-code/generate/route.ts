import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { generateShapeCode } from '@/lib/utils'

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

    const { swapRequestId } = await request.json()

    if (!swapRequestId) {
      return NextResponse.json({ error: 'swapRequestId gerekli' }, { status: 400 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      select: { id: true, ownerId: true, requesterId: true },
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    if (swapRequest.ownerId !== currentUser.id && swapRequest.requesterId !== currentUser.id) {
      return NextResponse.json({ error: 'Bu takas için yetkiniz yok' }, { status: 403 })
    }

    const shapeCode = generateShapeCode()
    const shapeCodeExpiry = new Date(Date.now() + 5 * 60 * 1000)

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
      expiresInMinutes: 5,
      maxAttempts: 3,
    })
  } catch (error) {
    console.error('Shape code generate error:', error)
    return NextResponse.json({ error: 'Şekil kodu oluşturulamadı' }, { status: 500 })
  }
}
