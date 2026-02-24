// Email gönderme modülü - Nodemailer + SMTP (Namecheap Private Email)
import nodemailer from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
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
  const { to, subject, html, from } = options
  
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
        <h1 style="color: white; margin: 0; font-size: 28px;">✉️ Email Doğrulama</h1>
      </div>
      <div style="padding: 30px;">
        <p style="color: #333; font-size: 16px;">Merhaba <strong>${userName || 'Kullanıcı'}</strong>,</p>
        <p style="color: #666; font-size: 14px;">TAKAS-A'ya hoş geldiniz! Hesabınızı doğrulamak için aşağıdaki kodu kullanın:</p>
        <div style="background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%); padding: 25px; text-align: center; border-radius: 12px; margin: 25px 0; border: 2px dashed #a855f7;">
          <h1 style="color: #7c3aed; font-size: 42px; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${code}</h1>
        </div>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
          <p style="color: #92400e; margin: 0; font-size: 13px;">⏱️ Bu kod <strong>15 dakika</strong> geçerlidir.</p>
        </div>
      </div>
      <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">TAKAS-A - Güvenli Takas Platformu</p>
        <p style="color: #9ca3af; font-size: 11px; margin: 5px 0 0 0;">${appUrl}</p>
      </div>
    </div>
  `
  
  return sendEmail({
    to: email,
    subject: `✉️ TAKAS-A Email Doğrulama Kodu: ${code}`,
    html
  })
}
