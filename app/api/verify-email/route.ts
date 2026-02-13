import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { giveWelcomeBonus, WELCOME_BONUS } from '@/lib/valor-system'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, code } = body ?? {}

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email ve doğrulama kodu gerekli' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email zaten doğrulanmış' },
        { status: 400 }
      )
    }

    if (!user.verificationCode || !user.verificationCodeExpiry) {
      return NextResponse.json(
        { error: 'Doğrulama kodu bulunamadı, lütfen tekrar kayıt olun' },
        { status: 400 }
      )
    }

    // Check if code is expired
    if (new Date() > user.verificationCodeExpiry) {
      return NextResponse.json(
        { error: 'Doğrulama kodu süresi dolmuş, lütfen yeni kod isteyin' },
        { status: 400 }
      )
    }

    // Check if code matches
    if (user.verificationCode !== code) {
      return NextResponse.json(
        { error: 'Geçersiz doğrulama kodu' },
        { status: 400 }
      )
    }

    // Verify user
    await prisma.user.update({
      where: { email },
      data: {
        emailVerified: new Date(),
        verificationCode: null,
        verificationCodeExpiry: null,
      },
    })

    // 🎁 Hoşgeldin bonusu ver (50 Valor)
    let bonusGiven = false
    try {
      bonusGiven = await giveWelcomeBonus(user.id)
    } catch (bonusError) {
      console.error('Hoşgeldin bonusu hatası:', bonusError)
      // Bonus hatası doğrulamayı engellemez
    }

    return NextResponse.json({
      success: true,
      message: bonusGiven 
        ? `Email başarıyla doğrulandı! 🎉 ${WELCOME_BONUS} Valor hoşgeldin bonusu hesabınıza eklendi.`
        : 'Email başarıyla doğrulandı',
      welcomeBonus: bonusGiven ? WELCOME_BONUS : 0,
    })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: 'Doğrulama sırasında bir hata oluştu' },
      { status: 500 }
    )
  }
}
