import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Kullanıcıyı al
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, isVip: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // VIP ise sınırsız
    if (user.isVip) {
      return NextResponse.json({
        used: 0,
        limit: -1, // -1 = sınırsız
        remaining: -1,
        isVip: true
      })
    }

    // Bugünkü teklif sayısını say
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayCount = await prisma.swapRequest.count({
      where: {
        requesterId: user.id,
        createdAt: { gte: today },
        // İptal edilen teklifler sayılmaz (hak geri gelir)
        status: { notIn: ['cancelled', 'auto_cancelled', 'expired'] }
      }
    })

    return NextResponse.json({
      used: todayCount,
      limit: 3,
      remaining: Math.max(0, 3 - todayCount),
      isVip: false
    })
  } catch (error) {
    console.error('Daily limit check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
