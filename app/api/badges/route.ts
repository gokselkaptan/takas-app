import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { getAllBadgesWithProgress, checkAndAwardBadges, seedBadges } from '@/lib/badge-system'

// GET - Tüm rozetleri veya kullanıcının rozetlerini getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const sessionUserId = (session?.user as any)?.id
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const type = searchParams.get('type') // all, user, check
    const checkNew = searchParams.get('check') // 'new' - bildirilmemiş yeni rozetler
    
    // Seed kontrolü (ilk çalıştırmada rozetleri oluştur)
    const badgeCount = await prisma.badge.count()
    if (badgeCount === 0) {
      await seedBadges()
    }
    
    // Yeni kazanılmış ama henüz bildirilmemiş rozetleri getir
    if (checkNew === 'new') {
      // Giriş yapmamış kullanıcılar için boş dön
      if (!sessionUserId) {
        return NextResponse.json({ newBadges: [] })
      }
      
      try {
        const newBadges = await prisma.userBadge.findMany({
          where: {
            userId: sessionUserId,
            notified: false
          },
          include: {
            badge: true
          },
          orderBy: { earnedAt: 'desc' },
          take: 5 // En fazla 5 adet
        })
        
        return NextResponse.json({
          newBadges: newBadges.map(ub => ({
            id: ub.id,
            name: ub.badge.name,
            icon: ub.badge.icon,
            tier: ub.badge.tier,
            valorReward: ub.badge.valorReward,
            description: ub.badge.description
          }))
        })
      } catch {
        // UserBadge'de notified alanı yoksa veya hata varsa boş dön
        return NextResponse.json({ newBadges: [] })
      }
    }
    
    if (type === 'all') {
      // Tüm aktif rozetleri getir
      const badges = await prisma.badge.findMany({
        where: { isActive: true, isSecret: false },
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }]
      })
      return NextResponse.json(badges)
    }
    
    if (type === 'check' && sessionUserId) {
      // Rozet kontrolü yap ve yenilerini ver
      const result = await checkAndAwardBadges(sessionUserId)
      return NextResponse.json(result)
    }
    
    // Belirli kullanıcının rozetlerini getir (userId parametresi ile veya session'dan)
    const targetUserId = userId || sessionUserId
    if (!targetUserId) {
      return NextResponse.json({ error: 'Kullanıcı ID gerekli' }, { status: 400 })
    }
    
    if (sessionUserId === targetUserId) {
      // Kendi profilim - tüm rozetleri ilerleme ile getir
      const badges = await getAllBadgesWithProgress(targetUserId)
      return NextResponse.json(badges)
    } else {
      // Başka birinin profili - sadece kazanılmış rozetleri göster
      const userBadges = await prisma.userBadge.findMany({
        where: { userId: targetUserId },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' }
      })
      
      return NextResponse.json(userBadges.map(ub => ({
        ...ub.badge,
        earned: true,
        earnedAt: ub.earnedAt,
        isDisplayed: ub.isDisplayed
      })))
    }
  } catch (error) {
    console.error('Badge API error:', error)
    return NextResponse.json({ error: 'Rozetler yüklenemedi' }, { status: 500 })
  }
}

// POST - Rozet ayarlarını güncelle (gösterilecek rozetleri seç)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const sessionUserId = (session?.user as any)?.id
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }
    
    const { badgeId, isDisplayed } = await request.json()
    
    if (!badgeId) {
      return NextResponse.json({ error: 'Badge ID gerekli' }, { status: 400 })
    }
    
    // Kullanıcının bu rozeti var mı kontrol et
    const userBadge = await prisma.userBadge.findFirst({
      where: {
        userId: sessionUserId,
        badgeId
      }
    })
    
    if (!userBadge) {
      return NextResponse.json({ error: 'Bu rozete sahip değilsiniz' }, { status: 403 })
    }
    
    // Maksimum 5 rozet gösterilebilir
    if (isDisplayed) {
      const displayedCount = await prisma.userBadge.count({
        where: {
          userId: sessionUserId,
          isDisplayed: true,
          NOT: { badgeId }
        }
      })
      
      if (displayedCount >= 5) {
        return NextResponse.json({ error: 'En fazla 5 rozet gösterebilirsiniz' }, { status: 400 })
      }
    }
    
    // Güncelle
    await prisma.userBadge.update({
      where: { id: userBadge.id },
      data: { isDisplayed }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Badge update error:', error)
    return NextResponse.json({ error: 'Rozet güncellenemedi' }, { status: 500 })
  }
}

// PATCH - Rozeti "görüldü" olarak işaretle (bildirim sonrası)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const sessionUserId = (session?.user as any)?.id
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }
    
    const { badgeId, action } = await request.json()
    
    if (!badgeId) {
      return NextResponse.json({ error: 'Badge ID gerekli' }, { status: 400 })
    }
    
    if (action === 'seen') {
      // Rozeti "görüldü" (notified) olarak işaretle
      const userBadge = await prisma.userBadge.findFirst({
        where: {
          id: badgeId,
          userId: sessionUserId
        }
      })
      
      if (!userBadge) {
        return NextResponse.json({ error: 'Rozet bulunamadı' }, { status: 404 })
      }
      
      await prisma.userBadge.update({
        where: { id: userBadge.id },
        data: { notified: true }
      })
      
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 })
  } catch (error) {
    console.error('Badge PATCH error:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
