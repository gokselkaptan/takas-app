import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/system-valor
 * Sistem Valor istatistiklerini döndürür (sadece admin erişebilir)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin kontrolü
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin erişimi gerekli' }, { status: 403 })
    }

    // System config'i al
    const systemConfig = await prisma.systemConfig.findUnique({
      where: { id: 'main' }
    })

    if (!systemConfig) {
      return NextResponse.json({
        communityPoolValor: 0,
        totalFeesCollected: 0,
        distributedValor: 0,
        totalValorSupply: 1000000000,
        reserveValor: 200000000,
        totalTransactions: 0,
        totalSwapsCompleted: 0,
        totalMeltedValor: 0,
        lastMeltProcessedAt: null,
        circulatingValor: 0,
        utilizationRate: 0,
        averageFeePerSwap: 0,
        recentTransactions: []
      })
    }

    // Son 20 işlem
    const recentTransactions = await prisma.valorTransaction.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        fromUser: { select: { name: true, nickname: true, email: true } },
        toUser: { select: { name: true, nickname: true, email: true } }
      }
    })

    // Toplam aktif kullanıcı valor bakiyesi
    const totalUserValor = await prisma.user.aggregate({
      _sum: { valorBalance: true }
    })

    // Hesaplamalar
    const communityPool = Number(systemConfig.communityPoolValor)
    const distributed = Number(systemConfig.distributedValor)
    const totalSupply = Number(systemConfig.totalValorSupply)
    const reserve = Number(systemConfig.reserveValor)
    const totalFees = Number(systemConfig.totalFeesCollected)
    const swapsCompleted = systemConfig.totalSwapsCompleted
    
    // Dolaşımdaki Valor = Dağıtılan - Toplanan kesintiler
    const circulatingValor = distributed - communityPool
    
    // Kullanım oranı = Dolaşımdaki / (Toplam Arz - Rezerv)
    const availableSupply = totalSupply - reserve
    const utilizationRate = availableSupply > 0 
      ? Math.round((circulatingValor / availableSupply) * 10000) / 100 
      : 0
    
    // Ortalama kesinti/takas
    const averageFeePerSwap = swapsCompleted > 0 
      ? Math.round((communityPool / swapsCompleted) * 100) / 100 
      : 0

    return NextResponse.json({
      communityPoolValor: communityPool,
      totalFeesCollected: totalFees,
      distributedValor: distributed,
      totalValorSupply: totalSupply,
      reserveValor: reserve,
      totalTransactions: systemConfig.totalTransactions,
      totalSwapsCompleted: swapsCompleted,
      totalMeltedValor: Number(systemConfig.totalMeltedValor),
      lastMeltProcessedAt: systemConfig.lastMeltProcessedAt,
      circulatingValor,
      totalUserValor: totalUserValor._sum.valorBalance || 0,
      utilizationRate,
      averageFeePerSwap,
      recentTransactions: recentTransactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        fee: tx.fee,
        netAmount: tx.netAmount,
        description: tx.description,
        createdAt: tx.createdAt,
        fromUser: tx.fromUser,
        toUser: tx.toUser
      }))
    })
  } catch (error) {
    console.error('System valor stats error:', error)
    return NextResponse.json(
      { error: 'Sistem istatistikleri alınamadı' },
      { status: 500 }
    )
  }
}
