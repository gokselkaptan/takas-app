import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'

// POST: Teslimat ayarlarını kaydet (karşılıklı anlaşma sistemi)
// action: 'set_delivery_method' - Teslimat yöntemini seç (canonical deliveryMethod)
// action: 'propose' - Teslimat noktası öner
// action: 'accept' - Karşı tarafın önerisini kabul et
// action: 'counter' - Karşı öneri yap
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }
    
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true },
    })
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    const { 
      swapRequestId, 
      action = 'propose', // 'propose' | 'accept' | 'counter'
      deliveryMethod, 
      deliveryPointId, 
      customLocation, 
      senderPhotos,
      deliveryDate,
      deliveryTime 
    } = await request.json()

    if (!swapRequestId) {
      return NextResponse.json({ error: 'Takas ID gerekli' }, { status: 400 })
    }

    // Takas isteğini kontrol et
    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      include: {
        product: { select: { id: true, title: true } },
        offeredProduct: { select: { id: true, title: true } },
        owner: { select: { id: true, name: true, email: true } },
        requester: { select: { id: true, name: true, email: true } },
      },
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas isteği bulunamadı' }, { status: 404 })
    }

    const isOwner = swapRequest.ownerId === currentUser.id
    const isRequester = swapRequest.requesterId === currentUser.id

    if (!isOwner && !isRequester) {
      return NextResponse.json({ error: 'Bu takasa erişim yetkiniz yok' }, { status: 403 })
    }

    // Son teslimat önerisini StatusLog'dan al
    const lastProposalLog = await prisma.swapStatusLog.findFirst({
      where: { 
        swapRequestId, 
        reason: { startsWith: 'DELIVERY_PROPOSAL|' }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    let lastProposal: any = null
    if (lastProposalLog?.reason) {
      try {
        const proposalJson = lastProposalLog.reason.replace('DELIVERY_PROPOSAL|', '')
        lastProposal = JSON.parse(proposalJson)
      } catch (e) {
        lastProposal = null
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // AKSİYON: TESLİMAT YÖNTEMİ SEÇ (set_delivery_method)
    // UI -> API mapping frontend'de yapılır, backend sadece canonical kabul eder:
    // custom_location | delivery_point
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'set_delivery_method') {
      if (!deliveryMethod || !['delivery_point', 'custom_location'].includes(deliveryMethod)) {
        return NextResponse.json({ error: 'Geçerli bir teslimat yöntemi seçin' }, { status: 400 })
      }

      if (!['accepted', 'delivery_proposed'].includes(swapRequest.status)) {
        if (swapRequest.status === 'awaiting_delivery') {
          return NextResponse.json({ error: 'Teslimat zaten ayarlanmış' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Bu takas için teslimat yöntemi değiştirilemez' }, { status: 400 })
      }

      const uiDeliveryType = deliveryMethod === 'delivery_point' ? 'drop_off' : 'face_to_face'

      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: {
          deliveryMethod,
          deliveryType: uiDeliveryType,
        },
      })

      await prisma.swapStatusLog.create({
        data: {
          swapRequestId,
          fromStatus: swapRequest.status,
          toStatus: swapRequest.status,
          changedBy: currentUser.id,
          reason: `DELIVERY_METHOD_SET|${JSON.stringify({ deliveryMethod, deliveryType: uiDeliveryType, changedAt: new Date().toISOString() })}`,
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Teslimat yöntemi güncellendi',
      })
    }

    // ═══════════════════════════════════════════════════════════════════
    // AKSİYON: KABUL ET (accept) - Karşı tarafın teslimat önerisini kabul et
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'accept') {
      // Öneri var mı kontrol et
      if (!lastProposal) {
        return NextResponse.json({ error: 'Kabul edilecek teslimat önerisi bulunamadı' }, { status: 400 })
      }

      // Öneriyi yapan kişi kendisi olamaz
      if (lastProposal.proposedBy === currentUser.id) {
        return NextResponse.json({ error: 'Kendi önerinizi kabul edemezsiniz' }, { status: 400 })
      }

      // Idempotency guard: zaten teslim doğrulama aşamasındaysa side-effect'leri tekrar çalıştırma
      if (['awaiting_delivery', 'delivered', 'completed'].includes(swapRequest.status)) {
        return NextResponse.json({ success: true, message: 'Teslimat zaten onaylanmış' })
      }

      // Teslimat noktası bilgisini al
      let deliveryPointName: string | null = null
      if (lastProposal.deliveryMethod === 'delivery_point' && lastProposal.deliveryPointId) {
        const deliveryPoint = await prisma.deliveryPoint.findUnique({
          where: { id: lastProposal.deliveryPointId },
        })
        deliveryPointName = deliveryPoint?.name || null
      }

      // Canonical state: sadece awaiting_delivery'e geç, legacy QR alanlarını temizle
      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: {
          deliveryMethod: lastProposal.deliveryMethod,
          deliveryPointId: lastProposal.deliveryPointId || null,
          customLocation: lastProposal.customLocation || null,
          status: 'awaiting_delivery',
          qrCode: null,
          qrCodeB: null,
          qrCodeGeneratedAt: null,
          deliveryVerificationCode: null,
          deliveryVerificationCodeB: null,
        },
      })

      // StatusLog'a kaydet
      await prisma.swapStatusLog.create({
        data: {
          swapRequestId,
          fromStatus: swapRequest.status,
          toStatus: 'awaiting_delivery',
          changedBy: currentUser.id,
          reason: `DELIVERY_ACCEPTED|${JSON.stringify({ acceptedBy: currentUser.id, acceptedAt: new Date().toISOString() })}`,
        }
      })

      const locationText = deliveryPointName || lastProposal.customLocation || 'Belirtilmedi'
      const meetingDate = lastProposal.deliveryDate || 'Belirtilmedi'
      const meetingTime = lastProposal.deliveryTime || 'Belirtilmedi'

      const ownerMessage = `🤝 TESLİMAT ANLAŞMASI SAĞLANDI!

📦 Ürün: "${swapRequest.product.title}"

📍 Buluşma Yeri: ${locationText}
📅 Tarih: ${meetingDate}
⏰ Saat: ${meetingTime}

🔐 Teslim doğrulama artık yalnızca Shape Code ile yapılır.
💬 Sohbet panelinden şekil kodu oluşturup paylaşın.

İyi takaslar! 🎉`

      const requesterMessage = `🤝 TESLİMAT ANLAŞMASI SAĞLANDI!

📦 Alacağınız Ürün: "${swapRequest.product.title}"

📍 Buluşma Yeri: ${locationText}
📅 Tarih: ${meetingDate}
⏰ Saat: ${meetingTime}

🔐 Teslim doğrulama artık yalnızca Shape Code ile yapılır.
💬 Sohbet panelinden satıcının oluşturduğu şekil kodunu doğrulayın.

İyi takaslar! 🎉`

      await prisma.message.create({
        data: {
          senderId: swapRequest.requesterId,
          receiverId: swapRequest.ownerId,
          content: ownerMessage,
          productId: swapRequest.productId,
          swapRequestId: swapRequest.id,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      await prisma.message.create({
        data: {
          senderId: swapRequest.ownerId,
          receiverId: swapRequest.requesterId,
          content: requesterMessage,
          productId: swapRequest.productId,
          swapRequestId: swapRequest.id,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      sendPushToUser(
        swapRequest.ownerId,
        NotificationTypes.SWAP_DELIVERY_SETUP,
        {
          productTitle: swapRequest.product.title,
          swapId: swapRequestId,
          location: locationText
        }
      ).catch(err => console.error('Push notification error:', err))

      sendPushToUser(
        swapRequest.requesterId,
        NotificationTypes.SWAP_DELIVERY_SETUP,
        {
          productTitle: swapRequest.product.title,
          swapId: swapRequestId,
          location: locationText
        }
      ).catch(err => console.error('Push notification error:', err))

      return NextResponse.json({
        success: true,
        message: '✅ Teslimat noktası anlaşması sağlandı! Durum teslim doğrulama aşamasına geçti.',
        deliveryLocation: locationText,
        deliveryDate: lastProposal.deliveryDate,
        deliveryTime: lastProposal.deliveryTime,
        instructions: [
          'Teslimat anlaşması sağlandı',
          'Belirlenen tarih ve saatte buluşun',
          'Teslim doğrulamayı sohbet panelindeki Shape Code ile tamamlayın'
        ]
      })
    }

    // ═══════════════════════════════════════════════════════════════════
    // AKSİYON: ÖNER (propose) veya KARŞI ÖNERİ (counter)
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'propose' || action === 'counter') {
      // Validasyonlar
      if (!deliveryMethod || !['delivery_point', 'custom_location'].includes(deliveryMethod)) {
        return NextResponse.json({ error: 'Geçerli bir teslimat yöntemi seçin' }, { status: 400 })
      }

      if (deliveryMethod === 'delivery_point' && !deliveryPointId) {
        return NextResponse.json({ error: 'Teslim noktası seçin' }, { status: 400 })
      }

      if (deliveryMethod === 'custom_location' && !customLocation) {
        return NextResponse.json({ error: 'Buluşma noktası belirtin' }, { status: 400 })
      }

      // Status kontrolü - accepted veya delivery_proposed olmalı
      if (!['accepted', 'delivery_proposed'].includes(swapRequest.status)) {
        if (swapRequest.status === 'awaiting_delivery') {
          return NextResponse.json({ error: 'Teslimat zaten ayarlanmış' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Bu takas için teslimat ayarlanamaz' }, { status: 400 })
      }

      // Fotoğraf opsiyonel — her iki taraf da öneri yapabilir
      if (senderPhotos && Array.isArray(senderPhotos) && senderPhotos.length > 5) {
        return NextResponse.json({ error: 'En fazla 5 fotoğraf yükleyebilirsiniz' }, { status: 400 })
      }

      // Teslimat noktası bilgisini al
      let deliveryPointName: string | null = null
      if (deliveryMethod === 'delivery_point' && deliveryPointId) {
        const deliveryPoint = await prisma.deliveryPoint.findUnique({
          where: { id: deliveryPointId },
        })
        if (!deliveryPoint) {
          return NextResponse.json({ error: 'Teslim noktası bulunamadı' }, { status: 404 })
        }
        deliveryPointName = deliveryPoint.name
      }

      // Öneriyi StatusLog'a kaydet
      const newProposal = {
        proposedBy: currentUser.id,
        proposedByName: currentUser.name,
        proposedAt: new Date().toISOString(),
        deliveryMethod,
        deliveryPointId: deliveryMethod === 'delivery_point' ? deliveryPointId : null,
        deliveryPointName,
        customLocation: deliveryMethod === 'custom_location' ? customLocation : null,
        deliveryDate: deliveryDate || null,
        deliveryTime: deliveryTime || null,
        isCounterProposal: action === 'counter',
      }

      // Güncelle
      const updateData: any = {
        status: 'delivery_proposed',
        deliveryMethod,
        deliveryType: deliveryMethod === 'delivery_point' ? 'drop_off' : 'face_to_face',
        deliveryPointId: deliveryMethod === 'delivery_point' ? deliveryPointId : null,
        customLocation: deliveryMethod === 'custom_location' ? customLocation : null,
      }

      // Fotoğrafları kaydet (opsiyonel)
      if (senderPhotos && Array.isArray(senderPhotos) && senderPhotos.length > 0) {
        updateData.senderPhotos = senderPhotos
      }

      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: updateData,
      })

      // StatusLog'a öneriyi kaydet
      await prisma.swapStatusLog.create({
        data: {
          swapRequestId,
          fromStatus: swapRequest.status,
          toStatus: 'delivery_proposed',
          changedBy: currentUser.id,
          reason: `DELIVERY_PROPOSAL|${JSON.stringify(newProposal)}`,
        }
      })

      // Karşı tarafa mesaj gönder
      const otherUserId = isOwner ? swapRequest.requesterId : swapRequest.ownerId
      const locationText = deliveryPointName || customLocation || 'Belirtilmedi'
      const actionText = action === 'counter' ? 'KARŞI ÖNERİ' : 'TESLİMAT ÖNERİSİ'

      await prisma.message.create({
        data: {
          senderId: currentUser.id,
          receiverId: otherUserId,
          content: `📍 ${actionText}\n\n"${swapRequest.product.title}" ürünü için teslimat noktası önerisi:\n\n📍 Yer: ${locationText}\n📅 Tarih: ${deliveryDate || 'Belirtilmedi'}\n⏰ Saat: ${deliveryTime || 'Belirtilmedi'}\n\n✅ Kabul etmek için "Onayla" butonuna tıklayın\n🔄 Farklı bir yer önermek için "Karşı Öneri" yapın`,
          productId: swapRequest.productId,
          swapRequestId: swapRequest.id,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      // Push bildirim
      sendPushToUser(otherUserId, NotificationTypes.SWAP_DELIVERY_SETUP, {
        productTitle: swapRequest.product.title,
        swapId: swapRequestId,
        location: locationText
      }).catch(err => console.error('Push notification error:', err))

      return NextResponse.json({
        success: true,
        message: action === 'counter' 
          ? '🔄 Karşı öneri gönderildi. Satıcının onayı bekleniyor.'
          : '📍 Teslimat önerisi gönderildi. Alıcının onayı bekleniyor.',
        proposal: newProposal,
        waitingForApproval: true,
        instructions: [
          'Öneri karşı tarafa mesaj olarak gönderildi',
          'Karşı taraf onayladığında durum teslim doğrulama aşamasına geçecek',
          'Karşı taraf farklı bir yer önerebilir'
        ]
      })
    }

    return NextResponse.json({ error: 'Geçersiz aksiyon' }, { status: 400 })
  } catch (error) {
    console.error('Delivery setup error:', error)
    return NextResponse.json({ error: 'Teslimat ayarlanamadı' }, { status: 500 })
  }
}

// GET: Teslimat bilgilerini getir
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }
    
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const swapRequestId = searchParams.get('swapRequestId')

    if (!swapRequestId) {
      return NextResponse.json({ error: 'Takas ID gerekli' }, { status: 400 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      include: {
        product: { select: { id: true, title: true, images: true, valorPrice: true } },
        offeredProduct: { select: { id: true, title: true, images: true, valorPrice: true } },
        owner: { select: { id: true, name: true, image: true } },
        requester: { select: { id: true, name: true, image: true } },
      },
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas isteği bulunamadı' }, { status: 404 })
    }

    // Kullanıcı takas taraflarından biri olmalı
    if (swapRequest.ownerId !== currentUser.id && swapRequest.requesterId !== currentUser.id) {
      return NextResponse.json({ error: 'Bu takas için yetkiniz yok' }, { status: 403 })
    }

    // Teslimat noktası bilgisini al
    let deliveryPoint: { name: string; id: string; city: string; district: string; address: string; } | null = null
    if (swapRequest.deliveryPointId) {
      deliveryPoint = await prisma.deliveryPoint.findUnique({
        where: { id: swapRequest.deliveryPointId },
        select: { id: true, name: true, address: true, city: true, district: true },
      })
    }

    return NextResponse.json({
      ...swapRequest,
      deliveryPoint,
      isOwner: swapRequest.ownerId === currentUser.id,
      isRequester: swapRequest.requesterId === currentUser.id,
    })
  } catch (error) {
    console.error('Delivery info error:', error)
    return NextResponse.json({ error: 'Teslimat bilgisi alınamadı' }, { status: 500 })
  }
}
