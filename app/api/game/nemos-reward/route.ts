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

    const { score } = await req.json()

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Günlük limit kontrolü — max 1 kez 5 VALOR
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayRewards = await prisma.valorTransaction.count({
      where: {
        toUserId: user.id,
        type: 'game_reward',
        createdAt: { gte: today }
      }
    })

    if (todayRewards >= 1) {
      return NextResponse.json({ error: 'Günlük limit doldu', limitReached: true })
    }

    // Sabit 5 VALOR ödülü
    const valorReward = 5

    await prisma.user.update({
      where: { id: user.id },
      data: { valorBalance: { increment: valorReward } }
    })

    await prisma.valorTransaction.create({
      data: {
        toUserId: user.id,
        type: 'game_reward',
        amount: valorReward,
        netAmount: valorReward,
        fee: 0,
        description: `NEMOS oyun ödülü — Skor: ${score || 0}`
      }
    })

    return NextResponse.json({ success: true, valorReward })
  } catch (error) {
    console.error('NEMOS reward error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
