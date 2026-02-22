import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'week'

  // Periyod hesapla
  const now = new Date()
  let periodStart: Date
  switch (period) {
    case 'today':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week':
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'month':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    default:
      periodStart = new Date(2020, 0, 1) // Tümü
  }

  try {
    // 1. Özet istatistikler
    const [totalUsers, newUsers, activeUsers, verifiedUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: periodStart } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }),
      prisma.user.count({ where: { OR: [{ isPhoneVerified: true }, { isIdentityVerified: true }] } }),
    ])

    // 2. Şehir dağılımı (ürünlerden)
    const cityData = await prisma.product.groupBy({
      by: ['city'],
      _count: true,
      orderBy: { _count: { city: 'desc' } },
      take: 10,
    })
    
    const totalCityProducts = cityData.reduce((sum, c) => sum + c._count, 0)
    const cities = cityData.map(c => ({
      name: c.city || 'Bilinmiyor',
      count: c._count,
      percent: totalCityProducts > 0 ? Math.round((c._count / totalCityProducts) * 100) : 0,
    }))

    // 3. Son giriş yapanlar (son 20)
    const recentLoginUsers = await prisma.user.findMany({
      where: { lastLoginAt: { not: null } },
      orderBy: { lastLoginAt: 'desc' },
      take: 20,
      select: {
        id: true, name: true, email: true, image: true, 
        trustScore: true, lastLoginAt: true, location: true,
        products: { take: 1, select: { city: true } },
      }
    })

    const recentLogins = recentLoginUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      trustScore: u.trustScore,
      city: u.location || u.products[0]?.city || '—',
      lastLoginAt: u.lastLoginAt ? formatTimeAgo(u.lastLoginAt) : '—',
    }))

    // 4. Yeni kayıtlar (periyoda göre, son 30)
    const newRegUsers = await prisma.user.findMany({
      where: { createdAt: { gte: periodStart } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true, name: true, email: true, createdAt: true,
        referredBy: true, isPhoneVerified: true, isIdentityVerified: true,
      }
    })

    const newRegistrations = newRegUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: formatDate(u.createdAt),
      referredBy: u.referredBy || null,
      isPhoneVerified: u.isPhoneVerified,
      isIdentityVerified: u.isIdentityVerified,
    }))

    // 5. Günlük giriş akışı (son 14 gün)
    const dailyLogins: { date: string; label: string; count: number }[] = []
    let maxDailyLogin = 0
    
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)
      
      const count = await prisma.user.count({
        where: {
          lastLoginAt: { gte: dayStart, lte: dayEnd }
        }
      })
      
      if (count > maxDailyLogin) maxDailyLogin = count
      
      dailyLogins.push({
        date: dayStart.toISOString().split('T')[0],
        label: `${dayStart.getDate()}/${dayStart.getMonth() + 1}`,
        count,
      })
    }

    return NextResponse.json({
      summary: { totalUsers, newUsers, activeUsers, verifiedUsers },
      cities,
      recentLogins,
      newRegistrations,
      dailyLogins,
      maxDailyLogin,
      period,
    })
  } catch (error) {
    console.error('User analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Az önce'
  if (minutes < 60) return `${minutes}dk önce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}s önce`
  const days = Math.floor(hours / 24)
  return `${days}g önce`
}

function formatDate(date: Date): string {
  return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}
