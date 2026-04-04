import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ══════════════════════════════════════════════════════════════════════════════
// GÖREV 7: 48 Saati Geçen Pending Teklifleri Otomatik İptal Et
// ══════════════════════════════════════════════════════════════════════════════
// Bu endpoint:
// 1. 48 saatten fazla "pending" durumunda olan teklifleri otomatik iptal eder
// 2. Her iki tarafa mesaj gönderir
// 3. Her iki tarafa push bildirim gönderir
// 4. Güven puanı DEĞİŞMEZ (kimse cezalandırılmaz)
// 5. Takas merkezi sayfası yüklendiğinde client-side çağrılır
// ══════════════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    // Authorization header kontrolü (opsiyonel güvenlik)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const now = new Date()
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    
    // ══════════════════════════════════════════════════════════════════
    // 1. HATIRLATMA BİLDİRİMLERİ (42-46 saat - son 6-2 saat kalan)
    // ══════════════════════════════════════════════════════════════════
    const fortyTwoHoursAgo = new Date(now.getTime() - 42 * 60 * 60 * 1000)
    const fortySixHoursAgo = new Date(now.getTime() - 46 * 60 * 60 * 1000)
    
    const soonExpiringPendingSwaps = await prisma.swapRequest.findMany({
      where: {
        status: 'pending',
        createdAt: {
          gte: fortySixHoursAgo,
          lt: fortyTwoHoursAgo
        }
      },
      include: {
        product: true,
        owner: true,
        requester: true
      }
    })
    
    const reminderResults: string[] = []
    let remindersSent = 0
    
    for (const swap of soonExpiringPendingSwaps) {
      const hoursRemaining = Math.ceil((swap.createdAt.getTime() + 48 * 60 * 60 * 1000 - now.getTime()) / (60 * 60 * 1000))
      const reminderMessage = `⏰ "${swap.product.title}" için takas teklifi ${hoursRemaining} saat içinde yanıtlanmazsa otomatik iptal edilecek!`
      
      // Ürün sahibine (owner) bildirim - henüz yanıtlamadı
      try {
        await sendPushToUser(
          swap.ownerId,
          NotificationTypes.SYSTEM,
          {
            title: `⏰ Son ${hoursRemaining} Saat!`,
            body: `${reminderMessage} Lütfen teklifi kabul veya reddedin.`,
            url: '/takas-firsatlari'
          }
        )
        remindersSent++
        reminderResults.push(`📢 Hatırlatma (satıcı): ${swap.product.title} (${hoursRemaining}h kaldı)`)
      } catch (pushErr) {
        reminderResults.push(`❌ Hatırlatma gönderilemedi (satıcı): ${swap.id}`)
      }
      
      // Teklif sahibine (requester) de bilgi ver
      try {
        await sendPushToUser(
          swap.requesterId,
          NotificationTypes.SYSTEM,
          {
            title: `⏰ Teklifiniz Beklemede`,
            body: `"${swap.product.title}" için teklifiniz ${hoursRemaining} saat içinde yanıtlanmazsa otomatik iptal edilecek.`,
            url: '/takas-firsatlari'
          }
        )
        remindersSent++
      } catch (pushErr) {
        // Requester bildirimi opsiyonel
      }
    }
    
    // ══════════════════════════════════════════════════════════════════
    // 2. 48 SAATİ GEÇEN PENDİNG TEKLİFLERİ İPTAL ET
    // ══════════════════════════════════════════════════════════════════
    const expiredPendingSwaps = await prisma.swapRequest.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: fortyEightHoursAgo }
      },
      include: {
        product: true,
        owner: true,
        requester: true
      }
    })
    
    const cancelledCount = expiredPendingSwaps.length
    const cancelResults: string[] = []
    let totalRefundedValor = 0
    
    for (const swap of expiredPendingSwaps) {
      try {
        let swapRefundedValor = 0
        
        // 🔒 Race condition fix + Idempotency: $transaction() ile atomik işlem
        await prisma.$transaction(async (tx) => {
          // İdempotency kontrolü: Status hâlâ pending mi?
          const freshSwap = await tx.swapRequest.findUnique({
            where: { id: swap.id },
            select: { status: true }
          })
          
          if (freshSwap?.status !== 'pending') {
            console.log(`[Auto-Cancel] Skip: ${swap.id} status zaten ${freshSwap?.status}`)
            return // Zaten işlenmiş
          }
          
          // Takası expired olarak işaretle - GÜVEN PUANI DEĞİŞMEZ
          await tx.swapRequest.update({
            where: { id: swap.id },
            data: { 
              status: 'expired',
              cancelReason: 'auto_timeout_48h',
              cancelledAt: new Date()
            }
          })
          
          // Ürünü tekrar aktif yap (eğer aktif değilse)
          await tx.product.update({
            where: { id: swap.productId },
            data: { status: 'active' }
          })
          
          // Requester'ın kilitli Valor'unu iade et (varsa)
          if (swap.requesterDeposit && swap.requesterDeposit > 0) {
            const reqBefore = await tx.user.findUnique({ where: { id: swap.requesterId }, select: { lockedValor: true } })
            await tx.user.update({
              where: { id: swap.requesterId },
              data: { 
                lockedValor: { decrement: swap.requesterDeposit }
              }
            })
            
            await tx.valorTransaction.create({
              data: {
                type: 'deposit_refund',
                amount: swap.requesterDeposit,
                fee: 0,
                netAmount: swap.requesterDeposit,
                description: `48 saat zaman aşımı - Teminat iadesi (${swap.product.title})`,
                toUserId: swap.requesterId
              }
            })

            // EscrowLedger — refund (auto-cancel)
            await tx.escrowLedger.create({
              data: {
                swapRequestId: swap.id,
                userId: swap.requesterId,
                type: 'refund',
                amount: swap.requesterDeposit,
                balanceBefore: reqBefore?.lockedValor ?? 0,
                balanceAfter: Math.max(0, (reqBefore?.lockedValor ?? 0) - swap.requesterDeposit),
                reason: '48 saat zaman aşımı — depozito iade edildi'
              }
            })
            
            swapRefundedValor += swap.requesterDeposit
          }
          
          // İptal mesajı - HER İKİ TARAFA
          const cancelMessage = `⏰ Takas teklifiniz 48 saat içinde yanıtlanmadığı için otomatik iptal edildi.\n\n📦 Ürün: "${swap.product.title}"\n\n💡 Bu iptal nedeniyle güven puanınız etkilenmez.`
          
          // Requester'a mesaj
          await tx.message.create({
            data: {
              senderId: swap.ownerId,
              receiverId: swap.requesterId,
              content: cancelMessage,
              productId: swap.productId,
              isModerated: true,
              moderationResult: 'approved',
              metadata: JSON.stringify({ type: 'auto_cancel_48h', swapRequestId: swap.id })
            }
          })
          
          // Owner'a mesaj
          await tx.message.create({
            data: {
              senderId: swap.requesterId,
              receiverId: swap.ownerId,
              content: cancelMessage,
              productId: swap.productId,
              isModerated: true,
              moderationResult: 'approved',
              metadata: JSON.stringify({ type: 'auto_cancel_48h', swapRequestId: swap.id })
            }
          })
        })
        
        totalRefundedValor += swapRefundedValor
        
        // Push bildirimler - Transaction dışında (hata olsa bile swap işlendi)
        try {
          await sendPushToUser(swap.requesterId, NotificationTypes.SYSTEM, {
            title: '⏰ Takas Zaman Aşımı',
            body: `"${swap.product.title}" için teklifiniz 48 saat yanıtsız kaldığı için iptal edildi.`,
            url: '/takas-firsatlari'
          })
        } catch (pushErr) {}
        
        try {
          await sendPushToUser(swap.ownerId, NotificationTypes.SYSTEM, {
            title: '⏰ Takas Zaman Aşımı',
            body: `"${swap.product.title}" için gelen teklif 48 saat yanıtsız kaldığı için iptal edildi.`,
            url: '/takas-firsatlari'
          })
        } catch (pushErr) {}
        
        cancelResults.push(`✅ Expired: ${swap.product.title} (pending, 48h+) - ${swapRefundedValor} Valor iade`)
      } catch (err: any) {
        cancelResults.push(`❌ Hata: ${swap.id} - ${err.message}`)
      }
    }
    
    // ══════════════════════════════════════════════════════════════════
    // 3. DETAYLI LOGLAMA
    // ══════════════════════════════════════════════════════════════════
    const logSummary = [
      ``,
      `════════════════════════════════════════════════════════`,
      `[AUTO-CANCEL 48H PENDING] ${now.toISOString()}`,
      `════════════════════════════════════════════════════════`,
      `📊 ÖZET:`,
      `   • İptal edilen pending teklif sayısı: ${cancelledCount}`,
      `   • İade edilen toplam Valor: ${totalRefundedValor}`,
      `   • Gönderilen hatırlatma: ${remindersSent}`,
      `   • Yakında dolacak (2-6h): ${soonExpiringPendingSwaps.length}`,
      ``
    ]
    
    if (reminderResults.length > 0) {
      logSummary.push(`📢 HATIRLATMALAR:`)
      reminderResults.forEach(r => logSummary.push(`   ${r}`))
      logSummary.push(``)
    }
    
    if (cancelResults.length > 0) {
      logSummary.push(`🔄 İPTAL İŞLEMLERİ:`)
      cancelResults.forEach(r => logSummary.push(`   ${r}`))
      logSummary.push(``)
    }
    
    logSummary.push(`════════════════════════════════════════════════════════`)
    
    console.log(logSummary.join('\n'))
    
    return NextResponse.json({
      success: true,
      summary: {
        cancelledCount,
        totalRefundedValor,
        remindersSent,
        soonExpiringCount: soonExpiringPendingSwaps.length
      },
      details: {
        reminders: reminderResults,
        cancellations: cancelResults
      },
      timestamp: now.toISOString()
    })
  } catch (error: any) {
    console.error('[AUTO-CANCEL 48H ERROR]', error)
    return NextResponse.json(
      { error: 'İptal işlemi başarısız: ' + error.message },
      { status: 500 }
    )
  }
}

// GET - Durum kontrolü (client-side çağrısı için)
export async function GET() {
  try {
    const now = new Date()
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    
    // 48 saat geçen pending teklifler
    const expiredPendingCount = await prisma.swapRequest.count({
      where: {
        status: 'pending',
        createdAt: { lt: fortyEightHoursAgo }
      }
    })
    
    // Son 42-48 saat arası (6 saat kalan)
    const fortyTwoHoursAgo = new Date(now.getTime() - 42 * 60 * 60 * 1000)
    const soonExpiringCount = await prisma.swapRequest.count({
      where: {
        status: 'pending',
        createdAt: {
          gte: fortyEightHoursAgo,
          lt: fortyTwoHoursAgo
        }
      }
    })
    
    // Aktif pending teklifler (henüz süresi dolmamış)
    const activePendingCount = await prisma.swapRequest.count({
      where: {
        status: 'pending',
        createdAt: { gte: fortyEightHoursAgo }
      }
    })
    
    return NextResponse.json({
      expiredPendingCount,
      soonExpiringCount,
      activePendingCount,
      timeoutHours: 48,
      timestamp: now.toISOString()
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
