import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const UNREAD_CACHE_TTL_MS = 15_000
const unreadCountCache = new Map<string, { count: number; expiresAt: number }>()

// Sadece okunmamış mesaj sayısı için hafif endpoint
// Opsiyonel: ?userIds=id1,id2 -> tek çağrıda kullanıcı bazlı okunmamış sayılar
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ unreadCount: 0, unreadByUser: {} })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ unreadCount: 0, unreadByUser: {} })
    }

    const { searchParams } = new URL(request.url)
    const rawUserIds = searchParams.get('userIds')

    if (rawUserIds) {
      const userIds = rawUserIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 100)

      if (userIds.length === 0) {
        return NextResponse.json({ unreadCount: 0, unreadByUser: {} })
      }

      const grouped = await prisma.message.groupBy({
        by: ['senderId'],
        where: {
          receiverId: user.id,
          isRead: false,
          senderId: { in: userIds }
        },
        _count: {
          _all: true
        }
      })

      const unreadByUser: Record<string, number> = {}
      for (const senderId of userIds) {
        unreadByUser[senderId] = 0
      }
      grouped.forEach((row) => {
        unreadByUser[row.senderId] = row._count._all
      })

      const unreadCount = Object.values(unreadByUser).reduce((sum, count) => sum + count, 0)
      return NextResponse.json({ unreadCount, unreadByUser })
    }

    const now = Date.now()
    const cached = unreadCountCache.get(user.id)
    if (cached && cached.expiresAt > now) {
      return NextResponse.json({ unreadCount: cached.count, unreadByUser: {} })
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

    return NextResponse.json({ unreadCount, unreadByUser: {} })
  } catch (error) {
    console.error('Unread count error:', error)
    return NextResponse.json({ unreadCount: 0, unreadByUser: {} })
  }
}
