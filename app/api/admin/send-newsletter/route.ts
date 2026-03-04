import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// HTML Email Template
function createEmailTemplate(subject: string, content: string): string {
  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); padding: 40px 30px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <!-- Logo -->
                    <div style="background-color: rgba(255,255,255,0.2); border-radius: 16px; padding: 12px 20px; display: inline-block; margin-bottom: 16px;">
                      <span style="font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                        🔄 TAKAS-A
                      </span>
                    </div>
                    <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">
                      Türkiye'nin En Güvenilir Takas Platformu
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Subject Title -->
          <tr>
            <td style="padding: 30px 30px 10px 30px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1f2937; line-height: 1.3;">
                ${subject}
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px 30px 30px 30px;">
              <div style="font-size: 15px; line-height: 1.7; color: #4b5563;">
                ${content}
              </div>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 30px 40px 30px;" align="center">
              <a href="https://takas-a.com" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                Takas-A'yı Keşfet →
              </a>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 30px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;">
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f9fafb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <span style="font-size: 20px; font-weight: 600; color: #6366f1;">🔄 TAKAS-A</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                      Değer Taşır, Para Değil 💜
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <a href="https://takas-a.com" style="color: #6366f1; text-decoration: none; font-size: 13px; margin: 0 8px;">Web</a>
                    <span style="color: #d1d5db;">•</span>
                    <a href="mailto:join@takas-a.com" style="color: #6366f1; text-decoration: none; font-size: 13px; margin: 0 8px;">İletişim</a>
                    <span style="color: #d1d5db;">•</span>
                    <a href="https://takas-a.com/yardim" style="color: #6366f1; text-decoration: none; font-size: 13px; margin: 0 8px;">Yardım</a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.6;">
                      Bu e-postayı Takas-A üyesi olduğunuz için aldınız.<br>
                      <a href="https://takas-a.com/ayarlar?unsubscribe=true" style="color: #9ca3af; text-decoration: underline;">
                        E-posta bildirimlerini yönet
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

// Rate limiter - 1 mail per second
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(req: NextRequest) {
  try {
    // Admin session kontrolü
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Admin rolü kontrolü
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true, email: true }
    })
    
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }
    
    const body = await req.json()
    const { subject, content, testMode = true, sendToAll = false } = body
    
    if (!subject || !content) {
      return NextResponse.json({ error: 'Subject and content are required' }, { status: 400 })
    }
    
    // Email listesini al
    let emailList: { email: string }[] = []
    
    if (testMode) {
      // Test modunda sadece admin'e gönder
      emailList = [{ email: user.email }]
      console.log('📧 Test mode: Sending only to admin:', user.email)
    } else {
      // sendToAll: true ise tüm kullanıcılara, false ise sadece doğrulanmış kullanıcılara
      emailList = await prisma.user.findMany({
        where: sendToAll 
          ? {} // Tüm kullanıcılar (doğrulanmamış dahil)
          : { emailVerified: { not: null } }, // Sadece doğrulanmış emailler
        select: { email: true }
      })
      console.log(`📧 Production mode: Sending to ${emailList.length} users (sendToAll: ${sendToAll})`)
    }
    
    if (emailList.length === 0) {
      return NextResponse.json({ 
        error: 'No recipients found',
        success: false,
        sent: 0,
        failed: 0,
        total: 0
      }, { status: 400 })
    }
    
    // HTML template oluştur
    const htmlContent = createEmailTemplate(subject, content)
    
    // Gönderim sayaçları
    let sent = 0
    let failed = 0
    const failedEmails: string[] = []
    
    // Her kullanıcıya gönder (rate limiting ile)
    for (let i = 0; i < emailList.length; i++) {
      const recipient = emailList[i]
      
      try {
        const success = await sendEmail({
          to: recipient.email,
          subject: `🔄 ${subject}`,
          html: htmlContent,
        })
        
        if (success) {
          sent++
          console.log(`✅ [${sent}/${emailList.length}] Sent to: ${recipient.email}`)
        } else {
          failed++
          failedEmails.push(recipient.email)
          console.error(`❌ Failed to send to ${recipient.email}`)
        }
        
      } catch (emailError: any) {
        failed++
        failedEmails.push(recipient.email)
        console.error(`❌ Failed to send to ${recipient.email}:`, emailError.message)
      }
      
      // Rate limiting: 1 saniye bekle (son email hariç)
      if (i < emailList.length - 1) {
        await sleep(1000)
      }
    }
    
    // Sonuç logla
    console.log(`📊 Newsletter completed: ${sent} sent, ${failed} failed, ${emailList.length} total`)
    
    // Log to database (optional - newsletter_logs table gerekir)
    try {
      await prisma.$executeRaw`
        INSERT INTO "NewsletterLog" ("id", "subject", "sentCount", "failedCount", "testMode", "createdAt")
        VALUES (gen_random_uuid(), ${subject}, ${sent}, ${failed}, ${testMode}, NOW())
      `
    } catch {
      // NewsletterLog tablosu yoksa devam et
      console.log('📝 NewsletterLog table not found, skipping log entry')
    }
    
    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: emailList.length,
      testMode,
      failedEmails: failed > 0 ? failedEmails : undefined
    })
    
  } catch (error: any) {
    console.error('Newsletter API error:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      success: false
    }, { status: 500 })
  }
}

// GET: Newsletter istatistikleri
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    })
    
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }
    
    // Toplam kullanıcı sayısı
    const totalUsers = await prisma.user.count()
    
    // Doğrulanmış email sayısı
    const verifiedUsers = await prisma.user.count({
      where: { emailVerified: { not: null } }
    })
    
    return NextResponse.json({
      totalUsers,
      verifiedUsers,
      eligibleRecipients: verifiedUsers // Gönderim yapılabilecek kullanıcılar
    })
    
  } catch (error: any) {
    console.error('Newsletter stats error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
