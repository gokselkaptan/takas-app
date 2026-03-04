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
    
    // Aktif ürün sayısı
    const activeProducts = await prisma.product.count({ where: { status: 'active' } })
    
    // Bekleyen teklifler
    const pendingSwaps = await prisma.swapRequest.count({ where: { status: 'pending' } })
    
    // Tamamlanan takaslar
    const completedSwaps = await prisma.swapRequest.count({ where: { status: 'completed' } })
    
    // Kabul edilen (devam eden) takaslar
    const acceptedSwaps = await prisma.swapRequest.count({ where: { status: 'accepted' } })
    
    // Kullanıcı başına ürün dağılımı
    const userProducts = await prisma.product.groupBy({
      by: ['userId'],
      where: { status: 'active' },
      _count: true
    })
    
    // Potansiyel eşleşme sayısı (basit hesap: farklı kullanıcıların ürün çiftleri)
    const uniqueOwners = userProducts.length
    const potentialMatches = uniqueOwners > 1 ? Math.floor(uniqueOwners * (uniqueOwners - 1) / 2) : 0
    
    // Multi-swap sayısı (eğer varsa)
    let multiSwapCount = 0
    try {
      const multiSwaps = await prisma.multiSwap.count({ where: { status: 'active' } })
      multiSwapCount = multiSwaps
    } catch (e) {
      // MultiSwap tablosu yoksa devam et
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      stats: {
        activeProducts,
        pendingSwaps,
        acceptedSwaps,
        completedSwaps,
        multiSwapCount,
        uniqueOwners,
        potentialMatches,
        avgProductsPerUser: uniqueOwners > 0 ? (activeProducts / uniqueOwners).toFixed(1) : 0,
      },
      health: {
        hasActiveProducts: activeProducts > 0 ? 'PASS' : 'FAIL',
        hasMultipleOwners: uniqueOwners > 1 ? 'PASS' : 'WARN',
        swapRatio: completedSwaps > 0 
          ? `${((completedSwaps / (pendingSwaps + completedSwaps + acceptedSwaps)) * 100).toFixed(0)}% tamamlanma oranı`
          : 'Henüz takas yok',
      }
    })
  } catch (error) {
    console.error('Test swap algorithm error:', error)
    return NextResponse.json({ error: 'Test başarısız' }, { status: 500 })
  }
}
