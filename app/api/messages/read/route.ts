import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Toplu mesaj okundu işaretleme
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { messageIds, otherUserId, swapRequestId, productId } = body

    const now = new Date()

    // Belirli mesajları okundu yap
    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      const result = await prisma.message.updateMany({
        where: {
          id: { in: messageIds },
          receiverId: user.id,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: now,
        },
      })
      return NextResponse.json({ success: true, updated: result.count })
    }

    // Belirli bir kullanıcıdan gelen tüm mesajları okundu yap
    if (otherUserId) {
      const whereClause: any = {
        senderId: otherUserId,
        receiverId: user.id,
        isRead: false,
      }
      if (swapRequestId) whereClause.swapRequestId = swapRequestId
      else if (productId) whereClause.productId = productId

      const result = await prisma.message.updateMany({
        where: whereClause,
        data: {
          isRead: true,
          readAt: now,
        },
      })
      return NextResponse.json({ success: true, updated: result.count })
    }

    return NextResponse.json({ error: 'messageIds or otherUserId required' }, { status: 400 })
  } catch (error: any) {
    console.error('Mark messages as read error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
