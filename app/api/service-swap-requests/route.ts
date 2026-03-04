import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { sendPushToUser } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'

// POST: Yeni hizmet takas teklifi
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }
    
    const { serviceListingId, requesterServiceId, message, proposedDate } = await request.json()
    
    if (!serviceListingId || !requesterServiceId) {
      return NextResponse.json({ error: 'Hizmet ID\'leri gerekli' }, { status: 400 })
    }
    
    // Hizmetlerin varlığını ve sahipliğini kontrol et
    const [requestedService, offeredService] = await Promise.all([
      prisma.serviceListing.findUnique({
        where: { id: serviceListingId },
        include: { user: { select: { id: true, name: true } } }
      }),
      prisma.serviceListing.findUnique({
        where: { id: requesterServiceId },
        include: { user: { select: { id: true, name: true } } }
      })
    ])
    
    if (!requestedService || !offeredService) {
      return NextResponse.json({ error: 'Hizmet bulunamadı' }, { status: 404 })
    }
    
    // Kendi hizmetine teklif gönderilemez
    if (requestedService.userId === user.id) {
      return NextResponse.json({ error: 'Kendi hizmetinize teklif gönderemezsiniz' }, { status: 400 })
    }
    
    // Teklif gönderen, teklif ettiği hizmetin sahibi olmalı
    if (offeredService.userId !== user.id) {
      return NextResponse.json({ error: 'Sadece kendi hizmetinizi teklif edebilirsiniz' }, { status: 403 })
    }
    
    // Aynı hizmetler için bekleyen teklif var mı kontrol et
    const existingRequest = await prisma.serviceSwapRequest.findFirst({
      where: {
        requestedServiceId: serviceListingId,
        offeredServiceId: requesterServiceId,
        status: 'pending'
      }
    })
    
    if (existingRequest) {
      return NextResponse.json({ error: 'Bu hizmetler için zaten bekleyen bir teklifiniz var' }, { status: 409 })
    }
    
    // Hizmet takas teklifi oluştur
    const swapRequest = await prisma.serviceSwapRequest.create({
      data: {
        requestedServiceId: serviceListingId,
        offeredServiceId: requesterServiceId,
        requesterId: user.id,
        message,
        proposedDate: proposedDate ? new Date(proposedDate) : null,
        status: 'pending'
      },
      include: {
        requestedService: { include: { user: { select: { id: true, name: true } } } },
        offeredService: { select: { title: true } },
        requester: { select: { id: true, name: true } }
      }
    })
    
    // Hizmet sahibine bildirim gönder
    await sendPushToUser(
      swapRequest.requestedService.userId,
      'service_swap_request',
      {
        title: '🔔 Yeni Hizmet Takas Teklifi!',
        body: `${swapRequest.requester.name || 'Bir kullanıcı'} "${swapRequest.requestedService.title}" hizmetiniz için takas teklifi gönderdi`,
        swapRequestId: swapRequest.id,
        url: '/hizmet-takasi?tab=received'
      }
    )
    
    return NextResponse.json({ success: true, swapRequest })
  } catch (error: any) {
    console.error('Service swap request error:', error)
    return NextResponse.json({ error: error.message || 'Bir hata oluştu' }, { status: 500 })
  }
}

// GET: Tekliflerimi listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }
    
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'sent' | 'received'
    
    const whereClause = type === 'sent' 
      ? { requesterId: user.id }
      : { requestedService: { userId: user.id } }
    
    const swapRequests = await prisma.serviceSwapRequest.findMany({
      where: whereClause,
      include: {
        requestedService: { 
          include: { 
            user: { select: { id: true, name: true, image: true } } 
          } 
        },
        offeredService: { 
          include: { 
            user: { select: { id: true, name: true, image: true } } 
          } 
        },
        requester: { select: { id: true, name: true, image: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({ swapRequests })
  } catch (error: any) {
    console.error('Get service swap requests error:', error)
    return NextResponse.json({ error: error.message || 'Bir hata oluştu' }, { status: 500 })
  }
}

// PUT: Kabul/Reddet
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }
    
    const { swapRequestId, action } = await request.json() // action: 'accept' | 'reject'
    
    if (!swapRequestId || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
    }
    
    const swapRequest = await prisma.serviceSwapRequest.findUnique({
      where: { id: swapRequestId },
      include: { 
        requestedService: { select: { userId: true, title: true } },
        requester: { select: { id: true, name: true } }
      }
    })
    
    if (!swapRequest) {
      return NextResponse.json({ error: 'Teklif bulunamadı' }, { status: 404 })
    }
    
    // Sadece hizmet sahibi kabul/ret yapabilir
    if (swapRequest.requestedService.userId !== user.id) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }
    
    // Teklif zaten işlenmiş mi?
    if (swapRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Bu teklif zaten işlenmiş' }, { status: 400 })
    }
    
    const updatedRequest = await prisma.serviceSwapRequest.update({
      where: { id: swapRequestId },
      data: { status: action === 'accept' ? 'accepted' : 'rejected' }
    })
    
    // Teklif sahibine bildirim
    await sendPushToUser(
      swapRequest.requesterId,
      action === 'accept' ? 'service_swap_accepted' : 'service_swap_rejected',
      {
        title: action === 'accept' ? '✅ Teklif Kabul Edildi!' : '❌ Teklif Reddedildi',
        body: action === 'accept' 
          ? `"${swapRequest.requestedService.title}" için hizmet takas teklifiniz kabul edildi!`
          : `"${swapRequest.requestedService.title}" için hizmet takas teklifiniz reddedildi`,
        swapRequestId: swapRequest.id,
        action,
        url: '/hizmet-takasi?tab=sent'
      }
    )
    
    return NextResponse.json({ success: true, swapRequest: updatedRequest })
  } catch (error: any) {
    console.error('Update service swap request error:', error)
    return NextResponse.json({ error: error.message || 'Bir hata oluştu' }, { status: 500 })
  }
}
