import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

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

    // Verify user - bonus artık ilk takas sonrası veriliyor (MILESTONE_BONUSES'tan first_swap)
    await prisma.user.update({
      where: { email },
      data: {
        emailVerified: new Date(),
        verificationCode: null,
        verificationCodeExpiry: null,
      },
    })

    // NOT: Bonus artık email doğrulama sonrası verilmiyor!
    // İlk takas tamamlandığında otomatik olarak 5 VALOR bonus veriliyor
    // (lib/valor-system.ts içindeki MILESTONE_BONUSES - first_swap)

    return NextResponse.json({
      success: true,
      message: 'Email başarıyla doğrulandı! 🎉 İlk takasınızı tamamladığınızda 5 VALOR bonus kazanacaksınız.',
      welcomeBonus: 0, // Artık email doğrulama sonrası bonus yok
      firstSwapBonusPending: true, // İlk takas bonusu bekliyor
    })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: 'Doğrulama sırasında bir hata oluştu' },
      { status: 500 }
    )
  }
}
