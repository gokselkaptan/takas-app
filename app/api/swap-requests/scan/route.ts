import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'

// Email ile doğrulama kodu gönder (QR okutulunca)
async function sendVerificationCodeEmail(
  receiverEmail: string,
  receiverName: string,
  productTitle: string,
  verificationCode: string,
  senderName: string
) {
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

    await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
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
    
    return true
  } catch (error) {
    console.error('Verification email error:', error)
    return false
  }
}

// POST: QR kod tara - İki aşamalı sistem
// Aşama 1: QR tarama → email ile kod gönder
// Aşama 2: Kod doğrulama → teslimat tamamla
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

    const { qrCode, verificationCode, receiverPhotos, previewOnly, action } = await request.json()

    if (!qrCode) {
      return NextResponse.json({ error: 'QR kod gerekli' }, { status: 400 })
    }

    // QR koda göre takas isteğini bul
    const swapRequest = await prisma.swapRequest.findUnique({
      where: { qrCode },
      include: {
        product: { select: { id: true, title: true, images: true, valorPrice: true, aiValorPrice: true } },
        offeredProduct: { select: { id: true, title: true, images: true, valorPrice: true } },
        owner: { select: { id: true, name: true, email: true } },
        requester: { select: { id: true, name: true, email: true } },
      },
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Geçersiz QR kod' }, { status: 404 })
    }

    // Sadece önizleme modunda: QR kod geçerli mi kontrol et
    if (previewOnly) {
      if (swapRequest.status !== 'awaiting_delivery' && swapRequest.status !== 'qr_scanned') {
        if (swapRequest.status === 'delivered') {
          return NextResponse.json({ 
            valid: false,
            error: 'Bu ürün zaten teslim alınmış',
            status: swapRequest.status
          })
        }
        return NextResponse.json({ 
          valid: false,
          error: 'Bu takas için teslimat beklenmiyor',
          status: swapRequest.status
        })
      }

      // Kullanıcı alıcı mı kontrol et
      if (swapRequest.requesterId !== currentUser.id) {
        return NextResponse.json({ 
          valid: false,
          error: 'Sadece alıcı QR kodu tarayabilir'
        })
      }

      const isQrScanned = swapRequest.status === 'qr_scanned'

      return NextResponse.json({
        valid: true,
        swapRequestId: swapRequest.id,
        product: swapRequest.product,
        senderPhotos: swapRequest.senderPhotos,
        isQrScanned,
        requiresVerificationCode: isQrScanned,
        instructions: isQrScanned 
          ? ['QR zaten tarandı', 'Email adresinize gelen 6 haneli kodu girin', 'Fotoğraf çekin ve teslimatı tamamlayın']
          : ['QR kodu tarayın', 'Email adresinize 6 haneli kod gelecek', 'Kodu girerek teslimatı tamamlayın']
      })
    }

    // ============ AŞAMA 1: QR TARAMA (action: 'scan_qr' veya verificationCode yok) ============
    if (action === 'scan_qr' || (!verificationCode && !receiverPhotos)) {
      // Takas durumunu kontrol et
      if (swapRequest.status !== 'awaiting_delivery') {
        if (swapRequest.status === 'qr_scanned') {
          return NextResponse.json({ 
            success: true,
            alreadyScanned: true,
            message: 'QR kod zaten tarandı. Email adresinize gelen 6 haneli kodu girin.',
            requiresVerificationCode: true
          })
        }
        if (swapRequest.status === 'delivered') {
          return NextResponse.json({ error: 'Bu ürün zaten teslim alınmış' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Bu takas için teslimat beklenmiyor' }, { status: 400 })
      }

      // Alıcı (requester) QR kodu taramalı
      if (swapRequest.requesterId !== currentUser.id) {
        return NextResponse.json({ 
          error: 'Sadece alıcı QR kodu tarayabilir',
          hint: 'Ürünü talep eden kişi QR kodu taramalıdır'
        }, { status: 403 })
      }

      // QR tarandı - alıcıya email ile kod gönder
      const emailSent = await sendVerificationCodeEmail(
        swapRequest.requester.email,
        swapRequest.requester.name || 'Kullanıcı',
        swapRequest.product.title,
        swapRequest.deliveryVerificationCode || '',
        swapRequest.owner.name || 'Satıcı'
      )

      // Status'u güncelle: qr_scanned
      await prisma.swapRequest.update({
        where: { id: swapRequest.id },
        data: {
          status: 'qr_scanned',
          qrScannedAt: new Date(),
          verificationCodeSentAt: new Date(),
        },
      })

      // Satıcıya bildirim gönder
      sendPushToUser(swapRequest.ownerId, NotificationTypes.SWAP_QR_SCANNED, {
        productTitle: swapRequest.product.title,
        swapId: swapRequest.id,
        receiverName: swapRequest.requester.name
      }).catch(err => console.error('Push notification error:', err))

      return NextResponse.json({
        success: true,
        message: emailSent 
          ? 'QR kod tarandı! 6 haneli doğrulama kodu email adresinize gönderildi.' 
          : 'QR kod tarandı! Doğrulama kodu gönderilemedi, satıcıyla iletişime geçin.',
        emailSent,
        requiresVerificationCode: true,
        swapRequestId: swapRequest.id,
        product: swapRequest.product,
        instructions: [
          'Email adresinize 6 haneli doğrulama kodu gönderildi',
          'Ürünü kontrol edin ve 1-2 fotoğraf çekin',
          'Kodu ve fotoğrafları girerek teslimatı tamamlayın'
        ]
      })
    }

    // ============ AŞAMA 2: KOD DOĞRULAMA (verificationCode var) ============
    
    // Takas durumunu kontrol et
    if (swapRequest.status !== 'qr_scanned' && swapRequest.status !== 'awaiting_delivery') {
      if (swapRequest.status === 'delivered') {
        return NextResponse.json({ error: 'Bu ürün zaten teslim alınmış' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Önce QR kodu tarayın' }, { status: 400 })
    }

    // Alıcı kontrolü
    if (swapRequest.requesterId !== currentUser.id) {
      return NextResponse.json({ 
        error: 'Sadece alıcı teslimatı onaylayabilir'
      }, { status: 403 })
    }

    // Zaten teslim alınmışsa
    if (swapRequest.deliveredAt) {
      return NextResponse.json({ error: 'Bu ürün zaten teslim alınmış' }, { status: 400 })
    }

    // Doğrulama kodu kontrolü
    if (!verificationCode) {
      return NextResponse.json({ 
        error: 'Doğrulama kodu gerekli',
        hint: 'Email adresinize gönderilen 6 haneli kodu girin',
        requiresVerificationCode: true
      }, { status: 400 })
    }

    // Kod doğrulama
    if (swapRequest.deliveryVerificationCode !== verificationCode) {
      return NextResponse.json({ 
        error: 'Geçersiz doğrulama kodu',
        hint: 'Lütfen email adresinize gönderilen kodu kontrol edin'
      }, { status: 400 })
    }

    // Kod zaten kullanılmış mı?
    if (swapRequest.verificationCodeUsed) {
      return NextResponse.json({ 
        error: 'Bu doğrulama kodu zaten kullanılmış',
      }, { status: 400 })
    }

    // Kod süresi kontrolü (24 saat)
    if (swapRequest.verificationCodeSentAt) {
      const codeAge = Date.now() - new Date(swapRequest.verificationCodeSentAt).getTime()
      const maxCodeAge = 24 * 60 * 60 * 1000 // 24 saat
      if (codeAge > maxCodeAge) {
        return NextResponse.json({ 
          error: 'Doğrulama kodunun süresi dolmuş',
          hint: 'Satıcıdan yeni bir teslimat ayarlaması isteyin'
        }, { status: 400 })
      }
    }

    // Alıcı fotoğrafı zorunlu (en az 1)
    if (!receiverPhotos || !Array.isArray(receiverPhotos) || receiverPhotos.length < 1) {
      return NextResponse.json({ 
        error: 'Ürünün teslim sonrası en az 1 fotoğrafını yükleyin',
        hint: 'Bu fotoğraflar olası anlaşmazlıklarda kanıt olarak kullanılacaktır',
        requiresPhotos: true
      }, { status: 400 })
    }

    if (receiverPhotos.length > 5) {
      return NextResponse.json({ error: 'En fazla 5 fotoğraf yükleyebilirsiniz' }, { status: 400 })
    }

    // Teslim zamanı ve onay son tarihini hesapla (24 saat)
    const now = new Date()
    const confirmDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Valor miktarını hesapla
    const valorAmount = swapRequest.product.valorPrice

    // Güncelle: Ürün teslim alındı
    await prisma.swapRequest.update({
      where: { id: swapRequest.id },
      data: {
        status: 'delivered',
        deliveredAt: now,
        deliveryConfirmDeadline: confirmDeadline,
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
      pendingValorAmount: valorAmount,
      verification: {
        codeVerified: true,
        photosUploaded: receiverPhotos.length,
        senderPhotosCount: swapRequest.senderPhotos?.length || 0
      },
      instructions: [
        'Teslimat başarıyla tamamlandı!',
        '24 saat içinde sorun bildirmezseniz takas otomatik onaylanır',
        'Satıcıya Valor puanı aktarılacak'
      ],
    })
  } catch (error) {
    console.error('QR scan error:', error)
    return NextResponse.json({ error: 'QR kod taranamadı' }, { status: 500 })
  }
}
