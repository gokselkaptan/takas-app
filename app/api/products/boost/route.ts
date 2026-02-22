import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { getUserLevel } from '@/lib/valor-system'

export const dynamic = 'force-dynamic'

// Seviye bazlı boost maliyetleri
const BOOST_COSTS = [
  { level: 0, cost: 0, duration: 0, available: false },    // Seviye 0: Kullanamaz
  { level: 1, cost: 30, duration: 24, available: true },    // 30V = 24 saat
  { level: 2, cost: 25, duration: 48, available: true },    // 25V = 48 saat
  { level: 3, cost: 20, duration: 48, available: true },    // 20V = 48 saat
  { level: 4, cost: 15, duration: 72, available: true },    // 15V = 72 saat
  { level: 5, cost: 10, duration: 72, available: true },    // 10V = 72 saat (en ucuz!)
]

// GET: Boost bilgisi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, valorBalance: true, lockedValor: true, isPremium: true }
    })
    if (!user) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })

    const level = await getUserLevel(user.id)
    const boostConfig = BOOST_COSTS[level.level] || BOOST_COSTS[0]

    // Aktif boost sayısı
    const activeBoostedProducts = await prisma.product.count({
      where: { 
        userId: user.id, 
        isBoosted: true, 
        boostExpiresAt: { gt: new Date() } 
      }
    })

    // Premium kullanıcılar ayda 3 bedava boost hakkı
    let freeBoostsRemaining = 0
    if (user.isPremium) {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const monthlyBoosts = await prisma.product.count({
        where: {
          userId: user.id,
          boostedAt: { gte: startOfMonth },
          boostCost: 0
        }
      })
      freeBoostsRemaining = Math.max(0, 3 - monthlyBoosts)
    }

    return NextResponse.json({
      level: level.level,
      cost: boostConfig.cost,
      durationHours: boostConfig.duration,
      available: boostConfig.available,
      balance: user.valorBalance - user.lockedValor,
      canAfford: (user.valorBalance - user.lockedValor) >= boostConfig.cost,
      activeBoostedProducts,
      maxActiveBoosts: user.isPremium ? 5 : 2,
      isPremium: user.isPremium,
      freeBoostsRemaining,
    })
  } catch (error) {
    console.error('Boost info error:', error)
    return NextResponse.json({ error: 'Hata' }, { status: 500 })
  }
}

// POST: Ürünü boost et
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 })
    }

    const { productId } = await request.json()
    if (!productId) {
      return NextResponse.json({ error: 'Ürün ID gerekli' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, valorBalance: true, lockedValor: true, isPremium: true }
    })
    if (!user) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })

    // Ürün kontrolü
    const product = await prisma.product.findFirst({
      where: { id: productId, userId: user.id, status: 'active' }
    })
    if (!product) {
      return NextResponse.json({ error: 'Ürün bulunamadı veya size ait değil' }, { status: 404 })
    }

    // Zaten boost edilmiş mi?
    if (product.isBoosted && product.boostExpiresAt && product.boostExpiresAt > new Date()) {
      return NextResponse.json({ error: 'Bu ürün zaten öne çıkarılmış' }, { status: 400 })
    }

    const level = await getUserLevel(user.id)
    const boostConfig = BOOST_COSTS[level.level] || BOOST_COSTS[0]

    if (!boostConfig.available) {
      return NextResponse.json({ error: 'Seviye 1\'e ulaşmanız gerekiyor. İlk takasınızı yapın!' }, { status: 403 })
    }

    // Aktif boost limiti
    const activeBoosts = await prisma.product.count({
      where: { userId: user.id, isBoosted: true, boostExpiresAt: { gt: new Date() } }
    })
    const maxBoosts = user.isPremium ? 5 : 2
    if (activeBoosts >= maxBoosts) {
      return NextResponse.json({ error: `Aynı anda en fazla ${maxBoosts} ürünü öne çıkarabilirsiniz` }, { status: 400 })
    }

    // Premium bedava boost kontrolü
    let actualCost = boostConfig.cost
    if (user.isPremium) {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const monthlyFreeBoosts = await prisma.product.count({
        where: { userId: user.id, boostedAt: { gte: startOfMonth }, boostCost: 0 }
      })
      if (monthlyFreeBoosts < 3) {
        actualCost = 0 // Bedava!
      }
    }

    // Bakiye kontrolü
    const available = user.valorBalance - user.lockedValor
    if (actualCost > 0 && available < actualCost) {
      return NextResponse.json({ error: `Yetersiz bakiye. ${actualCost} Valor gerekli, ${available} Valor mevcut` }, { status: 400 })
    }

    const expiresAt = new Date(Date.now() + boostConfig.duration * 60 * 60 * 1000)

    // Transaction: Valor düş + ürünü boost et
    const operations: any[] = []
    if (actualCost > 0) {
      operations.push(
        prisma.user.update({
          where: { id: user.id },
          data: { valorBalance: { decrement: actualCost } }
        })
      )
    }
    operations.push(
      prisma.product.update({
        where: { id: productId },
        data: {
          isBoosted: true,
          boostedAt: new Date(),
          boostExpiresAt: expiresAt,
          boostCost: actualCost,
          isPopular: true, // Popüler listede de göster
        }
      })
    )

    await prisma.$transaction(operations)

    return NextResponse.json({
      success: true,
      cost: actualCost,
      expiresAt,
      durationHours: boostConfig.duration,
      message: actualCost > 0 
        ? `🚀 Ürün öne çıkarıldı! ${actualCost} Valor harcandı. ${boostConfig.duration} saat boyunca üstte görünecek.`
        : `🚀 Ürün öne çıkarıldı! (Premium bedava hak kullanıldı) ${boostConfig.duration} saat boyunca üstte görünecek.`
    })
  } catch (error) {
    console.error('Boost error:', error)
    return NextResponse.json({ error: 'Boost işlemi başarısız' }, { status: 500 })
  }
}
