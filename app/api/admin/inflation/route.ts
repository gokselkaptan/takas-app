import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getInflationMetrics, resetWeeklyInflationIfNeeded } from '@/lib/valor-system'
import prisma from '@/lib/db'

// Enflasyon izleme API'si
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
    }

    // Admin kontrolü
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    })

    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin yetkisi gerekli' }, { status: 403 })
    }

    // Haftalık sıfırlama kontrolü
    await resetWeeklyInflationIfNeeded()

    // Enflasyon metriklerini getir
    const metrics = await getInflationMetrics()

    // Ek tarihsel veriler için son 4 haftanın işlemlerini al
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

    const weeklyHistory = await prisma.valorTransaction.groupBy({
      by: ['type'],
      where: {
        createdAt: { gte: fourWeeksAgo },
        type: { in: ['welcome_bonus', 'daily_bonus', 'swap_bonus', 'referral_bonus', 'product_bonus', 'review_bonus'] }
      },
      _sum: { amount: true },
      _count: true
    })

    // Sistem config
    const config = await prisma.systemConfig.findUnique({
      where: { id: 'main' }
    })

    return NextResponse.json({
      metrics,
      bonusBreakdown: weeklyHistory.map(h => ({
        type: h.type,
        totalAmount: h._sum.amount || 0,
        count: h._count
      })),
      systemStatus: {
        totalSupply: Number(config?.totalValorSupply || 0),
        distributed: Number(config?.distributedValor || 0),
        remaining: Number(config?.totalValorSupply || 0) - Number(config?.distributedValor || 0),
        weeklyDistributed: Number(config?.weeklyDistributedValor || 0),
        lastWeeklyReset: config?.lastWeeklyResetAt
      }
    })
  } catch (error) {
    console.error('Enflasyon verisi hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// Haftalık enflasyon sıfırlama (manuel)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    })

    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin yetkisi gerekli' }, { status: 403 })
    }

    // Manuel sıfırlama
    await prisma.systemConfig.update({
      where: { id: 'main' },
      data: {
        weeklyDistributedValor: BigInt(0),
        lastWeeklyResetAt: new Date()
      }
    })

    return NextResponse.json({ success: true, message: 'Haftalık enflasyon sayacı sıfırlandı' })
  } catch (error) {
    console.error('Sıfırlama hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
