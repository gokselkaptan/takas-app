import prisma from '@/lib/db'

// ===== IP WHITELIST/BLACKLIST =====

// Admin paneli için IP whitelist kontrolü
export async function checkAdminIPWhitelist(ip: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Önce blacklist kontrolü
    const blacklisted = await prisma.iPBlacklist.findFirst({
      where: {
        ip,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    })
    
    if (blacklisted) {
      // Hit sayısını artır
      await prisma.iPBlacklist.update({
        where: { id: blacklisted.id },
        data: { 
          hitCount: { increment: 1 },
          lastHitAt: new Date()
        }
      })
      return { allowed: false, reason: `IP blacklisted: ${blacklisted.reason || 'Güvenlik ihlali'}` }
    }
    
    // Whitelist kontrolü - boşsa herkese izin ver
    const whitelistCount = await prisma.adminIPWhitelist.count({
      where: { isActive: true }
    })
    
    // Whitelist boşsa herkese izin ver (ilk kurulum için)
    if (whitelistCount === 0) {
      return { allowed: true }
    }
    
    // Whitelist'te mi kontrol et
    const whitelisted = await prisma.adminIPWhitelist.findFirst({
      where: {
        ip,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    })
    
    if (!whitelisted) {
      // Güvenlik logu
      await logSecurityEvent({
        eventType: 'suspicious_request',
        ip,
        severity: 'high',
        metadata: { reason: 'Admin access from non-whitelisted IP' }
      })
      return { allowed: false, reason: 'IP adresi admin erişimi için yetkilendirilmemiş' }
    }
    
    return { allowed: true }
  } catch (error) {
    console.error('IP whitelist check error:', error)
    // Hata durumunda güvenli tarafta kal - engelle
    return { allowed: false, reason: 'Güvenlik kontrolü başarısız' }
  }
}

// Genel IP blacklist kontrolü
export async function checkIPBlacklist(ip: string): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const blacklisted = await prisma.iPBlacklist.findFirst({
      where: {
        ip,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    })
    
    if (blacklisted) {
      await prisma.iPBlacklist.update({
        where: { id: blacklisted.id },
        data: { 
          hitCount: { increment: 1 },
          lastHitAt: new Date()
        }
      })
      return { blocked: true, reason: blacklisted.reason || 'IP engellendi' }
    }
    
    return { blocked: false }
  } catch (error) {
    console.error('IP blacklist check error:', error)
    return { blocked: false }
  }
}

// IP'yi blacklist'e ekle
export async function addToBlacklist(
  ip: string, 
  reason: string, 
  addedBy?: string,
  expiresInHours?: number
): Promise<void> {
  try {
    await prisma.iPBlacklist.upsert({
      where: { ip },
      update: {
        reason,
        addedBy,
        isActive: true,
        expiresAt: expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : null
      },
      create: {
        ip,
        reason,
        addedBy,
        expiresAt: expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : null
      }
    })
  } catch (error) {
    console.error('Add to blacklist error:', error)
  }
}

// IP'yi whitelist'e ekle (admin için)
export async function addToAdminWhitelist(
  ip: string, 
  description?: string, 
  addedBy?: string
): Promise<void> {
  try {
    await prisma.adminIPWhitelist.upsert({
      where: { ip },
      update: {
        description,
        addedBy,
        isActive: true
      },
      create: {
        ip,
        description,
        addedBy
      }
    })
  } catch (error) {
    console.error('Add to whitelist error:', error)
  }
}

// ===== HONEYPOT =====

// Honeypot alanı kontrolü ve loglama
export async function checkHoneypot(
  ip: string,
  endpoint: string,
  honeypotFields: Record<string, string | undefined>,
  userAgent?: string
): Promise<{ isBot: boolean; fieldTriggered?: string }> {
  try {
    // Honeypot alanlarını kontrol et
    for (const [fieldName, fieldValue] of Object.entries(honeypotFields)) {
      if (fieldValue && fieldValue.trim() !== '') {
        // Bot tespit edildi - logla
        await prisma.honeypotLog.create({
          data: {
            ip,
            userAgent,
            endpoint,
            fieldName,
            fieldValue: fieldValue.substring(0, 500) // Max 500 karakter
          }
        })
        
        // Güvenlik logu
        await logSecurityEvent({
          eventType: 'suspicious_request',
          ip,
          userAgent,
          severity: 'high',
          metadata: { 
            reason: 'Honeypot triggered',
            endpoint,
            fieldName
          }
        })
        
        // Çok fazla honeypot tetikleme varsa blacklist'e ekle
        const recentHoneypotHits = await prisma.honeypotLog.count({
          where: {
            ip,
            createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } // Son 1 saat
          }
        })
        
        if (recentHoneypotHits >= 3) {
          await addToBlacklist(ip, 'Multiple honeypot triggers', 'system', 24) // 24 saat ban
        }
        
        return { isBot: true, fieldTriggered: fieldName }
      }
    }
    
    return { isBot: false }
  } catch (error) {
    console.error('Honeypot check error:', error)
    return { isBot: false }
  }
}

// ===== ACCOUNT LOCKOUT BİLDİRİMİ =====

// Hesap kilitleme bildirimi gönder
export async function sendAccountLockoutNotification(
  email: string,
  ip: string,
  attempts: number,
  userId?: string
): Promise<void> {
  try {
    // Son 1 saatte bu email'e bildirim gönderilmiş mi?
    const recentNotification = await prisma.accountLockoutNotification.findFirst({
      where: {
        email,
        sentAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
      }
    })
    
    // Çok sık bildirim gönderme
    if (recentNotification) {
      return
    }
    
    // Bildirim kaydı oluştur
    await prisma.accountLockoutNotification.create({
      data: {
        email,
        ip,
        userId,
        reason: `${attempts} başarısız giriş denemesi`,
        attempts
      }
    })
    
    // Email gönder (notification API varsa kullan)
    const notificationId = process.env.NOTIF_ID_ACCOUNT_LOCKOUT
    if (notificationId) {
      try {
        const response = await fetch(`${process.env.NEXTAUTH_URL}/api/send-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notification_id: notificationId,
            to_email: email,
            subject: '⚠️ Hesap Güvenlik Uyarısı - TAKAS-A',
            html_body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">⚠️ Hesabınız Geçici Olarak Kilitlendi</h2>
                <p>Sayın Kullanıcı,</p>
                <p>Hesabınıza <strong>${attempts}</strong> başarısız giriş denemesi yapıldı.</p>
                <p><strong>Detaylar:</strong></p>
                <ul>
                  <li>IP Adresi: ${ip}</li>
                  <li>Tarih: ${new Date().toLocaleString('tr-TR')}</li>
                </ul>
                <p style="color: #dc2626; font-weight: bold;">
                  Hesabınız güvenlik nedeniyle 30 dakika süreyle kilitlenmiştir.
                </p>
                <p>Bu sizin girişiminiz değilse, şifrenizi değiştirmenizi öneririz.</p>
                <hr style="border: 1px solid #eee; margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">
                  Bu email TAKAS-A güvenlik sistemi tarafından otomatik gönderilmiştir.
                </p>
              </div>
            `
          })
        })
        
        if (!response.ok) {
          console.error('Lockout notification email failed')
        }
      } catch (emailError) {
        console.error('Email send error:', emailError)
      }
    }
    
    // Güvenlik logu
    await logSecurityEvent({
      eventType: 'account_locked',
      ip,
      email,
      userId,
      severity: 'high',
      metadata: { attempts, notificationSent: true }
    })
    
  } catch (error) {
    console.error('Send lockout notification error:', error)
  }
}

// Şüpheli aktivite türleri
export type SecurityEventType = 
  | 'login_failed'
  | 'login_success'
  | 'brute_force_detected'
  | 'rate_limit_exceeded'
  | 'suspicious_request'
  | 'captcha_failed'
  | 'account_locked'
  | 'password_reset_request'
  | 'multiple_failed_attempts'

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical'

interface SecurityLogParams {
  eventType: SecurityEventType
  ip: string
  userAgent?: string
  userId?: string
  email?: string
  metadata?: Record<string, unknown>
  severity?: SecuritySeverity
}

// Login deneme limitleri
const LOGIN_ATTEMPT_LIMITS = {
  maxAttempts: 5,           // Max deneme sayısı
  windowMs: 15 * 60 * 1000, // 15 dakika penceresi
  lockoutMs: 30 * 60 * 1000 // 30 dakika kilitleme
}

// Güvenlik olayı logla
export async function logSecurityEvent(params: SecurityLogParams): Promise<void> {
  const { eventType, ip, userAgent, userId, email, metadata, severity = 'low' } = params
  
  try {
    await prisma.securityLog.create({
      data: {
        eventType,
        ip,
        userAgent: userAgent || null,
        userId: userId || null,
        email: email || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        severity,
        createdAt: new Date()
      }
    })
    
    // Kritik olayları konsola logla
    if (severity === 'high' || severity === 'critical') {
      console.warn(`[SECURITY ${severity.toUpperCase()}] ${eventType} from IP: ${ip}`, metadata)
    }
  } catch (error) {
    console.error('Security log error:', error)
  }
}

// Login denemelerini kontrol et (Brute-force koruması)
export async function checkLoginAttempts(
  ip: string,
  email?: string
): Promise<{ allowed: boolean; remainingAttempts: number; lockedUntil?: Date }> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - LOGIN_ATTEMPT_LIMITS.windowMs)
  
  try {
    // IP bazlı başarısız denemeleri say
    const ipAttempts = await prisma.securityLog.count({
      where: {
        ip,
        eventType: 'login_failed',
        createdAt: { gte: windowStart }
      }
    })
    
    // Email bazlı başarısız denemeleri say (varsa)
    let emailAttempts = 0
    if (email) {
      emailAttempts = await prisma.securityLog.count({
        where: {
          email,
          eventType: 'login_failed',
          createdAt: { gte: windowStart }
        }
      })
    }
    
    const totalAttempts = Math.max(ipAttempts, emailAttempts)
    
    // Kilitleme kontrolü
    if (totalAttempts >= LOGIN_ATTEMPT_LIMITS.maxAttempts) {
      // Son başarısız denemeyi bul
      const lastFailedAttempt = await prisma.securityLog.findFirst({
        where: {
          OR: [
            { ip, eventType: 'login_failed' },
            email ? { email, eventType: 'login_failed' } : {}
          ],
          createdAt: { gte: windowStart }
        },
        orderBy: { createdAt: 'desc' }
      })
      
      if (lastFailedAttempt) {
        const lockedUntil = new Date(lastFailedAttempt.createdAt.getTime() + LOGIN_ATTEMPT_LIMITS.lockoutMs)
        
        if (now < lockedUntil) {
          // Brute force tespit edildi - logla
          await logSecurityEvent({
            eventType: 'brute_force_detected',
            ip,
            email,
            severity: 'high',
            metadata: { totalAttempts, lockedUntil: lockedUntil.toISOString() }
          })
          
          return {
            allowed: false,
            remainingAttempts: 0,
            lockedUntil
          }
        }
      }
    }
    
    return {
      allowed: true,
      remainingAttempts: Math.max(0, LOGIN_ATTEMPT_LIMITS.maxAttempts - totalAttempts)
    }
  } catch (error) {
    console.error('Login attempt check error:', error)
    // Hata durumunda izin ver
    return { allowed: true, remainingAttempts: LOGIN_ATTEMPT_LIMITS.maxAttempts }
  }
}

// Başarısız login denemesi kaydet
export async function recordFailedLogin(
  ip: string,
  email: string,
  userAgent?: string,
  reason?: string
): Promise<void> {
  await logSecurityEvent({
    eventType: 'login_failed',
    ip,
    email,
    userAgent,
    severity: 'medium',
    metadata: { reason: reason || 'Invalid credentials' }
  })
}

// Başarılı login kaydet
export async function recordSuccessfulLogin(
  ip: string,
  userId: string,
  email: string,
  userAgent?: string
): Promise<void> {
  await logSecurityEvent({
    eventType: 'login_success',
    ip,
    userId,
    email,
    userAgent,
    severity: 'low',
    metadata: { timestamp: new Date().toISOString() }
  })
}

// reCAPTCHA doğrulama
export async function verifyCaptcha(token: string): Promise<{ success: boolean; score?: number }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY
  
  if (!secretKey) {
    console.warn('reCAPTCHA secret key not configured')
    return { success: true } // Yapılandırılmamışsa geç
  }
  
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secretKey}&response=${token}`
    })
    
    const data = await response.json()
    
    return {
      success: data.success && (data.score === undefined || data.score >= 0.5),
      score: data.score
    }
  } catch (error) {
    console.error('reCAPTCHA verification error:', error)
    return { success: false }
  }
}

// IP adresini al — spoofing korumalı
export function getClientIP(request: Request): string {
  // 1. x-real-ip öncelikli (reverse proxy tarafından set edilir, spoof edilemez)
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  
  // 2. x-forwarded-for — SON elemanı al (proxy chain'de en güvenilir)
  // İlk eleman client tarafından spoof edilebilir!
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim()).filter(Boolean)
    // Vercel/Railway gibi platformlarda son IP gerçek client'tır
    // Çünkü platform kendi proxy'sinden geçerken ekler
    return ips[ips.length - 1] || 'unknown'
  }
  
  return 'unknown'
}

// User Agent al
export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown'
}

// Şüpheli istek analizi
export async function analyzeRequest(
  request: Request,
  params: { userId?: string; email?: string }
): Promise<{ suspicious: boolean; reasons: string[] }> {
  const ip = getClientIP(request)
  const userAgent = getUserAgent(request)
  const reasons: string[] = []
  
  // Bot/crawler user agent kontrolü
  const botPatterns = /bot|crawler|spider|scraper|headless|phantom|selenium/i
  if (botPatterns.test(userAgent)) {
    reasons.push('Suspicious user agent detected')
  }
  
  // Boş veya çok kısa user agent
  if (!userAgent || userAgent.length < 10) {
    reasons.push('Missing or invalid user agent')
  }
  
  // Son 1 saatte aynı IP'den çok fazla hata
  const recentErrors = await prisma.securityLog.count({
    where: {
      ip,
      severity: { in: ['high', 'critical'] },
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
    }
  })
  
  if (recentErrors >= 10) {
    reasons.push('Multiple security events from this IP')
  }
  
  if (reasons.length > 0) {
    await logSecurityEvent({
      eventType: 'suspicious_request',
      ip,
      userAgent,
      userId: params.userId,
      email: params.email,
      severity: reasons.length >= 2 ? 'high' : 'medium',
      metadata: { reasons }
    })
  }
  
  return {
    suspicious: reasons.length > 0,
    reasons
  }
}

// Güvenlik istatistikleri (Admin panel için)
export async function getSecurityStats() {
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  const [total, last24hCount, last7dCount, byType, bySeverity, topIPs] = await Promise.all([
    prisma.securityLog.count(),
    prisma.securityLog.count({ where: { createdAt: { gte: last24h } } }),
    prisma.securityLog.count({ where: { createdAt: { gte: last7d } } }),
    prisma.securityLog.groupBy({
      by: ['eventType'],
      _count: true,
      where: { createdAt: { gte: last7d } }
    }),
    prisma.securityLog.groupBy({
      by: ['severity'],
      _count: true,
      where: { createdAt: { gte: last7d } }
    }),
    prisma.$queryRaw`
      SELECT ip, COUNT(*) as count 
      FROM "SecurityLog" 
      WHERE "createdAt" >= ${last24h} AND "eventType" = 'login_failed'
      GROUP BY ip 
      ORDER BY count DESC 
      LIMIT 10
    `
  ])
  
  return {
    total,
    last24h: last24hCount,
    last7d: last7dCount,
    byType,
    bySeverity,
    topIPs
  }
}
