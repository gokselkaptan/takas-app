import prisma from '@/lib/db'

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

// IP adresini al
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (realIp) {
    return realIp
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
