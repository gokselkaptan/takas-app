import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    // Rate limit kontrolü
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown'
    
    const rateLimitResult = await checkRateLimit(ip, 'api/signup')
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Çok fazla deneme. Lütfen 1 saat sonra tekrar deneyin.' },
        { status: 429 }
      )
    }
    
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email gerekli' }, { status: 400 })
    }
    
    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    })
    
    // Güvenlik: Kullanıcı bulunamasa bile başarılı mesajı göster
    if (!user) {
      return NextResponse.json({ 
        success: true,
        message: 'Eğer bu email ile kayıtlı bir hesap varsa, şifre sıfırlama kodu gönderildi'
      })
    }
    
    // 6 haneli doğrulama kodu oluştur
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString()
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000) // 15 dakika geçerli
    
    // Kodu veritabanına kaydet
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode: resetCode,
        verificationCodeExpiry: resetExpiry
      }
    })
    
    // Email gönder
    try {
      const appUrl = process.env.NEXTAUTH_URL || 'https://takas-a.com'
      
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Şifre Sıfırlama</h1>
          </div>
          <div style="padding: 30px;">
            <p style="color: #333; font-size: 16px;">Merhaba <strong>${user.name || 'Kullanıcı'}</strong>,</p>
            <p style="color: #666; font-size: 14px;">Şifrenizi sıfırlamak için aşağıdaki kodu kullanın:</p>
            <div style="background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%); padding: 25px; text-align: center; border-radius: 12px; margin: 25px 0; border: 2px dashed #a855f7;">
              <h1 style="color: #7c3aed; font-size: 42px; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${resetCode}</h1>
            </div>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #92400e; margin: 0; font-size: 13px;">⏱️ Bu kod <strong>15 dakika</strong> geçerlidir.</p>
            </div>
            <p style="color: #666; font-size: 13px;">Eğer bu talebi siz yapmadıysanız, bu emaili görmezden gelebilirsiniz. Hesabınız güvende.</p>
          </div>
          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">TAKAS-A - Güvenli Takas Platformu</p>
            <p style="color: #9ca3af; font-size: 11px; margin: 5px 0 0 0;">${appUrl}</p>
          </div>
        </div>
      `
      
      const emailSent = await sendEmail({
        to: user.email,
        subject: `🔐 TAKAS-A Şifre Sıfırlama Kodu: ${resetCode}`,
        html: htmlBody
      })
      
      if (!emailSent) {
        console.error('Email gönderme başarısız')
      }
    } catch (emailError) {
      console.error('Email gönderme hatası:', emailError)
      // Email gönderilemese bile devam et - kullanıcıya hata gösterme
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Şifre sıfırlama kodu email adresinize gönderildi'
    })
    
  } catch (error) {
    console.error('Şifre sıfırlama hatası:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
