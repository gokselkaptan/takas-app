import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET - Tek topluluk detayı
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = params

    // Kullanıcı ID'sini email'den al
    let userId: string | undefined
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      })
      userId = user?.id
    }

    // Slug veya ID ile ara
    const community = await prisma.community.findFirst({
      where: {
        OR: [{ id }, { slug: id }]
      },
      include: {
        members: {
          where: { isActive: true },
          orderBy: [{ role: 'asc' }, { swapsInCommunity: 'desc' }],
          take: 20
        },
        posts: {
          where: { isApproved: true },
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
          take: 10
        },
        events: {
          where: { status: { in: ['upcoming', 'ongoing'] } },
          orderBy: { startDate: 'asc' },
          take: 5
        },
        announcements: {
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          },
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
          take: 3
        },
        _count: {
          select: { members: true, posts: true, events: true }
        }
      }
    })

    if (!community) {
      return NextResponse.json(
        { error: 'Topluluk bulunamadı' },
        { status: 404 }
      )
    }

    // Kullanıcının üyelik durumu
    let membership: {
      role: string
      joinedAt: Date
      swapsInCommunity: number
      reputation: number
      badges: string[]
    } | null = null
    if (userId) {
      const member = await prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId
          }
        }
      })
      if (member) {
        membership = {
          role: member.role,
          joinedAt: member.joinedAt,
          swapsInCommunity: member.swapsInCommunity,
          reputation: member.reputation,
          badges: member.badges
        }
      }
    }

    // Üyelerin kullanıcı bilgilerini al
    const memberIds = community.members.map(m => m.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: {
        id: true,
        name: true,
        nickname: true,
        image: true,
        trustScore: true
      }
    })
    const userMap = new Map(users.map(u => [u.id, u]))

    const membersWithInfo = community.members.map(m => ({
      ...m,
      user: userMap.get(m.userId)
    }))

    // Post authorlarını al
    const postAuthorIds = community.posts.map(p => p.authorId)
    const postAuthors = await prisma.user.findMany({
      where: { id: { in: postAuthorIds } },
      select: { id: true, name: true, nickname: true, image: true }
    })
    const authorMap = new Map(postAuthors.map(a => [a.id, a]))

    const postsWithAuthor = community.posts.map(p => ({
      ...p,
      author: authorMap.get(p.authorId)
    }))

    return NextResponse.json({
      ...community,
      members: membersWithInfo,
      posts: postsWithAuthor,
      membership,
      stats: {
        memberCount: community._count.members,
        postCount: community._count.posts,
        eventCount: community._count.events,
        weeklyActivity: community.weeklyActivity,
        swapCount: community.swapCount
      }
    })
  } catch (error) {
    console.error('Community detail error:', error)
    return NextResponse.json(
      { error: 'Topluluk yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}

// PATCH - Topluluk güncelle (sadece admin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const { id } = params

    // Admin mi kontrol et
    const membership = await prisma.communityMember.findFirst({
      where: {
        communityId: id,
        userId: user.id,
        role: { in: ['admin', 'moderator'] }
      }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { description, rules, coverImage, icon, tags, isPrivate } = body

    const updated = await prisma.community.update({
      where: { id },
      data: {
        ...(description !== undefined && { description }),
        ...(rules !== undefined && { rules }),
        ...(coverImage !== undefined && { coverImage }),
        ...(icon !== undefined && { icon }),
        ...(tags !== undefined && { tags }),
        ...(isPrivate !== undefined && { isPrivate })
      }
    })

    return NextResponse.json({ success: true, community: updated })
  } catch (error) {
    console.error('Community update error:', error)
    return NextResponse.json({ error: 'Güncelleme hatası' }, { status: 500 })
  }
}
