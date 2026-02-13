import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendVerificationEmail(email: string, code: string, name: string) {
  const appUrl = process.env.NEXTAUTH_URL || 'https://takas-a.com'
  const appName = 'TAKAS-A'

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 40px 20px;">
      <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7c3aed; margin: 0; font-size: 28px;">TAKAS-A</h1>
          <p style="color: #64748b; margin-top: 8px;">Email Doğrulama</p>
        </div>
        
        <p style="color: #334155; font-size: 16px;">Merhaba ${name || 'Kullanıcı'},</p>
        
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
          TAKAS-A'ya hoş geldiniz! Hesabınızı aktif hale getirmek için aşağıdaki doğrulama kodunu kullanın:
        </p>
        
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%); border-radius: 12px; padding: 24px; text-align: center; margin: 30px 0;">
          <span style="color: white; font-size: 36px; font-weight: bold; letter-spacing: 8px;">${code}</span>
        </div>
        
        <p style="color: #64748b; font-size: 14px; text-align: center;">
          Bu kod <strong>10 dakika</strong> içinde geçerliliğini yitirecektir.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          Bu emaili siz talep etmediyseniz, lütfen dikkate almayın.
        </p>
      </div>
    </div>
  `

  try {
    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_EMAIL_DORULAMA_KODU,
        subject: `TAKAS-A Email Doğrulama Kodunuz: ${code}`,
        body: htmlBody,
        is_html: true,
        recipient_email: email,
        sender_email: `noreply@takas-a.com`,
        sender_alias: appName,
      }),
    })

    const result = await response.json()
    return result.success
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name, nickname } = body ?? {}

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email ve şifre gerekli' },
        { status: 400 }
      )
    }

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
