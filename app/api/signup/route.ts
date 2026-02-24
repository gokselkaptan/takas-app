import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { checkHoneypot, checkIPBlacklist, getClientIP, getUserAgent } from '@/lib/security'
import { checkRateLimit } from '@/lib/rate-limit'
import { validate, signupSchema } from '@/lib/validations'
import { sendVerificationEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request)
    const userAgent = getUserAgent(request)
    
    // Rate limit kontrolü
    const rateLimitResult = await checkRateLimit(ip, 'api/signup')
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Çok fazla kayıt denemesi. Lütfen 1 saat sonra tekrar deneyin.' },
        { status: 429 }
      )
    }
    
    // IP Blacklist kontrolü
    const blacklistCheck = await checkIPBlacklist(ip)
    if (blacklistCheck.blocked) {
      return NextResponse.json(
        { error: 'Erişim engellendi' },
        { status: 403 }
      )
    }
    
    const body = await request.json()
    
    // Şifre gücü ve format validation
    const { success, data: validated, error } = validate(signupSchema, body)
    if (!success || !validated) {
      return NextResponse.json({ error: error || 'Geçersiz veri' }, { status: 400 })
    }
    
    const { email, password, name, nickname } = validated
    
    // Honeypot kontrolü - bu alanlar form'da gizli olacak
    // Gerçek kullanıcılar bunları doldurmaz, sadece botlar doldurur
    const honeypotFields = {
      website: body?.website,       // Gizli alan 1
      company: body?.company,       // Gizli alan 2
      faxNumber: body?.faxNumber,   // Gizli alan 3
    }
    
    const honeypotCheck = await checkHoneypot(ip, '/api/signup', honeypotFields, userAgent)
    if (honeypotCheck.isBot) {
      // Bot'a normal hata gibi görünsün
      return NextResponse.json(
        { error: 'Kayıt sırasında bir hata oluştu' },
        { status: 400 }
      )
    }
    
    // Zod validation zaten email ve password kontrolü yapıyor

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      // If user exists but not verified, allow resending code
      if (!existingUser.emailVerified) {
        const code = generateVerificationCode()
        const expiryTime = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

        await prisma.user.update({
          where: { email },
          data: {
            verificationCode: code,
            verificationCodeExpiry: expiryTime,
            password: await bcrypt.hash(password, 12),
            name: name ?? existingUser.name,
            nickname: nickname ?? existingUser.nickname,
          },
        })

        const emailSent = await sendVerificationEmail(email, code, name || existingUser.name || '')
        
        return NextResponse.json({
          requiresVerification: true,
          email: email,
          message: emailSent 
            ? 'Doğrulama kodu emailinize gönderildi' 
            : 'Doğrulama kodu gönderilemedi, lütfen tekrar deneyin',
        })
      }
      
      return NextResponse.json(
        { error: 'Bu email zaten kayıtlı' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const verificationCode = generateVerificationCode()
    const verificationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name ?? '',
        nickname: nickname || null,
        verificationCode,
        verificationCodeExpiry,
        // emailVerified will be null until verification
      },
    })

    const emailSent = await sendVerificationEmail(email, verificationCode, name || '')

    return NextResponse.json({
      requiresVerification: true,
      email: user.email,
      message: emailSent 
        ? 'Doğrulama kodu emailinize gönderildi' 
        : 'Doğrulama kodu gönderilemedi, lütfen tekrar deneyin',
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Kayıt sırasında bir hata oluştu' },
      { status: 500 }
    )
  }
}
