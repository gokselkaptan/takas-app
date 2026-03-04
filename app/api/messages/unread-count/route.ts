import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Sadece okunmamış mesaj sayısı için hafif endpoint
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ unreadCount: 0 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ unreadCount: 0 })
    }

    // Sadece okunmamış mesaj sayısını say - çok hafif sorgu
    const unreadCount = await prisma.message.count({
      where: {
        receiverId: user.id,
        isRead: false
      }
    })

    return NextResponse.json({ unreadCount })
  } catch (error) {
    console.error('Unread count error:', error)
    return NextResponse.json({ unreadCount: 0 })
  }
}
