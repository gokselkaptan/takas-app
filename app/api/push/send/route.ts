import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { sendPushToUser, sendPushBroadcast, NotificationTypes } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'

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
    const { type, data, userId, broadcast } = body
    
    if (!type || !data) {
      return NextResponse.json({ error: 'Missing type or data' }, { status: 400 })
    }
    
    // Broadcast sadece admin için
    if (broadcast && user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }
    
    let result
    
    if (broadcast) {
      // Tüm kullanıcılara gönder
      result = await sendPushBroadcast(type, data)
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
