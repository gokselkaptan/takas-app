import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET - Topluluk gönderilerini listele
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: communityId } = params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {
      communityId,
      isApproved: true
    }
    if (type) where.type = type

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          replies: {
            take: 3,
            orderBy: { createdAt: 'desc' }
          },
          _count: { select: { replies: true } }
        }
      }),
      prisma.communityPost.count({ where })
    ])

    // Yazar bilgilerini al
    const authorIds = posts.map(p => p.authorId)
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, name: true, nickname: true, image: true }
    })
    const authorMap = new Map(authors.map(a => [a.id, a]))

    const postsWithAuthor = posts.map(p => ({
      ...p,
      author: authorMap.get(p.authorId),
      commentCount: p._count.replies
    }))

    return NextResponse.json({
      posts: postsWithAuthor,
      total,
      hasMore: offset + limit < total
    })
  } catch (error) {
    console.error('Community posts error:', error)
    return NextResponse.json(
      { error: 'Gönderiler yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni gönderi oluştur
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Giriş yapmanız gerekiyor' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    const { id: communityId } = params
    const userId = user.id

    // Üye mi kontrol et
    const membership = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: { communityId, userId }
      }
    })

    if (!membership || !membership.isActive) {
      return NextResponse.json(
        { error: 'Bu topluluğun üyesi olmalısınız' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { type, title, content, images, productId, swapRequestId } = body

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'İçerik boş olamaz' },
        { status: 400 }
      )
    }

    const post = await prisma.communityPost.create({
      data: {
        communityId,
        authorId: userId,
        type: type || 'general',
        title,
        content,
        images: images || [],
        productId,
        swapRequestId,
        isApproved: true // TODO: Moderasyon sistemi eklenebilir
      }
    })

    // Üyenin aktivitesini güncelle
    await prisma.communityMember.update({
      where: { id: membership.id },
      data: { lastActiveAt: new Date() }
    })

    return NextResponse.json({
      success: true,
      post
    })
  } catch (error) {
    console.error('Create post error:', error)
    return NextResponse.json(
      { error: 'Gönderi oluşturulurken hata oluştu' },
      { status: 500 }
    )
  }
}
