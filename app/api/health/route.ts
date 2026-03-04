import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/health — Uptime monitoring için
export async function GET() {
  const start = Date.now()
  const checks: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  }

  // 1. DB bağlantı kontrolü
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1 as health`
    checks.database = {
      status: 'ok',
      responseTime: Date.now() - dbStart + 'ms'
    }
  } catch (error: any) {
    checks.database = {
      status: 'error',
      error: error.message?.substring(0, 100)
    }
    checks.status = 'degraded'
  }

  // 2. Bellek kullanımı
  const mem = process.memoryUsage()
  checks.memory = {
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
    rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
  }

  // 3. Bellek sızıntısı uyarısı (512MB üstü)
  if (mem.heapUsed > 512 * 1024 * 1024) {
    checks.memoryWarning = 'Yüksek bellek kullanımı!'
    checks.status = 'degraded'
  }

  // 4. Toplam yanıt süresi
  checks.totalResponseTime = Date.now() - start + 'ms'

  const httpStatus = checks.status === 'ok' ? 200 : 503
  
  return NextResponse.json(checks, { 
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  })
}
