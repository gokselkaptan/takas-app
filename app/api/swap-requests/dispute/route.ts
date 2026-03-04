import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { openDispute, checkDisputeWindowStatus, getStatusLogs } from '@/lib/state-machine'
import { DISPUTE_WINDOW_HOURS } from '@/lib/swap-config'

export const dynamic = 'force-dynamic'

/**
 * GET - Dispute durumunu ve window bilgisini getir
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const swapId = searchParams.get('swapId')

    if (!swapId) {
      return NextResponse.json({ error: 'swapId gerekli' }, { status: 400 })
    }

    // Takası kontrol et
    const swap = await prisma.swapRequest.findUnique({
      where: { id: swapId },
      include: {
        disputes: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    })

    if (!swap) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    // Yetki kontrolü
    if (swap.requesterId !== user.id && swap.ownerId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 })
    }

    // Dispute window durumunu kontrol et
    const windowStatus = await checkDisputeWindowStatus(swapId)

    // Durum loglarını getir
    const statusLogs = await getStatusLogs(swapId)

    return NextResponse.json({
      swap: {
        id: swap.id,
        status: swap.status,
        deliveredAt: swap.deliveredAt,
        riskTier: swap.riskTier,
        autoCompleteEligible: swap.autoCompleteEligible
      },
      disputeWindow: {
        endsAt: swap.disputeWindowEndsAt,
        hoursTotal: DISPUTE_WINDOW_HOURS,
        remainingHours: windowStatus?.remainingHours || 0,
        isActive: windowStatus?.isInDisputeWindow || false,
        canOpenDispute: windowStatus?.canOpenDispute || false,
        canAutoComplete: windowStatus?.canAutoComplete || false
      },
      disputes: swap.disputes.map(d => ({
        id: d.id,
        type: d.type,
        description: d.description,
        status: d.status,
        createdAt: d.createdAt
      })),
      statusHistory: statusLogs.map(log => ({
        id: log.id,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        reason: log.reason,
        createdAt: log.createdAt
      })),
      currentUserId: user.id,
      isRequester: swap.requesterId === user.id,
      isOwner: swap.ownerId === user.id,
      isAdmin: user.role === 'admin'
    })
  } catch (error) {
    console.error('Get dispute info error:', error)
    return NextResponse.json(
      { error: 'Dispute bilgisi yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}

/**
 * POST - Yeni dispute aç
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const { swapId, reason, description } = body

    if (!swapId || !reason || !description) {
      return NextResponse.json(
        { error: 'swapId, reason ve description gerekli' },
        { status: 400 }
      )
    }

    // Geçerli sebep kontrolü
    const validReasons = [
      'item_not_received',       // Ürün teslim alınmadı
      'item_damaged',            // Ürün hasarlı
      'item_not_as_described',   // Ürün tanıma uymayan
      'wrong_item',              // Yanlış ürün
      'fraud',                   // Dolandırıcılık
      'other'                    // Diğer
    ]

    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: 'Geçersiz itiraz sebebi' },
        { status: 400 }
      )
    }

    // Description uzunluk kontrolü
    if (description.length < 20) {
      return NextResponse.json(
        { error: 'Açıklama en az 20 karakter olmalı' },
        { status: 400 }
      )
    }

    // Dispute aç
    const result = await openDispute(swapId, user.id, reason, description)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'İtirazınız açıldı. En kısa sürede incelenecektir.',
      newStatus: result.newStatus
    })
  } catch (error) {
    console.error('Open dispute error:', error)
    return NextResponse.json(
      { error: 'İtiraz açılırken hata oluştu' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Dispute durumunu güncelle (sadece admin)
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 })
    }

    const body = await request.json()
    const { disputeId, status, resolution, compensationAmount } = body

    if (!disputeId || !status) {
      return NextResponse.json(
        { error: 'disputeId ve status gerekli' },
        { status: 400 }
      )
    }

    const validStatuses = ['open', 'investigating', 'resolved', 'rejected']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Geçersiz durum' },
        { status: 400 }
      )
    }

    // Dispute'u güncelle
    const dispute = await prisma.disputeReport.update({
      where: { id: disputeId },
      data: {
        status,
        resolution
      }
    })

    // Eğer çözüldüyse swap durumunu güncelle
    if (status === 'resolved') {
      await prisma.swapRequest.update({
        where: { id: dispute.swapRequestId },
        data: { status: 'resolved' }
      })

      // Tazminat varsa uygula
      if (compensationAmount && compensationAmount > 0) {
        // Reporter'a tazminat
        await prisma.user.update({
          where: { id: dispute.reporterId },
          data: {
            valorBalance: { increment: compensationAmount }
          }
        })

        // Transaction kaydı
        await prisma.valorTransaction.create({
          data: {
            toUserId: dispute.reporterId,
            amount: compensationAmount,
            netAmount: compensationAmount,
            type: 'compensation',
            description: `İtiraz tazminatı - ${dispute.type}`,
            swapRequestId: dispute.swapRequestId
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      dispute: {
        id: dispute.id,
        status: dispute.status,
        resolution: dispute.resolution
      }
    })
  } catch (error) {
    console.error('Update dispute error:', error)
    return NextResponse.json(
      { error: 'İtiraz güncellenirken hata oluştu' },
      { status: 500 }
    )
  }
}
