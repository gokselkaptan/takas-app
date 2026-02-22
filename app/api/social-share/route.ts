import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { getUserLevel } from '@/lib/valor-system'

// Seviye bazlı paylaşım ödül ayarları
const SHARE_REWARDS_BY_LEVEL = [
  { sharesForReward: 0,  valorReward: 0, maxDailyValor: 0 },    // Seviye 0: Yok
  { sharesForReward: 10, valorReward: 1, maxDailyValor: 2 },    // Seviye 1
  { sharesForReward: 7,  valorReward: 1, maxDailyValor: 3 },    // Seviye 2
  { sharesForReward: 5,  valorReward: 2, maxDailyValor: 5 },    // Seviye 3
  { sharesForReward: 5,  valorReward: 2, maxDailyValor: 8 },    // Seviye 4
  { sharesForReward: 5,  valorReward: 3, maxDailyValor: 10 },   // Seviye 5
]
const MAX_DAILY_SHARES = 20

// GET - Kullanıcının paylaşım istatistiklerini getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Toplam paylaşım sayısı
    const totalShares = await prisma.socialShare.count({
      where: { userId: user.id }
    })

    // Bugün yapılan paylaşımlar
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayShares = await prisma.socialShare.count({
      where: {
        userId: user.id,
        createdAt: { gte: today }
      }
    })

    // Bugün kazanılan Valor
    const todayValor = await prisma.socialShare.aggregate({
      where: {
        userId: user.id,
        createdAt: { gte: today }
      },
      _sum: { valorAwarded: true }
    })

    // Toplam kazanılan Valor
    const totalValor = await prisma.socialShare.aggregate({
      where: { userId: user.id },
      _sum: { valorAwarded: true }
    })

    // Platform bazında dağılım
    const platformStats = await prisma.socialShare.groupBy({
      by: ['platform'],
      where: { userId: user.id },
      _count: { id: true }
    })

    // Kullanıcı seviyesini al
    const level = await getUserLevel(user.id)
    const rewardConfig = SHARE_REWARDS_BY_LEVEL[level.level] || SHARE_REWARDS_BY_LEVEL[0]

    // Bir sonraki ödüle kaç paylaşım kaldı
    const sharesUntilReward = rewardConfig.sharesForReward > 0 
      ? rewardConfig.sharesForReward - (totalShares % rewardConfig.sharesForReward)
      : 0
    const canEarnMoreToday = rewardConfig.maxDailyValor > 0 && 
      (todayValor._sum.valorAwarded || 0) < rewardConfig.maxDailyValor

    return NextResponse.json({
      totalShares,
      todayShares,
      todayValorEarned: todayValor._sum.valorAwarded || 0,
      totalValorEarned: totalValor._sum.valorAwarded || 0,
      sharesUntilReward: sharesUntilReward === rewardConfig.sharesForReward ? 0 : sharesUntilReward,
      sharesForReward: rewardConfig.sharesForReward,
      valorReward: rewardConfig.valorReward,
      maxDailyShares: MAX_DAILY_SHARES,
      maxDailyValor: rewardConfig.maxDailyValor,
      canEarnMoreToday,
      userLevel: level.level,
      levelName: level.name,
      platformStats: platformStats.reduce((acc, item) => {
        acc[item.platform] = item._count.id
        return acc
      }, {} as Record<string, number>)
    })
  } catch (error) {
    console.error('Social share stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Yeni paylaşım kaydet
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { platform, shareType, contentId, shareUrl } = body

    // Platform doğrulama
    const validPlatforms = ['twitter', 'facebook', 'instagram', 'whatsapp', 'linkedin']
    if (!platform || !validPlatforms.includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    // ShareType doğrulama
    const validShareTypes = ['profile', 'product', 'swap', 'platform', 'swap_history']
    if (!shareType || !validShareTypes.includes(shareType)) {
      return NextResponse.json({ error: 'Invalid share type' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, valorBalance: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Bugünkü paylaşım sayısını kontrol et
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayShareCount = await prisma.socialShare.count({
      where: {
        userId: user.id,
        createdAt: { gte: today }
      }
    })

    if (todayShareCount >= MAX_DAILY_SHARES) {
      return NextResponse.json({
        error: 'Günlük paylaşım limitine ulaştınız',
        valorAwarded: 0,
        todayShares: todayShareCount,
        limitReached: true
      }, { status: 200 }) // 200 dönüş - paylaşım yapılabilir ama ödül yok
    }

    // Bugün kazanılan Valor’u kontrol et
    const todayValor = await prisma.socialShare.aggregate({
      where: {
        userId: user.id,
        createdAt: { gte: today }
      },
      _sum: { valorAwarded: true }
    })

    // Toplam paylaşım sayısını al (yeni paylaşım dahil)
    const totalShares = await prisma.socialShare.count({
      where: { userId: user.id }
    })

    // Kullanıcı seviyesini al
    const level = await getUserLevel(user.id)
    const rewardConfig = SHARE_REWARDS_BY_LEVEL[level.level] || SHARE_REWARDS_BY_LEVEL[0]

    // Seviye 0 ise ödül yok
    if (rewardConfig.sharesForReward === 0) {
      // Paylaşımı kaydet ama ödül yok
      const share = await prisma.socialShare.create({
        data: { userId: user.id, platform, shareType, contentId: contentId || null, shareUrl: shareUrl || null, valorAwarded: 0 }
      })
      return NextResponse.json({
        success: true, shareId: share.id, valorAwarded: 0,
        totalShares: totalShares + 1,
        todayShares: todayShareCount + 1,
        sharesUntilReward: 0,
        sharesForReward: 0,
        valorReward: 0,
        message: 'Paylaşım kaydedildi! İlk takasını tamamla ve paylaşım bonusu kazan! 🔓',
        levelRequired: true, currentLevel: level.level
      })
    }

    // Valor ödülü hesapla (seviye bazlı)
    let valorAwarded = 0
    const newTotalShares = totalShares + 1
    
    if (newTotalShares % rewardConfig.sharesForReward === 0) {
      const currentDailyValor = todayValor._sum.valorAwarded || 0
      if (currentDailyValor < rewardConfig.maxDailyValor) {
        valorAwarded = Math.min(rewardConfig.valorReward, rewardConfig.maxDailyValor - currentDailyValor)
      }
    }

    // Paylaşımı kaydet
    const share = await prisma.socialShare.create({
      data: {
        userId: user.id,
        platform,
        shareType,
        contentId: contentId || null,
        shareUrl: shareUrl || null,
        valorAwarded
      }
    })

    // Eğer Valor kazandıysa, bakiyeyi güncelle
    if (valorAwarded > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          valorBalance: { increment: valorAwarded },
          totalValorEarned: { increment: valorAwarded }
        }
      })
    }

    // Bir sonraki ödüle kaç paylaşım kaldı
    const sharesUntilReward = rewardConfig.sharesForReward - (newTotalShares % rewardConfig.sharesForReward)

    return NextResponse.json({
      success: true,
      shareId: share.id,
      valorAwarded,
      totalShares: newTotalShares,
      todayShares: todayShareCount + 1,
      sharesUntilReward: sharesUntilReward === rewardConfig.sharesForReward ? 0 : sharesUntilReward,
      sharesForReward: rewardConfig.sharesForReward,
      valorReward: rewardConfig.valorReward,
      message: valorAwarded > 0 
        ? `Tebrikler! +${valorAwarded} Valor kazandınız! 🎉`
        : `Paylaşım kaydedildi. ${sharesUntilReward} paylaşım daha yapın ve +${rewardConfig.valorReward} Valor kazanın!`
    })
  } catch (error) {
    console.error('Social share error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
