import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { checkAndAwardBadges } from '@/lib/badge-system'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

// GET - Takip edilen/takipçi listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const sessionUserId = (session?.user as any)?.id
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const type = searchParams.get('type') // followers, following, check
    
    const targetUserId = userId || sessionUserId
    if (!targetUserId) {
      return NextResponse.json({ error: 'Kullanıcı ID gerekli' }, { status: 400 })
    }
    
    if (type === 'check' && sessionUserId) {
      // Takip durumunu kontrol et
      const follow = await prisma.userFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId: sessionUserId,
            followingId: targetUserId
          }
        }
      })
      return NextResponse.json({ isFollowing: !!follow })
    }
    
    if (type === 'followers') {
      const followers = await prisma.userFollow.findMany({
        where: { followingId: targetUserId },
        include: {
          follower: {
            select: {
              id: true,
              name: true,
              nickname: true,
              image: true,
              trustScore: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
      return NextResponse.json(followers.map(f => ({
        ...f.follower,
        followedAt: f.createdAt
      })))
    }
    
    if (type === 'following') {
      const following = await prisma.userFollow.findMany({
        where: { followerId: targetUserId },
        include: {
          following: {
            select: {
              id: true,
              name: true,
              nickname: true,
              image: true,
              trustScore: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
      return NextResponse.json(following.map(f => ({
        ...f.following,
        followedAt: f.createdAt
      })))
    }
    
    // Varsayılan: hem takipçi hem takip edilen sayılarını döndür
    const [followerCount, followingCount] = await Promise.all([
      prisma.userFollow.count({ where: { followingId: targetUserId } }),
      prisma.userFollow.count({ where: { followerId: targetUserId } })
    ])
    
    return NextResponse.json({ followerCount, followingCount })
  } catch (error) {
    console.error('Follow GET error:', error)
    return NextResponse.json({ error: 'Takip bilgisi alınamadı' }, { status: 500 })
  }
}

// POST - Takip et
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const sessionUserId = (session?.user as any)?.id
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }
    
    const { userId: targetUserId } = await request.json()
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'Kullanıcı ID gerekli' }, { status: 400 })
    }
    
    if (targetUserId === sessionUserId) {
      return NextResponse.json({ error: 'Kendinizi takip edemezsiniz' }, { status: 400 })
    }
    
    // Kullanıcı var mı kontrol et
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, nickname: true }
    })
    
    if (!targetUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }
    
    // Zaten takip ediyor mu?
    const existingFollow = await prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId: sessionUserId,
          followingId: targetUserId
        }
      }
    })
    
    if (existingFollow) {
      return NextResponse.json({ error: 'Zaten takip ediyorsunuz' }, { status: 400 })
    }
    
    // Takip et
    await prisma.userFollow.create({
      data: {
        followerId: sessionUserId,
        followingId: targetUserId
      }
    })
    
    // Takipçi sayısını al
    const followerCount = await prisma.userFollow.count({
      where: { followingId: targetUserId }
    })
    
    // Aktivite akışına ekle
    const currentUser = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { name: true, nickname: true, email: true }
    })
    
    await prisma.activityFeed.create({
      data: {
        type: 'followed_user',
        userId: sessionUserId,
        userName: currentUser?.name || currentUser?.nickname || currentUser?.email.split('@')[0],
        targetUserId,
        targetUserName: targetUser.name || targetUser.nickname || 'Kullanıcı',
        visibility: 'followers'
      }
    })
    
    // Push bildirim gönder
    await sendPushToUser(targetUserId, NotificationTypes.SYSTEM, {
      title: 'Yeni Takipçi! 🎉',
      body: `${currentUser?.name || currentUser?.nickname || 'Bir kullanıcı'} seni takip etmeye başladı`,
      data: {
        userId: sessionUserId
      }
    })
    
    // Rozet kontrolü yap
    await checkAndAwardBadges(sessionUserId)
    await checkAndAwardBadges(targetUserId)
    
    return NextResponse.json({ success: true, followerCount })
  } catch (error) {
    console.error('Follow POST error:', error)
    return NextResponse.json({ error: 'Takip edilemedi' }, { status: 500 })
  }
}

// DELETE - Takipten çık
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const sessionUserId = (session?.user as any)?.id
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'Kullanıcı ID gerekli' }, { status: 400 })
    }
    
    await prisma.userFollow.deleteMany({
      where: {
        followerId: sessionUserId,
        followingId: targetUserId
      }
    })
    
    const followerCount = await prisma.userFollow.count({
      where: { followingId: targetUserId }
    })
    
    return NextResponse.json({ success: true, followerCount })
  } catch (error) {
    console.error('Follow DELETE error:', error)
    return NextResponse.json({ error: 'Takipten çıkılamadı' }, { status: 500 })
  }
}
