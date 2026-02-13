import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { getSecurityStats } from '@/lib/security'

export const dynamic = 'force-dynamic'

// GET: Güvenlik istatistikleri ve logları
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Admin kontrolü
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    })
    
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'stats'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const eventType = searchParams.get('eventType')
    const severity = searchParams.get('severity')
    const ip = searchParams.get('ip')
    
    if (action === 'stats') {
      const stats = await getSecurityStats()
      return NextResponse.json(stats)
    }
    
    if (action === 'logs') {
      const where: Record<string, unknown> = {}
      
      if (eventType) where.eventType = eventType
      if (severity) where.severity = severity
      if (ip) where.ip = { contains: ip }
      
      const [logs, total] = await Promise.all([
        prisma.securityLog.findMany({
          where,
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.securityLog.count({ where })
      ])
      
      return NextResponse.json({
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    }
    
    if (action === 'blocked_ips') {
      // Son 24 saatte brute-force tespit edilen IP'ler
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
      
      const blockedIPs = await prisma.$queryRaw<Array<{ ip: string; count: bigint; lastAttempt: Date }>>`
        SELECT ip, COUNT(*) as count, MAX("createdAt") as "lastAttempt"
        FROM "SecurityLog"
        WHERE "createdAt" >= ${last24h}
        AND "eventType" IN ('login_failed', 'brute_force_detected')
        GROUP BY ip
        HAVING COUNT(*) >= 5
        ORDER BY count DESC
        LIMIT 50
      `
      
      return NextResponse.json({
        blockedIPs: blockedIPs.map(row => ({
          ip: row.ip,
          attempts: Number(row.count),
          lastAttempt: row.lastAttempt
        }))
      })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    
  } catch (error) {
    console.error('Security API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Eski logları temizle
export async function DELETE(request: NextRequest) {
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const severityFilter = searchParams.get('severity') // Sadece belirli severity'leri sil
    
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    
    const where: Record<string, unknown> = {
      createdAt: { lt: cutoffDate }
    }
    
    // Sadece low/medium severity logları sil (high/critical koruns
    if (!severityFilter) {
      where.severity = { in: ['low', 'medium'] }
    } else {
      where.severity = severityFilter
    }
    
    const result = await prisma.securityLog.deleteMany({ where })
    
    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `${result.count} eski güvenlik logu silindi`
    })
    
  } catch (error) {
    console.error('Security cleanup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
