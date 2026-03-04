import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { findMatches, findMatchingRequests, expireOldWishes } from '@/lib/wishboard-service'
import { sendPushToUser } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  // CRON_SECRET kontrolü
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    let expiredCount = 0
    let matchedCount = 0
    let notificationsSent = 0
    
    // 1. Süresi dolan istekleri expire et
    expiredCount = await expireOldWishes()
    console.log(`⏰ ${expiredCount} süresi dolan istek expired olarak işaretlendi`)
    
    // 2. Son 24 saatteki yeni ürünleri mevcut isteklerle eşleştir
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const newProducts = await prisma.product.findMany({
      where: {
        createdAt: { gte: yesterday },
        status: 'active'
      },
      select: { id: true, title: true }
    })
    
    console.log(`📦 Son 24 saatte ${newProducts.length} yeni ürün bulundu`)
    
    for (const product of newProducts) {
      const matches = await findMatchingRequests(product.id)
      
      for (const match of matches.slice(0, 3)) { // Her ürün için en fazla 3 bildirim
        if (match.score >= 50) {
          try {
            await sendPushToUser(
              match.request.userId,
              'cron_match',
              {
                title: '🎯 Yeni Eşleşme!',
                body: `"${match.request.wantTitle}" isteğinize yeni bir ürün eşleşti`,
                requestId: match.request.id,
                productId: product.id,
                url: `/urun/${product.id}`
              }
            )
            notificationsSent++
          } catch (error) {
            console.error('Bildirim gönderme hatası:', error)
          }
          matchedCount++
        }
      }
    }
    
    // 3. Tüm aktif istekleri tara ve eşleştirme güncelle
    const activeRequests = await prisma.wishItem.findMany({
      where: { 
        status: 'active',
        expiresAt: { gt: new Date() }
      },
      select: { id: true }
    })
    
    console.log(`🔄 ${activeRequests.length} aktif istek için eşleştirme güncelleniyor`)
    
    for (const request of activeRequests) {
      await findMatches(request.id)
    }
    
    const result = {
      success: true,
      expiredCount,
      matchedCount,
      notificationsSent,
      totalNewProducts: newProducts.length,
      totalActiveRequests: activeRequests.length,
      timestamp: new Date().toISOString()
    }
    
    console.log('✅ Wishboard cron tamamlandı:', result)
    
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('Wishboard cron error:', error)
    return NextResponse.json({ 
      error: 'Internal error',
      message: error.message 
    }, { status: 500 })
  }
}
