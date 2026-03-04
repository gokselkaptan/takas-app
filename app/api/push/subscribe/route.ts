import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// Push subscription kaydet
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
    
    const body = await request.json()
    const { subscription, userAgent } = body
    
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }
    
    // Mevcut subscription varsa güncelle, yoksa oluştur
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint }
    })
    
    if (existing) {
      await prisma.pushSubscription.update({
        where: { endpoint: subscription.endpoint },
        data: {
          userId: user.id,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: userAgent || null,
          isActive: true,
          updatedAt: new Date()
        }
      })
    } else {
      await prisma.pushSubscription.create({
        data: {
          userId: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: userAgent || null,
          isActive: true
        }
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push subscribe error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Subscription iptal
export async function DELETE(request: NextRequest) {
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
    
    const body = await request.json()
    const { endpoint } = body
    
    if (endpoint) {
      // Belirli bir subscription'ı sil
      await prisma.pushSubscription.deleteMany({
        where: { endpoint, userId: user.id }
      })
    } else {
      // Tüm subscription'ları sil
      await prisma.pushSubscription.deleteMany({
        where: { userId: user.id }
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push unsubscribe error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Subscription durumunu kontrol et
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ subscribed: false })
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user) {
      return NextResponse.json({ subscribed: false })
    }
    
    const count = await prisma.pushSubscription.count({
      where: { userId: user.id, isActive: true }
    })
    
    return NextResponse.json({ 
      subscribed: count > 0,
      subscriptionCount: count
    })
  } catch (error) {
    console.error('Push status error:', error)
    return NextResponse.json({ subscribed: false })
  }
}
