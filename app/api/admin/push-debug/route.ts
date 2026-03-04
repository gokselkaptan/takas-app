import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// Push subscription debug endpoint (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }
    
    // Push subscription stats
    const totalSubscriptions = await prisma.pushSubscription.count()
    const activeSubscriptions = await prisma.pushSubscription.count({
      where: { isActive: true }
    })
    
    // Get subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' }
    })
    
    // Get user info for subscriptions
    const userIds = [...new Set(subscriptions.map(s => s.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true }
    })
    const userMap = new Map(users.map(u => [u.id, u]))
    
    const enrichedSubs = subscriptions.map(s => ({
      id: s.id,
      userId: s.userId,
      userName: userMap.get(s.userId)?.name || 'Unknown',
      userEmail: userMap.get(s.userId)?.email || 'Unknown',
      isActive: s.isActive,
      userAgent: s.userAgent?.substring(0, 100),
      endpoint: s.endpoint.substring(0, 80) + '...',
      isAndroid: s.userAgent?.toLowerCase().includes('android'),
      isIOS: s.userAgent?.toLowerCase().includes('iphone') || s.userAgent?.toLowerCase().includes('ipad'),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }))
    
    // VAPID key check
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
    
    return NextResponse.json({
      stats: {
        totalSubscriptions,
        activeSubscriptions,
        inactiveSubscriptions: totalSubscriptions - activeSubscriptions
      },
      vapidConfigured: {
        publicKey: vapidPublicKey ? `${vapidPublicKey.substring(0, 20)}...` : 'NOT SET',
        privateKey: vapidPrivateKey ? '***CONFIGURED***' : 'NOT SET'
      },
      subscriptions: enrichedSubs
    })
  } catch (error) {
    console.error('Push debug error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Test push notification to admin
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }
    
    // Import push notification functions
    const { sendPushToUser, NotificationTypes } = await import('@/lib/push-notifications')
    
    // Send test notification to admin
    const result = await sendPushToUser(user.id, NotificationTypes.SYSTEM, {
      title: '🧪 Test Bildirimi',
      body: `Bu bir test bildirimidir. Saat: ${new Date().toLocaleTimeString('tr-TR')}`
    })
    
    return NextResponse.json({
      testResult: result,
      message: result.sent > 0 ? 'Test bildirimi gönderildi!' : 'Hiç aktif subscription bulunamadı'
    })
  } catch (error) {
    console.error('Push test error:', error)
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}
