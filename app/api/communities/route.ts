import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

// GET - Toplulukları listele
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const city = searchParams.get('city')
    const district = searchParams.get('district')
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const myOnly = searchParams.get('my') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const session = await getServerSession(authOptions)
    
    // Kullanıcı ID'sini email'den al
    let userId: string | undefined
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      })
      userId = user?.id
    }

    // Base where clause
    const where: any = {}
    
    if (city) where.city = city
    if (district) where.district = district
    if (type) where.type = type
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { district: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Sadece kullanıcının üye olduğu topluluklar
    if (myOnly && userId) {
      where.members = {
        some: { userId, isActive: true }
      }
    }

    const [communities, total] = await Promise.all([
      prisma.community.findMany({
        where,
        include: {
          members: {
            where: userId ? { userId } : undefined,
            take: 1
          },
          _count: {
            select: { members: true, posts: true, events: true }
          }
        },
        orderBy: [
          { isOfficial: 'desc' },
          { memberCount: 'desc' },
          { weeklyActivity: 'desc' }
        ],
        take: limit,
        skip: offset
      }),
      prisma.community.count({ where })
    ])

    // Kullanıcının üyelik durumunu ekle
    const communitiesWithMembership = communities.map(c => ({
      ...c,
      isMember: c.members.length > 0,
      myRole: c.members[0]?.role || null,
      members: undefined,
      memberCount: c._count.members,
      postCount: c._count.posts,
      eventCount: c._count.events
    }))

    return NextResponse.json({
      communities: communitiesWithMembership,
      total,
      hasMore: offset + limit < total
    })
  } catch (error) {
    console.error('Communities fetch error:', error)
    return NextResponse.json(
      { error: 'Topluluklar yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni topluluk oluştur
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { name, description, city, district, neighborhood, type, tags, rules, isPrivate } = body

    if (!name || !city) {
      return NextResponse.json(
        { error: 'İsim ve şehir zorunludur' },
        { status: 400 }
      )
    }

    // Slug oluştur
    const baseSlug = name
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // Slug benzersiz mi kontrol et
    let slug = baseSlug
    let counter = 1
    while (await prisma.community.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Topluluk oluştur
    const community = await prisma.community.create({
      data: {
        name,
        slug,
        description,
        city,
        district,
        neighborhood,
        type: type || 'neighborhood',
        tags: tags || [],
        rules,
        isPrivate: isPrivate || false,
        memberCount: 1,
        // Oluşturan kişiyi admin olarak ekle
        members: {
          create: {
            userId: user.id,
            role: 'admin',
            badges: ['founder']
          }
        }
      },
      include: {
        _count: { select: { members: true } }
      }
    })

    return NextResponse.json({
      success: true,
      community: {
        ...community,
        memberCount: community._count.members
      }
    })
  } catch (error) {
    console.error('Community create error:', error)
    return NextResponse.json(
      { error: 'Topluluk oluşturulurken hata oluştu' },
      { status: 500 }
    )
  }
}
