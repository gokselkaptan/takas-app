import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

// Bu endpoint, 24 saatten fazla pending/accepted/awaiting_delivery durumunda olan takasları otomatik iptal eder
// Ayrıca 4-6 saat kalan takaslara hatırlatma bildirimi gönderir
// Cron job veya scheduled task tarafından çağrılmalıdır
export async function POST(request: Request) {
  try {
    // Authorization header kontrolü (opsiyonel güvenlik)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      if (cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const statusesToCheck = ['pending', 'accepted', 'awaiting_delivery']
    
    // ========== 1. HATIRLATMA BİLDİRİMLERİ (4-6 saat kalan) ==========
    // 18-20 saat önce güncellenen (4-6 saat kalan) takasları bul
    const eighteenHoursAgo = new Date(now.getTime() - 18 * 60 * 60 * 1000)
    const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000)
    
    const soonExpiringSwaps = await prisma.swapRequest.findMany({
      where: {
        status: { in: statusesToCheck },
        updatedAt: {
          gte: twentyHoursAgo,
          lt: eighteenHoursAgo
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
    
    for (const swap of soonExpiringSwaps) {
      const hoursRemaining = Math.ceil((swap.updatedAt.getTime() + 24 * 60 * 60 * 1000 - now.getTime()) / (60 * 60 * 1000))
      const reminderMessage = `⚠️ "${swap.product.title}" takasınız için ${hoursRemaining} saat kaldı! İşlem yapmazsanız otomatik iptal edilecek.`
      
      // Duruma göre bildirimi kime göndereceğimizi belirle
      let targetUserId: string
      let actionHint: string
      
      if (swap.status === 'pending') {
        // Pending: Satıcı karar vermeli
        targetUserId = swap.ownerId
        actionHint = 'Teklifi kabul veya reddedin.'
      } else if (swap.status === 'accepted') {
        // Accepted: Alıcı teslimat ayarlamalı
        targetUserId = swap.requesterId
        actionHint = 'Teslimat detaylarını ayarlayın.'
      } else {
        // Awaiting delivery: Her ikisi de
        targetUserId = swap.ownerId // İlk olarak satıcıya
        actionHint = 'Teslimat noktasına gelin.'
      }
      
      try {
        await sendPushToUser(
          targetUserId,
          NotificationTypes.SYSTEM,
          {
            title: `⏰ Son ${hoursRemaining} Saat!`,
            body: `${reminderMessage} ${actionHint}`,
            url: '/takaslarim'
          }
        )
        remindersSent++
        reminderResults.push(`📢 Hatırlatma gönderildi: ${swap.product.title} (${swap.status}, ${hoursRemaining}h kaldı)`)
        
        // Awaiting delivery için alıcıya da gönder
        if (swap.status === 'awaiting_delivery') {
          await sendPushToUser(
            swap.requesterId,
            NotificationTypes.SYSTEM,
            {
              title: `⏰ Son ${hoursRemaining} Saat!`,
              body: `${reminderMessage} Teslimat noktasına gelin.`,
              url: '/takaslarim'
            }
          )
          remindersSent++
        }
      } catch (pushErr) {
        reminderResults.push(`❌ Hatırlatma gönderilemedi: ${swap.id}`)
      }
    }
    
    // ========== 2. SÜRESİ DOLMUŞ TAKASLARI İPTAL ET ==========
    const expiredSwaps = await prisma.swapRequest.findMany({
      where: {
        status: { in: statusesToCheck },
        updatedAt: { lt: twentyFourHoursAgo }
      },
      include: {
        product: true,
        owner: true,
        requester: true
      }
    })
    
    const cancelledCount = expiredSwaps.length
    const cancelResults: string[] = []
    let totalRefundedValor = 0
    
    for (const swap of expiredSwaps) {
      try {
        const previousStatus = swap.status
        let swapRefundedValor = 0
        
        // Takası iptal et
        await prisma.swapRequest.update({
          where: { id: swap.id },
          data: { status: 'cancelled' }
        })
        
        // Ürünü tekrar aktif yap
        await prisma.product.update({
          where: { id: swap.productId },
          data: { status: 'active' }
        })
        
        // Escrow'daki Valor'u iade et
        if (swap.pendingValorAmount && swap.pendingValorAmount > 0) {
          await prisma.user.update({
            where: { id: swap.requesterId },
            data: { valorBalance: { increment: swap.pendingValorAmount } }
          })
          
          await prisma.valorTransaction.create({
            data: {
              type: 'escrow_refund',
              amount: swap.pendingValorAmount,
              fee: 0,
              netAmount: swap.pendingValorAmount,
              description: `Zaman aşımı - Takas iadesi (${swap.product.title})`,
              toUserId: swap.requesterId
            }
          })
          
          swapRefundedValor += swap.pendingValorAmount
          cancelResults.push(`💰 ${swap.pendingValorAmount} Valor → ${swap.requester.email} (alıcı)`)
        }
        
        // Satıcının teminatı varsa iade et
        if (['accepted', 'awaiting_delivery'].includes(previousStatus)) {
          const ownerDeposit = swap.product.valorPrice || 0
          if (ownerDeposit > 0) {
            await prisma.user.update({
              where: { id: swap.ownerId },
              data: { valorBalance: { increment: ownerDeposit } }
            })
            
            await prisma.valorTransaction.create({
              data: {
                type: 'escrow_refund',
                amount: ownerDeposit,
                fee: 0,
                netAmount: ownerDeposit,
                description: `Zaman aşımı - Teminat iadesi (${swap.product.title})`,
                toUserId: swap.ownerId
              }
            })
            
            swapRefundedValor += ownerDeposit
            cancelResults.push(`💰 ${ownerDeposit} Valor → ${swap.owner.email} (satıcı)`)
          }
        }
        
        totalRefundedValor += swapRefundedValor
        
        // Her iki kullanıcıya bildirim gönder
        const notificationMessage = `Takasınız zaman aşımına uğradı ve otomatik iptal edildi. "${swap.product.title}" için Valor bakiyenize iade edildi.`
        
        try {
          await sendPushToUser(swap.requesterId, NotificationTypes.SYSTEM, {
            title: 'Takas Zaman Aşımı ⏰',
            body: notificationMessage,
            url: '/takaslarim'
          })
        } catch (pushErr) {}
        
        try {
          await sendPushToUser(swap.ownerId, NotificationTypes.SYSTEM, {
            title: 'Takas Zaman Aşımı ⏰',
            body: notificationMessage,
            url: '/takaslarim'
          })
        } catch (pushErr) {}
        
        cancelResults.push(`✅ İptal: ${swap.product.title} (${previousStatus}) - ${swapRefundedValor} Valor iade`)
      } catch (err: any) {
        cancelResults.push(`❌ Hata: ${swap.id} - ${err.message}`)
      }
    }
    
    // ========== 3. DETAYLI LOGLAMA ==========
    const logSummary = [
      ``,
      `════════════════════════════════════════════════════════`,
      `[AUTO-CANCEL CRON] ${now.toISOString()}`,
      `════════════════════════════════════════════════════════`,
      `📊 ÖZET:`,
      `   • İptal edilen takas sayısı: ${cancelledCount}`,
      `   • İade edilen toplam Valor: ${totalRefundedValor}`,
      `   • Gönderilen hatırlatma: ${remindersSent}`,
      `   • Yakında dolacak (4-6h): ${soonExpiringSwaps.length}`,
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
        soonExpiringCount: soonExpiringSwaps.length
      },
      details: {
        reminders: reminderResults,
        cancellations: cancelResults
      },
      timestamp: now.toISOString()
    })
  } catch (error: any) {
    console.error('[AUTO-CANCEL ERROR]', error)
    return NextResponse.json(
      { error: 'İptal işlemi başarısız: ' + error.message },
      { status: 500 }
    )
  }
}

// Durum kontrolü için GET endpoint
export async function GET() {
  try {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    // Timeout kontrol edilecek durumlar
    const statusesToCheck = ['pending', 'accepted', 'awaiting_delivery']
    
    // Süresi dolmuş takas sayısı (durum bazlı)
    const expiredByStatus = await Promise.all(
      statusesToCheck.map(async (status) => {
        const count = await prisma.swapRequest.count({
          where: {
            status,
            updatedAt: { lt: twentyFourHoursAgo }
          }
        })
        return { status, count }
      })
    )
    
    const totalExpired = expiredByStatus.reduce((sum, item) => sum + item.count, 0)
    
    // Yakında dolacak takaslar (son 4 saat içinde dolacak)
    const fourHoursFromExpiry = new Date(twentyFourHoursAgo.getTime() + 4 * 60 * 60 * 1000)
    const soonExpiring = await prisma.swapRequest.count({
      where: {
        status: { in: statusesToCheck },
        updatedAt: {
          gte: twentyFourHoursAgo,
          lt: fourHoursFromExpiry
        }
      }
    })
    
    // Aktif takaslar (henüz süresi dolmamış)
    const activeSwaps = await prisma.swapRequest.count({
      where: {
        status: { in: statusesToCheck },
        updatedAt: { gte: twentyFourHoursAgo }
      }
    })
    
    return NextResponse.json({
      expiredCount: totalExpired,
      expiredByStatus,
      soonExpiring,
      activeSwaps,
      statusesChecked: statusesToCheck,
      timestamp: now.toISOString()
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
