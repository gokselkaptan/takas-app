import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ══════════════════════════════════════════════════════════════════════════════
// GÖREV 10: 24 Saat Geçen Takaslar için Uyarı ve Mesaj
// ══════════════════════════════════════════════════════════════════════════════
// Bu endpoint:
// 1. Teslim tarihi 24+ saat geçmiş aktif takasları bulur
// 2. Her iki tarafa uyarı mesajı gönderir
// 3. Her iki tarafa push bildirim gönderir
// 4. Hem normal takaslar hem çoklu takaslar için geçerli
// 5. Günde 1 kez (spam önleme için lastOverdueNotificationAt kullanılır)
// ══════════════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    // Authorization header kontrolü
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000)
    
    // Aktif statüler (sadeleştirilmiş akış)
    const activeStatuses = ['accepted', 'awaiting_delivery']

    // ══════════════════════════════════════════════════════════════════
    // 1. NORMAL TAKASLAR - 7 gün geçmiş awaiting_delivery olanları bul
    // ══════════════════════════════════════════════════════════════════
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const overdueSwaps = await prisma.swapRequest.findMany({
      where: {
        status: 'awaiting_delivery',
        updatedAt: { lt: sevenDaysAgo },
        // Son 12 saat içinde bildirim gönderilmemişler
        OR: [
          { lastOverdueNotificationAt: null },
          { lastOverdueNotificationAt: { lt: twelveHoursAgo } }
        ]
      },
      include: {
        product: true,
        owner: { select: { id: true, name: true, email: true } },
        requester: { select: { id: true, name: true, email: true } }
      }
    })

    const results: string[] = []
    let notificationsSent = 0
    let messagesSent = 0

    for (const swap of overdueSwaps) {
      const daysOverdue = Math.floor((now.getTime() - new Date(swap.updatedAt).getTime()) / (24 * 60 * 60 * 1000))
      const hoursOverdue = daysOverdue * 24
      
      try {
        // Uyarı mesajı - HER İKİ TARAFA
        const warningMessage = `🔴 HATIRLATMA!\n\n"${swap.product.title}" takası ${daysOverdue} gündür bekliyor!\n\n⚠️ Lütfen karşı tarafla iletişime geçip takası tamamlayın:\n\n1️⃣ Mesajlaşarak buluşma noktası belirleyin\n2️⃣ Buluşun, QR kod taratın ve 6 haneli kodu girin\n3️⃣ Takas tamamlansın!\n\n📍 Takas Merkezi'nden işlem yapabilirsiniz.`

        // Owner'a mesaj
        await prisma.message.create({
          data: {
            senderId: swap.requesterId,
            receiverId: swap.ownerId,
            content: warningMessage,
            productId: swap.productId,
            isModerated: true,
            moderationResult: 'approved',
            metadata: JSON.stringify({ type: 'overdue_24h_warning', swapRequestId: swap.id, hoursOverdue })
          }
        })
        messagesSent++

        // Requester'a mesaj
        await prisma.message.create({
          data: {
            senderId: swap.ownerId,
            receiverId: swap.requesterId,
            content: warningMessage,
            productId: swap.productId,
            isModerated: true,
            moderationResult: 'approved',
            metadata: JSON.stringify({ type: 'overdue_24h_warning', swapRequestId: swap.id, hoursOverdue })
          }
        })
        messagesSent++

        // Push bildirimleri
        try {
          await sendPushToUser(swap.ownerId, NotificationTypes.SYSTEM, {
            title: '📦 Takas Bekliyor!',
            body: `"${swap.product.title}" takası ${daysOverdue} gündür bekliyor. Karşı tarafla iletişime geçin!`,
            url: '/takas-firsatlari'
          })
          notificationsSent++
        } catch (pushErr) {}

        try {
          await sendPushToUser(swap.requesterId, NotificationTypes.SYSTEM, {
            title: '📦 Takas Bekliyor!',
            body: `"${swap.product.title}" takası ${daysOverdue} gündür bekliyor. Karşı tarafla iletişime geçin!`,
            url: '/takas-firsatlari'
          })
          notificationsSent++
        } catch (pushErr) {}

        // Bildirim zamanını güncelle
        await prisma.swapRequest.update({
          where: { id: swap.id },
          data: { lastOverdueNotificationAt: now }
        })

        results.push(`✅ Bildirim gönderildi: ${swap.product.title} (${daysOverdue} gün bekliyor)`)
      } catch (err: any) {
        results.push(`❌ Hata: ${swap.id} - ${err.message}`)
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. ÇOKLU TAKASLAR - 24 saat geçmiş olanları bul
    // ══════════════════════════════════════════════════════════════════
    const overdueMultiSwaps = await prisma.multiSwap.findMany({
      where: {
        status: { in: ['pending', 'confirmed'] },
        expiresAt: { lt: twentyFourHoursAgo }
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            givesProduct: true
          }
        }
      }
    })

    for (const multiSwap of overdueMultiSwaps) {
      try {
        const meetingDetails = multiSwap.meetingDetails ? JSON.parse(multiSwap.meetingDetails) : {}
        const lastNotified = meetingDetails.lastOverdueNotificationAt
        
        // Son 12 saat içinde bildirim gönderilmişse atla
        if (lastNotified && new Date(lastNotified) > twelveHoursAgo) {
          continue
        }

        const hoursOverdue = Math.floor((now.getTime() - multiSwap.expiresAt.getTime()) / (60 * 60 * 1000))
        const productTitles = multiSwap.participants.map(p => p.givesProduct.title).join(', ')

        // Tüm katılımcılara mesaj ve bildirim gönder
        for (const participant of multiSwap.participants) {
          const warningMessage = `🔴 KRİTİK UYARI!\n\nÇoklu takas "${productTitles}" son tarihi ${hoursOverdue} saattir geçmiş durumda!\n\n⚠️ Lütfen aşağıdaki seçeneklerden birini tercih edin:\n\n1️⃣ Yeni teslim tarihi belirleyin (tüm katılımcılar onaylamalı)\n2️⃣ Takası iptal edin\n\n📍 Takas Merkezi'nden işlem yapabilirsiniz.`

          // Diğer katılımcılardan birinden gönder
          const otherParticipant = multiSwap.participants.find(p => p.userId !== participant.userId)
          
          if (otherParticipant) {
            await prisma.message.create({
              data: {
                senderId: otherParticipant.userId,
                receiverId: participant.userId,
                content: warningMessage,
                isModerated: true,
                moderationResult: 'approved',
                metadata: JSON.stringify({ type: 'multi_swap_overdue_24h', multiSwapId: multiSwap.id, hoursOverdue })
              }
            })
            messagesSent++
          }

          // Push bildirim
          try {
            await sendPushToUser(participant.userId, NotificationTypes.SYSTEM, {
              title: '🔴 Çoklu Takas Gecikmesi!',
              body: `Çoklu takas ${hoursOverdue} saattir geçmiş. Acil işlem gerekli!`,
              url: '/takas-firsatlari'
            })
            notificationsSent++
          } catch (pushErr) {}
        }

        // Bildirim zamanını güncelle
        meetingDetails.lastOverdueNotificationAt = now.toISOString()
        await prisma.multiSwap.update({
          where: { id: multiSwap.id },
          data: { meetingDetails: JSON.stringify(meetingDetails) }
        })

        results.push(`✅ Çoklu takas bildirimi: ${productTitles} (${hoursOverdue}h geçmiş)`)
      } catch (err: any) {
        results.push(`❌ Çoklu takas hata: ${multiSwap.id} - ${err.message}`)
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. GÖREV 24A: RETROAKTİF ORPHANED ÜRÜN KONTROLÜ
    // ══════════════════════════════════════════════════════════════════
    // Tamamlanmış takaslara dahil olup hala active olan ürünleri bul ve düzelt
    let orphanedProductsFixed = 0
    try {
      // Completed swap'lara dahil ama hala active olan ürünleri bul
      const completedSwaps = await prisma.swapRequest.findMany({
        where: { status: 'completed' },
        select: { productId: true, offeredProductId: true }
      })
      
      const completedProductIds = completedSwaps.flatMap(s => 
        [s.productId, s.offeredProductId].filter(Boolean) as string[]
      )
      
      if (completedProductIds.length > 0) {
        // Bu ürünlerden hala active olanları bul
        const orphanedProducts = await prisma.product.findMany({
          where: {
            id: { in: completedProductIds },
            status: 'active'
          },
          select: { id: true, title: true }
        })
        
        if (orphanedProducts.length > 0) {
          await prisma.product.updateMany({
            where: { id: { in: orphanedProducts.map(p => p.id) } },
            data: { status: 'swapped' }
          })
          
          orphanedProductsFixed = orphanedProducts.length
          console.log(`🔧 Retroaktif düzeltme: ${orphanedProductsFixed} ürün swapped yapıldı`)
          console.log('Düzeltilen ürünler:', orphanedProducts.map(p => p.title).join(', '))
          results.push(`🔧 Retroaktif düzeltme: ${orphanedProductsFixed} ürün swapped yapıldı (${orphanedProducts.map(p => p.title).join(', ')})`)
        }
      }
    } catch (orphanErr: any) {
      console.error('[ORPHANED PRODUCTS ERROR]', orphanErr.message)
      results.push(`❌ Orphaned ürün kontrolü hatası: ${orphanErr.message}`)
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. DETAYLI LOGLAMA
    // ══════════════════════════════════════════════════════════════════
    const logSummary = [
      ``,
      `════════════════════════════════════════════════════════`,
      `[OVERDUE-SWAPS CRON] ${now.toISOString()}`,
      `════════════════════════════════════════════════════════`,
      `📊 ÖZET:`,
      `   • İşlenen normal takas: ${overdueSwaps.length}`,
      `   • İşlenen çoklu takas: ${overdueMultiSwaps.length}`,
      `   • Gönderilen mesaj: ${messagesSent}`,
      `   • Gönderilen push bildirim: ${notificationsSent}`,
      `   • Retroaktif düzeltilen ürün: ${orphanedProductsFixed}`,
      ``
    ]

    if (results.length > 0) {
      logSummary.push(`📋 DETAYLAR:`)
      results.forEach(r => logSummary.push(`   ${r}`))
      logSummary.push(``)
    }

    logSummary.push(`════════════════════════════════════════════════════════`)
    
    console.log(logSummary.join('\n'))

    return NextResponse.json({
      success: true,
      summary: {
        overdueSwapsProcessed: overdueSwaps.length,
        overdueMultiSwapsProcessed: overdueMultiSwaps.length,
        messagesSent,
        notificationsSent,
        orphanedProductsFixed
      },
      details: results,
      timestamp: now.toISOString()
    })
  } catch (error: any) {
    console.error('[OVERDUE-SWAPS CRON ERROR]', error)
    return NextResponse.json(
      { error: 'İşlem başarısız: ' + error.message },
      { status: 500 }
    )
  }
}

// GET - Durum kontrolü
export async function GET() {
  try {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

    // 3 gün geçmiş awaiting_delivery
    const threeDaysOverdueCount = await prisma.swapRequest.count({
      where: {
        status: 'awaiting_delivery',
        updatedAt: { lt: threeDaysAgo }
      }
    })

    // 7 gün geçmiş awaiting_delivery
    const sevenDaysOverdueCount = await prisma.swapRequest.count({
      where: {
        status: 'awaiting_delivery',
        updatedAt: { lt: sevenDaysAgo }
      }
    })

    // Çoklu takaslar (24 saat geçmiş)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const overdueMultiSwapsCount = await prisma.multiSwap.count({
      where: {
        status: { in: ['pending', 'confirmed'] },
        expiresAt: { lt: twentyFourHoursAgo }
      }
    })

    return NextResponse.json({
      swaps: {
        threeDaysOverdue: threeDaysOverdueCount,
        sevenDaysOverdue: sevenDaysOverdueCount
      },
      multiSwaps: {
        twentyFourHoursOverdue: overdueMultiSwapsCount
      },
      timestamp: now.toISOString()
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
