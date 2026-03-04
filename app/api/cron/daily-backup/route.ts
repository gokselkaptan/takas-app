import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Cron secret kontrolü
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    // Kritik verilerin snapshot'ını al
    const snapshot = {
      date: new Date().toISOString(),
      userCount: await prisma.user.count(),
      productCount: await prisma.product.count(),
      swapCount: await prisma.swapRequest.count(),
      messageCount: await prisma.message.count(),
      
      // Son 24 saatteki aktivite
      newUsers24h: await prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 86400000) } }
      }),
      newSwaps24h: await prisma.swapRequest.count({
        where: { createdAt: { gte: new Date(Date.now() - 86400000) } }
      }),
      errors24h: await prisma.errorLog.count({
        where: { 
          createdAt: { gte: new Date(Date.now() - 86400000) },
          severity: { in: ['error', 'critical'] }
        }
      }),
    }
    
    // Snapshot'ı ErrorLog'a kaydet (info severity)
    await prisma.errorLog.create({
      data: {
        type: 'daily_backup_snapshot',
        message: `Daily snapshot: ${snapshot.userCount} users, ${snapshot.productCount} products, ${snapshot.swapCount} swaps`,
        severity: 'info',
        metadata: JSON.stringify(snapshot),
      }
    })
    
    // Kritik uyarılar
    const warnings: string[] = []
    if (snapshot.errors24h > 100) {
      warnings.push(`Son 24 saatte ${snapshot.errors24h} hata!`)
    }
    
    return NextResponse.json({ 
      success: true, 
      snapshot,
      warnings,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
