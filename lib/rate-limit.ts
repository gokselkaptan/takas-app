import prisma from '@/lib/db'
import { getClientIP } from '@/lib/security'

interface RateLimitConfig {
  windowMs: number      // Zaman penceresi (ms)
  maxRequests: number   // Max istek sayısı
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  // Genel API limitleri
  'api/products': { windowMs: 60000, maxRequests: 100 },      // 100 req/dk
  'api/favorites': { windowMs: 60000, maxRequests: 60 },      // 60 req/dk
  'api/messages': { windowMs: 60000, maxRequests: 30 },       // 30 req/dk (spam önleme)
  'api/signup': { windowMs: 3600000, maxRequests: 5 },        // 5 req/saat
  'api/swap-requests': { windowMs: 60000, maxRequests: 20 },  // 20 req/dk
  
  // Yeni endpoint limitleri
  'api/services': { windowMs: 60000, maxRequests: 30 },           // 30 req/dk
  'api/wishboard': { windowMs: 60000, maxRequests: 20 },          // 20 req/dk
  'api/profile/photo': { windowMs: 300000, maxRequests: 10 },     // 5 dk'da 10
  'api/admin/backup': { windowMs: 3600000, maxRequests: 3 },      // 1 saatte 3
  'api/auth/two-factor': { windowMs: 300000, maxRequests: 5 },    // 5 dk'da 5
  
  // AI Endpoint limitleri - KRITIK: yüksek maliyetli işlemler
  'api/valor/calculate': { windowMs: 60000, maxRequests: 5 },    // 5 req/dk
  'api/ai-visualize': { windowMs: 60000, maxRequests: 5 },       // 5 req/dk
  'api/visual-search': { windowMs: 60000, maxRequests: 5 },      // 5 req/dk
  'api/ai-moderation': { windowMs: 60000, maxRequests: 10 },     // 10 req/dk
  'api/ai-translate': { windowMs: 60000, maxRequests: 10 },      // 10 req/dk
  
  // Varsayılan
  'default': { windowMs: 60000, maxRequests: 100 },
}

export async function checkRateLimit(
  identifier: string, 
  endpoint: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  // 🔓 ADMIN BYPASS: Admin için rate limit kontrolünü atla
  const ADMIN_EMAILS = ['join@takas-a.com']
  if (ADMIN_EMAILS.includes(identifier)) {
    return {
      allowed: true,
      remaining: 999,
      resetAt: new Date(Date.now() + 60000)
    }
  }

  const config = DEFAULT_LIMITS[endpoint] || DEFAULT_LIMITS['default']
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowMs)
  
  try {
    // Mevcut kaydı bul veya oluştur
    const existing = await prisma.rateLimit.findUnique({
      where: {
        identifier_endpoint: {
          identifier,
          endpoint
        }
      }
    })
    
    if (!existing) {
      // Yeni kayıt oluştur
      await prisma.rateLimit.create({
        data: {
          identifier,
          endpoint,
          count: 1,
          windowStart: now
        }
      })
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(now.getTime() + config.windowMs)
      }
    }
    
    // Pencere süresi dolmuşsa sıfırla
    if (existing.windowStart < windowStart) {
      await prisma.rateLimit.update({
        where: { id: existing.id },
        data: {
          count: 1,
          windowStart: now
        }
      })
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(now.getTime() + config.windowMs)
      }
    }
    
    // Limit aşıldı mı?
    if (existing.count >= config.maxRequests) {
      const resetAt = new Date(existing.windowStart.getTime() + config.windowMs)
      return {
        allowed: false,
        remaining: 0,
        resetAt
      }
    }
    
    // Sayıcıyı artır
    await prisma.rateLimit.update({
      where: { id: existing.id },
      data: { count: existing.count + 1 }
    })
    
    return {
      allowed: true,
      remaining: config.maxRequests - existing.count - 1,
      resetAt: new Date(existing.windowStart.getTime() + config.windowMs)
    }
  } catch (error) {
    console.error('Rate limit check error:', error)
    // KRITIK: Fail-closed yaklaşımı - hata durumunda izin VERME
    // Güvenlik açısından, veritabanı hatası olduğunda istekleri reddetmek daha güvenlidir
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(now.getTime() + config.windowMs)
    }
  }
}

export function getClientIdentifier(request: Request): string {
  return getClientIP(request)
}

// AI endpoint'leri için özel kontrol
export function isAIEndpoint(endpoint: string): boolean {
  const aiEndpoints = [
    'api/valor/calculate',
    'api/ai-visualize',
    'api/visual-search',
    'api/ai-moderation',
    'api/ai-translate'
  ]
  return aiEndpoints.some(ai => endpoint.includes(ai))
}

// Rate limit header'larını oluştur
export function getRateLimitHeaders(result: { allowed: boolean; remaining: number; resetAt: Date }): Record<string, string> {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
    ...(result.allowed ? {} : { 'Retry-After': Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString() })
  }
}
