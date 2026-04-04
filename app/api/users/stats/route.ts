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
      swappedAt: true,
      senderProductSnapshot: true,
      receiverProductSnapshot: true
    }
  })

  let totalGain = 0
  let totalLoss = 0  // pozitif sayı olarak tutulacak
  let netBalance = 0
  let qualifiedSwaps = 0
  let totalDiscount = 0
  let discountCount = 0

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

    // ✅ Qualified swap kontrolü (absBalance >= 50)
    const absBalance = Math.abs(balance)
    if (absBalance >= 50) {
      qualifiedSwaps++
      
      // ✅ avgDiscountGiven hesabı - sadece qualified swap için
      const isSender = swap.senderUserId === user.id
      const snapshot = isSender ? swap.senderProductSnapshot : swap.receiverProductSnapshot
      const originalValor = (snapshot as any)?.originalValor || 0
      const agreedValor = (snapshot as any)?.valor || 0
      if (originalValor > 0 && agreedValor > 0) {
        totalDiscount += (originalValor - agreedValor) / originalValor
        discountCount++
      }
    }
  }

  const totalSwaps = swaps.length  // tüm kayıtlar
  const avgBalance = qualifiedSwaps > 0 ? Math.round(netBalance / qualifiedSwaps) : 0

  const avgDiscountGiven = discountCount > 0 
    ? Math.round((totalDiscount / discountCount) * 100) 
    : 0

  // Trust Score
  // TODO: dispute sistemi eklenince successRate rafine edilecek
  const baseScore = qualifiedSwaps === 0 ? 0 : 20
  const rawTrustScore = baseScore + qualifiedSwaps * 2 + (netBalance / 200)
  const trustScore = Math.min(100, Math.max(0, Math.round(rawTrustScore)))

  // Badge sistemi
  const badges: { id: string; label: string; icon: string }[] = []
  if (qualifiedSwaps >= 1) badges.push({ id: 'first_swap', label: 'İlk Takas', icon: '🎉' })
  if (qualifiedSwaps >= 5 && netBalance > 0) badges.push({ id: 'active_trader', label: 'Aktif Trader', icon: '🔄' })
  if (qualifiedSwaps >= 20 && netBalance > 0) badges.push({ id: 'top_trader', label: 'Top Trader', icon: '💎' })
  if (netBalance > 500) badges.push({ id: 'profitable', label: 'Kârlı Trader', icon: '📈' })
  if (trustScore >= 70) badges.push({ id: 'trusted', label: 'Güvenilir', icon: '🟢' })
  if (trustScore >= 90) badges.push({ id: 'elite', label: 'Elite', icon: '⭐' })
  if (Math.abs(avgBalance) <= 50 && qualifiedSwaps >= 3) badges.push({ id: 'balanced', label: 'Dengeli', icon: '⚖️' })

  return NextResponse.json({
    totalSwaps,       // tüm kayıtlar
    qualifiedSwaps,   // anlamlı takaslar (absBalance >= 50)
    totalGain,
    totalLoss,
    netBalance,
    avgBalance,
    last30DaysNet,
    avgDiscountGiven, // kullanıcının kendi ürününde yaptığı ortalama indirim
    trustScore,
    badges
  })
}
