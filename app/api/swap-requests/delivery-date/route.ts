import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ══════════════════════════════════════════════════════════════════════════════
// GÖREV 8: Teslim Tarihi Yönetimi API
// ══════════════════════════════════════════════════════════════════════════════
// Teslim tarihinden 6 saat geçtiyse uyarı sistemi ve yeni tarih belirleme
// Hem Aktif Takaslar hem Çoklu Takaslar için geçerli
// ══════════════════════════════════════════════════════════════════════════════

// POST: Teslim tarihi öner/kabul et/güncelle
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const { swapId, action, proposedDate, multiSwapId } = body

    // ═══════════════════════════════════════════════════════════════
    // NORMAL TAKAS İÇİN TESLİM TARİHİ YÖNETİMİ
    // ═══════════════════════════════════════════════════════════════
    if (swapId) {
      const swap = await prisma.swapRequest.findUnique({
        where: { id: swapId },
        include: {
          product: true,
          owner: { select: { id: true, name: true, email: true } },
          requester: { select: { id: true, name: true, email: true } }
        }
      })

      if (!swap) {
        return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
      }

      const isOwner = swap.ownerId === user.id
      const isRequester = swap.requesterId === user.id

      if (!isOwner && !isRequester) {
        return NextResponse.json({ error: 'Bu takasa erişim yetkiniz yok' }, { status: 403 })
      }

      const otherUserId = isOwner ? swap.requesterId : swap.ownerId
      const otherUserName = isOwner ? swap.requester.name : swap.owner.name

      // ─────────────────────────────────────────────────────────────
      // AKSİYON: PROPOSE - Yeni teslim tarihi öner
      // ─────────────────────────────────────────────────────────────
      if (action === 'propose') {
        if (!proposedDate) {
          return NextResponse.json({ error: 'Teslim tarihi gerekli' }, { status: 400 })
        }

        const proposedDateTime = new Date(proposedDate)
        
        // Geçmiş tarih kontrolü
        if (proposedDateTime < new Date()) {
          return NextResponse.json({ error: 'Geçmiş bir tarih seçilemez' }, { status: 400 })
        }

        // Öneriyi kaydet
        await prisma.swapRequest.update({
          where: { id: swapId },
          data: {
            deliveryDateProposedBy: user.id,
            deliveryDateProposedAt: new Date(),
            // Önerilen tarihi geçici olarak scheduledDeliveryDate'e yaz, kabul edilince kesinleşir
            scheduledDeliveryDate: proposedDateTime,
            deliveryDateAcceptedBy: null,
            deliveryDateAcceptedAt: null
          }
        })

        // Karşı tarafa mesaj gönder
        const formattedDate = proposedDateTime.toLocaleDateString('tr-TR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })

        await prisma.message.create({
          data: {
            senderId: user.id,
            receiverId: otherUserId,
            content: `📅 Takas için yeni teslim tarihi önerildi: ${formattedDate}\n\n"${swap.product.title}" takası için yeni teslim tarihi önerisini kabul etmek için "Onayla" butonuna tıklayın.`,
            productId: swap.productId,
            swapRequestId: swapId,
            isModerated: true,
            moderationResult: 'approved',
            metadata: JSON.stringify({ 
              type: 'delivery_date_proposal', 
              proposedDate: proposedDateTime.toISOString()
            })
          }
        })

        // Push bildirim
        try {
          await sendPushToUser(otherUserId, NotificationTypes.SYSTEM, {
            title: '📅 Yeni Teslim Tarihi Önerildi',
            body: `"${swap.product.title}" için ${formattedDate} tarihi önerildi.`,
            url: '/takas-firsatlari'
          })
        } catch (pushErr) {
          console.error('[Delivery Date] Push gönderim hatası (propose):', pushErr)
        }

        return NextResponse.json({
          success: true,
          message: 'Teslim tarihi önerisi gönderildi. Karşı tarafın onayı bekleniyor.',
          proposedDate: proposedDateTime.toISOString()
        })
      }

      // ─────────────────────────────────────────────────────────────
      // AKSİYON: ACCEPT - Önerilen teslim tarihini kabul et
      // ─────────────────────────────────────────────────────────────
      if (action === 'accept') {
        // Öneri var mı kontrol et
        if (!swap.deliveryDateProposedBy || !swap.scheduledDeliveryDate) {
          return NextResponse.json({ error: 'Kabul edilecek teslim tarihi önerisi yok' }, { status: 400 })
        }

        // Kendi önerisini kabul edemez
        if (swap.deliveryDateProposedBy === user.id) {
          return NextResponse.json({ error: 'Kendi önerinizi kabul edemezsiniz' }, { status: 400 })
        }

        // Kabul et
        await prisma.swapRequest.update({
          where: { id: swapId },
          data: {
            deliveryDateAcceptedBy: user.id,
            deliveryDateAcceptedAt: new Date(),
            lastOverdueNotificationAt: null // Reset overdue notification
          }
        })

        const formattedDate = swap.scheduledDeliveryDate.toLocaleDateString('tr-TR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })

        // Karşı tarafa mesaj gönder
        await prisma.message.create({
          data: {
            senderId: user.id,
            receiverId: otherUserId,
            content: `✅ Teslim tarihi kabul edildi!\n\n"${swap.product.title}" takası için teslim tarihi kesinleşti:\n📅 ${formattedDate}`,
            productId: swap.productId,
            swapRequestId: swapId,
            isModerated: true,
            moderationResult: 'approved',
            metadata: JSON.stringify({ 
              type: 'delivery_date_accepted', 
              acceptedDate: swap.scheduledDeliveryDate.toISOString()
            })
          }
        })

        // Push bildirim
        try {
          await sendPushToUser(otherUserId, NotificationTypes.SYSTEM, {
            title: '✅ Teslim Tarihi Onaylandı',
            body: `"${swap.product.title}" için teslim tarihi kesinleşti: ${formattedDate}`,
            url: '/takas-firsatlari'
          })
        } catch (pushErr) {
          console.error('[Delivery Date] Push gönderim hatası (accept):', pushErr)
        }

        return NextResponse.json({
          success: true,
          message: 'Teslim tarihi kabul edildi!',
          acceptedDate: swap.scheduledDeliveryDate.toISOString()
        })
      }

      // ─────────────────────────────────────────────────────────────
      // AKSİYON: REJECT - Önerilen teslim tarihini reddet
      // ─────────────────────────────────────────────────────────────
      if (action === 'reject') {
        // Öneri var mı kontrol et
        if (!swap.deliveryDateProposedBy || !swap.scheduledDeliveryDate) {
          return NextResponse.json({ error: 'Reddedilecek teslim tarihi önerisi yok' }, { status: 400 })
        }

        // Kendi önerisini reddedemez
        if (swap.deliveryDateProposedBy === user.id) {
          return NextResponse.json({ error: 'Kendi önerinizi reddedemezsiniz' }, { status: 400 })
        }

        // Reddet - önerilen tarihi temizle
        await prisma.swapRequest.update({
          where: { id: swapId },
          data: {
            deliveryDateProposedBy: null,
            deliveryDateProposedAt: null,
            scheduledDeliveryDate: null,
            deliveryDateAcceptedBy: null,
            deliveryDateAcceptedAt: null
          }
        })

        // Öneren tarafa mesaj gönder
        await prisma.message.create({
          data: {
            senderId: user.id,
            receiverId: otherUserId,
            content: `❌ Önerilen teslim tarihi reddedildi.\n\n"${swap.product.title}" takası için lütfen yeni bir tarih önerin.`,
            productId: swap.productId,
            swapRequestId: swapId,
            isModerated: true,
            moderationResult: 'approved',
            metadata: JSON.stringify({ 
              type: 'delivery_date_rejected'
            })
          }
        })

        // Push bildirim
        try {
          await sendPushToUser(otherUserId, NotificationTypes.SYSTEM, {
            title: '❌ Teslim Tarihi Reddedildi',
            body: `"${swap.product.title}" için önerdiğiniz teslim tarihi reddedildi.`,
            url: '/takas-firsatlari'
          })
        } catch (pushErr) {
          console.error('[Delivery Date] Push gönderim hatası (reject):', pushErr)
        }

        return NextResponse.json({
          success: true,
          message: 'Teslim tarihi önerisi reddedildi.'
        })
      }

      return NextResponse.json({ error: 'Geçersiz aksiyon' }, { status: 400 })
    }

    // ═══════════════════════════════════════════════════════════════
    // ÇOKLU TAKAS (MULTI-SWAP) İÇİN TESLİM TARİHİ YÖNETİMİ
    // ═══════════════════════════════════════════════════════════════
    if (multiSwapId) {
      const multiSwap = await prisma.multiSwap.findUnique({
        where: { id: multiSwapId },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              givesProduct: true
            }
          }
        }
      })

      if (!multiSwap) {
        return NextResponse.json({ error: 'Çoklu takas bulunamadı' }, { status: 404 })
      }

      const isParticipant = multiSwap.participants.some(p => p.userId === user.id)
      if (!isParticipant) {
        return NextResponse.json({ error: 'Bu çoklu takasa erişim yetkiniz yok' }, { status: 403 })
      }

      // Çoklu takas için teslim tarihi yönetimi
      // meetingDetails alanında JSON olarak tarih bilgisi saklanabilir
      if (action === 'propose') {
        if (!proposedDate) {
          return NextResponse.json({ error: 'Teslim tarihi gerekli' }, { status: 400 })
        }

        const proposedDateTime = new Date(proposedDate)
        
        if (proposedDateTime < new Date()) {
          return NextResponse.json({ error: 'Geçmiş bir tarih seçilemez' }, { status: 400 })
        }

        const meetingDetails = multiSwap.meetingDetails ? JSON.parse(multiSwap.meetingDetails) : {}
        meetingDetails.proposedDeliveryDate = proposedDateTime.toISOString()
        meetingDetails.proposedBy = user.id
        meetingDetails.proposedAt = new Date().toISOString()
        meetingDetails.acceptedBy = []

        await prisma.multiSwap.update({
          where: { id: multiSwapId },
          data: {
            meetingDetails: JSON.stringify(meetingDetails)
          }
        })

        const formattedDate = proposedDateTime.toLocaleDateString('tr-TR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })

        // Tüm katılımcılara bildirim gönder (öneren hariç)
        for (const participant of multiSwap.participants) {
          if (participant.userId !== user.id) {
            try {
              await sendPushToUser(participant.userId, NotificationTypes.SYSTEM, {
                title: '📅 Yeni Teslim Tarihi Önerildi',
                body: `Çoklu takas için ${formattedDate} tarihi önerildi.`,
                url: '/takas-firsatlari'
              })
            } catch (pushErr) {
              console.error('[Delivery Date] Push gönderim hatası (multi-swap propose):', pushErr)
            }
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Teslim tarihi önerisi tüm katılımcılara gönderildi.',
          proposedDate: proposedDateTime.toISOString()
        })
      }

      // Çoklu takas için kabul
      if (action === 'accept') {
        const meetingDetails = multiSwap.meetingDetails ? JSON.parse(multiSwap.meetingDetails) : {}
        
        if (!meetingDetails.proposedDeliveryDate) {
          return NextResponse.json({ error: 'Kabul edilecek teslim tarihi yok' }, { status: 400 })
        }

        if (meetingDetails.proposedBy === user.id) {
          return NextResponse.json({ error: 'Kendi önerinizi kabul edemezsiniz' }, { status: 400 })
        }

        meetingDetails.acceptedBy = meetingDetails.acceptedBy || []
        if (!meetingDetails.acceptedBy.includes(user.id)) {
          meetingDetails.acceptedBy.push(user.id)
        }

        // Tüm katılımcılar kabul etti mi kontrol et
        const otherParticipants = multiSwap.participants.filter(p => p.userId !== meetingDetails.proposedBy)
        const allAccepted = otherParticipants.every(p => meetingDetails.acceptedBy.includes(p.userId))

        if (allAccepted) {
          meetingDetails.confirmedDeliveryDate = meetingDetails.proposedDeliveryDate
          meetingDetails.confirmedAt = new Date().toISOString()
        }

        await prisma.multiSwap.update({
          where: { id: multiSwapId },
          data: {
            meetingDetails: JSON.stringify(meetingDetails)
          }
        })

        return NextResponse.json({
          success: true,
          message: allAccepted 
            ? 'Tüm katılımcılar onayladı! Teslim tarihi kesinleşti.' 
            : 'Onayınız kaydedildi. Diğer katılımcıların onayı bekleniyor.',
          allAccepted,
          acceptedCount: meetingDetails.acceptedBy.length,
          totalRequired: otherParticipants.length
        })
      }

      return NextResponse.json({ error: 'Geçersiz aksiyon' }, { status: 400 })
    }

    return NextResponse.json({ error: 'swapId veya multiSwapId gerekli' }, { status: 400 })
  } catch (error: any) {
    console.error('Delivery date error:', error)
    return NextResponse.json(
      { error: 'Teslim tarihi işlemi başarısız: ' + error.message },
      { status: 500 }
    )
  }
}

// GET: Teslim tarihi geçmiş takasları kontrol et
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const now = new Date()
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000)

    // Aktif statüler
    const activeStatuses = [
      'accepted',
      'negotiating',
      'delivery_proposed',
      'awaiting_delivery',
      'qr_generated', // legacy uyumluluk
      'delivered',
      'arrived',
      'qr_scanned',
      'inspection',
      'code_sent'
    ]

    // Kullanıcının aktif takaslarını getir
    const userSwaps = await prisma.swapRequest.findMany({
      where: {
        OR: [
          { requesterId: user.id },
          { ownerId: user.id }
        ],
        status: { in: activeStatuses }
      },
      select: {
        id: true,
        status: true,
        scheduledDeliveryDate: true,
        deliveryDateProposedBy: true,
        deliveryDateAcceptedBy: true,
        lastOverdueNotificationAt: true,
        product: { select: { title: true } }
      }
    })

    // 6 saat geçmiş olanları filtrele
    const overdueSwaps = userSwaps.filter(swap => {
      if (!swap.scheduledDeliveryDate || !swap.deliveryDateAcceptedBy) return false
      return swap.scheduledDeliveryDate < sixHoursAgo
    })

    // Pending date proposals (kabul bekleyen)
    const pendingDateProposals = userSwaps.filter(swap => {
      return swap.deliveryDateProposedBy && 
             swap.deliveryDateProposedBy !== user.id && 
             !swap.deliveryDateAcceptedBy
    })

    return NextResponse.json({
      overdueSwaps: overdueSwaps.map(s => ({
        id: s.id,
        productTitle: s.product.title,
        scheduledDate: s.scheduledDeliveryDate,
        hoursOverdue: Math.floor((now.getTime() - s.scheduledDeliveryDate!.getTime()) / (60 * 60 * 1000))
      })),
      pendingDateProposals: pendingDateProposals.map(s => ({
        id: s.id,
        productTitle: s.product.title,
        proposedDate: s.scheduledDeliveryDate
      })),
      timestamp: now.toISOString()
    })
  } catch (error: any) {
    console.error('[Delivery Date] GET error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
