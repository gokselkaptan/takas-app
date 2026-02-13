import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
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
    
    // Email gönder (notification system kullanarak)
    try {
      const notificationEndpoint = process.env.NOTIFICATION_EMAIL_ENDPOINT
      const notificationApiKey = process.env.NOTIFICATION_EMAIL_API_KEY
      
      if (notificationEndpoint && notificationApiKey) {
        await fetch(notificationEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${notificationApiKey}`
          },
          body: JSON.stringify({
            to: user.email,
            subject: 'TAKAS-A Şifre Sıfırlama Kodu',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #7c3aed;">Şifre Sıfırlama</h2>
                <p>Merhaba ${user.name || 'Kullanıcı'},</p>
                <p>Şifrenizi sıfırlamak için aşağıdaki kodu kullanın:</p>
                <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0;">
                  <h1 style="color: #7c3aed; font-size: 32px; letter-spacing: 5px; margin: 0;">${resetCode}</h1>
                </div>
                <p style="color: #666;">Bu kod 15 dakika geçerlidir.</p>
                <p style="color: #666;">Eğer bu talebi siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #999; font-size: 12px;">TAKAS-A - Güvenli Takas Platformu</p>
              </div>
            `
          })
        })
      }
    } catch (emailError) {
      console.error('Email gönderme hatası:', emailError)
      // Email gönderilemese bile devam et
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
