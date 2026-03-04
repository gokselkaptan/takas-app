import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json()
    
    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'Tüm alanlar gerekli' }, { status: 400 })
    }
    
    // Şifre kontrolü
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Şifre en az 8 karakter olmalıdır' }, { status: 400 })
    }
    
    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'Geçersiz kod veya email' }, { status: 400 })
    }
    
    // Kod kontrolü
    if (user.verificationCode !== code) {
      return NextResponse.json({ error: 'Geçersiz doğrulama kodu' }, { status: 400 })
    }
    
    // Süre kontrolü
    if (!user.verificationCodeExpiry || new Date() > new Date(user.verificationCodeExpiry)) {
      return NextResponse.json({ error: 'Doğrulama kodunun süresi dolmuş. Lütfen yeni kod isteyin.' }, { status: 400 })
    }
    
    // Şifreyi hashle ve güncelle
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        verificationCode: null,
        verificationCodeExpiry: null
      }
    })
    
    return NextResponse.json({ 
      success: true,
      message: 'Şifreniz başarıyla güncellendi. Şimdi giriş yapabilirsiniz.'
    })
    
  } catch (error) {
    console.error('Şifre güncelleme hatası:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
