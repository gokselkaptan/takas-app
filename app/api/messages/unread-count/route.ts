import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const UNREAD_CACHE_TTL_MS = 15_000
const unreadCountCache = new Map<string, { count: number; expiresAt: number }>()

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

    const now = Date.now()
    const cached = unreadCountCache.get(user.id)
    if (cached && cached.expiresAt > now) {
      return NextResponse.json({ unreadCount: cached.count })
    }

    // receiverId + isRead kombinasyonu DB index'leriyle hızlı sayım yapar
    const unreadCount = await prisma.message.count({
      where: {
        receiverId: user.id,
        isRead: false
      }
    })

    unreadCountCache.set(user.id, {
      count: unreadCount,
      expiresAt: now + UNREAD_CACHE_TTL_MS
    })

    return NextResponse.json({ unreadCount })
  } catch (error) {
    console.error('Unread count error:', error)
    return NextResponse.json({ unreadCount: 0 })
  }
}
