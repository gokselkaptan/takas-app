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
  WELCOME_BONUS,
  SURVEY_BONUS,
  REFERRAL_BONUS,
  DAILY_LOGIN_BONUS,
  PRODUCT_BONUS,
  REVIEW_BONUS,
  FEE_BRACKETS
} from '@/lib/valor-system'

export const dynamic = 'force-dynamic'

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
