import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

// ═══ EMAIL RETRY MEKANİZMASI ═══
async function sendEmailWithRetry(
  emailFn: () => Promise<any>, 
  maxRetries: number = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await emailFn()
      return true
    } catch (error) {
      console.error(`Email gönderim hatası (deneme ${attempt}/${maxRetries}):`, error)
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
      }
    }
  }
  console.error('Email gönderilemedi — tüm denemeler başarısız')
  return false
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, nickname: true, email: true }
    })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const { swapRequestId, action, code, deliveryType } = await req.json()

    if (!swapRequestId || !action) {
      return NextResponse.json({ error: 'swapRequestId ve action gerekli' }, { status: 400 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      include: {
        product: { select: { id: true, title: true } },
        offeredProduct: { select: { id: true, title: true } },
        owner: { select: { id: true, name: true, nickname: true, email: true } },
        requester: { select: { id: true, name: true, nickname: true, email: true } },
      }
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    const isRequester = swapRequest.requesterId === user.id
    const isOwner = swapRequest.ownerId === user.id
    if (!isRequester && !isOwner) {
      return NextResponse.json({ error: 'Bu takas size ait değil' }, { status: 403 })
    }

    const otherUserId = isRequester ? swapRequest.ownerId : swapRequest.requesterId
    const userName = user.nickname || user.name || 'Kullanıcı'

    // ═══ ARRIVED — Teslimat noktasına geldi (ÇİFT TARAFLI) ═══
    if (action === 'arrived') {
      // qr_generated durumunda olmalı (bir taraf geldiğinde status hala qr_generated kalır)
      if (swapRequest.status !== 'qr_generated') {
        // Zaten arrived olabilir mi kontrol et
        if (swapRequest.status === 'arrived') {
          return NextResponse.json({ error: 'Her iki taraf da zaten geldi' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Bu takas teslimat aşamasında değil' }, { status: 400 })
      }

      // Kimin geldiğini belirle
      const updateData: any = {}
      if (isOwner) {
        if (swapRequest.ownerArrived) {
          return NextResponse.json({ error: 'Zaten geldiğinizi bildirdiniz' }, { status: 400 })
        }
        updateData.ownerArrived = true
      } else {
        if (swapRequest.requesterArrived) {
          return NextResponse.json({ error: 'Zaten geldiğinizi bildirdiniz' }, { status: 400 })
        }
        updateData.requesterArrived = true
      }

      // Güncellenmiş değerleri hesapla
      const newOwnerArrived = isOwner ? true : (swapRequest.ownerArrived || false)
      const newRequesterArrived = isRequester ? true : (swapRequest.requesterArrived || false)

      // İKİSİ DE GELDİYSE → status: arrived
      if (newOwnerArrived && newRequesterArrived) {
        updateData.status = 'arrived'
      }
      // Sadece biri geldiyse status değişmez ama alan güncellenir

      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: updateData,
      })

      // Bildirimler
      if (newOwnerArrived && newRequesterArrived) {
        // İkisi de geldi — her ikisine mesaj
        const msg = `✅ Her iki taraf da teslimat noktasına geldi! Şimdi QR kodu taratabilirsiniz.`
        await prisma.message.createMany({
          data: [
            {
              senderId: user.id,
              receiverId: swapRequest.ownerId,
              content: msg,
              productId: swapRequest.productId,
              isModerated: true,
              moderationResult: 'approved',
            },
            {
              senderId: user.id,
              receiverId: swapRequest.requesterId,
              content: msg,
              productId: swapRequest.productId,
              isModerated: true,
              moderationResult: 'approved',
            }
          ]
        })
      } else {
        // Sadece biri geldi — karşı tarafa bildir
        await prisma.message.create({
          data: {
            senderId: user.id,
            receiverId: otherUserId,
            content: `📍 ${userName} teslimat noktasına geldiğini bildirdi! Siz de geldiğinizde "Geldim" butonuna basın.`,
            productId: swapRequest.productId,
            isModerated: true,
            moderationResult: 'approved',
          }
        })
      }

      sendPushToUser(otherUserId, NotificationTypes.SWAP_DELIVERY_SETUP, {
        productTitle: swapRequest.product.title,
        swapId: swapRequestId,
      }).catch(console.error)

      return NextResponse.json({ 
        success: true, 
        message: (newOwnerArrived && newRequesterArrived) 
          ? 'İki taraf da geldi! QR tarama başlayabilir.' 
          : 'Geldiğiniz bildirildi. Karşı tarafı bekliyorsunuz.',
        bothArrived: newOwnerArrived && newRequesterArrived,
        ownerArrived: newOwnerArrived,
        requesterArrived: newRequesterArrived,
      })
    }

    // ═══ START_INSPECTION — Alıcı ürünü kontrol etmeye başladı ═══
    if (action === 'start_inspection') {
      if (swapRequest.status !== 'qr_scanned') {
        return NextResponse.json({ error: 'Önce QR kod taranmalı' }, { status: 400 })
      }

      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: { status: 'inspection' }
      })

      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: otherUserId,
          content: `🔍 ${userName} ürünü kontrol ediyor. Lütfen bekleyin.`,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      return NextResponse.json({ success: true, message: 'Kontrol başladı' })
    }

    // ═══ APPROVE_PRODUCT — Alıcı ürünü onayladı ═══
    if (action === 'approve_product') {
      if (swapRequest.status !== 'inspection') {
        return NextResponse.json({ error: 'Ürün kontrol aşamasında olmalı' }, { status: 400 })
      }

      // ALICI İSE ALIM FOTOĞRAFI ZORUNLU
      const hasReceivingPhotos = swapRequest.receivingPhotos && swapRequest.receivingPhotos.length > 0
      if (!hasReceivingPhotos) {
        return NextResponse.json({ 
          error: 'Alım fotoğrafı zorunludur. Lütfen önce fotoğraf yükleyin.' 
        }, { status: 400 })
      }

      // ═══ DROP-OFF AKIŞI: Alıcı zaten teslim kodunu girdi (picked_up'da) ═══
      // Ürünü onayladığında DİREKT completed olsun, code_sent adımı atlanır
      if (swapRequest.deliveryType === 'drop_off') {
        await prisma.swapRequest.update({
          where: { id: swapRequestId },
          data: { 
            status: 'completed',
          }
        })

        // Her iki tarafa tamamlanma mesajı
        const completionMsg = `🎉 TAKAS GÜVENLİ BİR ŞEKİLDE TAMAMLANDI!\n\n📦 Ürün: ${swapRequest.product.title}\n✅ Alıcı ürünü onayladı.\n\n⭐ Lütfen karşı tarafı değerlendirmeyi unutmayın!\n\nTeşekkürler, TAKAS-A 💜`

        await prisma.message.create({
          data: {
            senderId: user.id,
            receiverId: swapRequest.ownerId,
            content: completionMsg,
            productId: swapRequest.productId,
            isModerated: true,
            moderationResult: 'approved',
          }
        })

        await prisma.message.create({
          data: {
            senderId: user.id,
            receiverId: swapRequest.requesterId,
            content: completionMsg,
            productId: swapRequest.productId,
            isModerated: true,
            moderationResult: 'approved',
          }
        })

        sendPushToUser(otherUserId, NotificationTypes.SWAP_COMPLETED, {
          productTitle: swapRequest.product.title,
          swapId: swapRequestId,
        }).catch(console.error)

        return NextResponse.json({ success: true, message: 'Takas tamamlandı!' })
      }

      // ═══ FACE-TO-FACE AKIŞI: 6 haneli kod iletilir, satıcı doğrular ═══
      const verificationCode = swapRequest.deliveryVerificationCode
      if (!verificationCode) {
        return NextResponse.json({ error: 'Doğrulama kodu bulunamadı' }, { status: 400 })
      }

      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: { status: 'code_sent' }
      })

      // Alıcıya kendi mesajlarına kodu gönder
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: user.id, // KENDİSİNE
          content: `🔑 Doğrulama Kodunuz: ${verificationCode}\n\n📦 Bu kodu satıcıya söyleyin.\n⚠️ Kodu sadece yüz yüze paylaşın!`,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      // Satıcıya bildirim
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: otherUserId,
          content: `✅ ${userName} ürünü onayladı! Şimdi alıcıdan 6 haneli doğrulama kodunu isteyin ve Takas Merkezi'ne girin.`,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      sendPushToUser(otherUserId, NotificationTypes.SWAP_CONFIRMED, {
        productTitle: swapRequest.product.title,
        swapId: swapRequestId,
      }).catch(console.error)

      return NextResponse.json({ 
        success: true, 
        message: 'Ürün onaylandı, kod iletildi',
        verificationCode 
      })
    }

    // ═══ VERIFY_CODE — Satıcı 6 haneli kodu doğrular → TAMAMLA ═══
    if (action === 'verify_code') {
      if (swapRequest.status !== 'code_sent') {
        return NextResponse.json({ error: 'Kod iletilmiş olmalı' }, { status: 400 })
      }

      if (!code) {
        return NextResponse.json({ error: '6 haneli kodu girin' }, { status: 400 })
      }

      // Doğrulama kodu kontrolü
      const validCode = swapRequest.deliveryVerificationCode
      if (code !== validCode) {
        return NextResponse.json({ error: 'Doğrulama kodu yanlış!' }, { status: 400 })
      }

      // Takası tamamla
      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: { 
          status: 'completed',
        }
      })

      // Her iki tarafa tamamlanma mesajı
      const completionMsg = `🎉 TAKAS GÜVENLİ BİR ŞEKİLDE TAMAMLANDI!\n\n📦 Ürün: ${swapRequest.product.title}\n✅ Doğrulama kodu eşleşti.\n\n⭐ Lütfen karşı tarafı değerlendirmeyi unutmayın!\n\nTeşekkürler, TAKAS-A 💜`

      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: swapRequest.ownerId,
          content: completionMsg,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: swapRequest.requesterId,
          content: completionMsg,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      // Push bildirimi
      sendPushToUser(otherUserId, NotificationTypes.SWAP_COMPLETED, {
        productTitle: swapRequest.product.title,
        swapId: swapRequestId,
      }).catch(console.error)

      return NextResponse.json({ success: true, message: 'Takas tamamlandı!' })
    }

    // ═══ DISPUTE — Sorun bildirildi ═══
    if (action === 'dispute') {
      if (!['qr_scanned', 'inspection', 'arrived'].includes(swapRequest.status)) {
        return NextResponse.json({ error: 'Bu aşamada sorun bildirilemez' }, { status: 400 })
      }

      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: { status: 'disputed' }
      })

      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: otherUserId,
          content: `⚠️ ${userName} bir sorun bildirdi. Destek ekibi inceleme başlatacak.`,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      sendPushToUser(otherUserId, NotificationTypes.SWAP_DISPUTE, {
        productTitle: swapRequest.product.title,
        swapId: swapRequestId,
      }).catch(console.error)

      return NextResponse.json({ success: true, message: 'Sorun bildirildi' })
    }

    // ═══ SET_DELIVERY_TYPE — Teslimat yöntemi seç ═══
    if (action === 'set_delivery_type') {
      if (!['face_to_face', 'drop_off'].includes(deliveryType)) {
        return NextResponse.json({ error: 'Geçersiz teslimat yöntemi' }, { status: 400 })
      }
      
      if (swapRequest.status !== 'accepted') {
        return NextResponse.json({ error: 'Takas kabul edilmiş olmalı' }, { status: 400 })
      }

      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: { deliveryType }
      })

      // Karşı tarafa bildirim
      const typeLabel = deliveryType === 'face_to_face' ? 'Buluşma' : 'Teslim Noktasına Bırakma'
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: otherUserId,
          content: `📦 ${userName} teslimat yöntemi olarak "${typeLabel}" seçti. Şimdi teslimat noktasını belirleyin.`,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      return NextResponse.json({ success: true, message: `Teslimat yöntemi: ${typeLabel}` })
    }

    // ═══ DROP_OFF — Satıcı ürünü teslim noktasına bıraktı ═══
    if (action === 'drop_off') {
      if (swapRequest.deliveryType !== 'drop_off') {
        return NextResponse.json({ error: 'Bu takas buluşma yöntemiyle planlandı' }, { status: 400 })
      }
      if (!isOwner) {
        return NextResponse.json({ error: 'Sadece satıcı ürünü bırakabilir' }, { status: 403 })
      }
      if (swapRequest.status !== 'qr_generated') {
        return NextResponse.json({ error: 'Önce QR kod oluşturulmalı' }, { status: 400 })
      }

      // 3 iş günü hesapla
      const now = new Date()
      const deadline = new Date(now)
      let businessDays = 0
      while (businessDays < 3) {
        deadline.setDate(deadline.getDate() + 1)
        const day = deadline.getDay()
        if (day !== 0 && day !== 6) businessDays++ // Haftasonu hariç
      }

      // 6 haneli teslim kodu oluştur
      const pickupCode = Math.floor(100000 + Math.random() * 900000).toString()

      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: { 
          status: 'dropped_off',
          droppedOffAt: now,
          dropOffDeadline: deadline,
          deliveryVerificationCode: pickupCode, // Drop-off teslim kodu
        }
      })

      // Alıcıya kodu mesajla gönder
      const locationText = swapRequest.customLocation || 'Teslim noktası'
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: swapRequest.requesterId,
          content: `📦 Ürün teslim noktasına bırakıldı!\n\n📍 Konum: ${locationText}\n🔑 Teslim Kodu: ${pickupCode}\n⏰ Son tarih: ${deadline.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n⚠️ Ürünü alırken bu kodu girmeniz gerekecek.`,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      sendPushToUser(swapRequest.requesterId, NotificationTypes.SWAP_DELIVERY_SETUP, {
        productTitle: swapRequest.product.title,
        swapId: swapRequestId,
      }).catch(console.error)

      return NextResponse.json({ success: true, message: 'Ürün bırakıldı', dropOffDeadline: deadline })
    }

    // ═══ PICKED_UP — Alıcı ürünü teslim noktasından aldı ═══
    if (action === 'picked_up') {
      if (swapRequest.status !== 'dropped_off') {
        return NextResponse.json({ error: 'Ürün henüz bırakılmamış' }, { status: 400 })
      }
      if (!isRequester) {
        return NextResponse.json({ error: 'Sadece alıcı ürünü alabilir' }, { status: 403 })
      }

      // Teslim kodu doğrulama (drop-off için zorunlu)
      if (swapRequest.deliveryVerificationCode && swapRequest.deliveryType === 'drop_off') {
        if (!code) {
          return NextResponse.json({ error: '6 haneli teslim kodunu girin' }, { status: 400 })
        }
        if (code !== swapRequest.deliveryVerificationCode) {
          return NextResponse.json({ error: 'Teslim kodu yanlış' }, { status: 400 })
        }
      }

      // Sonraki adım: inspection (alıcı kontrol eder)
      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: { 
          status: 'inspection',
          pickedUpAt: new Date(),
        }
      })

      // Satıcıya bildirim
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: swapRequest.ownerId,
          content: `✅ ${userName} ürünü teslim noktasından aldı ve kontrol ediyor.`,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      sendPushToUser(swapRequest.ownerId, NotificationTypes.SWAP_QR_SCANNED, {
        productTitle: swapRequest.product.title,
        swapId: swapRequestId,
      }).catch(console.error)

      return NextResponse.json({ success: true, message: 'Ürün alındı, kontrol başladı' })
    }

    return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 })

  } catch (error) {
    console.error('Swap status error:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}