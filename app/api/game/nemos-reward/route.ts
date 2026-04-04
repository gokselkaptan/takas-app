import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Günlük limit kontrolü — günde 1 kez ödül
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayReward = await prisma.valorTransaction.findFirst({
      where: {
        toUserId: user.id,
        type: 'game_reward',
        createdAt: { gte: today }
      }
    })

    if (todayReward) {
      return NextResponse.json(
        { error: 'Bugün zaten ödül aldınız' },
        { status: 429 }
      )
    }

    const valorReward = 5

    await prisma.user.update({
      where: { email: session.user.email },
      data: { valorBalance: { increment: valorReward } }
    })

    await prisma.valorTransaction.create({
      data: {
        toUserId: user.id,
        type: 'game_reward',
        amount: valorReward,
        netAmount: valorReward,
        fee: 0,
        description: 'NEMOS oyun ödülü — 30 günde 10 oyun tamamlandı'
      }
    })

    return NextResponse.json({ success: true, valorReward })
  } catch (error) {
    console.error('NEMOS reward error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
