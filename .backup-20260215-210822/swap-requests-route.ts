import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'
import { calculateDeposits, lockDeposit, getUserTrustInfo, getTrustBadgeInfo, activateEscrow, releaseEscrow } from '@/lib/trust-system'
import { 
  calculateRiskTier, 
  calculateDisputeWindowEnd, 
  canAutoComplete,
  DISPUTE_WINDOW_HOURS,
  type RiskTier
} from '@/lib/swap-config'
import { checkSwapEligibility, checkSwapCapacity, checkFirstSwapGainLimit } from '@/lib/valor-system'

export const dynamic = 'force-dynamic'

// Send notification to admin
async function sendAdminNotification(data: {
  requesterName: string
  requesterEmail: string
  productTitle: string
  productId: string
  message?: string
}) {
  try {
    const appUrl = process.env.NEXTAUTH_URL || 'https://takas-a.com'
    const appName = 'TAKAS-A'
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7C3AED; border-bottom: 2px solid #7C3AED; padding-bottom: 10px;">
          💜 Yeni Ürün İlgi Bildirimi
        </h2>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 10px 0;"><strong>Kullanıcı:</strong> ${data.requesterName}</p>
          <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${data.requesterEmail}">${data.requesterEmail}</a></p>
          <p style="margin: 10px 0;"><strong>Ürün:</strong> ${data.productTitle}</p>
          ${data.message ? `
          <p style="margin: 10px 0;"><strong>Mesaj:</strong></p>
          <div style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #7C3AED;">
            ${data.message}
          </div>
          ` : ''}
        </div>
        <p style="margin: 20px 0;">
          <a href="${appUrl}/urun/${data.productId}" style="background: #7C3AED; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
            Ürünü Görüntüle
          </a>
        </p>
        <p style="color: #666; font-size: 12px;">
          Tarih: ${new Date().toLocaleString('tr-TR')}
        </p>
      </div>
    `

    await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_RN_LGI_BILDIRIMI,
        subject: `[TAKAS-A] Yeni İlgi: ${data.productTitle}`,
        body: htmlBody,
        is_html: true,
        recipient_email: 'join@takas-a.com',
        sender_email: `noreply@takas-a.com`,
        sender_alias: appName,
      }),
    })
  } catch (error) {
    console.error('Admin notification error:', error)
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'sent', 'received', veya null (tümü)
    const status = searchParams.get('status') // 'pending', 'accepted' vs.
    const isAdmin = user.role === 'admin'

    // Admin can see all swap requests
    if (isAdmin && searchParams.get('all') === 'true') {
      const allRequests = await prisma.swapRequest.findMany({
        include: {
          product: {
            include: { category: true, user: { select: { id: true, name: true, nickname: true, email: true } } },
          },
          requester: {
            select: { id: true, name: true, nickname: true, email: true, image: true },
          },
          owner: {
            select: { id: true, name: true, nickname: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({ requests: allRequests })
    }

    // Filtre koşullarını oluştur
    let whereCondition: any = {
      OR: [
        { requesterId: user.id },
        { ownerId: user.id }
      ]
    }

    // Type filtresi (sent/received)
    if (type === 'sent') {
      whereCondition = { requesterId: user.id }
    } else if (type === 'received') {
      whereCondition = { ownerId: user.id }
    }

    // Status filtresi
    if (status) {
      whereCondition.status = status
    }

    const swapRequests = await prisma.swapRequest.findMany({
      where: whereCondition,
      include: {
        product: {
          include: { category: true, user: { select: { id: true, name: true, nickname: true } } },
        },
        offeredProduct: {
          select: { id: true, title: true, images: true, valorPrice: true },
        },
        requester: {
          select: { id: true, name: true, nickname: true, email: true, image: true },
        },
        owner: {
          select: { id: true, name: true, nickname: true, email: true, image: true },
        },
        deliveryPoint: {
          select: { id: true, name: true, address: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ requests: swapRequests })
  } catch (error) {
    console.error('Swap requests fetch error:', error)
    return NextResponse.json(
      { error: 'Talepler yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true, valorBalance: true, lockedValor: true, isPhoneVerified: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // ========================================
    // KÖTÜ NİYETLİ KULLANIM KORUMASI
    // 1. En az 1 aktif ürün eklemiş olmalı
    // 2. İlk 30 gün içinde maksimum 3 takas teklifi
    // 3. Mevcut 7 gün / doğrulama şartı korunur
    // ========================================
    const swapEligibility = await checkSwapEligibility(user.id)
    if (!swapEligibility.eligible) {
      return NextResponse.json({ 
        error: swapEligibility.reason,
        swapEligibility: {
          canSwap: false,
          activeProducts: swapEligibility.details?.activeProductCount || 0,
          minProducts: swapEligibility.details?.minProductsRequired || 1,
          isNewUser: swapEligibility.details?.isNewUser || false,
          swapsUsed: swapEligibility.details?.swapRequestCount || 0,
          maxSwaps: swapEligibility.details?.maxSwapRequestsForNewUser || 3
        }
      }, { status: 403 })
    }

    // Telefon doğrulaması - Şimdilik devre dışı, pek yakında aktif olacak
    // if (!user.isPhoneVerified) {
    //   return NextResponse.json({ 
    //     error: 'Takas yapabilmek için telefon numaranızı doğrulamanız gerekiyor',
    //     requiresPhoneVerification: true 
    //   }, { status: 403 })
    // }

    const body = await request.json()
    const { productId, message, offeredProductId, offeredValor, previewOnly } = body

    if (!productId) {
      return NextResponse.json({ error: 'Ürün ID gerekli' }, { status: 400 })
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { user: true },
    })

    if (!product) {
      return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 })
    }

    if (product.userId === user.id) {
      return NextResponse.json(
        { error: 'Kendi ürününüze ilgi bildiremezsiniz' },
        { status: 400 }
      )
    }

    // Teklif edilen ürünün değerini al
    let offeredProductValue = 0
    if (offeredProductId) {
      const offeredProduct = await prisma.product.findUnique({
        where: { id: offeredProductId },
        select: { valorPrice: true, userId: true }
      })
      if (offeredProduct && offeredProduct.userId === user.id) {
        offeredProductValue = offeredProduct.valorPrice
      }
    }

    // Depozito hesapla
    const depositCalc = await calculateDeposits(
      user.id,
      product.userId,
      product.valorPrice,
      offeredProductValue || undefined
    )

    // Kullanıcının güven bilgisini al
    const requesterTrustInfo = await getUserTrustInfo(user.id)
    const trustBadge = getTrustBadgeInfo(requesterTrustInfo.trustLevel)

    // Sadece önizleme mi?
    if (previewOnly) {
      const availableBalance = user.valorBalance - user.lockedValor
      return NextResponse.json({
        preview: true,
        depositRequired: depositCalc.requesterDeposit,
        availableBalance,
        canAfford: availableBalance >= depositCalc.requesterDeposit,
        trustLevel: requesterTrustInfo.trustLevel,
        trustBadge: trustBadge.label,
        depositRate: `%${Math.round(requesterTrustInfo.depositRate * 100)}`,
        message: `Takas talebi için ${depositCalc.requesterDeposit} Valor teminat yatırmanız gerekiyor. Başarılı takas sonrası iade edilecektir.`
      })
    }

    // ========================================
    // SPEKÜLASYON ÖNLEME KONTROLLARI
    // 1. Bonus Valor %50 kısıtlaması (ilk takas öncesi)
    // 2. İlk 3 takasta net kazanç limiti (+400V max)
    // ========================================
    
    // Potansiyel net kazanç hesapla (hedef ürün değeri - teklif edilen değer)
    const potentialGain = product.valorPrice - (offeredProductValue || 0) - (offeredValor || 0)
    
    // Kapasite kontrolü (bonus kısıtlaması + kazanç limiti dahil)
    const capacityCheck = await checkSwapCapacity(
      user.id,
      depositCalc.requesterDeposit,
      potentialGain > 0 ? potentialGain : 0
    )
    
    if (!capacityCheck.canSwap) {
      return NextResponse.json({
        error: capacityCheck.reason,
        capacityDetails: {
          usableBalance: capacityCheck.usableBalance,
          lockedBonus: capacityCheck.lockedBonus,
          gainLimitOk: capacityCheck.gainLimitOk,
          depositRequired: depositCalc.requesterDeposit
        }
      }, { status: 403 })
    }

    // Yeterli bakiye kontrolü (eski kontrol - güvenlik için korundu)
    const availableBalance = capacityCheck.usableBalance
    if (availableBalance < depositCalc.requesterDeposit) {
      return NextResponse.json({
        error: `Yetersiz bakiye. Teminat için ${depositCalc.requesterDeposit} Valor gerekli, mevcut: ${availableBalance} Valor`,
        depositRequired: depositCalc.requesterDeposit,
        availableBalance
      }, { status: 400 })
    }

    // Check if already requested
    const existingRequest = await prisma.swapRequest.findFirst({
      where: {
        productId,
        requesterId: user.id,
        status: 'pending',
      },
    })

    if (existingRequest) {
      return NextResponse.json(
        { error: 'Bu ürün için zaten bekleyen bir talebiniz var' },
        { status: 400 }
      )
    }

    // Teklif edilen Valor miktarını belirle (varsayılan: ürün fiyatı)
    const proposedValorAmount = offeredValor !== undefined && offeredValor !== null && offeredValor !== '' 
      ? Number(offeredValor) 
      : product.valorPrice

    // Swap request oluştur
    const swapRequest = await prisma.swapRequest.create({
      data: {
        requesterId: user.id,
        ownerId: product.userId,
        productId,
        offeredProductId,
        message,
        status: 'pending',
        requesterDeposit: depositCalc.requesterDeposit,
        escrowStatus: 'locked',
        // Pazarlık alanları - ilk teklif fiyatını kaydet
        agreedPriceRequester: proposedValorAmount,
        pendingValorAmount: proposedValorAmount,
        negotiationStatus: 'price_proposed'
      },
      include: {
        product: true,
        requester: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // Depozito kilitle
    await lockDeposit(user.id, depositCalc.requesterDeposit, swapRequest.id, 'requester')

    // Mesajı da Message tablosuna ekle (sohbette görünmesi için)
    if (message && message.trim()) {
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: product.userId,
          content: `💜 Takas Talebi: ${message}`,
          productId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({
            type: 'swap_request',
            swapRequestId: swapRequest.id
          })
        }
      })
    }

    // Send notification to admin
    await sendAdminNotification({
      requesterName: user.name || 'Anonim',
      requesterEmail: user.email,
      productTitle: product.title,
      productId: product.id,
      message: message,
    })

    // Ürün sahibine push bildirim gönder
    sendPushToUser(product.userId, NotificationTypes.SWAP_REQUEST, {
      requesterName: user.name || 'Birisi',
      productTitle: product.title,
      swapId: swapRequest.id
    }).catch(err => console.error('Push notification error:', err))

    return NextResponse.json(swapRequest)
  } catch (error) {
    console.error('Swap request create error:', error)
    return NextResponse.json(
      { error: 'Talep oluşturulurken hata oluştu' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const { id, requestId, status, action, proposedPrice } = body
    const swapId = id || requestId // Support both field names

    // ========== FİYAT ÖNERİ SİSTEMİ ==========
    if (action === 'propose_price') {
      if (!swapId || proposedPrice === undefined) {
        return NextResponse.json({ error: 'Talep ID ve fiyat gerekli' }, { status: 400 })
      }

      const swapRequest = await prisma.swapRequest.findUnique({
        where: { id: swapId },
        include: { product: true, requester: true, owner: true }
      })

      if (!swapRequest) {
        return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 })
      }

      const isRequester = swapRequest.requesterId === user.id
      const isOwner = swapRequest.ownerId === user.id

      if (!isRequester && !isOwner) {
        return NextResponse.json({ error: 'Bu talep size ait değil' }, { status: 403 })
      }

      // Fiyat önerisini kaydet
      const updateData: any = {
        negotiationStatus: 'price_proposed'
      }

      if (isRequester) {
        updateData.agreedPriceRequester = proposedPrice
      } else {
        updateData.agreedPriceOwner = proposedPrice
      }

      const updated = await prisma.swapRequest.update({
        where: { id: swapId },
        data: updateData
      })

      // Fiyatlar eşleşiyor mu kontrol et
      const requesterPrice = isRequester ? proposedPrice : swapRequest.agreedPriceRequester
      const ownerPrice = isOwner ? proposedPrice : swapRequest.agreedPriceOwner

      if (requesterPrice !== null && ownerPrice !== null && requesterPrice === ownerPrice) {
        // Fiyatlar eşleşti! Anlaşma sağlandı
        await prisma.swapRequest.update({
          where: { id: swapId },
          data: {
            negotiationStatus: 'price_agreed',
            priceAgreedAt: new Date(),
            pendingValorAmount: requesterPrice
          }
        })

        // Anlaşma mesajı gönder
        await prisma.message.create({
          data: {
            senderId: user.id,
            receiverId: isRequester ? swapRequest.ownerId : swapRequest.requesterId,
            content: `🤝 Fiyat anlaşması sağlandı: ${requesterPrice} Valor! Şimdi takası onaylayabilirsiniz.`,
            productId: swapRequest.productId,
            isModerated: true,
            moderationResult: 'approved',
            metadata: JSON.stringify({ type: 'price_agreed', swapRequestId: swapId, agreedPrice: requesterPrice })
          }
        })

        // Push bildirim
        const otherUserId = isRequester ? swapRequest.ownerId : swapRequest.requesterId
        sendPushToUser(otherUserId, NotificationTypes.SWAP_REQUEST, {
          requesterName: user.name || 'Birisi',
          productTitle: `${swapRequest.product.title} - Fiyat anlaşması: ${requesterPrice} Valor`,
          swapId
        }).catch(err => console.error('Push error:', err))

        return NextResponse.json({
          success: true,
          priceAgreed: true,
          agreedPrice: requesterPrice,
          message: `Tebrikler! ${requesterPrice} Valor fiyatında anlaştınız.`
        })
      }

      // Karşı tarafa bildir
      const otherUserId = isRequester ? swapRequest.ownerId : swapRequest.requesterId
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: otherUserId,
          content: `💰 Fiyat önerisi: ${proposedPrice} Valor. Kabul ediyorsanız siz de aynı fiyatı girin.`,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({ type: 'price_proposal', swapRequestId: swapId, proposedPrice })
        }
      })

      sendPushToUser(otherUserId, NotificationTypes.SWAP_REQUEST, {
        requesterName: user.name || 'Birisi',
        productTitle: `${swapRequest.product.title} için ${proposedPrice} Valor önerdi`,
        swapId
      }).catch(err => console.error('Push error:', err))

      return NextResponse.json({
        success: true,
        priceAgreed: false,
        yourPrice: proposedPrice,
        otherPrice: isRequester ? swapRequest.agreedPriceOwner : swapRequest.agreedPriceRequester,
        message: 'Fiyat öneriniz gönderildi. Karşı tarafın onayı bekleniyor.'
      })
    }

    // ========== FİYAT DİREKT KABUL (Owner requester fiyatını kabul eder) ==========
    if (action === 'accept_price') {
      const swapRequest = await prisma.swapRequest.findUnique({
        where: { id: swapId },
        include: { product: true, requester: true, owner: true }
      })

      if (!swapRequest) {
        return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 })
      }

      const isOwner = swapRequest.ownerId === user.id
      if (!isOwner) {
        return NextResponse.json({ error: 'Sadece ürün sahibi teklifi kabul edebilir' }, { status: 403 })
      }

      // Requester'ın önerdiği fiyatı al
      const agreedPrice = swapRequest.agreedPriceRequester || swapRequest.pendingValorAmount || swapRequest.product.valorPrice

      // Anlaşmayı kaydet
      await prisma.swapRequest.update({
        where: { id: swapId },
        data: {
          agreedPriceOwner: agreedPrice,
          pendingValorAmount: agreedPrice,
          negotiationStatus: 'price_agreed',
          priceAgreedAt: new Date()
        }
      })

      // Anlaşma mesajı
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: swapRequest.requesterId,
          content: `🤝 Fiyat teklifi kabul edildi: ${agreedPrice} Valor! Şimdi takası başlatabilirsiniz.`,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({ type: 'price_accepted', swapRequestId: swapId, agreedPrice })
        }
      })

      // Push bildirim
      sendPushToUser(swapRequest.requesterId, NotificationTypes.SWAP_REQUEST, {
        requesterName: user.name || 'Ürün sahibi',
        productTitle: `${swapRequest.product.title} - Fiyat kabul edildi: ${agreedPrice} Valor`,
        swapId
      }).catch(err => console.error('Push error:', err))

      return NextResponse.json({
        success: true,
        priceAgreed: true,
        agreedPrice,
        message: `Teklif kabul edildi! ${agreedPrice} Valor üzerinden anlaşıldı.`
      })
    }

    // ========== TAKAS BAŞLATMA (Fiyat anlaşması sonrası) ==========
    if (action === 'confirm_swap') {
      const swapRequest = await prisma.swapRequest.findUnique({
        where: { id: swapId },
        include: { 
          product: { include: { category: true } }, 
          requester: true, 
          owner: true 
        }
      })

      if (!swapRequest) {
        return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 })
      }

      if (swapRequest.negotiationStatus !== 'price_agreed') {
        return NextResponse.json({ error: 'Önce fiyat anlaşması sağlanmalı' }, { status: 400 })
      }

      const isRequester = swapRequest.requesterId === user.id
      const isOwner = swapRequest.ownerId === user.id

      if (!isRequester && !isOwner) {
        return NextResponse.json({ error: 'Bu talep size ait değil' }, { status: 403 })
      }

      // QR kod ve 6 haneli kod oluştur (her zaman UPPERCASE)
      const timestamp = Date.now().toString(36).toUpperCase()
      const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase()
      const qrCode = `TAKAS-${timestamp}-${randomPart}`
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
      
      // ÜRÜNE KARŞI ÜRÜN TAKASI: İkinci QR kod ve doğrulama kodu (offeredProduct varsa)
      let qrCodeB: string | null = null
      let verificationCodeB: string | null = null
      const isProductToProductSwap = !!swapRequest.offeredProductId
      
      if (isProductToProductSwap) {
        const timestampB = (Date.now() + 1).toString(36).toUpperCase()
        const randomPartB = Math.random().toString(36).substring(2, 10).toUpperCase()
        qrCodeB = `TAKAS-${timestampB}-${randomPartB}`
        verificationCodeB = Math.floor(100000 + Math.random() * 900000).toString()
      }

      // Teminat hesapla ve kilitle
      const agreedPrice = swapRequest.pendingValorAmount || swapRequest.agreedPriceRequester || 0
      const deposits = await calculateDeposits(
        swapRequest.requesterId,
        swapRequest.ownerId,
        agreedPrice,
        0
      )

      // Requester yeterli Valor'a sahip mi?
      const requester = await prisma.user.findUnique({
        where: { id: swapRequest.requesterId },
        select: { valorBalance: true, lockedValor: true }
      })

      if (requester) {
        const available = requester.valorBalance - requester.lockedValor
        if (available < deposits.requesterDeposit) {
          return NextResponse.json({
            error: `Yetersiz bakiye. ${deposits.requesterDeposit} Valor teminat gerekli.`,
            depositRequired: deposits.requesterDeposit
          }, { status: 400 })
        }
      }

      // Depozito kilitle
      await lockDeposit(swapRequest.requesterId, deposits.requesterDeposit, swapId, 'requester')

      // Risk seviyesini hesapla
      const riskTier = calculateRiskTier(
        agreedPrice,
        swapRequest.product.category?.name
      )
      const autoCompleteEligible = riskTier === 'low'

      // Swap'ı güncelle
      const updateData: any = {
        status: 'accepted',
        qrCode,
        qrCodeGeneratedAt: new Date(),
        deliveryVerificationCode: verificationCode,
        verificationCodeSentAt: new Date(),
        depositsLocked: true,
        requesterDeposit: deposits.requesterDeposit,
        escrowStatus: 'active',
        riskTier,
        autoCompleteEligible
      }
      
      // Ürüne karşı ürün takası için ikinci QR kod bilgilerini ekle
      if (isProductToProductSwap && qrCodeB && verificationCodeB) {
        updateData.qrCodeB = qrCodeB
        updateData.qrCodeBGeneratedAt = new Date()
        updateData.deliveryVerificationCodeB = verificationCodeB
        updateData.verificationCodeBSentAt = new Date()
      }
      
      await prisma.swapRequest.update({
        where: { id: swapId },
        data: updateData
      })

      // Escrow ledger kaydı oluştur (requester zaten yukarıda tanımlı)
      if (requester) {
        await prisma.escrowLedger.create({
          data: {
            swapRequestId: swapId,
            userId: swapRequest.requesterId,
            type: 'freeze',
            amount: deposits.requesterDeposit,
            balanceBefore: requester.valorBalance,
            balanceAfter: requester.valorBalance,
            reason: 'Takas teminatı kilitlendi'
          }
        })
      }

      // Onay mesajı - Ürüne karşı ürün takası için özel mesaj
      const swapTypeMessage = isProductToProductSwap 
        ? `✅ ÜRÜNE KARŞI ÜRÜN TAKASI ONAYLANDI!\n\n🔄 Her iki taraf da hem satıcı hem alıcı konumundadır.\n\n📦 İKİ AYRI TESLİMAT GEREKLİ:\n\n1️⃣ QR Kod A (${swapRequest.product.title}):\n   → Alıcı: Talep eden (requester) taratacak\n   → Kod: ${qrCode?.slice(0, 15)}...\n\n2️⃣ QR Kod B (${(swapRequest as any).offeredProduct?.title || 'Teklif edilen ürün'}):\n   → Alıcı: Ürün sahibi (owner) taratacak\n   → Kod: ${qrCodeB?.slice(0, 15)}...\n\n⚠️ Her iki QR kod taratılıp onaylanınca takas tamamlanır.`
        : `✅ Takas onaylandı! QR Kod ve doğrulama kodu oluşturuldu. Teslim noktasında buluşabilirsiniz.`
      
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: isRequester ? swapRequest.ownerId : swapRequest.requesterId,
          content: swapTypeMessage,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({ 
            type: isProductToProductSwap ? 'product_swap_confirmed' : 'swap_confirmed', 
            swapRequestId: swapId,
            isProductToProductSwap
          })
        }
      })

      // Push bildirim
      const otherUserId = isRequester ? swapRequest.ownerId : swapRequest.requesterId
      sendPushToUser(otherUserId, NotificationTypes.SWAP_ACCEPTED, {
        productTitle: swapRequest.product.title,
        productId: swapRequest.productId,
        swapId
      }).catch(err => console.error('Push error:', err))

      return NextResponse.json({
        success: true,
        message: isProductToProductSwap 
          ? 'Ürüne karşı ürün takası onaylandı! İki ayrı QR kod oluşturuldu.'
          : 'Takas onaylandı! QR kod ve doğrulama kodu oluşturuldu.',
        qrCode,
        verificationCode,
        qrCodeB: isProductToProductSwap ? qrCodeB : undefined,
        verificationCodeB: isProductToProductSwap ? verificationCodeB : undefined,
        isProductToProductSwap,
        agreedPrice
      })
    }

    // ========== ESKİ SİSTEM (status güncellemesi) ==========
    if (!swapId || !status) {
      return NextResponse.json({ error: 'Talep ID ve durum gerekli' }, { status: 400 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapId },
      include: {
        product: true,
        offeredProduct: true,
        requester: true,
        owner: true
      }
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 })
    }

    // Owner or admin can accept/reject
    const isAdmin = user.role === 'admin'
    if (swapRequest.ownerId !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'Bu talebi güncelleme yetkiniz yok' },
        { status: 403 }
      )
    }

    // Takas tamamlama durumu - Progresif kesinti sistemi devreye girer
    if (status === 'completed' && swapRequest.status === 'accepted') {
      const { completeSwapWithFee, previewSwapFee } = await import('@/lib/valor-system')
      
      const result = await completeSwapWithFee(
        swapId,
        swapRequest.product.valorPrice
      )

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Takas tamamlanamadı' },
          { status: 400 }
        )
      }

      // Escrow'u serbest bırak - depozitolar iade edilir
      await releaseEscrow(swapId)

      // Tamamlama mesajını sohbete ekle
      await prisma.message.create({
        data: {
          senderId: swapRequest.ownerId,
          receiverId: swapRequest.requesterId,
          content: `🎉 Takas başarıyla tamamlandı! Değerlendirme yapmayı unutmayın.`,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({
            type: 'swap_completed',
            swapRequestId: swapId
          })
        }
      })

      // Her iki tarafa da takas tamamlandı bildirimi gönder
      const valorAmount = result.netAmount || 0
      
      sendPushToUser(swapRequest.requesterId, NotificationTypes.SWAP_COMPLETED, {
        productTitle: swapRequest.product.title,
        valorAmount,
        swapId
      }).catch(err => console.error('Push notification error:', err))
      
      sendPushToUser(swapRequest.ownerId, NotificationTypes.SWAP_COMPLETED, {
        productTitle: swapRequest.product.title,
        valorAmount,
        swapId
      }).catch(err => console.error('Push notification error:', err))

      return NextResponse.json({
        success: true,
        message: 'Takas başarıyla tamamlandı! Teminatlar iade edildi.',
        valorDetails: {
          productValue: swapRequest.product.valorPrice,
          fee: result.fee,
          netAmount: result.netAmount,
          effectiveRate: result.breakdown.effectiveRate,
          feeBreakdown: result.breakdown
        }
      })
    }

    // RED DURUMU - Depozito iade et
    if (status === 'rejected') {
      // Requester'ın depozitosunu iade et
      if (swapRequest.requesterDeposit && swapRequest.requesterDeposit > 0) {
        await prisma.user.update({
          where: { id: swapRequest.requesterId },
          data: { lockedValor: { decrement: swapRequest.requesterDeposit } }
        })
      }
      
      await prisma.swapRequest.update({
        where: { id: swapId },
        data: { 
          status: 'rejected',
          escrowStatus: 'released'
        },
      })

      // Red mesajını sohbete ekle
      await prisma.message.create({
        data: {
          senderId: swapRequest.ownerId,
          receiverId: swapRequest.requesterId,
          content: `❌ Takas talebi reddedildi. Teminatınız iade edildi.`,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({
            type: 'swap_rejected',
            swapRequestId: swapId
          })
        }
      })

      // Red bildirimi - Yeni bildirim tipi kullanılıyor
      sendPushToUser(swapRequest.requesterId, NotificationTypes.SWAP_REJECTED, {
        productTitle: swapRequest.product.title,
        swapId
      }).catch(err => console.error('Push notification error:', err))

      return NextResponse.json({
        success: true,
        message: 'Talep reddedildi. Teminat iade edildi.'
      })
    }

    // KABUL DURUMU - Owner da depozito yatırmalı (ürün takası ise)
    if (status === 'accepted') {
      // Eğer ürün takası varsa owner da depozito yatırmalı
      if (swapRequest.offeredProduct) {
        const ownerDepositCalc = await calculateDeposits(
          swapRequest.requesterId,
          swapRequest.ownerId,
          swapRequest.product.valorPrice,
          swapRequest.offeredProduct.valorPrice
        )

        const owner = await prisma.user.findUnique({
          where: { id: swapRequest.ownerId },
          select: { valorBalance: true, lockedValor: true }
        })

        if (owner) {
          const ownerAvailable = owner.valorBalance - owner.lockedValor
          if (ownerAvailable < ownerDepositCalc.ownerDeposit) {
            return NextResponse.json({
              error: `Yetersiz bakiye. Teminat için ${ownerDepositCalc.ownerDeposit} Valor gerekli, mevcut: ${ownerAvailable} Valor`,
              depositRequired: ownerDepositCalc.ownerDeposit,
              availableBalance: ownerAvailable
            }, { status: 400 })
          }

          // Owner depozitosunu kilitle
          await lockDeposit(swapRequest.ownerId, ownerDepositCalc.ownerDeposit, swapId, 'owner')
        }
      }

      // Escrow'u etkinleştir
      await activateEscrow(swapId)
    }

    // Normal durum güncellemesi
    const updatedRequest = await prisma.swapRequest.update({
      where: { id: swapId },
      data: { status },
    })

    // Kabul bildirimi teklif gönderene
    if (status === 'accepted') {
      // Kabul mesajını sohbete ekle
      await prisma.message.create({
        data: {
          senderId: swapRequest.ownerId,
          receiverId: swapRequest.requesterId,
          content: `✅ Takas talebiniz kabul edildi! Teslim noktasında buluşabilirsiniz.`,
          productId: swapRequest.productId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({
            type: 'swap_accepted',
            swapRequestId: swapId
          })
        }
      })

      sendPushToUser(swapRequest.requesterId, NotificationTypes.SWAP_ACCEPTED, {
        productTitle: swapRequest.product.title,
        productId: swapRequest.productId,
        swapId
      }).catch(err => console.error('Push notification error:', err))
    }

    return NextResponse.json(updatedRequest)
  } catch (error) {
    console.error('Swap request update error:', error)
    return NextResponse.json(
      { error: 'Talep güncellenirken hata oluştu' },
      { status: 500 }
    )
  }
}
