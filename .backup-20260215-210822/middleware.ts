import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const start = Date.now()
  const response = NextResponse.next()
  const { pathname } = request.nextUrl

  // Timing header
  response.headers.set('X-Response-Time', `${Date.now() - start}ms`)
  
  // Security Headers
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Frame-Options', 'DENY')
  // Kamera izni QR kod tarama için gerekli
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self), payment=()')
  
  // ═══ CACHE HEADERS (sayfa tipine göre) ═══
  // Statik sayfalar — cache'lenebilir
  if (pathname.match(/^\/(hakkimizda|nasil-calisir|sss|kurumsal|iletisim|teslim-noktalari)$/)) {
    response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  }
  // API GET'ler — kısa cache
  if (pathname.startsWith('/api/') && request.method === 'GET') {
    if (pathname.match(/\/api\/(categories|delivery-points|stats)/)) {
      response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
    }
  }

  // ═══ PRELOAD HINTS (ana sayfa için) ═══
  if (pathname === '/') {
    response.headers.set('Link', '</api/products?limit=12>; rel=preload; as=fetch; crossorigin')
  }
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://apps.abacus.ai",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com https://www.google.com https://routellm.abacus.ai https://*.s3.amazonaws.com https://*.s3.us-west-2.amazonaws.com https://abacusai-apps-641f1fb9b34a169b5dfc6c6a-us-west-2.s3.us-west-2.amazonaws.com",
    "frame-src 'self' https://www.google.com https://recaptcha.google.com",
    "frame-ancestors 'self' https://*.abacus.ai https://*.abacusai.app",
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', csp)
  
  return response
}

export const config = {
  matcher: [
    // Apply to all routes except static files and api routes that need different handling
    '/((?!_next/static|_next/image|favicon.ico|icons|images|videos|manifest.json|sw.js|robots.txt|sitemap.xml).*)',
  ],
}
