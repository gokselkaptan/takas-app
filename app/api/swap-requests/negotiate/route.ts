import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { 
  processNegotiation, 
  getNegotiationHistory,
  transitionSwapStatus 
} from '@/lib/state-machine'

export const dynamic = 'force-dynamic'

/**
 * GET - Pazarlık geçmişini getir
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
      select: {
        id: true,
        requesterId: true,
        ownerId: true,
        negotiationStatus: true,
        agreedPriceRequester: true,
        agreedPriceOwner: true,
        counterOfferCount: true,
        maxCounterOffers: true,
        lastCounterOfferAt: true,
        negotiationDeadline: true,
        priceAgreedAt: true
      }
    })

    if (!swap) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    // Yetki kontrolü
    if (swap.requesterId !== user.id && swap.ownerId !== user.id) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 })
    }

    // Pazarlık geçmişini getir
    const history = await getNegotiationHistory(swapId)

    return NextResponse.json({
      swap: {
        id: swap.id,
        negotiationStatus: swap.negotiationStatus,
        agreedPriceRequester: swap.agreedPriceRequester,
        agreedPriceOwner: swap.agreedPriceOwner,
        counterOfferCount: swap.counterOfferCount,
        maxCounterOffers: swap.maxCounterOffers,
        remainingCounterOffers: swap.maxCounterOffers - swap.counterOfferCount,
        lastCounterOfferAt: swap.lastCounterOfferAt,
        negotiationDeadline: swap.negotiationDeadline,
        priceAgreedAt: swap.priceAgreedAt,
        isAgreed: swap.negotiationStatus === 'price_agreed'
      },
      history: history.map(h => ({
        id: h.id,
        actionType: h.actionType,
        proposedPrice: h.proposedPrice,
        previousPrice: h.previousPrice,
        message: h.message,
        createdAt: h.createdAt,
        isCurrentUser: h.userId === user.id
      })),
      currentUserId: user.id,
      isRequester: swap.requesterId === user.id,
      isOwner: swap.ownerId === user.id
    })
  } catch (error) {
    console.error('Get negotiation history error:', error)
    return NextResponse.json(
      { error: 'Pazarlık geçmişi yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}

/**
 * POST - Pazarlık işlemi yap
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
    const { swapId, action, proposedPrice, message } = body

    if (!swapId || !action) {
      return NextResponse.json(
        { error: 'swapId ve action gerekli' },
        { status: 400 }
      )
    }

    // Geçerli action kontrolü
    const validActions = ['propose', 'counter', 'accept', 'reject']
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Geçersiz işlem: ' + validActions.join(', ') },
        { status: 400 }
      )
    }

    // Fiyat gerektiren işlemler için kontrol
    if (['propose', 'counter'].includes(action) && (!proposedPrice || proposedPrice <= 0)) {
      return NextResponse.json(
        { error: 'Geçerli bir fiyat giriniz' },
        { status: 400 }
      )
    }

    // Pazarlık işlemini gerçekleştir
    const result = await processNegotiation(swapId, {
      type: action,
      userId: user.id,
      proposedPrice: proposedPrice ? parseInt(proposedPrice) : undefined,
      message
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      negotiationStatus: result.negotiationStatus,
      agreedPrice: result.agreedPrice,
      message: getSuccessMessage(action, result.agreedPrice)
    })
  } catch (error) {
    console.error('Negotiation error:', error)
    return NextResponse.json(
      { error: 'Pazarlık işlemi başarısız' },
      { status: 500 }
    )
  }
}

function getSuccessMessage(action: string, agreedPrice?: number): string {
  switch (action) {
    case 'propose':
      return 'Fiyat teklifiniz gönderildi'
    case 'counter':
      return 'Karşı teklifiniz gönderildi'
    case 'accept':
      return `${agreedPrice} Valor üzerinde anlaşıldı!`
    case 'reject':
      return 'Pazarlık reddedildi'
    default:
      return 'İşlem tamamlandı'
  }
}
