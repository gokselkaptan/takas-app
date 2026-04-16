import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'

// QR Kod oluşturma fonksiyonu
function generateQRCode(): string {
  const timestamp = Date.now().toString(36)
  const random = uuidv4().replace(/-/g, '').substring(0, 8)
  return `TAKAS-${timestamp}-${random}`.toUpperCase()
}

// 6 haneli doğrulama kodu oluştur
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Email ile doğrulama kodu gönder
async function sendVerificationEmail(
  receiverEmail: string,
  receiverName: string,
  productTitle: string,
  verificationCode: string,
  senderName: string
) {
  try {
    const appUrl = process.env.NEXTAUTH_URL || 'https://takas-a.com'
    const appName = 'TAKAS-A'

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7C3AED; margin: 0;">💜 TAKAS-A</h1>
          <p style="color: #666; margin: 5px 0;">Teslimat Doğrulama Kodu</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #7C3AED 0%, #F97316 100%); padding: 3px; border-radius: 12px;">
          <div style="background: white; border-radius: 10px; padding: 25px;">
            <p style="margin: 0 0 15px; color: #333;">Merhaba <strong>${receiverName}</strong>,</p>
            
            <p style="margin: 0 0 20px; color: #555;">
              <strong>${senderName}</strong> tarafından gönderilen <strong>"${productTitle}"</strong> ürününü teslim almak için aşağıdaki doğrulama kodunu kullanın:
            </p>
            
            <div style="background: #F3F0FF; border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0;">
              <p style="margin: 0 0 10px; color: #7C3AED; font-size: 14px; font-weight: 500;">Doğrulama Kodunuz:</p>
              <div style="font-size: 36px; font-weight: bold; color: #7C3AED; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                ${verificationCode}
              </div>
            </div>
            
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0;">
              <p style="margin: 0; color: #92400E; font-size: 14px;">
                ⚠️ <strong>Önemli:</strong> Bu kodu sadece ürünü fiziksel olarak teslim aldıktan ve kontrol ettikten sonra sisteme girin. Kod girildikten sonra teslimat onaylanmış sayılır.
              </p>
            </div>
            
            <div style="background: #F0FDF4; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0 0 10px; color: #166534; font-weight: 600;">📸 Teslimat Adımları:</p>
              <ol style="margin: 0; padding-left: 20px; color: #166534; font-size: 14px;">
                <li>Ürünü teslim alın ve kontrol edin</li>
                <li>1-2 fotoğraf çekin (ürün durumu için)</li>
                <li>Bu kodu sisteme girin</li>
                <li>Teslimat onaylanacak</li>
              </ol>
            </div>
            
            <p style="margin: 20px 0 0; color: #999; font-size: 12px; text-align: center;">
              Bu kod 24 saat geçerlidir. Sorun yaşarsanız <a href="mailto:join@takas-a.com" style="color: #7C3AED;">join@takas-a.com</a> adresinden bize ulaşın.
            </p>
          </div>
        </div>
        
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
          © 2025 TAKAS-A | İzmir'in Takas Platformu
        </p>
      </div>
    `

    await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_TESLIMAT_DORULAMA,
        subject: `[TAKAS-A] Teslimat Doğrulama Kodu: ${verificationCode}`,
        body: htmlBody,
        is_html: true,
        recipient_email: receiverEmail,
        sender_email: `noreply@takas-a.com`,
        sender_alias: appName,
      }),
    })
    
    return true
  } catch (error) {
    console.error('Verification email error:', error)
    return false
  }
}

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
        if (swapRequest.status === 'qr_generated') {
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

      // Idempotency guard: zaten onaylandıysa side-effect'leri tekrar çalıştırma
      if (swapRequest.status === 'qr_generated') {
        return NextResponse.json({ success: true, message: 'Already confirmed' })
      }

      // QR kod ve doğrulama kodu oluştur
      const qrCode = generateQRCode()
      const verificationCode = generateVerificationCode()
      
      // Ürüne karşı ürün takası için ikinci QR kod
      let qrCodeB: string | null = null
      let verificationCodeB: string | null = null
      if (swapRequest.offeredProductId) {
        qrCodeB = generateQRCode()
        verificationCodeB = generateVerificationCode()
      }

      // Teslimat noktası bilgisini al
      let deliveryPointName: string | null = null
      if (lastProposal.deliveryMethod === 'delivery_point' && lastProposal.deliveryPointId) {
        const deliveryPoint = await prisma.deliveryPoint.findUnique({
          where: { id: lastProposal.deliveryPointId },
        })
        deliveryPointName = deliveryPoint?.name || null
      }

      // Güncelle
      const updated = await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: {
          qrCode,
          qrCodeGeneratedAt: new Date(),
          qrCodeB,
          deliveryMethod: lastProposal.deliveryMethod,
          deliveryPointId: lastProposal.deliveryPointId || null,
          customLocation: lastProposal.customLocation || null,
          status: 'qr_generated',
          deliveryVerificationCode: verificationCode,
          deliveryVerificationCodeB: verificationCodeB,
        },
      })

      // StatusLog'a kaydet
      await prisma.swapStatusLog.create({
        data: {
          swapRequestId,
          fromStatus: swapRequest.status,
          toStatus: 'qr_generated',
          changedBy: currentUser.id,
          reason: `DELIVERY_ACCEPTED|${JSON.stringify({ acceptedBy: currentUser.id, acceptedAt: new Date().toISOString() })}`,
        }
      })

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`
      const locationText = deliveryPointName || lastProposal.customLocation || 'Belirtilmedi'
      const meetingDate = lastProposal.deliveryDate || 'Belirtilmedi'
      const meetingTime = lastProposal.deliveryTime || 'Belirtilmedi'

      // BUG 1 FIX: Her tarafa farklı mesaj - SATICI QR gösterir, ALICI tarar
      // Ürün sahibine (owner/satıcı) giden mesaj
      const ownerMessage = `🤝 TESLİMAT ANLAŞMASI SAĞLANDI!

📦 Ürün: "${swapRequest.product.title}"

📍 Buluşma Yeri: ${locationText}
📅 Tarih: ${meetingDate}
⏰ Saat: ${meetingTime}

═══════════════════════════════════
📱 SİZİN QR KODUNUZ (Alıcıya gösterin)
═══════════════════════════════════
${qrCode}

🔄 AKIŞ:
1️⃣ Buluşma yerine gidin
2️⃣ Bu QR kodu telefonunuzda ALICIYA gösterin
3️⃣ Alıcı QR'ı taradığında email/mesajla 6 haneli kod alacak
4️⃣ Alıcı kodu girince teslimat tamamlanır

⚠️ QR kodu sadece SİZ gösterebilirsiniz!

İyi takaslar! 🎉`

      // Alıcıya (requester) giden mesaj
      const requesterMessage = `🤝 TESLİMAT ANLAŞMASI SAĞLANDI!

📦 Alacağınız Ürün: "${swapRequest.product.title}"

📍 Buluşma Yeri: ${locationText}
📅 Tarih: ${meetingDate}
⏰ Saat: ${meetingTime}

═══════════════════════════════════
📷 TESLİMAT ADIMI: QR KODU TARATIN
═══════════════════════════════════

🔄 AKIŞ:
1️⃣ Buluşma yerine gidin
2️⃣ Satıcının telefonundaki QR kodu TARAYIN
3️⃣ Email/mesajlarınıza 6 haneli doğrulama kodu gelecek
4️⃣ Ürünü kontrol edip kodu sisteme girin
5️⃣ Teslimat tamamlanır!

⚠️ Önce QR taramanız gerekiyor, sonra kod gelecek!

İyi takaslar! 🎉`

      // BUG 1 FIX: Her tarafa doğru mesajı gönder
      // Owner (satıcı) QR kodunu gösterecek, Requester (alıcı) tarayacak
      
      // Owner'a (satıcıya) QR kodlu mesaj gönder
      await prisma.message.create({
        data: {
          senderId: swapRequest.requesterId, // Alıcıdan geliyormuş gibi
          receiverId: swapRequest.ownerId,
          content: ownerMessage,
          productId: swapRequest.productId,
          swapRequestId: swapRequest.id,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      // Requester'a (alıcıya) QR taratma mesajı gönder
      await prisma.message.create({
        data: {
          senderId: swapRequest.ownerId, // Satıcıdan geliyormuş gibi
          receiverId: swapRequest.requesterId,
          content: requesterMessage,
          productId: swapRequest.productId,
          swapRequestId: swapRequest.id,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      // Push bildirim - her iki tarafa da
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
        message: '✅ Teslimat noktası anlaşması sağlandı! QR kod oluşturuldu.',
        qrCode: updated.qrCode,
        qrCodeUrl,
        deliveryLocation: locationText,
        deliveryDate: lastProposal.deliveryDate,
        deliveryTime: lastProposal.deliveryTime,
        instructions: [
          'Teslimat anlaşması sağlandı',
          'QR kod her iki tarafa da mesaj olarak gönderildi',
          'Belirlenen tarih ve saatte buluşun',
          'Alıcı QR kodu taratarak teslimatı başlatır'
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
        if (swapRequest.status === 'qr_generated') {
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
          'Karşı taraf onayladığında QR kod oluşturulacak',
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
