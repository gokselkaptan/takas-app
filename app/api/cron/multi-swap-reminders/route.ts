import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SIX_HOURS = 6 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  // CRON_SECRET kontrolü
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    console.log('🔔 6 saatlik hatırlatma cron başlatıldı...')
    
    const now = new Date()
    const sixHoursAgo = new Date(now.getTime() - SIX_HOURS)
    
    let swapReminders = 0
    let messageReminders = 0

    // ═══ 1. YANITLANMAMIŞ TAKAS TEKLİFLERİ ═══
    // 6+ saat önce oluşturulmuş, hala pending durumunda, hatırlatma gönderilmemiş
    const pendingSwaps = await prisma.swapRequest.findMany({
      where: {
        status: 'pending',
        createdAt: { lte: sixHoursAgo },
        reminderSentAt: null
      },
      include: {
        product: { select: { title: true } },
        owner: { select: { id: true, name: true, email: true } },
        requester: { select: { name: true } },
        offeredProduct: { select: { title: true } }
      },
      take: 50 // Batch limiti
    })

    for (const swap of pendingSwaps) {
      try {
        if (!swap.owner.email) continue
        
        await sendEmail({
          to: swap.owner.email,
          subject: `⏰ Bekleyen takas teklifiniz var!`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
              <h2 style="color:#7c3aed">Bekleyen Teklif ⏰</h2>
              <p>Merhaba <strong>${swap.owner.name || 'Kullanıcı'}</strong>,</p>
              <p><strong>${swap.requester.name || 'Bir kullanıcı'}</strong> tarafından gönderilen takas teklifinizi henüz yanıtlamadınız.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr style="background:#f3f4f6">
                  <td style="padding:8px"><strong>Ürününüz:</strong></td>
                  <td style="padding:8px">${swap.product.title}</td>
                </tr>
                ${swap.offeredProduct ? `<tr>
                  <td style="padding:8px"><strong>Teklif edilen:</strong></td>
                  <td style="padding:8px">${swap.offeredProduct.title}</td>
                </tr>` : ''}
              </table>
              <a href="https://takas-a.com/takas-firsatlari" 
                 style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
                Teklifi Yanıtla →
              </a>
              <p style="color:#6b7280;font-size:12px;margin-top:24px">
                Takas-A • Para olmadan takas!
              </p>
            </div>
          `
        })
        
        // reminderSentAt güncelle
        await prisma.swapRequest.update({
          where: { id: swap.id },
          data: { reminderSentAt: now }
        })
        
        swapReminders++
      } catch (e) {
        console.error(`Swap hatırlatma hatası (${swap.id}):`, e)
      }
    }

    // ═══ 2. OKUNMAMIŞ MESAJLAR ═══
    // 6+ saat önce gönderilmiş, okunmamış, hatırlatma gönderilmemiş
    const unreadMessages = await prisma.message.findMany({
      where: {
        isRead: false,
        createdAt: { lte: sixHoursAgo },
        reminderSentAt: null
      },
      include: {
        sender: { select: { name: true } },
        receiver: { select: { id: true, name: true, email: true } }
      },
      take: 50 // Batch limiti
    })

    // Alıcı bazında grupla (aynı kişiye tek email)
    const recipientMap = new Map<string, { email: string, name: string, count: number, messageIds: string[] }>()
    
    for (const msg of unreadMessages) {
      if (!msg.receiver.email) continue
      
      const existing = recipientMap.get(msg.receiver.id)
      if (existing) {
        existing.count++
        existing.messageIds.push(msg.id)
      } else {
        recipientMap.set(msg.receiver.id, {
          email: msg.receiver.email,
          name: msg.receiver.name || 'Kullanıcı',
          count: 1,
          messageIds: [msg.id]
        })
      }
    }

    for (const [receiverId, data] of recipientMap) {
      try {
        await sendEmail({
          to: data.email,
          subject: `💬 ${data.count} okunmamış mesajınız var!`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
              <h2 style="color:#7c3aed">Okunmamış Mesajlar 💬</h2>
              <p>Merhaba <strong>${data.name}</strong>,</p>
              <p><strong>${data.count}</strong> adet okunmamış mesajınız var.</p>
              <a href="https://takas-a.com/mesajlar" 
                 style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
                Mesajları Görüntüle →
              </a>
              <p style="color:#6b7280;font-size:12px;margin-top:24px">
                Takas-A • Para olmadan takas!
              </p>
            </div>
          `
        })
        
        // reminderSentAt güncelle (tüm mesajlar için)
        await prisma.message.updateMany({
          where: { id: { in: data.messageIds } },
          data: { reminderSentAt: now }
        })
        
        messageReminders++
      } catch (e) {
        console.error(`Mesaj hatırlatma hatası (${receiverId}):`, e)
      }
    }

    console.log(`✅ 6 saatlik hatırlatma cron tamamlandı: ${swapReminders} takas, ${messageReminders} mesaj`)
    
    return NextResponse.json({ 
      success: true, 
      swapReminders,
      messageReminders,
      timestamp: now.toISOString() 
    })
  } catch (error: any) {
    console.error('6 saatlik hatırlatma cron error:', error)
    return NextResponse.json({ 
      error: 'Internal error',
      message: error.message 
    }, { status: 500 })
  }
}
