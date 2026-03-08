import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { sendPushToUser, sendPushBroadcast, NotificationTypes } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'

// Segment türleri
type SegmentType = 'all' | 'inactive_3days' | 'no_product' | 'no_offer' | 'not_verified'

// Push bildirim gönder (admin veya sistem)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Sadece admin broadcast yapabilir
    const body = await request.json()
    const { type, data, userId, broadcast, segment } = body
    
    if (!type || !data) {
      return NextResponse.json({ error: 'Missing type or data' }, { status: 400 })
    }
    
    // Broadcast sadece admin için
    if (broadcast && user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }
    
    let result
    
    if (broadcast) {
      // Segment bazlı broadcast
      const segmentType: SegmentType = segment || 'all'
      
      if (segmentType === 'all') {
        // Tüm kullanıcılara gönder (mevcut davranış)
        result = await sendPushBroadcast(type, data)
      } else {
        // Segment'e göre kullanıcıları filtrele
        const now = new Date()
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
        
        // Önce aktif push subscription'ı olan kullanıcı ID'lerini al
        const usersWithSubscription = await prisma.pushSubscription.findMany({
          where: { isActive: true },
          select: { userId: true },
          distinct: ['userId']
        })
        const subscribedUserIds = usersWithSubscription.map(s => s.userId)
        
        let targetUsers: { id: string }[] = []
        
        if (segmentType === 'inactive_3days') {
          // 3+ gündür giriş yapmayanlar (subscription'ı olanlar)
          targetUsers = await prisma.user.findMany({
            where: {
              id: { in: subscribedUserIds },
              OR: [
                { lastLoginAt: { lt: threeDaysAgo } },
                { lastLoginAt: null }
              ]
            },
            select: { id: true }
          })
        } else if (segmentType === 'no_product') {
          // Hiç ürün yüklemeyenler (subscription'ı olanlar)
          targetUsers = await prisma.user.findMany({
            where: {
              id: { in: subscribedUserIds },
              products: { none: {} }
            },
            select: { id: true }
          })
        } else if (segmentType === 'no_offer') {
          // Hiç teklif vermeyenler (subscription'ı olanlar, requesterId olarak swapRequest yok)
          targetUsers = await prisma.user.findMany({
            where: {
              id: { in: subscribedUserIds },
              swapRequestsSent: { none: {} }
            },
            select: { id: true }
          })
        } else if (segmentType === 'not_verified') {
          // Email doğrulanmamış kullanıcılar (subscription'ı olanlar)
          targetUsers = await prisma.user.findMany({
            where: {
              id: { in: subscribedUserIds },
              emailVerified: null
            },
            select: { id: true }
          })
        }
        
        // Her kullanıcıya tek tek gönder
        let totalSent = 0
        let totalFailed = 0
        
        for (const targetUser of targetUsers) {
          const sendResult = await sendPushToUser(targetUser.id, type, data)
          totalSent += sendResult.sent
          totalFailed += sendResult.failed
        }
        
        result = { success: true, totalSent, totalFailed, sent: targetUsers.length }
      }
    } else if (userId) {
      // Belirli kullanıcıya gönder
      result = await sendPushToUser(userId, type, data)
    } else {
      // Kendine gönder (test amaçlı)
      result = await sendPushToUser(user.id, type, data)
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Push send error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
