// Email gönderme modülü - Nodemailer + SMTP (Namecheap Private Email)
import nodemailer from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
}

// SMTP transporter oluştur
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.privateemail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // TLS kullan (port 587)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false // Self-signed sertifikalar için
    }
  })
}

// Email gönder
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, html, from, replyTo } = options
  
  // SMTP bilgileri kontrol et
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials not configured. Set SMTP_USER and SMTP_PASS environment variables.')
    console.log('Email would be sent to:', to)
    console.log('Subject:', subject)
    
    // Development modda true döndür
    if (process.env.NODE_ENV === 'development') {
      return true
    }
    return false
  }
  
  try {
    const transporter = createTransporter()
    
    const result = await transporter.sendMail({
      from: from || `TAKAS-A <${process.env.SMTP_USER}>`,
      to: to,
      subject: subject,
      html: html,
      replyTo: replyTo || process.env.SMTP_USER,
    })
    
    console.log('Email sent via SMTP:', result.messageId)
    return true
  } catch (error) {
    console.error('SMTP email error:', error)
    return false
  }
}

// Email doğrulama kodu gönder
export async function sendVerificationEmail(email: string, code: string, userName?: string): Promise<boolean> {
  const appUrl = process.env.NEXTAUTH_URL || 'https://takas-a.com'
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">📧 Takas-A Doğrulama Kodu</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Verification Code / Código de Verificación / Codi de Verificació</p>
      </div>
      <div style="padding: 30px;">
        <!-- Kod Bölümü / Code Section -->
        <div style="background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%); padding: 25px; text-align: center; border-radius: 12px; margin: 0 0 25px 0; border: 2px dashed #a855f7;">
          <h1 style="color: #7c3aed; font-size: 48px; letter-spacing: 10px; margin: 0; font-family: 'Courier New', monospace;">${code}</h1>
        </div>
        
        <!-- Türkçe -->
        <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">
          <p style="color: #333; font-size: 15px; margin: 0 0 8px 0;"><strong>🇹🇷 Türkçe</strong></p>
          <p style="color: #333; font-size: 14px; margin: 0 0 5px 0;">Merhaba <strong>${userName || 'Kullanıcı'}</strong>,</p>
          <p style="color: #666; font-size: 13px; margin: 0;">TAKAS-A'ya hoş geldiniz! Hesabınızı doğrulamak için yukarıdaki kodu kullanın. Bu kod <strong>15 dakika</strong> geçerlidir.</p>
        </div>
        
        <!-- English -->
        <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">
          <p style="color: #333; font-size: 15px; margin: 0 0 8px 0;"><strong>🇬🇧 English</strong></p>
          <p style="color: #333; font-size: 14px; margin: 0 0 5px 0;">Hello <strong>${userName || 'User'}</strong>,</p>
          <p style="color: #666; font-size: 13px; margin: 0;">Welcome to TAKAS-A! Use the code above to verify your account. This code is valid for <strong>15 minutes</strong>.</p>
        </div>
        
        <!-- Español -->
        <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">
          <p style="color: #333; font-size: 15px; margin: 0 0 8px 0;"><strong>🇪🇸 Español</strong></p>
          <p style="color: #333; font-size: 14px; margin: 0 0 5px 0;">Hola <strong>${userName || 'Usuario'}</strong>,</p>
          <p style="color: #666; font-size: 13px; margin: 0;">¡Bienvenido a TAKAS-A! Usa el código de arriba para verificar tu cuenta. Este código es válido por <strong>15 minutos</strong>.</p>
        </div>
        
        <!-- Català -->
        <div style="margin-bottom: 15px;">
          <p style="color: #333; font-size: 15px; margin: 0 0 8px 0;"><strong>🏴󠁥󠁳󠁣󠁴󠁿 Català</strong></p>
          <p style="color: #333; font-size: 14px; margin: 0 0 5px 0;">Hola <strong>${userName || 'Usuari'}</strong>,</p>
          <p style="color: #666; font-size: 13px; margin: 0;">Benvingut a TAKAS-A! Fes servir el codi de dalt per verificar el teu compte. Aquest codi és vàlid durant <strong>15 minuts</strong>.</p>
        </div>
        
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
          <p style="color: #92400e; margin: 0; font-size: 12px;">⚠️ Bu emaili talep etmediyseniz lütfen göz ardı edin.<br/>If you didn't request this email, please ignore it.</p>
        </div>
      </div>
      <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">TAKAS-A - Güvenli Takas Platformu / Safe Swap Platform</p>
        <p style="color: #9ca3af; font-size: 11px; margin: 5px 0 0 0;">${appUrl}</p>
      </div>
    </div>
  `
  
  return sendEmail({
    to: email,
    subject: 'Takas-A - Dogrulama Kodunuz / Your Verification Code',
    html,
    from: '"TAKAS-A" <join@takas-a.com>',
    replyTo: 'join@takas-a.com'
  })
}
