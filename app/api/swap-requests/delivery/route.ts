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

// POST: Teslimat ayarlarını kaydet ve QR kod oluştur
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

    const { swapRequestId, deliveryMethod, deliveryPointId, customLocation, senderPhotos } = await request.json()

    if (!swapRequestId) {
      return NextResponse.json({ error: 'Takas ID gerekli' }, { status: 400 })
    }

    if (!deliveryMethod || !['delivery_point', 'custom_location'].includes(deliveryMethod)) {
      return NextResponse.json({ error: 'Geçerli bir teslimat yöntemi seçin' }, { status: 400 })
    }

    if (deliveryMethod === 'delivery_point' && !deliveryPointId) {
      return NextResponse.json({ error: 'Teslim noktası seçin' }, { status: 400 })
    }

    if (deliveryMethod === 'custom_location' && !customLocation) {
      return NextResponse.json({ error: 'Buluşma noktası belirtin' }, { status: 400 })
    }

    // Satıcı fotoğrafı zorunlu (en az 1)
    if (!senderPhotos || !Array.isArray(senderPhotos) || senderPhotos.length < 1) {
      return NextResponse.json({ 
        error: 'Ürünün teslim öncesi en az 1 fotoğrafını yükleyin',
        hint: 'Bu fotoğraflar olası anlaşmazlıklarda kanıt olarak kullanılacaktır'
      }, { status: 400 })
    }

    if (senderPhotos.length > 5) {
      return NextResponse.json({ error: 'En fazla 5 fotoğraf yükleyebilirsiniz' }, { status: 400 })
    }

    // Takas isteğini kontrol et
    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      include: {
        product: true,
        offeredProduct: true,
        owner: { select: { id: true, name: true, email: true } },
        requester: { select: { id: true, name: true, email: true } },
      },
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas isteği bulunamadı' }, { status: 404 })
    }

    // Sadece kabul edilmiş takaslar için QR kod oluşturulabilir
    if (swapRequest.status !== 'accepted') {
      return NextResponse.json({ error: 'Sadece kabul edilmiş takaslar için teslimat ayarlanabilir' }, { status: 400 })
    }

    // Sadece ürün sahibi (satıcı) teslimat ayarlayabilir
    if (swapRequest.ownerId !== currentUser.id) {
      return NextResponse.json({ error: 'Sadece satıcı teslimat ayarlayabilir' }, { status: 403 })
    }

    // Zaten QR kod varsa hata ver
    if (swapRequest.qrCode) {
      return NextResponse.json({ error: 'Bu takas için zaten QR kod oluşturulmuş' }, { status: 400 })
    }

    // QR kod ve doğrulama kodu oluştur
    const qrCode = generateQRCode()
    const verificationCode = generateVerificationCode()

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

    // Güncelle
    const updated = await prisma.swapRequest.update({
      where: { id: swapRequestId },
      data: {
        qrCode,
        qrCodeGeneratedAt: new Date(),
        deliveryMethod,
        deliveryPointId: deliveryMethod === 'delivery_point' ? deliveryPointId : null,
        customLocation: deliveryMethod === 'custom_location' ? customLocation : null,
        status: 'awaiting_delivery',
        // Yeni alanlar
        deliveryVerificationCode: verificationCode,
        verificationCodeSentAt: new Date(),
        senderPhotos: senderPhotos,
      },
    })

    // QR kod URL'i oluştur (frontend'de gösterilecek)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`

    // Alıcıya QR kodu mesaj olarak gönder (otomatik)
    await prisma.message.create({
      data: {
        senderId: currentUser.id,
        receiverId: swapRequest.requesterId,
        content: `📱 TAKAS QR KODU\n\n"${swapRequest.product.title}" ürünü için QR kodunuz hazır!\n\n🔹 Teslim Yeri: ${deliveryPointName || customLocation}\n\n⚠️ Ürünü teslim alırken bu QR kodu taratın. QR okutulduktan sonra size email ile 6 haneli doğrulama kodu gelecektir.\n\nQR Kod: ${qrCode}`,
        productId: swapRequest.productId,
        isModerated: true,
        moderationResult: 'approved',
        metadata: JSON.stringify({
          type: 'qr_code',
          swapRequestId,
          qrCode,
          qrCodeUrl,
          deliveryLocation: deliveryPointName || customLocation
        })
      }
    })

    // Alıcıya push bildirim gönder
    sendPushToUser(swapRequest.requesterId, NotificationTypes.SWAP_DELIVERY_SETUP, {
      productTitle: swapRequest.product.title,
      swapId: swapRequestId,
      deliveryMethod,
      location: deliveryPointName || customLocation
    }).catch(err => console.error('Push notification error:', err))

    return NextResponse.json({
      success: true,
      qrCode: updated.qrCode,
      qrCodeUrl,
      deliveryMethod: updated.deliveryMethod,
      deliveryPointName,
      customLocation: updated.customLocation,
      senderPhotosCount: senderPhotos.length,
      message: 'QR kod oluşturuldu ve alıcıya mesaj olarak gönderildi.',
      instructions: [
        'QR kod alıcıya mesaj olarak gönderildi',
        'Teslim noktasında buluşun ve ürünü teslim edin',
        'Alıcı QR kodu taradığında emailine 6 haneli kod gidecek',
        'Alıcı kodu girince teslimat onaylanır'
      ]
    })
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
