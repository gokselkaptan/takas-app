/**
 * TAKAS-A Geliştirilmiş Rate Limiter
 * lib/rate-limiter.ts
 * 
 * In-memory rate limiting (küçük-orta ölçek için yeterli).
 * Büyük ölçek için Redis'e geçilebilir.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Her 60 saniyede süresi dolmuş kayıtları temizle
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 60_000)

interface RateLimitConfig {
  maxRequests: number    // Pencere içinde max istek
  windowMs: number       // Pencere süresi (ms)
}

// Endpoint bazlı limitler
const LIMITS: Record<string, RateLimitConfig> = {
  'auth/login':           { maxRequests: 5,  windowMs: 15 * 60 * 1000 },  // 15 dk'da 5
  'auth/forgot-password': { maxRequests: 3,  windowMs: 60 * 60 * 1000 },  // 1 saatte 3
  'signup':               { maxRequests: 3,  windowMs: 60 * 60 * 1000 },  // 1 saatte 3
  'messages':             { maxRequests: 60, windowMs: 60 * 1000 },        // 1 dk'da 60
  'swap-requests':        { maxRequests: 20, windowMs: 60 * 1000 },        // 1 dk'da 20
  'products':             { maxRequests: 10, windowMs: 60 * 1000 },        // 1 dk'da 10
  'reviews':              { maxRequests: 10, windowMs: 60 * 1000 },        // 1 dk'da 10
  'push/subscribe':       { maxRequests: 5,  windowMs: 60 * 1000 },        // 1 dk'da 5
  'contact':              { maxRequests: 3,  windowMs: 60 * 60 * 1000 },   // 1 saatte 3
  'default':              { maxRequests: 100, windowMs: 60 * 1000 },       // 1 dk'da 100
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Rate limit kontrolü
 * @param identifier - IP adresi veya user ID
 * @param endpoint - API endpoint adı (LIMITS'te tanımlı)
 */
export function checkRateLimit(identifier: string, endpoint: string): RateLimitResult {
  const config = LIMITS[endpoint] || LIMITS.default
  const key = `${endpoint}:${identifier}`
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // Yeni pencere
    store.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs }
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt }
}

/**
 * NextRequest'ten IP adresi al
 */
export function getClientIP(req: Request): string {
  const forwarded = (req.headers as any).get?.('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = (req.headers as any).get?.('x-real-ip')
  if (real) return real
  return '127.0.0.1'
}

/**
 * Rate limit + response header helper
 * API route'un başında çağırın:
 * 
 *   const rl = applyRateLimit(req, 'auth/login')
 *   if (rl) return rl  // 429 Too Many Requests
 */
export function applyRateLimit(req: Request, endpoint: string): Response | null {
  const ip = getClientIP(req)
  const result = checkRateLimit(ip, endpoint)

  if (!result.allowed) {
    return new Response(
      JSON.stringify({ error: 'Çok fazla istek. Lütfen bekleyin.', retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000) }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  return null // İzin verildi
}
