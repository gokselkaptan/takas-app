import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { releaseEscrow } from '@/lib/trust-system'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'
import { 
  DISPUTE_WINDOW_HOURS, 
  AUTO_COMPLETE_LOW_RISK,
  SWAP_STATUS,
  calculateRiskTier 
} from '@/lib/swap-config'

export const dynamic = 'force-dynamic'

// Cron job için secret key (opsiyonel güvenlik)
const CRON_SECRET = process.env.CRON_SECRET

/**
 * Auto-complete API
 * 
 * Dispute window süresi dolmuş ve itiraz açılmamış takasları otomatik tamamlar.
 * Cron job tarafından periyodik olarak çağrılır.
 * 
 * GET: Admin veya cron job tarafından çağrılır
 * POST: Manuel tetikleme (admin only)
 */

export async function GET(request: Request) {
  try {
    // Cron secret kontrolü (varsa)
    const { searchParams } = new URL(request.url)
    const cronSecret = searchParams.get('secret')
    
    if (CRON_SECRET && cronSecret !== CRON_SECRET) {
      // Admin session kontrolü
      const session = await getServerSession(authOptions)
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
      }
      
      const user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })
      
      if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Sadece admin erişebilir' }, { status: 403 })
      }
    }

    const result = await processAutoComplete()
    
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Auto-complete error:', error)
    return NextResponse.json(
      { error: 'Auto-complete işlemi başarısız' },
      { status: 500 }
    )
  }
}

// Manuel tetikleme için POST endpoint
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Sadece admin erişebilir' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { swapId, force } = body

    // Tek bir takas için manuel tamamlama
    if (swapId) {
      const result = await manualComplete(swapId, force)
      return NextResponse.json(result)
    }

    // Tüm uygun takaslar için auto-complete
    const result = await processAutoComplete()
    
    return NextResponse.json({
      success: true,
      ...result,
      triggeredBy: user.email,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Manual auto-complete error:', error)
    return NextResponse.json(
      { error: 'Auto-complete işlemi başarısız' },
      { status: 500 }
    )
  }
}

/**
 * Tüm uygun takasları otomatik tamamla
 */
async function processAutoComplete() {
  const now = new Date()
  
  // 1. Dispute window süresi dolmuş ve delivered durumundaki takasları bul
  const eligibleSwaps = await prisma.swapRequest.findMany({
    where: {
      status: SWAP_STATUS.DELIVERED,
      disputeWindowEndsAt: {
        lte: now // Dispute window sona ermiş
      },
      // Dispute açılmamış
      disputes: {
        none: {}
      }
    },
    include: {
      product: {
        include: { category: true }
      },
      owner: { select: { id: true, name: true, email: true } },
      requester: { select: { id: true, name: true, email: true } }
    },
    take: 100 // Batch limit
  })

  console.log(`[Auto-Complete] ${eligibleSwaps.length} takas auto-complete için uygun`)

  const results = {
    processed: 0,
    completed: 0,
    skipped: 0,
    errors: 0,
    details: [] as any[]
  }

  for (const swap of eligibleSwaps) {
    results.processed++
    
    try {
      // Risk tier kontrolü
      const riskTier = swap.riskTier || calculateRiskTier(
        swap.product.valorPrice,
        swap.product.category?.name
      )

      // Yüksek riskli ürünlerde auto-complete sadece config'e göre
      if (riskTier !== 'low' && !AUTO_COMPLETE_LOW_RISK) {
        results.skipped++
        results.details.push({
          swapId: swap.id,
          status: 'skipped',
          reason: `Risk seviyesi yüksek (${riskTier}), manuel onay gerekli`
        })
        continue
      }

      // Takası tamamla
      await completeSwap(swap)
      
      results.completed++
      results.details.push({
        swapId: swap.id,
        status: 'completed',
        productTitle: swap.product.title,
        valorAmount: swap.pendingValorAmount
      })
    } catch (error) {
      results.errors++
      results.details.push({
        swapId: swap.id,
        status: 'error',
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      })
      console.error(`[Auto-Complete] Swap ${swap.id} error:`, error)
    }
  }

  // Loglama
  await prisma.activityFeed.create({
    data: {
      type: 'auto_complete_batch',
      userId: 'system',
      userName: 'Sistem',
      productId: null,
      productTitle: `${results.completed} takas otomatik tamamlandı`,
      city: 'Sistem',
      metadata: JSON.stringify(results)
    }
  })

  return results
}

/**
 * Tek bir takası tamamla
 */
async function completeSwap(swap: any) {
  const now = new Date()
  const valorAmount = swap.pendingValorAmount || swap.product.valorPrice

  // 1. Swap durumunu güncelle
  await prisma.swapRequest.update({
    where: { id: swap.id },
    data: {
      status: SWAP_STATUS.COMPLETED,
      receiverConfirmed: true,
      receiverConfirmedAt: now,
      ownerConfirmed: true,
      ownerConfirmedAt: now,
      valorReleased: true,
      autoCompleteEligible: false // Artık uygun değil
    }
  })

  // 2. Escrow'u serbest bırak
  try {
    await releaseEscrow(swap.id)
  } catch (error) {
    console.error(`[Auto-Complete] Escrow release error for ${swap.id}:`, error)
  }

  // 3. Valor transferi
  await prisma.valorTransaction.create({
    data: {
      type: 'auto_complete_release',
      amount: valorAmount,
      fee: 0,
      netAmount: valorAmount,
      description: `Otomatik tamamlama - ${swap.product.title}`,
      swapRequestId: swap.id,
      toUserId: swap.ownerId
    }
  })

  // 4. Ürün sahibinin Valor bakiyesini güncelle
  await prisma.user.update({
    where: { id: swap.ownerId },
    data: {
      valorBalance: { increment: valorAmount }
    }
  })

  // 5. Bildirimleri gönder
  const notificationPromises = [
    sendPushToUser(swap.ownerId, NotificationTypes.SWAP_COMPLETED, {
      productTitle: swap.product.title,
      valorAmount,
      swapId: swap.id
    }),
    sendPushToUser(swap.requesterId, NotificationTypes.SWAP_COMPLETED, {
      productTitle: swap.product.title,
      valorAmount,
      swapId: swap.id
    })
  ]

  await Promise.allSettled(notificationPromises)

  console.log(`[Auto-Complete] Swap ${swap.id} completed - ${valorAmount} VALOR released to ${swap.owner.email}`)
}

/**
 * Manuel tamamlama (admin için)
 */
async function manualComplete(swapId: string, force: boolean = false) {
  const swap = await prisma.swapRequest.findUnique({
    where: { id: swapId },
    include: {
      product: { include: { category: true } },
      owner: { select: { id: true, name: true, email: true } },
      requester: { select: { id: true, name: true, email: true } },
      disputes: { where: { status: { not: 'resolved' } } }
    }
  })

  if (!swap) {
    return { success: false, error: 'Takas bulunamadı' }
  }

  // Durum kontrolü
  if (swap.status !== SWAP_STATUS.DELIVERED && !force) {
    return { 
      success: false, 
      error: `Takas durumu: ${swap.status}. Sadece 'delivered' durumundaki takaslar tamamlanabilir.`,
      currentStatus: swap.status
    }
  }

  // Açık dispute kontrolü
  if (swap.disputes.length > 0 && !force) {
    return {
      success: false,
      error: 'Açık dispute var. Force parametresi ile zorla tamamlayabilirsiniz.',
      openDisputes: swap.disputes.length
    }
  }

  // Dispute window kontrolü (force değilse)
  if (!force && swap.disputeWindowEndsAt && new Date() < swap.disputeWindowEndsAt) {
    const remainingMs = swap.disputeWindowEndsAt.getTime() - Date.now()
    const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60))
    return {
      success: false,
      error: `Dispute window henüz bitmedi. ${remainingHours} saat kaldı.`,
      disputeWindowEndsAt: swap.disputeWindowEndsAt,
      remainingHours
    }
  }

  // Tamamla
  await completeSwap(swap)

  return {
    success: true,
    message: 'Takas manuel olarak tamamlandı',
    swapId: swap.id,
    productTitle: swap.product.title,
    valorAmount: swap.pendingValorAmount || swap.product.valorPrice,
    forced: force
  }
}
