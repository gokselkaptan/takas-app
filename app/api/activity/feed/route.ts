import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET - Aktivite akışını getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const sessionUserId = (session?.user as any)?.id
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // public, following, user
    const userId = searchParams.get('userId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit
    
    let where: any = {}
    
    if (type === 'user' && userId) {
      // Belirli kullanıcının aktiviteleri
      where = {
        userId,
        OR: [
          { visibility: 'public' },
          ...(sessionUserId ? [{ visibility: 'followers' }] : [])
        ]
      }
    } else if (type === 'following' && sessionUserId) {
      // Takip edilenlerin aktiviteleri
      const following = await prisma.userFollow.findMany({
        where: { followerId: sessionUserId },
        select: { followingId: true }
      })
      const followingIds = following.map(f => f.followingId)
      
      where = {
        userId: { in: [...followingIds, sessionUserId] }, // Kendisi + takip ettikleri
        OR: [
          { visibility: 'public' },
          { visibility: 'followers' }
        ]
      }
    } else {
      // Genel akış - sadece public
      where = { visibility: 'public' }
    }
    
    const [activities, total] = await Promise.all([
      prisma.activityFeed.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              nickname: true,
              image: true
            }
          },
          likes: sessionUserId ? {
            where: { userId: sessionUserId },
            select: { id: true }
          } : false,
          _count: {
            select: {
              likes: true,
              comments: true
            }
          }
        }
      }),
      prisma.activityFeed.count({ where })
    ])
    
    // Ürün/takas detaylarını zenginleştir
    const enrichedActivities = await Promise.all(activities.map(async (activity) => {
      let productData: { id: string; title: string; images: string[]; valorPrice: number } | null = null
      let badgeData: any = null
      
      if (activity.productId) {
        productData = await prisma.product.findUnique({
          where: { id: activity.productId },
          select: {
            id: true,
            title: true,
            images: true,
            valorPrice: true
          }
        })
      }
      
      if (activity.type === 'badge_earned' && activity.metadata) {
        try {
          badgeData = JSON.parse(activity.metadata)
        } catch (e) {}
      }
      
      const activityLikes = activity.likes as any[]
      
      return {
        ...activity,
        productData,
        badgeData,
        isLiked: activityLikes?.length > 0,
        likeCount: activity._count.likes,
        commentCount: activity._count.comments
      }
    }))
    
    return NextResponse.json({
      activities: enrichedActivities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Activity feed error:', error)
    return NextResponse.json({ error: 'Aktiviteler yüklenemedi' }, { status: 500 })
  }
}

// POST - Aktivite oluştur (sistem tarafından veya kullanıcı paylaşımı)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const sessionUserId = (session?.user as any)?.id
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }
    
    const { type, productId, message, visibility = 'followers' } = await request.json()
    
    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { name: true, nickname: true, email: true }
    })
    
    let productTitle: string | undefined = undefined
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { title: true }
      })
      productTitle = product?.title
    }
    
    const activity = await prisma.activityFeed.create({
      data: {
        type: type || 'user_post',
        userId: sessionUserId,
        userName: user?.name || user?.nickname || user?.email.split('@')[0],
        productId,
        productTitle,
        metadata: message ? JSON.stringify({ message }) : null,
        visibility
      }
    })
    
    return NextResponse.json(activity)
  } catch (error) {
    console.error('Activity create error:', error)
    return NextResponse.json({ error: 'Aktivite oluşturulamadı' }, { status: 500 })
  }
}
