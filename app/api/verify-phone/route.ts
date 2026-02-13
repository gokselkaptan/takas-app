import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Telefon doğrulama kodu gönder
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 })
    }

    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Telefon numarası gerekli' }, { status: 400 })
    }

    // Türk telefon numarası doğrulama
    const phoneRegex = /^(\+90|0)?[5][0-9]{9}$/
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return NextResponse.json({ 
        error: 'Geçersiz telefon numarası. Türk cep telefonu numarası girin.' 
      }, { status: 400 })
    }

    // Normalize phone number
    const normalizedPhone = phone.replace(/\s/g, '').replace(/^0/, '+90').replace(/^5/, '+905')

    // 6 haneli doğrulama kodu oluştur
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiry = new Date(Date.now() + 10 * 60 * 1000) // 10 dakika

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Kullanıcıyı güncelle
    await prisma.user.update({
      where: { id: user.id },
      data: {
        phone: normalizedPhone,
        verificationCode,
        verificationCodeExpiry: expiry
      }
    })

    // NOT: Gerçek SMS servisi henüz entegre edilmedi
    // Demo/beta sürümünde kod ekranda gösterilir
    console.log(`[TELEFON DOĞRULAMA] ${normalizedPhone} için kod: ${verificationCode}`)

    return NextResponse.json({
      success: true,
      message: 'Doğrulama kodu oluşturuldu',
      phone: normalizedPhone.slice(0, 7) + '****', // Gizlenmiş numara
      // Demo modu: SMS servisi olmadığı için kodu ekranda göster
      demoCode: verificationCode,
      isDemoMode: true,
      expiresAt: expiry.toISOString()
    })
  } catch (error) {
    console.error('Phone verification error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}

// Doğrulama kodunu kontrol et
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 })
    }

    const { code } = await request.json()

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Geçersiz doğrulama kodu' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        verificationCode: true,
        verificationCodeExpiry: true,
        phone: true,
        trustScore: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    if (!user.verificationCode || !user.verificationCodeExpiry) {
      return NextResponse.json({ error: 'Önce doğrulama kodu isteyin' }, { status: 400 })
    }

    if (new Date() > user.verificationCodeExpiry) {
      return NextResponse.json({ error: 'Doğrulama kodunun süresi dolmuş' }, { status: 400 })
    }

    if (user.verificationCode !== code) {
      return NextResponse.json({ error: 'Yanlış doğrulama kodu' }, { status: 400 })
    }

    // Telefon doğrulandı
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isPhoneVerified: true,
        verificationCode: null,
        verificationCodeExpiry: null,
        // Güven puanını artır
        trustScore: Math.min(100, user.trustScore + 10)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Telefon numarası doğrulandı! Güven puanınız +10 arttı.',
      phone: user.phone
    })
  } catch (error) {
    console.error('Phone verification error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
