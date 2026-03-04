import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET - Topluluk etkinliklerini listele
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: communityId } = params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')

    const where: any = { communityId }
    if (status) {
      where.status = status
    } else {
      where.status = { in: ['upcoming', 'ongoing'] }
    }

    const events = await prisma.communityEvent.findMany({
      where,
      orderBy: { startDate: 'asc' },
      take: limit,
      include: {
        attendees: {
          take: 5
        },
        _count: { select: { attendees: true } }
      }
    })

    // Organizatör bilgilerini al
    const organizerIds = events.map(e => e.organizerId)
    const organizers = await prisma.user.findMany({
      where: { id: { in: organizerIds } },
      select: { id: true, name: true, nickname: true, image: true }
    })
    const organizerMap = new Map(organizers.map(o => [o.id, o]))

    const eventsWithOrganizer = events.map(e => ({
      ...e,
      organizer: organizerMap.get(e.organizerId),
      attendeeCount: e._count.attendees
    }))

    return NextResponse.json({ events: eventsWithOrganizer })
  } catch (error) {
    console.error('Community events error:', error)
    return NextResponse.json(
      { error: 'Etkinlikler yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni etkinlik oluştur
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

    // Üye mi ve moderatör/admin mi kontrol et
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

    // Sadece admin/moderator/ambassador etkinlik oluşturabilir
    if (!['admin', 'moderator', 'ambassador'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Etkinlik oluşturmak için yetkiniz yok' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      title, description, type, location, address,
      latitude, longitude, startDate, endDate,
      maxAttendees, coverImage, isOnline, onlineLink
    } = body

    if (!title || !description || !startDate) {
      return NextResponse.json(
        { error: 'Başlık, açıklama ve tarih zorunludur' },
        { status: 400 }
      )
    }

    const event = await prisma.communityEvent.create({
      data: {
        communityId,
        organizerId: userId,
        title,
        description,
        type: type || 'meetup',
        location,
        address,
        latitude,
        longitude,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        maxAttendees,
        coverImage,
        isOnline: isOnline || false,
        onlineLink,
        // Organizatörü otomatik katılımcı yap
        attendees: {
          create: {
            userId,
            status: 'going'
          }
        },
        attendeeCount: 1
      }
    })

    return NextResponse.json({
      success: true,
      event
    })
  } catch (error) {
    console.error('Create event error:', error)
    return NextResponse.json(
      { error: 'Etkinlik oluşturulurken hata oluştu' },
      { status: 500 }
    )
  }
}
