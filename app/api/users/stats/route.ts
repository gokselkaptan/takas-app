import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true }
  })

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const swaps = await prisma.swapHistory.findMany({
    where: {
      OR: [
        { senderUserId: user.id },
        { receiverUserId: user.id }
      ]
    },
    select: {
      senderUserId: true,
      receiverUserId: true,
      valorBalance: true,
      swappedAt: true
    }
  })

  let totalGain = 0
  let totalLoss = 0  // pozitif sayı olarak tutulacak
  let netBalance = 0

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  let last30DaysNet = 0

  for (const swap of swaps) {
    const balance = swap.senderUserId === user.id
      ? swap.valorBalance
      : -swap.valorBalance

    if (balance > 0) totalGain += balance
    if (balance < 0) totalLoss += Math.abs(balance)  // ✅ absolute değer
    netBalance += balance

    if (new Date(swap.swappedAt) >= thirtyDaysAgo) {
      last30DaysNet += balance
    }
  }

  const totalSwaps = swaps.length
  const avgBalance = totalSwaps > 0 ? Math.round(netBalance / totalSwaps) : 0

  // Trust Score
  // TODO: dispute sistemi eklenince successRate rafine edilecek
  const baseScore = totalSwaps === 0 ? 0 : 20
  const rawTrustScore = baseScore + totalSwaps * 2 + (netBalance / 200)
  const trustScore = Math.min(100, Math.max(0, Math.round(rawTrustScore)))

  // Badge sistemi
  const badges: { id: string; label: string; icon: string }[] = []
  if (totalSwaps >= 1) badges.push({ id: 'first_swap', label: 'İlk Takas', icon: '🎉' })
  if (totalSwaps >= 5) badges.push({ id: 'active_trader', label: 'Aktif Trader', icon: '🔄' })
  if (totalSwaps >= 20) badges.push({ id: 'top_trader', label: 'Top Trader', icon: '💎' })
  if (netBalance > 500) badges.push({ id: 'profitable', label: 'Kârlı Trader', icon: '📈' })
  if (trustScore >= 70) badges.push({ id: 'trusted', label: 'Güvenilir', icon: '🟢' })
  if (trustScore >= 90) badges.push({ id: 'elite', label: 'Elite', icon: '⭐' })
  if (Math.abs(avgBalance) <= 50 && totalSwaps >= 3) badges.push({ id: 'balanced', label: 'Dengeli', icon: '⚖️' })

  return NextResponse.json({
    totalSwaps,
    totalGain,
    totalLoss,
    netBalance,
    avgBalance,
    last30DaysNet,
    trustScore,
    badges
  })
}
