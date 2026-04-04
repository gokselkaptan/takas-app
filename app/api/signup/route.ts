import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { checkHoneypot, checkIPBlacklist, getClientIP, getUserAgent } from '@/lib/security'
import { checkRateLimit } from '@/lib/rate-limit'
import { validate, signupSchema } from '@/lib/validations'
import { sendVerificationEmail, sendEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push-notifications'

// In-memory rate limiter for signup
const signupRateLimitMap = new Map<string, { count: number; resetTime: number }>()

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}

export const dynamic = 'force-dynamic'

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: Request) {
  // Memory leak önlemi — 10.000 kayıttan büyüyünce temizle
  if (signupRateLimitMap.size > 10000) signupRateLimitMap.clear()

  try {
    const ip = getClientIP(request)
    const userAgent = getUserAgent(request)
    
    // Rate limit kontrolü
    const rateLimitResult = await checkRateLimit(ip, 'api/signup')
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Çok fazla kayıt denemesi. Lütfen 1 saat sonra tekrar deneyin.' },
        { status: 429, headers: SECURITY_HEADERS }
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
            ? 'Doğrulama kodu emailinize gönderildi. Spam klasörünüzü de kontrol ediniz.' 
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

    // Admin bildirimi — fire & forget (kayıt akışını engellemesin)
    ;(async () => {
      try {
        const adminUser = await prisma.user.findUnique({
          where: { email: 'join@takas-a.com' },
          select: { id: true }
        })

        if (adminUser) {
          await sendPushToUser(adminUser.id, 'SYSTEM', {
            title: '🎉 Yeni Üye!',
            body: `${name} platforma katıldı.`,
            url: '/admin'
          })
        }

        await sendEmail({
          to: 'join@takas-a.com',
          subject: `🎉 Yeni Üye: ${name}`,
          html: `
            <h2>Yeni kullanıcı kaydoldu!</h2>
            <p><strong>İsim:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
            <br/>
            <a href="https://takas-a.com/admin" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Admin Panele Git →</a>
          `
        })
      } catch (err) {
        console.error('Admin yeni üye bildirimi hatası:', err)
      }
    })()

    const emailSent = await sendVerificationEmail(email, verificationCode, name || '')

    return NextResponse.json({
      requiresVerification: true,
      email: user.email,
      message: emailSent 
        ? 'Doğrulama kodu emailinize gönderildi. Spam klasörünüzü de kontrol ediniz.' 
        : 'Doğrulama kodu gönderilemedi, lütfen tekrar deneyin',
    }, { headers: SECURITY_HEADERS })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Kayıt sırasında bir hata oluştu' },
      { status: 500, headers: SECURITY_HEADERS }
    )
  }
}
