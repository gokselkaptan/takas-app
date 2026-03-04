import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { 
  checkLoginAttempts, 
  recordFailedLogin, 
  recordSuccessfulLogin,
  verifyCaptcha,
  getClientIP,
  getUserAgent,
  logSecurityEvent
} from '@/lib/security'

export async function POST(request: NextRequest) {
  try {
    const { email, password, captchaToken } = await request.json()
    const ip = getClientIP(request)
    const userAgent = getUserAgent(request)
    
    // 1. Brute-force kontrolü
    const loginCheck = await checkLoginAttempts(ip, email)
    
    if (!loginCheck.allowed) {
      return NextResponse.json({
        error: 'Hesabınız geçici olarak kilitlendi',
        lockedUntil: loginCheck.lockedUntil?.toISOString(),
        remainingMinutes: loginCheck.lockedUntil 
          ? Math.ceil((loginCheck.lockedUntil.getTime() - Date.now()) / 60000)
          : 30
      }, { status: 429 })
    }
    
    // 2. reCAPTCHA doğrulama (yapılandırılmışsa)
    if (captchaToken && process.env.RECAPTCHA_SECRET_KEY) {
      const captchaResult = await verifyCaptcha(captchaToken)
      
      if (!captchaResult.success) {
        await logSecurityEvent({
          eventType: 'captcha_failed',
          ip,
          email,
          userAgent,
          severity: 'medium',
          metadata: { score: captchaResult.score }
        })
        
        return NextResponse.json({
          error: 'Güvenlik doğrulaması başarısız'
        }, { status: 400 })
      }
    }
    
    // 3. Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email }
    })
    
    if (!user) {
      await recordFailedLogin(ip, email, userAgent, 'User not found')
      
      return NextResponse.json({
        error: 'Geçersiz email veya şifre',
        remainingAttempts: loginCheck.remainingAttempts - 1
      }, { status: 401 })
    }
    
    // 4. Şifre kontrolü
    const isPasswordValid = await bcrypt.compare(password, user.password)
    
    if (!isPasswordValid) {
      await recordFailedLogin(ip, email, userAgent, 'Invalid password')
      
      return NextResponse.json({
        error: 'Geçersiz email veya şifre',
        remainingAttempts: loginCheck.remainingAttempts - 1
      }, { status: 401 })
    }
    
    // 5. Email doğrulanmış mı?
    if (!user.emailVerified) {
      return NextResponse.json({
        error: 'Lütfen önce email adresinizi doğrulayın',
        requiresVerification: true
      }, { status: 403 })
    }
    
    // 6. Başarılı giriş - logla
    await recordSuccessfulLogin(ip, user.id, email, userAgent)
    
    // Son giriş tarihini güncelle
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Giriş başarılı',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    })
    
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Giriş yapılırken bir hata oluştu' },
      { status: 500 }
    )
  }
}
