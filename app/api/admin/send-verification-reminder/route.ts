import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Dil tespiti - email domain ve user preferences'a göre
function detectLanguage(email: string): 'tr' | 'en' | 'es' | 'de' {
  const domain = email.split('@')[1]?.toLowerCase() || ''
  
  // İspanyolca domain'ler
  if (domain.endsWith('.es') ||      // İspanya
      domain.endsWith('.mx') ||      // Meksika
      domain.endsWith('.ar') ||      // Arjantin
      domain.endsWith('.co') ||      // Kolombiya
      domain.endsWith('.cl') ||      // Şili
      domain.endsWith('.pe') ||      // Peru
      domain.endsWith('.ve') ||      // Venezuela
      domain.endsWith('.ec') ||      // Ekvador
      domain.endsWith('.uy') ||      // Uruguay
      domain.endsWith('.py')) {      // Paraguay
    return 'es'
  }
  
  // Almanca domain'ler
  if (domain.endsWith('.de') || domain.endsWith('.at') || domain.endsWith('.ch')) {
    return 'de'
  }
  
  // Türkçe domain'ler
  if (domain.endsWith('.tr') || domain.endsWith('.com.tr')) {
    return 'tr'
  }
  
  // İngilizce domain'ler
  if (domain.endsWith('.uk') || domain.endsWith('.us') || domain.endsWith('.au') || domain.endsWith('.ca')) {
    return 'en'
  }
  
  // Varsayılan Türkçe (Türkiye'nin platformu)
  return 'tr'
}

// 4 dilde email template (TR, EN, ES, DE)
function createVerificationEmailTemplate(
  code: string, 
  userName: string | null, 
  language: 'tr' | 'en' | 'es' | 'de'
): { subject: string; html: string } {
  
  const templates = {
    tr: {
      subject: `✉️ Email Doğrulama + İlk Takas Bonusu: 5 VALOR!`,
      greeting: `Merhaba${userName ? ` ${userName}` : ''},`,
      intro1: `<strong>TAKAS-A</strong>'ya hoş geldiniz! TAKAS-A, Türkiye'nin ilk ve tek parasız takas platformudur.`,
      intro2: `VALOR ile ürünlerinizi para kullanmadan güvenle takas edin.`,
      bonusTitle: `🎁 İLK TAKAS BONUSU: 5 VALOR!`,
      bonusText: `Email adresinizi doğrulayın ve <strong>ilk takasınızı tamamladıktan sonra 5 VALOR bonus</strong> kazanın!`,
      bonusNote: `Bonus, ilk başarılı takasınızın ardından otomatik olarak hesabınıza eklenecektir.`,
      codeLabel: `Doğrulama Kodunuz:`,
      buttonText: `Email'imi Doğrula`,
      expiryNote: `⏱️ Bu kod <strong>10 dakika</strong> geçerlidir.`,
      whyTitle: `Neden Doğrulamalıyım?`,
      reason1: `✅ İlk takas sonrası 5 VALOR bonus kazanın`,
      reason2: `✅ Takas tekliflerinden haberdar olun`,
      reason3: `✅ Mesaj bildirimlerini alın`,
      reason4: `✅ Hesap güvenliğinizi artırın`,
      footer: `Bu e-postayı TAKAS-A üyesi olduğunuz için aldınız.`,
      contact: `Sorularınız için: join@takas-a.com`,
      slogan: `Değer Taşır, Para Değil 💜`
    },
    en: {
      subject: `✉️ Email Verification + First Swap Bonus: 5 VALOR!`,
      greeting: `Hello${userName ? ` ${userName}` : ''},`,
      intro1: `Welcome to <strong>TAKAS-A</strong>! TAKAS-A is Turkey's first and only money-free barter platform.`,
      intro2: `Trade your products safely without money using VALOR.`,
      bonusTitle: `🎁 FIRST SWAP BONUS: 5 VALOR!`,
      bonusText: `Verify your email and earn <strong>5 VALOR bonus after completing your first swap</strong>!`,
      bonusNote: `The bonus will be automatically added to your account after your first successful swap.`,
      codeLabel: `Your Verification Code:`,
      buttonText: `Verify My Email`,
      expiryNote: `⏱️ This code is valid for <strong>10 minutes</strong>.`,
      whyTitle: `Why Verify?`,
      reason1: `✅ Earn 5 VALOR after your first swap`,
      reason2: `✅ Get notified about swap offers`,
      reason3: `✅ Receive message notifications`,
      reason4: `✅ Increase your account security`,
      footer: `You received this email because you are a TAKAS-A member.`,
      contact: `Questions? Contact: join@takas-a.com`,
      slogan: `Value Transfers, Not Money 💜`
    },
    es: {
      subject: `✉️ Verifica tu Correo + Bono de Primer Intercambio: ¡5 VALOR!`,
      greeting: `Hola${userName ? ` ${userName}` : ''},`,
      intro1: `¡Bienvenido a <strong>TAKAS-A</strong>! TAKAS-A es la primera y única plataforma de trueque sin dinero de Turquía.`,
      intro2: `Intercambia tus productos de forma segura sin dinero usando VALOR.`,
      bonusTitle: `🎁 ¡BONO DEL PRIMER INTERCAMBIO: 5 VALOR!`,
      bonusText: `Verifica tu correo electrónico y gana <strong>5 VALOR de bono después de completar tu primer intercambio</strong>!`,
      bonusNote: `El bono se agregará automáticamente a tu cuenta después de tu primer intercambio exitoso.`,
      codeLabel: `Tu Código de Verificación:`,
      buttonText: `Verificar Mi Correo`,
      expiryNote: `⏱️ Este código es válido por <strong>10 minutos</strong>.`,
      whyTitle: `¿Por Qué Verificar?`,
      reason1: `✅ Gana 5 VALOR después de tu primer intercambio`,
      reason2: `✅ Recibe notificaciones sobre ofertas de intercambio`,
      reason3: `✅ Recibe notificaciones de mensajes`,
      reason4: `✅ Aumenta la seguridad de tu cuenta`,
      footer: `Recibes este correo porque eres miembro de TAKAS-A.`,
      contact: `¿Preguntas? Contacto: join@takas-a.com`,
      slogan: `Valor se Transfiere, no Dinero 💜`
    },
    de: {
      subject: `✉️ E-Mail-Verifizierung + Erster Tausch Bonus: 5 VALOR!`,
      greeting: `Hallo${userName ? ` ${userName}` : ''},`,
      intro1: `Willkommen bei <strong>TAKAS-A</strong>! TAKAS-A ist die erste und einzige geldfreie Tauschplattform der Türkei.`,
      intro2: `Tauschen Sie Ihre Produkte sicher ohne Geld mit VALOR.`,
      bonusTitle: `🎁 ERSTER TAUSCH BONUS: 5 VALOR!`,
      bonusText: `Bestätigen Sie Ihre E-Mail und verdienen Sie <strong>5 VALOR Bonus nach Abschluss Ihres ersten Tauschs</strong>!`,
      bonusNote: `Der Bonus wird nach Ihrem ersten erfolgreichen Tausch automatisch Ihrem Konto gutgeschrieben.`,
      codeLabel: `Ihr Bestätigungscode:`,
      buttonText: `Meine E-Mail bestätigen`,
      expiryNote: `⏱️ Dieser Code ist <strong>10 Minuten</strong> gültig.`,
      whyTitle: `Warum verifizieren?`,
      reason1: `✅ 5 VALOR nach erstem Tausch verdienen`,
      reason2: `✅ Über Tauschangebote informiert werden`,
      reason3: `✅ Nachrichtenbenachrichtigungen erhalten`,
      reason4: `✅ Kontosicherheit erhöhen`,
      footer: `Sie haben diese E-Mail erhalten, weil Sie TAKAS-A Mitglied sind.`,
      contact: `Fragen? Kontakt: join@takas-a.com`,
      slogan: `Wert überträgt, kein Geld 💜`
    }
  }

  const t = templates[language]
  const verifyUrl = `https://takas-a.com/verify-email?code=${code}`

  const html = `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%); padding: 40px 30px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="background-color: rgba(255,255,255,0.2); border-radius: 16px; padding: 12px 24px; display: inline-block; margin-bottom: 16px;">
                      <span style="font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                        🔄 TAKAS-A
                      </span>
                    </div>
                    <p style="color: rgba(255,255,255,0.95); font-size: 14px; margin: 0;">
                      ${t.slogan}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 30px 10px 30px;">
              <p style="margin: 0; font-size: 18px; color: #1f2937;">
                ${t.greeting}
              </p>
            </td>
          </tr>
          
          <!-- Intro -->
          <tr>
            <td style="padding: 10px 30px 20px 30px;">
              <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: #4b5563;">
                ${t.intro1}
              </p>
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #4b5563;">
                ${t.intro2}
              </p>
            </td>
          </tr>
          
          <!-- VALOR Bonus Box -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 16px; padding: 24px; text-align: center;">
                <h2 style="margin: 0 0 12px 0; font-size: 24px; color: #92400e;">
                  ${t.bonusTitle}
                </h2>
                <p style="margin: 0 0 8px 0; font-size: 16px; color: #78350f;">
                  ${t.bonusText}
                </p>
                <p style="margin: 0; font-size: 13px; color: #92400e; opacity: 0.8;">
                  ${t.bonusNote}
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Verification Code -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <div style="background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%); border: 2px dashed #a855f7; border-radius: 16px; padding: 24px; text-align: center;">
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
                  ${t.codeLabel}
                </p>
                <p style="margin: 0; font-size: 42px; font-weight: 700; color: #7c3aed; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                  ${code}
                </p>
              </div>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 30px 20px 30px;" align="center">
              <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">
                ${t.buttonText}
              </a>
            </td>
          </tr>
          
          <!-- Expiry Note -->
          <tr>
            <td style="padding: 0 30px 30px 30px;" align="center">
              <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                ${t.expiryNote}
              </p>
            </td>
          </tr>
          
          <!-- Why Verify Box -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background: #f9fafb; border-radius: 12px; padding: 20px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">
                  ${t.whyTitle}
                </h3>
                <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; line-height: 1.8; color: #4b5563;">
                  <li>${t.reason1}</li>
                  <li>${t.reason2}</li>
                  <li>${t.reason3}</li>
                  <li>${t.reason4}</li>
                </ul>
              </div>
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
                    <span style="font-size: 20px; font-weight: 600; color: #7c3aed;">🔄 TAKAS-A</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <a href="https://takas-a.com" style="color: #7c3aed; text-decoration: none; font-size: 13px; margin: 0 8px;">Web</a>
                    <span style="color: #d1d5db;">•</span>
                    <a href="mailto:join@takas-a.com" style="color: #7c3aed; text-decoration: none; font-size: 13px; margin: 0 8px;">join@takas-a.com</a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.6;">
                      ${t.footer}<br>
                      ${t.contact}
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

  return { subject: t.subject, html }
}

// 6 haneli rastgele kod oluştur
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Rate limiter
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
    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true, email: true, name: true, id: true }
    })
    
    if (adminUser?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }
    
    const body = await req.json()
    const { testMode = true } = body
    
    // Doğrulanmamış kullanıcıları çek
    let usersToNotify: { id: string; email: string; name: string | null }[] = []
    
    if (testMode) {
      // Test modunda sadece admin'e gönder
      usersToNotify = [{ id: adminUser.id, email: adminUser.email, name: adminUser.name }]
      console.log('📧 Test mode: Sending only to admin:', adminUser.email)
    } else {
      // Doğrulanmamış tüm kullanıcıları al
      usersToNotify = await prisma.user.findMany({
        where: {
          emailVerified: null
        },
        select: { id: true, email: true, name: true }
      })
      console.log(`📧 Production mode: Sending to ${usersToNotify.length} unverified users`)
    }
    
    if (usersToNotify.length === 0) {
      return NextResponse.json({ 
        error: 'No unverified users found',
        success: false,
        sent: 0,
        failed: 0,
        total: 0
      }, { status: 400 })
    }
    
    // Gönderim sayaçları
    let sent = 0
    let failed = 0
    const failedEmails: string[] = []
    const languageStats = { tr: 0, en: 0, es: 0, de: 0 }
    
    // Her kullanıcıya gönder
    for (let i = 0; i < usersToNotify.length; i++) {
      const user = usersToNotify[i]
      
      try {
        // Yeni doğrulama kodu oluştur
        const verificationCode = generateVerificationCode()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 dakika
        
        // Kodu DB'ye kaydet
        await prisma.user.update({
          where: { id: user.id },
          data: {
            verificationCode,
            verificationCodeExpiry: expiresAt
          }
        })
        
        // Dil tespit et
        const language = detectLanguage(user.email)
        languageStats[language]++
        
        // Email template oluştur
        const { subject, html } = createVerificationEmailTemplate(
          verificationCode,
          user.name,
          language
        )
        
        // Email gönder
        const success = await sendEmail({
          to: user.email,
          subject,
          html,
        })
        
        if (success) {
          sent++
          console.log(`✅ [${sent}/${usersToNotify.length}] Sent to: ${user.email} (${language})`)
        } else {
          failed++
          failedEmails.push(user.email)
          console.error(`❌ Failed to send to ${user.email}`)
        }
        
      } catch (emailError: any) {
        failed++
        failedEmails.push(user.email)
        console.error(`❌ Failed to send to ${user.email}:`, emailError.message)
      }
      
      // Rate limiting: 1 saniye bekle (son email hariç)
      if (i < usersToNotify.length - 1) {
        await sleep(1000)
      }
    }
    
    // Sonuç logla
    console.log(`📊 Verification reminder completed: ${sent} sent, ${failed} failed, ${usersToNotify.length} total`)
    console.log(`📊 Language distribution: TR=${languageStats.tr}, EN=${languageStats.en}, ES=${languageStats.es}, DE=${languageStats.de}`)
    
    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: usersToNotify.length,
      testMode,
      languageStats,
      failedEmails: failed > 0 ? failedEmails : undefined
    })
    
  } catch (error: any) {
    console.error('Verification reminder API error:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      success: false
    }, { status: 500 })
  }
}

// GET: Doğrulanmamış kullanıcı istatistikleri
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
    
    // Doğrulanmış kullanıcı sayısı
    const verifiedUsers = await prisma.user.count({
      where: { emailVerified: { not: null } }
    })
    
    // Doğrulanmamış kullanıcı sayısı
    const unverifiedUsers = await prisma.user.count({
      where: { emailVerified: null }
    })
    
    // Doğrulama oranı
    const verificationRate = totalUsers > 0 
      ? ((verifiedUsers / totalUsers) * 100).toFixed(1)
      : '0'
    
    return NextResponse.json({
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      verificationRate: `${verificationRate}%`
    })
    
  } catch (error: any) {
    console.error('Verification stats error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
