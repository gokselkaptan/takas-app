import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    // Trust anomalileri
    const anomalies = await prisma.user.findMany({
      where: { OR: [{ trustScore: { gt: 100 } }, { trustScore: { lt: 0 } }] },
      select: { id: true, email: true, name: true, trustScore: true }
    })
    
    // Otomatik düzelt
    let fixed = 0
    const fixedUsers: { email: string; old: number; new: number }[] = []
    
    for (const u of anomalies) {
      const newScore = Math.max(0, Math.min(100, u.trustScore))
      if (newScore !== u.trustScore) {
        await prisma.user.update({ where: { id: u.id }, data: { trustScore: newScore } })
        fixed++
        fixedUsers.push({ email: u.email, old: u.trustScore, new: newScore })
      }
    }
    
    // Negatif bakiye kontrolü
    const negativeBalanceUsers = await prisma.user.findMany({
      where: { valorBalance: { lt: 0 } },
      select: { id: true, email: true, valorBalance: true }
    })
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      trustAnomalies: anomalies.length,
      fixed,
      fixedUsers,
      negativeBalanceUsers: negativeBalanceUsers.map(u => ({ email: u.email, balance: u.valorBalance })),
      status: anomalies.length === 0 && negativeBalanceUsers.length === 0 ? 'HEALTHY' : 'FIXED'
    })
  } catch (error) {
    console.error('Test trust error:', error)
    return NextResponse.json({ error: 'Test başarısız' }, { status: 500 })
  }
}
