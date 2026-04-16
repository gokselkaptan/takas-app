import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'
import { calculateDisputeWindowEnd, DISPUTE_WINDOW_HOURS } from '@/lib/swap-config'

export const dynamic = 'force-dynamic'

// Email ile doğrulama kodu gönder (QR okutulunca)
async function sendVerificationCodeEmail(
  receiverEmail: string,
  receiverName: string,
  productTitle: string,
  verificationCode: string,
  senderName: string
): Promise<{ success: boolean; error?: string }> {
  try {
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
              <strong>"${productTitle}"</strong> ürünü için QR kodu başarıyla tarandı! Ürünü teslim almak için aşağıdaki doğrulama kodunu sisteme girin:
            </p>
            
            <div style="background: #F3F0FF; border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0;">
              <p style="margin: 0 0 10px; color: #7C3AED; font-size: 14px; font-weight: 500;">Doğrulama Kodunuz:</p>
              <div style="font-size: 36px; font-weight: bold; color: #7C3AED; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                ${verificationCode}
              </div>
            </div>
            
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0;">
              <p style="margin: 0; color: #92400E; font-size: 14px;">
                ⚠️ <strong>Önemli:</strong> Bu kodu sadece ürünü fiziksel olarak kontrol ettikten sonra girin. Kod girildikten sonra teslimat onaylanmış sayılır ve satıcıya ödeme aktarılır.
              </p>
            </div>
            
            <div style="background: #F0FDF4; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0 0 10px; color: #166534; font-weight: 600;">✅ Son Adımlar:</p>
              <ol style="margin: 0; padding-left: 20px; color: #166534; font-size: 14px;">
                <li>Ürünü detaylıca kontrol edin</li>
                <li>1-2 fotoğraf çekin (kanıt için)</li>
                <li>Bu 6 haneli kodu sisteme girin</li>
                <li>Teslimat tamamlanacak!</li>
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

    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_TESLIMAT_DORULAMA,
        subject: `[TAKAS-A] QR Tarandı! Doğrulama Kodu: ${verificationCode}`,
        body: htmlBody,
        is_html: true,
        recipient_email: receiverEmail,
        sender_email: `noreply@takas-a.com`,
        sender_alias: appName,
      }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Email API error:', response.status, errorText)
      return { success: false, error: `Email API error: ${response.status}` }
    }
    
    console.log(`Verification email sent to ${receiverEmail} for product "${productTitle}"`)
    return { success: true }
  } catch (error) {
    console.error('Verification email error:', error)
    return { success: false, error: String(error) }
  }
}

// Sistem mesajı olarak doğrulama kodu gönder (email'e ek olarak)
async function sendVerificationCodeSystemMessage(
  senderId: string,
  receiverId: string,
  productId: string,
  productTitle: string,
  verificationCode: string,
  swapRequestId: string
): Promise<boolean> {
  try {
    await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content: `🔐 TESLİMAT DOĞRULAMA KODU\n\n"${productTitle}" ürünü için 6 haneli doğrulama kodunuz:\n\n📟 ${verificationCode}\n\n⚠️ Bu kodu sadece ürünü teslim aldıktan ve kontrol ettikten sonra sisteme girin!\n\n✅ Kod girildikten sonra teslimat tamamlanmış sayılır.`,
        productId,
        swapRequestId,
        isModerated: true,
        moderationResult: 'approved',
        metadata: JSON.stringify({
          type: 'verification_code',
          verificationCode,
          sentAt: new Date().toISOString()
        })
      }
    })
    console.log(`Verification code system message sent to user ${receiverId}`)
    return true
  } catch (error) {
    console.error('System message error:', error)
    return false
  }
}

// POST: QR kod tara - İki aşamalı sistem
// Aşama 1: QR tarama → email ile kod gönder
// Aşama 2: Kod doğrulama → teslimat tamamla
// Aşama Alternatif: Satıcı doğrudan email ile kod gönderir (send_code_email)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }
    
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, name: true },
    })
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    const { qrCode, verificationCode, receiverPhotos, previewOnly, action, swapRequestId, noPhotoAccepted } = await request.json()

    // ============ SATIICI DOĞRUDAN EMAIL GÖNDERİR (action: 'send_code_email') ============
    if (action === 'send_code_email' && swapRequestId) {
      // Takas isteğini bul
      const swapForEmail = await prisma.swapRequest.findUnique({
        where: { id: swapRequestId },
        include: {
          product: { select: { id: true, title: true } },
          owner: { select: { id: true, name: true, email: true } },
          requester: { select: { id: true, name: true, email: true } },
        },
      })

      if (!swapForEmail) {
        return NextResponse.json({ error: 'Takas isteği bulunamadı' }, { status: 404 })
      }

      // Sadece satıcı (owner) bu işlemi yapabilir
      if (swapForEmail.ownerId !== currentUser.id) {
        return NextResponse.json({ error: 'Sadece satıcı kodu gönderebilir' }, { status: 403 })
      }

      // Takas durumu kontrol - accepted, qr_generated, qr_scanned statüleri kabul edilir
      if (!['accepted', 'qr_generated', 'arrived', 'qr_scanned'].includes(swapForEmail.status)) {
        return NextResponse.json({ error: 'Bu takas için teslimat beklenmiyor' }, { status: 400 })
      }

      // Doğrulama kodu var mı kontrol et
      if (!swapForEmail.deliveryVerificationCode) {
        return NextResponse.json({ error: 'Doğrulama kodu bulunamadı' }, { status: 400 })
      }

      // Alıcıya email gönder
      const emailResult = await sendVerificationCodeEmail(
        swapForEmail.requester.email,
        swapForEmail.requester.name || 'Kullanıcı',
        swapForEmail.product.title,
        swapForEmail.deliveryVerificationCode,
        swapForEmail.owner.name || 'Satıcı'
      )

      // Alıcıya sistem mesajı olarak da gönder (email'e ek olarak)
      const messageSent = await sendVerificationCodeSystemMessage(
        swapForEmail.ownerId,
        swapForEmail.requesterId,
        swapForEmail.product.id,
        swapForEmail.product.title,
        swapForEmail.deliveryVerificationCode,
        swapForEmail.id
      )

      // Status'u güncelleme - QR kod fiilen okutulana kadar 'accepted' kalmalı
      // Sadece kod gönderim bilgisini kaydet
      await prisma.swapRequest.update({
        where: { id: swapRequestId },
        data: {
          // status: 'qr_scanned' KALDIRILDI - QR fiilen okutulana kadar değişmemeli
          verificationCodeSentAt: new Date(),
          verificationCodeSentViaEmail: emailResult.success,
        },
      })

      // Alıcıya push bildirim gönder
      sendPushToUser(swapForEmail.requesterId, NotificationTypes.SWAP_QR_SCANNED, {
        productTitle: swapForEmail.product.title,
        swapId: swapForEmail.id,
        receiverName: swapForEmail.owner.name
      }).catch(err => console.error('Push notification error:', err))

      const deliveryMethods: string[] = []
      if (emailResult.success) deliveryMethods.push('email')
      if (messageSent) deliveryMethods.push('sistem mesajı')

      return NextResponse.json({
        success: emailResult.success || messageSent,
        emailSent: emailResult.success,
        messageSent,
        message: deliveryMethods.length > 0
          ? `✅ Doğrulama kodu ${deliveryMethods.join(' ve ')} olarak gönderildi!` 
          : '⚠️ Kod gönderilemedi, lütfen tekrar deneyin.',
        emailError: emailResult.error,
        instructions: [
          'Alıcıya email ve mesaj olarak 6 haneli doğrulama kodu gönderildi',
          'Alıcı ürünü teslim alıp kodu sisteme girecek',
          'Kod girildiğinde teslimat onaylanır ve Valor puanınız aktarılır'
        ]
      })
    }

    if (!qrCode) {
      return NextResponse.json({ error: 'QR kod gerekli' }, { status: 400 })
    }

    // QR kodu normalize et (trim ve uppercase)
    const normalizedQrCode = qrCode.toString().trim().toUpperCase()
    
    // Hangi QR kod tarandı? A mı B mi?
    let isQrCodeB = false // true ise requester'ın ürünü için QR kod (owner taratır)
    
    // Önce qrCode (A) ile ara
    let swapRequest = await prisma.swapRequest.findUnique({
      where: { qrCode: normalizedQrCode },
      include: {
        product: { select: { id: true, title: true, images: true, valorPrice: true, aiValorPrice: true } },
        offeredProduct: { select: { id: true, title: true, images: true, valorPrice: true } },
        owner: { select: { id: true, name: true, email: true } },
        requester: { select: { id: true, name: true, email: true } },
      },
    })

    // A'da bulunamadıysa qrCodeB (B) ile ara
    if (!swapRequest) {
      swapRequest = await prisma.swapRequest.findUnique({
        where: { qrCodeB: normalizedQrCode },
        include: {
          product: { select: { id: true, title: true, images: true, valorPrice: true, aiValorPrice: true } },
          offeredProduct: { select: { id: true, title: true, images: true, valorPrice: true } },
          owner: { select: { id: true, name: true, email: true } },
          requester: { select: { id: true, name: true, email: true } },
        },
      })
      if (swapRequest) {
        isQrCodeB = true // Bu QR kod B (requester'ın ürünü için)
      }
    }

    // Bulunamadıysa orijinal QR kodla tekrar dene (A)
    if (!swapRequest) {
      swapRequest = await prisma.swapRequest.findUnique({
        where: { qrCode: qrCode.toString().trim() },
        include: {
          product: { select: { id: true, title: true, images: true, valorPrice: true, aiValorPrice: true } },
          offeredProduct: { select: { id: true, title: true, images: true, valorPrice: true } },
          owner: { select: { id: true, name: true, email: true } },
          requester: { select: { id: true, name: true, email: true } },
        },
      })
    }

    // Hala bulunamadıysa LIKE sorgusu ile ara (kısmi eşleşme - hem A hem B)
    if (!swapRequest) {
      const searchPattern = normalizedQrCode.replace('TAKAS-', '')
      const allSwaps = await prisma.swapRequest.findMany({
        where: {
          OR: [
            { qrCode: { contains: searchPattern, mode: 'insensitive' } },
            { qrCodeB: { contains: searchPattern, mode: 'insensitive' } }
          ]
        },
        include: {
          product: { select: { id: true, title: true, images: true, valorPrice: true, aiValorPrice: true } },
          offeredProduct: { select: { id: true, title: true, images: true, valorPrice: true } },
          owner: { select: { id: true, name: true, email: true } },
          requester: { select: { id: true, name: true, email: true } },
        },
        take: 1
      })
      if (allSwaps[0]) {
        swapRequest = allSwaps[0]
        // Hangi QR kod eşleşti kontrol et
        if (swapRequest.qrCodeB?.toUpperCase().includes(searchPattern)) {
          isQrCodeB = true
        }
      }
    }

    if (!swapRequest) {
      console.error('QR kod bulunamadı:', { original: qrCode, normalized: normalizedQrCode })
      return NextResponse.json({ 
        error: 'Geçersiz QR kod',
        hint: 'QR kod sistemde bulunamadı. Doğru takası mı tarıyorsunuz?' 
      }, { status: 404 })
    }
    
    // Ürüne karşı ürün takası mı?
    const isProductToProductSwap = !!swapRequest.offeredProductId

    // Sadece önizleme modunda: QR kod geçerli mi kontrol et
    if (previewOnly) {
      // accepted, qr_generated, qr_scanned statülerinde QR taranabilir
      if (!['accepted', 'qr_generated', 'arrived', 'qr_scanned'].includes(swapRequest.status)) {
        if (swapRequest.status === 'delivered') {
          return NextResponse.json({ 
            valid: false,
            error: 'Bu ürün zaten teslim alınmış',
            status: swapRequest.status
          })
        }
        if (swapRequest.status === 'completed') {
          return NextResponse.json({ 
            valid: false,
            error: 'Bu takas zaten tamamlanmış',
            status: swapRequest.status
          })
        }
        return NextResponse.json({ 
          valid: false,
          error: 'Bu takas için teslimat beklenmiyor',
          status: swapRequest.status
        })
      }

      // ÜRÜNE KARŞI ÜRÜN TAKASI: Doğru kişi doğru QR'ı mı tarıyor?
      if (isProductToProductSwap) {
        // QR A (owner'ın ürünü) → requester taratır
        // QR B (requester'ın ürünü) → owner taratır
        if (!isQrCodeB && swapRequest.requesterId !== currentUser.id) {
          return NextResponse.json({ 
            valid: false,
            error: 'Bu QR kodu sadece alıcı (teklif eden) tarayabilir'
          })
        }
        if (isQrCodeB && swapRequest.ownerId !== currentUser.id) {
          return NextResponse.json({ 
            valid: false,
            error: 'Bu QR kodu sadece ürün sahibi tarayabilir'
          })
        }
      } else {
        // Normal takas: Sadece alıcı (requester) tarar
        if (swapRequest.requesterId !== currentUser.id) {
          return NextResponse.json({ 
            valid: false,
            error: 'Sadece alıcı QR kodu tarayabilir'
          })
        }
      }

      const isQrScanned = isQrCodeB ? !!swapRequest.qrCodeBScannedAt : !!swapRequest.qrScannedAt
      const targetProduct = isQrCodeB ? swapRequest.offeredProduct : swapRequest.product

      return NextResponse.json({
        valid: true,
        swapRequestId: swapRequest.id,
        product: targetProduct,
        senderPhotos: isQrCodeB ? swapRequest.requesterSenderPhotos : swapRequest.senderPhotos,
        isQrScanned,
        isQrCodeB,
        isProductToProductSwap,
        requiresVerificationCode: isQrScanned,
        instructions: isQrScanned 
          ? ['QR zaten tarandı', 'Email adresinize gelen 6 haneli kodu girin', 'Fotoğraf çekin ve teslimatı tamamlayın']
          : ['QR kodu tarayın', 'Email adresinize 6 haneli kod gelecek', 'Kodu girerek teslimatı tamamlayın']
      })
    }

    // ============ AŞAMA 1: QR TARAMA (action: 'scan_qr' veya verificationCode yok) ============
    if (action === 'scan_qr' || (!verificationCode && !receiverPhotos)) {
      // Takas durumunu kontrol et - accepted, qr_generated, qr_scanned statüleri kabul edilir
      if (!['accepted', 'qr_generated', 'arrived', 'qr_scanned'].includes(swapRequest.status)) {
        if (swapRequest.status === 'delivered') {
          return NextResponse.json({ error: 'Bu ürün zaten teslim alınmış' }, { status: 400 })
        }
        if (swapRequest.status === 'completed') {
          return NextResponse.json({ error: 'Bu takas zaten tamamlanmış' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Bu takas için teslimat beklenmiyor' }, { status: 400 })
      }
      
      // ÜRÜNE KARŞI ÜRÜN TAKASI: Bu QR zaten tarandı mı kontrol et
      if (isProductToProductSwap) {
        const qrAlreadyScanned = isQrCodeB ? !!swapRequest.qrCodeBScannedAt : !!swapRequest.qrScannedAt
        if (qrAlreadyScanned) {
          return NextResponse.json({ 
            success: true,
            alreadyScanned: true,
            isQrCodeB,
            message: `Bu QR kod zaten tarandı. Email veya mesajlarınızdan 6 haneli kodu girin.`,
            requiresVerificationCode: true
          })
        }
      } else {
        // Normal takas: status qr_scanned ise zaten taranmış
        if (swapRequest.status === 'qr_scanned') {
          return NextResponse.json({ 
            success: true,
            alreadyScanned: true,
            message: 'QR kod zaten tarandı. Email veya mesajlarınızdan 6 haneli kodu girin.',
            requiresVerificationCode: true
          })
        }
      }

      // KULLANICI KONTROLÜ
      if (isProductToProductSwap) {
        // QR A (owner'ın ürünü) → requester taratır
        // QR B (requester'ın ürünü) → owner taratır
        if (!isQrCodeB && swapRequest.requesterId !== currentUser.id) {
          return NextResponse.json({ 
            error: 'Bu QR kodu sadece alıcı (teklif eden) tarayabilir',
            hint: 'Her ürün için farklı kişi QR kodu taramalıdır'
          }, { status: 403 })
        }
        if (isQrCodeB && swapRequest.ownerId !== currentUser.id) {
          return NextResponse.json({ 
            error: 'Bu QR kodu sadece ürün sahibi tarayabilir',
            hint: 'Her ürün için farklı kişi QR kodu taramalıdır'
          }, { status: 403 })
        }
      } else {
        // Normal takas: Sadece alıcı (requester) QR kodu taramalı
        if (swapRequest.requesterId !== currentUser.id) {
          return NextResponse.json({ 
            error: 'Sadece alıcı QR kodu tarayabilir',
            hint: 'Ürünü talep eden kişi QR kodu taramalıdır'
          }, { status: 403 })
        }
      }

      // DOĞRULAMA KODU SEÇİMİ
      const verificationCodeToSend = isQrCodeB 
        ? swapRequest.deliveryVerificationCodeB 
        : swapRequest.deliveryVerificationCode
        
      if (!verificationCodeToSend) {
        return NextResponse.json({ 
          error: 'Doğrulama kodu bulunamadı. Satıcıyla iletişime geçin.',
        }, { status: 400 })
      }

      // Doğru alıcı ve ürün bilgilerini belirle
      const receiver = isQrCodeB ? swapRequest.owner : swapRequest.requester
      const sender = isQrCodeB ? swapRequest.requester : swapRequest.owner
      const targetProduct = isQrCodeB ? swapRequest.offeredProduct : swapRequest.product
      const targetProductTitle = targetProduct?.title || 'Ürün'

      // QR tarandı - alıcıya hem email hem sistem mesajı ile kod gönder
      const emailResult = await sendVerificationCodeEmail(
        receiver.email,
        receiver.name || 'Kullanıcı',
        targetProductTitle,
        verificationCodeToSend,
        sender.name || 'Satıcı'
      )

      // Alıcıya sistem mesajı olarak da gönder
      const messageSent = await sendVerificationCodeSystemMessage(
        sender.id,
        receiver.id,
        targetProduct?.id || swapRequest.productId,
        targetProductTitle,
        verificationCodeToSend,
        swapRequest.id
      )

      // Status'u güncelle
      const updateData: any = isQrCodeB 
        ? {
            qrCodeBScannedAt: new Date(),
            verificationCodeBSentAt: new Date(),
            verificationCodeBSentViaEmail: emailResult.success,
          }
        : {
            qrScannedAt: new Date(),
            verificationCodeSentAt: new Date(),
            verificationCodeSentViaEmail: emailResult.success,
          }
      
      // Ürüne karşı ürün takasında status'u sadece her iki QR da tarandığında değiştir
      // Normal takasta hemen qr_scanned yap
      if (!isProductToProductSwap) {
        updateData.status = 'qr_scanned'
      }
      
      await prisma.swapRequest.update({
        where: { id: swapRequest.id },
        data: updateData,
      })

      // Karşı tarafa bildirim gönder
      sendPushToUser(sender.id, NotificationTypes.SWAP_QR_SCANNED, {
        productTitle: targetProductTitle,
        swapId: swapRequest.id,
        receiverName: receiver.name
      }).catch(err => console.error('Push notification error:', err))

      const deliveryMethods: string[] = []
      if (emailResult.success) deliveryMethods.push('email')
      if (messageSent) deliveryMethods.push('mesajlarınız')

      let successMessage = deliveryMethods.length > 0
        ? `QR kod tarandı! 6 haneli doğrulama kodu ${deliveryMethods.join(' ve ')} üzerinden gönderildi.`
        : 'QR kod tarandı! Doğrulama kodu gönderilemedi, satıcıyla iletişime geçin.'
      
      // Ürüne karşı ürün takası için ek bilgi
      if (isProductToProductSwap) {
        const otherQrScanned = isQrCodeB ? !!swapRequest.qrScannedAt : !!swapRequest.qrCodeBScannedAt
        const productName = isQrCodeB ? swapRequest.offeredProduct?.title : swapRequest.product.title
        successMessage += `\n\n📦 "${productName}" için QR tarandı.`
        if (!otherQrScanned) {
          successMessage += `\n⏳ Diğer ürün için QR henüz taranmadı.`
        } else {
          successMessage += `\n✅ Her iki ürün için de QR tarandı! Kodları girerek takası tamamlayın.`
        }
      }

      return NextResponse.json({
        success: emailResult.success || messageSent,
        message: successMessage,
        emailSent: emailResult.success,
        messageSent,
        emailError: emailResult.error,
        requiresVerificationCode: true,
        swapRequestId: swapRequest.id,
        product: isQrCodeB ? swapRequest.offeredProduct : swapRequest.product,
        isQrCodeB,
        isProductToProductSwap,
        instructions: isProductToProductSwap 
          ? [
              `"${targetProductTitle}" için doğrulama kodu gönderildi`,
              'Ürünü kontrol edin ve 1-2 fotoğraf çekin',
              'Kodu ve fotoğrafları girerek onaylayın',
              'Her iki taraf da onayladığında takas tamamlanır'
            ]
          : [
              'Email ve mesajlarınıza 6 haneli doğrulama kodu gönderildi',
              'Ürünü kontrol edin ve 1-2 fotoğraf çekin',
              'Kodu ve fotoğrafları girerek teslimatı tamamlayın'
            ]
      })
    }

    // ============ AŞAMA 2: KOD DOĞRULAMA (verificationCode var) ============
    
    // Takas durumunu kontrol et - accepted, qr_generated, qr_scanned statüleri kabul edilir
    if (!['accepted', 'qr_generated', 'arrived', 'qr_scanned'].includes(swapRequest.status)) {
      if (swapRequest.status === 'delivered') {
        return NextResponse.json({ error: 'Bu ürün zaten teslim alınmış' }, { status: 400 })
      }
      if (swapRequest.status === 'completed') {
        return NextResponse.json({ error: 'Bu takas zaten tamamlanmış' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Bu takas için teslimat beklenmiyor' }, { status: 400 })
    }

    // KULLANICI KONTROLÜ (Aşama 2)
    if (isProductToProductSwap) {
      // QR A (owner'ın ürünü) → requester doğrular
      // QR B (requester'ın ürünü) → owner doğrular
      if (!isQrCodeB && swapRequest.requesterId !== currentUser.id) {
        return NextResponse.json({ 
          error: 'Bu ürün için sadece alıcı (teklif eden) onay verebilir'
        }, { status: 403 })
      }
      if (isQrCodeB && swapRequest.ownerId !== currentUser.id) {
        return NextResponse.json({ 
          error: 'Bu ürün için sadece ürün sahibi onay verebilir'
        }, { status: 403 })
      }
    } else {
      // Normal takas: Sadece alıcı (requester) onaylar
      if (swapRequest.requesterId !== currentUser.id) {
        return NextResponse.json({ 
          error: 'Sadece alıcı teslimatı onaylayabilir'
        }, { status: 403 })
      }
    }

    // Ürüne karşı ürün: Bu taraf zaten onayladı mı?
    if (isProductToProductSwap) {
      const alreadyConfirmed = isQrCodeB ? swapRequest.ownerReceivedProduct : swapRequest.requesterReceivedProduct
      if (alreadyConfirmed) {
        return NextResponse.json({ error: 'Bu ürünü zaten onayladınız' }, { status: 400 })
      }
    } else {
      // Normal takas: Zaten teslim alınmışsa
      if (swapRequest.deliveredAt) {
        return NextResponse.json({ error: 'Bu ürün zaten teslim alınmış' }, { status: 400 })
      }
    }

    // Doğrulama kodu kontrolü
    if (!verificationCode) {
      return NextResponse.json({ 
        error: 'Doğrulama kodu gerekli',
        hint: 'Email adresinize gönderilen 6 haneli kodu girin',
        requiresVerificationCode: true
      }, { status: 400 })
    }

    // DOĞRU DOĞRULAMA KODUNU SEÇ
    const expectedCode = isQrCodeB 
      ? swapRequest.deliveryVerificationCodeB 
      : swapRequest.deliveryVerificationCode
    const codeUsedField = isQrCodeB ? 'verificationCodeBUsed' : 'verificationCodeUsed'
    const codeSentAtField = isQrCodeB ? 'verificationCodeBSentAt' : 'verificationCodeSentAt'

    // Kod doğrulama
    if (expectedCode !== verificationCode) {
      return NextResponse.json({ 
        error: 'Geçersiz doğrulama kodu',
        hint: 'Lütfen email adresinize gönderilen kodu kontrol edin'
      }, { status: 400 })
    }

    // Kod zaten kullanılmış mı?
    const codeAlreadyUsed = isQrCodeB ? swapRequest.verificationCodeBUsed : swapRequest.verificationCodeUsed
    if (codeAlreadyUsed) {
      return NextResponse.json({ 
        error: 'Bu doğrulama kodu zaten kullanılmış',
      }, { status: 400 })
    }

    // Kod süresi kontrolü (24 saat)
    const codeSentAt = isQrCodeB ? swapRequest.verificationCodeBSentAt : swapRequest.verificationCodeSentAt
    if (codeSentAt) {
      const codeAge = Date.now() - new Date(codeSentAt).getTime()
      const maxCodeAge = 24 * 60 * 60 * 1000 // 24 saat
      if (codeAge > maxCodeAge) {
        return NextResponse.json({ 
          error: 'Doğrulama kodunun süresi dolmuş',
          hint: 'Satıcıdan yeni bir teslimat ayarlaması isteyin'
        }, { status: 400 })
      }
    }

    // Alıcı fotoğrafı opsiyonel - fotoğraf veya sorumluluk kabulü yeterli
    const hasPhotos = receiverPhotos && Array.isArray(receiverPhotos) && receiverPhotos.length > 0
    
    // Fotoğraf yoksa ve sorumluluk kabul edilmemişse - artık sadece uyarı (zorunlu değil)
    // Kullanıcı noPhotoAccepted checkbox'ı işaretleyerek fotoğrafsız devam edebilir
    
    if (hasPhotos && receiverPhotos.length > 5) {
      return NextResponse.json({ error: 'En fazla 5 fotoğraf yükleyebilirsiniz' }, { status: 400 })
    }
    
    // S3 URL validasyonu - fotoğraflar S3'te olmalı
    const validS3Prefix = 'https://takas-a-uploads.s3.eu-north-1.amazonaws.com/'
    if (hasPhotos) {
      const invalidUrls = receiverPhotos.filter((url: string) => 
        typeof url !== 'string' || !url.startsWith(validS3Prefix)
      )
      if (invalidUrls.length > 0) {
        return NextResponse.json({ 
          error: 'Geçersiz fotoğraf URL\'i. Fotoğraflar S3\'e yüklenmelidir.',
          hint: 'Lütfen fotoğrafı tekrar yükleyin'
        }, { status: 400 })
      }
    }

    // Teslim zamanı ve dispute window hesapla
    const now = new Date()
    const disputeWindowEndsAt = calculateDisputeWindowEnd(now)
    const confirmDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Hedef ürün bilgileri
    const targetProduct = isQrCodeB ? swapRequest.offeredProduct : swapRequest.product
    const valorAmount = targetProduct?.valorPrice || 0

    // ÜRÜNE KARŞI ÜRÜN TAKASI: Farklı güncelleme mantığı
    if (isProductToProductSwap) {
      // Bu tarafın onayını kaydet
      const updateData: any = isQrCodeB 
        ? {
            ownerReceivedProduct: true,
            ownerReceivedAt: now,
            ownerReceiverPhotos: receiverPhotos,
            verificationCodeBUsed: true,
          }
        : {
            requesterReceivedProduct: true,
            requesterReceivedAt: now,
            receiverPhotos: receiverPhotos,
            verificationCodeUsed: true,
          }
      
      // Güncellenmiş swap'ı al
      const updatedSwap = await prisma.swapRequest.update({
        where: { id: swapRequest.id },
        data: updateData,
      })
      
      // Her iki taraf da onayladı mı kontrol et
      const bothConfirmed = isQrCodeB 
        ? (updatedSwap.requesterReceivedProduct && true) // owner şimdi onayladı
        : (updatedSwap.ownerReceivedProduct && true) // requester şimdi onayladı
      
      // Mevcut durumu tekrar oku
      const refreshedSwap = await prisma.swapRequest.findUnique({
        where: { id: swapRequest.id },
        select: { ownerReceivedProduct: true, requesterReceivedProduct: true }
      })
      
      const fullyConfirmed = refreshedSwap?.ownerReceivedProduct && refreshedSwap?.requesterReceivedProduct
      
      if (fullyConfirmed) {
        // Her iki taraf da onayladı - takası tamamla
        await prisma.swapRequest.update({
          where: { id: swapRequest.id },
          data: {
            status: 'delivered',
            deliveredAt: now,
            deliveryConfirmDeadline: confirmDeadline,
            disputeWindowEndsAt,
          },
        })
        
        // Activity feed'e ekle
        await prisma.activityFeed.create({
          data: {
            type: 'product_swap_completed',
            userId: swapRequest.requesterId,
            userName: swapRequest.requester.name,
            productId: swapRequest.productId,
            productTitle: swapRequest.product.title,
            targetUserId: swapRequest.ownerId,
            targetUserName: swapRequest.owner.name,
            city: 'İzmir',
            metadata: JSON.stringify({
              swapRequestId: swapRequest.id,
              isProductToProductSwap: true,
              offeredProductTitle: swapRequest.offeredProduct?.title,
              photosCount: receiverPhotos.length,
            }),
          },
        })
        
        // Her iki tarafa bildirim gönder
        sendPushToUser(swapRequest.ownerId, NotificationTypes.SWAP_COMPLETED, {
          productTitle: swapRequest.product.title,
          swapId: swapRequest.id
        }).catch(err => console.error('Push notification error:', err))
        
        sendPushToUser(swapRequest.requesterId, NotificationTypes.SWAP_COMPLETED, {
          productTitle: swapRequest.offeredProduct?.title || 'Teklif edilen ürün',
          swapId: swapRequest.id
        }).catch(err => console.error('Push notification error:', err))
        
        return NextResponse.json({
          success: true,
          message: '🎉 ÜRÜNE KARŞI ÜRÜN TAKASI TAMAMLANDI! Her iki taraf da ürünleri onayladı.',
          swapRequestId: swapRequest.id,
          isProductToProductSwap: true,
          bothConfirmed: true,
          deliveredAt: now.toISOString(),
          disputeWindowEndsAt: disputeWindowEndsAt.toISOString(),
          instructions: [
            'Her iki ürün de başarıyla teslim alındı!',
            `${DISPUTE_WINDOW_HOURS} saat içinde sorun bildirmezseniz takas otomatik onaylanır`,
            'Takas tamamlandı, iyi kullanımlar!'
          ],
        })
      } else {
        // Sadece bir taraf onayladı - diğerini bekle
        const waitingFor = isQrCodeB ? 'Alıcının (requester)' : 'Satıcının (owner)'
        
        return NextResponse.json({
          success: true,
          message: `✅ "${targetProduct?.title}" ürününü onayladınız! ${waitingFor} onayı bekleniyor.`,
          swapRequestId: swapRequest.id,
          isProductToProductSwap: true,
          bothConfirmed: false,
          yourConfirmation: true,
          waitingForOther: true,
          instructions: [
            `"${targetProduct?.title}" için onayınız alındı`,
            'Karşı tarafın onayı bekleniyor',
            'Her iki onay alındığında takas tamamlanacak'
          ],
        })
      }
    }

    // NORMAL TAKAS: Mevcut mantık
    // Güncelle: Ürün teslim alındı
    await prisma.swapRequest.update({
      where: { id: swapRequest.id },
      data: {
        status: 'delivered',
        deliveredAt: now,
        deliveryConfirmDeadline: confirmDeadline,
        disputeWindowEndsAt, // Faz 1: Dispute window başlat
        pendingValorAmount: valorAmount,
        verificationCodeUsed: true,
        receiverPhotos: receiverPhotos,
      },
    })

    // Activity feed'e ekle
    await prisma.activityFeed.create({
      data: {
        type: 'product_delivered',
        userId: swapRequest.requesterId,
        userName: swapRequest.requester.name,
        productId: swapRequest.productId,
        productTitle: swapRequest.product.title,
        targetUserId: swapRequest.ownerId,
        targetUserName: swapRequest.owner.name,
        city: 'İzmir',
        metadata: JSON.stringify({
          swapRequestId: swapRequest.id,
          valorAmount,
          photosCount: receiverPhotos.length,
          verificationUsed: true,
        }),
      },
    })

    // Her iki tarafa bildirim gönder
    sendPushToUser(swapRequest.ownerId, NotificationTypes.SWAP_COMPLETED, {
      productTitle: swapRequest.product.title,
      valorAmount,
      swapId: swapRequest.id
    }).catch(err => console.error('Push notification error:', err))

    return NextResponse.json({
      success: true,
      message: 'Teslimat başarıyla tamamlandı! ✅',
      swapRequestId: swapRequest.id,
      product: swapRequest.product,
      deliveredAt: now.toISOString(),
      confirmDeadline: confirmDeadline.toISOString(),
      disputeWindowEndsAt: disputeWindowEndsAt.toISOString(),
      disputeWindowHours: DISPUTE_WINDOW_HOURS,
      pendingValorAmount: valorAmount,
      verification: {
        codeVerified: true,
        photosUploaded: receiverPhotos.length,
        senderPhotosCount: swapRequest.senderPhotos?.length || 0
      },
      instructions: [
        'Teslimat başarıyla tamamlandı!',
        `${DISPUTE_WINDOW_HOURS} saat içinde sorun bildirmezseniz takas otomatik onaylanır`,
        'Satıcıya Valor puanı aktarılacak'
      ],
    })
  } catch (error) {
    console.error('QR scan error:', error)
    return NextResponse.json({ error: 'QR kod taranamadı' }, { status: 500 })
  }
}
