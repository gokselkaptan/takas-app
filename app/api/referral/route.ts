import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { 
  getReferralStatus, 
  giveReferralBonus, 
  REFERRAL_BONUS, 
  REFERRAL_ACTIVE_BONUS,
  MAX_REFERRAL_COUNT,
  REFERRAL_LOGIN_THRESHOLD
} from '@/lib/valor-system'

export const dynamic = 'force-dynamic'

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Get user's referral info
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        referralCode: true,
        totalReferrals: true,
        monthlyReferralCount: true,
        lastReferralAt: true,
        valorBalance: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Generate referral code if not exists
    let referralCode = user.referralCode
    if (!referralCode) {
      referralCode = generateReferralCode()
      await prisma.user.update({
        where: { email: session.user.email },
        data: { referralCode },
      })
    }

    // Get referral status from valor-system
    const referralStatus = await getReferralStatus(user.id)

    // Calculate time until next referral (24 hour cooldown)
    const now = new Date()
    const lastReferral = user.lastReferralAt ? new Date(user.lastReferralAt) : null
    let canInviteToday = true
    let hoursUntilNextInvite = 0

    if (lastReferral) {
      const hoursSinceLastReferral = (now.getTime() - lastReferral.getTime()) / (1000 * 60 * 60)
      if (hoursSinceLastReferral < 24) {
        canInviteToday = false
        hoursUntilNextInvite = Math.ceil(24 - hoursSinceLastReferral)
      }
    }

    // Get pending active bonuses (invitees who haven't reached 10 logins yet)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const pendingReferrals = await prisma.referral.findMany({
      where: {
        referrerId: user.id,
        createdAt: { gte: startOfMonth },
        activeBonusGiven: false
      },
      include: {
        referredUser: {
          select: { name: true, email: true }
        }
      }
    })

    return NextResponse.json({
      referralCode,
      totalReferrals: user.totalReferrals,
      valorBalance: user.valorBalance,
      // Yeni aylık sistem
      monthlyCount: referralStatus.monthlyCount,
      maxMonthlyCount: MAX_REFERRAL_COUNT,
      canInvite: referralStatus.canInvite && canInviteToday,
      hoursUntilNextInvite,
      // Bonus bilgileri
      referralBonus: REFERRAL_BONUS,
      activeBonusAmount: REFERRAL_ACTIVE_BONUS,
      loginThreshold: REFERRAL_LOGIN_THRESHOLD,
      // Bekleyen aktif bonuslar
      pendingActiveBonus: referralStatus.pendingActiveBonus,
      pendingReferrals: pendingReferrals.map(r => ({
        friendName: r.referredUser.name,
        loginCount: r.friendLoginCount,
        threshold: REFERRAL_LOGIN_THRESHOLD,
        createdAt: r.createdAt
      }))
    })
  } catch (error) {
    console.error('Referral fetch error:', error)
    return NextResponse.json(
      { error: 'Davet bilgileri yüklenemedi' },
      { status: 500 }
    )
  }
}

// Send invitation (or validate referral code for signup)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, email, referralCode } = body

    // Validate referral code during signup
    if (action === 'validate') {
      if (!referralCode) {
        return NextResponse.json({ valid: false })
      }

      const referrer = await prisma.user.findUnique({
        where: { referralCode },
        select: { id: true, name: true },
      })

      return NextResponse.json({
        valid: !!referrer,
        referrerName: referrer?.name,
      })
    }

    // Complete referral (called after signup with referral code)
    if (action === 'complete') {
      const { referrerId, referredUserId } = body
      
      if (!referrerId || !referredUserId) {
        return NextResponse.json({ error: 'Eksik bilgi' }, { status: 400 })
      }

      const result = await giveReferralBonus(referrerId, referredUserId)
      return NextResponse.json(result)
    }

    // Send invitation
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Get referral status
    const referralStatus = await getReferralStatus(user.id)

    // Check monthly limit
    if (!referralStatus.canInvite) {
      return NextResponse.json(
        { error: `Bu ay maksimum ${MAX_REFERRAL_COUNT} davet hakkınızı kullandınız. Yeni ay başında tekrar davet edebilirsiniz.` },
        { status: 429 }
      )
    }

    // Check daily limit (24 hour cooldown)
    const now = new Date()
    if (user.lastReferralAt) {
      const hoursSinceLastReferral = (now.getTime() - new Date(user.lastReferralAt).getTime()) / (1000 * 60 * 60)
      if (hoursSinceLastReferral < 24) {
        const hoursRemaining = Math.ceil(24 - hoursSinceLastReferral)
        return NextResponse.json(
          { error: `Günlük davet limitinize ulaştınız. ${hoursRemaining} saat sonra tekrar deneyebilirsiniz.` },
          { status: 429 }
        )
      }
    }

    if (!email) {
      return NextResponse.json({ error: 'Email adresi gerekli' }, { status: 400 })
    }

    // Check if email already registered
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Bu email adresi zaten kayıtlı' },
        { status: 400 }
      )
    }

    // Generate referral code if not exists
    let referralCodeToUse = user.referralCode
    if (!referralCodeToUse) {
      referralCodeToUse = generateReferralCode()
    }

    // Update user's last referral time
    await prisma.user.update({
      where: { id: user.id },
      data: {
        referralCode: referralCodeToUse,
        lastReferralAt: now,
      },
    })

    // In a real app, you'd send an email here
    // For now, we just return the referral link
    const referralLink = `https://takas-a.com/kayit?ref=${referralCodeToUse}`

    return NextResponse.json({
      success: true,
      message: `Davet başarıyla gönderildi! (${referralStatus.monthlyCount + 1}/${MAX_REFERRAL_COUNT} bu ay)`,
      referralLink,
      remainingInvites: MAX_REFERRAL_COUNT - referralStatus.monthlyCount - 1
    })
  } catch (error) {
    console.error('Referral send error:', error)
    return NextResponse.json(
      { error: 'Davet gönderilemedi' },
      { status: 500 }
    )
  }
}
