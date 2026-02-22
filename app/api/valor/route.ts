import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import {
  getUserValorHistory,
  getSystemStats,
  previewSwapFee,
  calculateProgressiveFee,
  giveSurveyBonus,
  giveDailyBonus,
  giveProductBonus,
  giveReviewBonus,
  checkAchievements,
  claimAchievement,
  getUserBonusStatus,
  getUserLevel,
  USER_LEVELS,
  getMonthlyBonusUsed,
  PROGRESSIVE_ECONOMY_ENABLED,
  BONUS_TRANSACTION_TYPES,
  WELCOME_BONUS,
  SURVEY_BONUS,
  REFERRAL_BONUS,
  DAILY_LOGIN_BONUS,
  PRODUCT_BONUS,
  REVIEW_BONUS,
  FEE_BRACKETS
} from '@/lib/valor-system'

export const dynamic = 'force-dynamic'

// ═══ Rate Limiter ═══
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60000 })
    return true
  }
  if (entry.count >= 20) return false
  entry.count++
  return true
}

/**
 * GET /api/valor
 * - ?action=balance : Kullanıcı bakiyesi
 * - ?action=history : İşlem geçmişi
 * - ?action=preview&amount=X : Kesinti önizleme
 * - ?action=stats : Sistem istatistikleri (admin)
 * - ?action=brackets : Kesinti dilimleri
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'balance'

    // Kesinti dilimleri - public
    if (action === 'brackets') {
      return NextResponse.json({
        brackets: FEE_BRACKETS.map((b, i) => ({
          level: i + 1,
          minAmount: i === 0 ? 0 : FEE_BRACKETS[i - 1].limit + 1,
          maxAmount: b.limit === Infinity ? 'Sınırsız' : b.limit,
          rate: `%${(b.rate * 100).toFixed(1)}`
        })),
        constants: {
          welcomeBonus: WELCOME_BONUS,
          surveyBonus: SURVEY_BONUS,
          referralBonus: REFERRAL_BONUS
        }
      })
    }

    // Kesinti önizleme - public
    if (action === 'preview') {
      const amount = parseInt(searchParams.get('amount') || '0')
      if (amount <= 0) {
        return NextResponse.json({ error: 'Geçerli bir miktar girin' }, { status: 400 })
      }
      
      const preview = previewSwapFee(amount)
      return NextResponse.json(preview)
    }

    // Authenticated endpoints
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        valorBalance: true,
        trustScore: true,
        role: true,
        welcomeBonusGiven: true,
        surveyCompleted: true,
        lastActiveAt: true,
        createdAt: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Rate limit kontrolü
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Çok fazla istek. 1 dakika bekleyin.' }, 
        { status: 429 }
      )
    }

    // Kullanıcı bakiyesi
    if (action === 'balance') {
      // Aktivite güncelle
      await prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() }
      })

      return NextResponse.json({
        balance: user.valorBalance,
        trustScore: user.trustScore,
        welcomeBonusGiven: user.welcomeBonusGiven,
        surveyCompleted: user.surveyCompleted,
        pendingBonuses: {
          survey: !user.surveyCompleted ? SURVEY_BONUS : 0
        },
        memberSince: user.createdAt
      })
    }

    // Bonus durumu
    if (action === 'bonus_status') {
      const bonusStatus = await getUserBonusStatus(user.id)
      return NextResponse.json(bonusStatus)
    }

    // Başarılar
    if (action === 'achievements') {
      const achievements = await checkAchievements(user.id)
      return NextResponse.json(achievements)
    }

    // Kullanıcı seviyesi
    if (action === 'user_level') {
      if (!PROGRESSIVE_ECONOMY_ENABLED) {
        return NextResponse.json({ level: 1, name: 'Aktif', emoji: '⭐', 
          dailyBonus: 3, monthlyCap: 999, swapCount: 0, progress: 100 })
      }
      
      const level = await getUserLevel(user.id)
      const nextIdx = USER_LEVELS.findIndex(l => l.level === level.level) + 1
      const nextLevel = nextIdx < USER_LEVELS.length ? USER_LEVELS[nextIdx] : null
      const swapsToNext = nextLevel ? Math.max(0, nextLevel.minSwaps - level.swapCount) : 0
      const progress = nextLevel 
        ? Math.min(100, Math.round((level.swapCount / nextLevel.minSwaps) * 100))
        : 100
      const monthlyUsed = await getMonthlyBonusUsed(user.id)
      
      return NextResponse.json({
        level: level.level,
        name: level.name,
        emoji: level.emoji,
        dailyBonus: level.dailyBonus,
        productBonus: level.productBonus,
        reviewBonus: level.reviewBonus,
        referralBonus: level.referralBonus,
        swapBonusMin: level.swapBonusMin,
        swapBonusMax: level.swapBonusMax,
        streakEnabled: level.streakEnabled,
        monthlyCap: level.monthlyCap,
        monthlyUsed,
        monthlyRemaining: Math.max(0, level.monthlyCap - monthlyUsed),
        swapCount: level.swapCount,
        swapsToNext,
        progress,
        nextLevel: nextLevel ? { 
          level: nextLevel.level, name: nextLevel.name,
          emoji: nextLevel.emoji, minSwaps: nextLevel.minSwaps 
        } : null,
      })
    }

    // Görev tamamlama durumu
    if (action === 'task_status') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // TEK SORGU — tüm günlük görevleri kontrol et
      const todayTransactions = await prisma.valorTransaction.findMany({
        where: {
          toUserId: user.id,
          createdAt: { gte: today },
          type: { in: ['daily_bonus', 'product_bonus', 'review_bonus', 'referral_bonus'] }
        },
        select: { type: true }
      })
      
      return NextResponse.json({
        'daily-login': todayTransactions.some(t => t.type === 'daily_bonus'),
        'add-product': todayTransactions.some(t => t.type === 'product_bonus'),
        'write-review': todayTransactions.some(t => t.type === 'review_bonus'),
        'invite-friend': todayTransactions.some(t => t.type === 'referral_bonus'),
      })
    }

    // İşlem geçmişi
    if (action === 'history') {
      const limit = parseInt(searchParams.get('limit') || '20')
      const offset = parseInt(searchParams.get('offset') || '0')
      
      const history = await getUserValorHistory(user.id, limit, offset)
      
      // Toplam işlem sayısı
      const totalCount = await prisma.valorTransaction.count({
        where: {
          OR: [
            { fromUserId: user.id },
            { toUserId: user.id }
          ]
        }
      })

      return NextResponse.json({
        transactions: history,
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      })
    }

    // Sistem istatistikleri (sadece admin)
    if (action === 'stats') {
      if (user.role !== 'admin') {
        return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
      }

      const stats = await getSystemStats()
      return NextResponse.json(stats)
    }

    return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 })
  } catch (error) {
    console.error('Valor API error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/valor
 * - action: claim_survey_bonus
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const { action } = body

    // Anket bonusu talep et
    if (action === 'claim_survey_bonus') {
      if (user.surveyCompleted) {
        return NextResponse.json(
          { error: 'Anket bonusu zaten alınmış' },
          { status: 400 }
        )
      }

      const success = await giveSurveyBonus(user.id)
      
      if (success) {
        return NextResponse.json({
          success: true,
          message: `🎉 ${SURVEY_BONUS} Valor anket bonusu hesabınıza eklendi!`,
          bonus: SURVEY_BONUS
        })
      } else {
        return NextResponse.json(
          { error: 'Bonus verilemedi' },
          { status: 400 }
        )
      }
    }

    // Günlük bonus talep et
    if (action === 'claim_daily_bonus') {
      const result = await giveDailyBonus(user.id)
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: result.message,
          bonus: result.bonus
        })
      } else {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        )
      }
    }

    // Başarı ödülü talep et
    if (action === 'claim_achievement') {
      const { achievementId } = body
      
      if (!achievementId) {
        return NextResponse.json(
          { error: 'Başarı ID gerekli' },
          { status: 400 }
        )
      }

      const result = await claimAchievement(user.id, achievementId)
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: result.message,
          bonus: result.bonus
        })
      } else {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 })
  } catch (error) {
    console.error('Valor POST error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
