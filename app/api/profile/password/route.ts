import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import bcrypt from 'bcryptjs'

// PUT - Şifre değiştir
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword, confirmPassword } = body

    // Validasyon
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'Tüm alanlar zorunludur' }, { status: 400 })
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'Yeni şifreler eşleşmiyor' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Şifre en az 8 karakter olmalıdır' }, { status: 400 })
    }

    // Güçlü şifre kontrolü
    const hasUpperCase = /[A-Z]/.test(newPassword)
    const hasLowerCase = /[a-z]/.test(newPassword)
    const hasNumbers = /\d/.test(newPassword)
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return NextResponse.json({ 
        error: 'Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir' 
      }, { status: 400 })
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, password: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Mevcut şifreyi kontrol et
    const isValidPassword = await bcrypt.compare(currentPassword, user.password)
    
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Mevcut şifre yanlış' }, { status: 400 })
    }

    // Yeni şifre eski şifreyle aynı olmamalı
    const isSamePassword = await bcrypt.compare(newPassword, user.password)
    if (isSamePassword) {
      return NextResponse.json({ error: 'Yeni şifre mevcut şifreden farklı olmalıdır' }, { status: 400 })
    }

    // Yeni şifreyi hashle
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Şifreyi güncelle
    await prisma.user.update({
      where: { email: session.user.email },
      data: { password: hashedPassword }
    })

    // Güvenlik logu
    try {
      await prisma.securityLog.create({
        data: {
          userId: user.id,
          eventType: 'PASSWORD_CHANGE',
          severity: 'medium',
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          metadata: JSON.stringify({ action: 'password_changed' })
        }
      })
    } catch (logError) {
      console.error('Güvenlik logu yazılamadı:', logError)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Şifreniz başarıyla güncellendi' 
    })
  } catch (error) {
    console.error('Şifre değiştirme hatası:', error)
    return NextResponse.json({ error: 'Şifre değiştirilemedi' }, { status: 500 })
  }
}
