import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'
import { sendEmail } from '@/lib/email'
import { calculateDeposits, lockDeposit, getUserTrustInfo, getTrustBadgeInfo, activateEscrow, getTrustRestrictions } from '@/lib/trust-system'
import { 
  calculateRiskTier, 
  calculateDisputeWindowEnd, 
  canAutoComplete,
  DISPUTE_WINDOW_HOURS,
  type RiskTier
} from '@/lib/swap-config'
import { checkSwapEligibility, checkSwapCapacity, checkFirstSwapGainLimit } from '@/lib/valor-system'
import { validate, createSwapSchema } from '@/lib/validations'
import { checkSpamSwaps, logSuspiciousActivity } from '@/lib/fraud-detection'
import { transformProfileImageUrl } from '@/lib/s3'

// In-memory rate limiter for swap requests
const swapRequestRateLimitMap = new Map<string, { count: number; resetTime: number }>()

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}

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

// ========== SWAP EMAIL FUNCTIONS ==========
async function sendSwapEmail(
  recipientEmail: string,
  recipientName: string,
  subject: string,
  htmlBody: string
) {
  try {
    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_EMAIL_DORULAMA_KODU,
        subject,
        body: htmlBody,
        is_html: true,
        recipient_email: recipientEmail,
        sender_email: 'noreply@takas-a.com',
        sender_alias: 'TAKAS-A',
      }),
    })
    const result = await response.json()
    return result.success
  } catch (error) {
    console.error('Swap email send error:', error)
    return false
  }
}

function buildSwapAcceptedEmail(
  userName: string,
  productTitle: string,
  otherUserName: string,
  isOwner: boolean,
  isProductSwap: boolean,
  offeredProductTitle?: string
) {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 40px 20px;">
    <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #7c3aed; margin: 0; font-size: 28px;">TAKAS-A</h1>
        <p style="color: #22c55e; margin-top: 8px; font-weight: bold;">✅ Takas Onaylandı!</p>
      </div>
      
      <p style="color: #334155; font-size: 16px;">Merhaba ${userName},</p>
      
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">
        <strong>${otherUserName}</strong> ile 
        <strong>${productTitle}</strong>${isProductSwap && offeredProductTitle ? ` ↔ <strong>${offeredProductTitle}</strong>` : ''} 
        takası onaylandı!
      </p>
      
      <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #166534; margin: 0 0 10px;">📋 Sonraki Adımlar:</h3>
        <ol style="color: #166534; font-size: 14px; line-height: 1.8; padding-left: 20px;">
          <li>Karşı tarafla teslim yeri ve zamanı netleştirin</li>
          <li>Sohbet panelindeki Shape Code bölümünü kullanın</li>
          <li>${isOwner ? 'Shape Code üretip alıcıyla doğrulayın' : 'Şekilleri girip teslimatı doğrulayın'}</li>
          <li>Doğrulama sonrası takas tamamlanır 🎉</li>
        </ol>
      </div>

      <p style="color: #ef4444; font-size: 13px; text-align: center; font-weight: bold;">
        ⚠️ Teslim doğrulama adımlarını yalnızca TAKAS-A sohbet panelinden yürütün.
      </p>
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://takas-a.com/takaslarim" style="background: #7c3aed; color: white; padding: 14px 30px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 15px;">
          Takaslarıma Git
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        TAKAS-A — Güvenli Takas Platformu
      </p>
    </div>
  </div>
  `
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
    const status = searchParams.get('status') // 'pending', 'accepted', 'active_count' vs.
    const role = searchParams.get('role') // 'owner' veya 'requester'
    const countOnly = searchParams.get('count') === 'true'
    const isAdmin = user.role === 'admin'
    const isChairman = user.email?.toLowerCase() === 'join@takas-a.com'

    const takeParam = Number.parseInt(searchParams.get('take') || '50', 10)
    const skipParam = Number.parseInt(searchParams.get('skip') || '0', 10)
    const take = Number.isNaN(takeParam) ? 50 : Math.min(Math.max(takeParam, 1), 100)
    const skip = Number.isNaN(skipParam) ? 0 : Math.max(skipParam, 0)

    // Aktif takas sayısı (10 adımlı akış status değerleri)
    if (status === 'active_count') {
      const activeStatuses = [
        'pending',
        'accepted',
        'awaiting_delivery',
        'delivered',
        'cancel_requested'
      ]
      const count = await prisma.swapRequest.count({
        where: {
          OR: [
            { requesterId: user.id },
            { ownerId: user.id }
          ],
          status: { in: activeStatuses }
        }
      })
      return NextResponse.json({ count })
    }

    // Admin can see all swap requests
    if (isAdmin && searchParams.get('all') === 'true') {
      const allRequests = await prisma.swapRequest.findMany({
        include: {
          product: {
            include: { category: true, user: { select: { id: true, name: true, nickname: true, email: true, image: true } } },
          },
          requester: {
            select: { id: true, name: true, nickname: true, email: true, image: true },
          },
          owner: {
            select: { id: true, name: true, nickname: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
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
      // Chairman hesabında gelen tekliflerin görünürlüğünü garanti et
      whereCondition = isChairman
        ? {
            OR: [
              { ownerId: user.id },
              { product: { userId: user.id } }
            ]
          }
        : { ownerId: user.id }
    }

    // Role filtresi (owner/requester) - bottom nav badge için
    if (role === 'owner') {
      whereCondition = { ownerId: user.id }
    } else if (role === 'requester') {
      whereCondition = { requesterId: user.id }
    }

    // Status filtresi
    if (status) {
      whereCondition.status = status
    }

    // Sadece sayı isteniyorsa
    if (countOnly) {
      const count = await prisma.swapRequest.count({ where: whereCondition })
      return NextResponse.json({ count })
    }

    const swapRequests = await prisma.swapRequest.findMany({
      where: whereCondition,
      include: {
        product: {
          include: { category: true, user: { select: { id: true, name: true, nickname: true, image: true } } },
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
      take,
      skip,
    })

    // delivery_proposed durumundaki request'ler için lastProposedBy bilgisini ekle
    const deliveryProposedIds = swapRequests
      .filter(r => r.status === 'delivery_proposed')
      .map(r => r.id)

    let lastProposedByMap: Record<string, string> = {}
    if (deliveryProposedIds.length > 0) {
      const proposalLogs = await prisma.swapStatusLog.findMany({
        where: {
          swapRequestId: { in: deliveryProposedIds },
          reason: { startsWith: 'DELIVERY_PROPOSAL|' },
        },
        orderBy: { createdAt: 'desc' },
      })

      // Her swap request için en son proposal'ı bul
      for (const log of proposalLogs) {
        if (!lastProposedByMap[log.swapRequestId] && log.reason) {
          try {
            const proposalJson = log.reason.replace('DELIVERY_PROPOSAL|', '')
            const proposal = JSON.parse(proposalJson)
            lastProposedByMap[log.swapRequestId] = proposal.proposedBy
          } catch (e) {
            // JSON parse hatası - atla
          }
        }
      }
    }

    // lastProposedBy bilgisini ve profil fotoğrafı URL'lerini ekle
    const requestsWithProposedBy = swapRequests.map(r => ({
      ...r,
      lastProposedBy: lastProposedByMap[r.id] || null,
      // Profil fotoğrafı URL dönüşümleri
      requester: r.requester ? {
        ...r.requester,
        image: transformProfileImageUrl(r.requester.image)
      } : r.requester,
      owner: r.owner ? {
        ...r.owner,
        image: transformProfileImageUrl(r.owner.image)
      } : r.owner,
      product: r.product ? {
        ...r.product,
        user: r.product.user ? {
          ...r.product.user,
          image: transformProfileImageUrl(r.product.user.image)
        } : r.product.user
      } : r.product,
    }))

    return NextResponse.json({ requests: requestsWithProposedBy })
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
      select: { id: true, name: true, email: true, valorBalance: true, lockedValor: true, isPhoneVerified: true, pendingReviewSwapId: true, trustScore: true, isVip: true, emailVerified: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Email doğrulama kontrolü
    if (!user.emailVerified) {
      return new Response(
        JSON.stringify({
          error: 'Email doğrulaması gerekli',
          code: 'EMAIL_NOT_VERIFIED'
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Memory leak önlemi — 10.000 kayıttan büyüyünce temizle
    if (swapRequestRateLimitMap.size > 10000) swapRequestRateLimitMap.clear()

    // Rate limiting - dakikada max 10 teklif
    const now = Date.now()
    const SWAP_LIMIT = 10
    const SWAP_WINDOW = 60 * 1000 // 1 dakika
    const userSwapRateData = swapRequestRateLimitMap.get(user.id) || { count: 0, resetTime: 0 }
    if (now > userSwapRateData.resetTime) {
      swapRequestRateLimitMap.set(user.id, { count: 1, resetTime: now + SWAP_WINDOW })
    } else if (userSwapRateData.count >= SWAP_LIMIT) {
      return NextResponse.json(
        { error: 'Çok fazla teklif gönderdiniz. Lütfen 1 dakika bekleyin.' },
        { status: 429, headers: SECURITY_HEADERS }
      )
    } else {
      userSwapRateData.count++
      swapRequestRateLimitMap.set(user.id, userSwapRateData)
    }

    // ========================================
    // ZORUNLU RATING KONTROLÜ
    // Önceki takası değerlendirmeden yeni teklif gönderemez
    // ========================================
    if (user.pendingReviewSwapId) {
      return NextResponse.json({ 
        error: 'Önce son takasınızı değerlendirmeniz gerekiyor!',
        pendingReviewSwapId: user.pendingReviewSwapId,
        requiresReview: true
      }, { status: 400 })
    }

    // ========================================
    // GÜNLÜK TAKİS TEKLİFİ LİMİTİ (3/gün)
    // VIP kullanıcılar sınırsız teklif gönderebilir
    // İptal edilen teklifler sayılmaz (hak geri gelir)
    // ========================================
    if (!user.isVip) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const todayCount = await prisma.swapRequest.count({
        where: {
          requesterId: user.id,
          createdAt: { gte: today },
          // İptal edilen teklifler sayılmaz (hak geri gelir)
          status: { notIn: ['cancelled', 'auto_cancelled', 'expired'] }
        }
      })

      if (todayCount >= 3) {
        return NextResponse.json(
          { 
            error: 'Günlük takas teklifi limitinize ulaştınız (3/3). Yarın tekrar deneyebilirsiniz.',
            used: todayCount,
            limit: 3,
            remaining: 0
          },
          { status: 429 }
        )
      }
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

    // ========================================
    // GÜVEN KISITLAMALARI KONTROLÜ (AKTİF)
    // Trust score'a göre kısıtlamalar uygulanır
    // ========================================
    const trustRestrictions = getTrustRestrictions(user.trustScore ?? 100)
    
    if (trustRestrictions.isSuspended) {
      return NextResponse.json({ 
        error: trustRestrictions.message || 'Hesabınız askıya alınmıştır.',
        trustScore: user.trustScore,
        isSuspended: true
      }, { status: 403 })
    }
    
    if (!trustRestrictions.canSwap) {
      return NextResponse.json({ 
        error: 'Güven puanınız takas yapmanıza izin vermiyor.',
        trustScore: user.trustScore
      }, { status: 403 })
    }
    
    // Aktif takas limiti kontrol et
    const activeSwapCount = await prisma.swapRequest.count({
      where: {
        OR: [
          { requesterId: user.id },
          { ownerId: user.id }
        ],
        status: {
          in: ['pending', 'accepted', 'awaiting_delivery', 'delivered', 'cancel_requested']
        }
      }
    })
    
    if (activeSwapCount >= trustRestrictions.maxActiveSwaps) {
      return NextResponse.json({ 
        error: `Güven puanınıza göre en fazla ${trustRestrictions.maxActiveSwaps} aktif takas yapabilirsiniz. Mevcut: ${activeSwapCount}`,
        trustScore: user.trustScore,
        limit: trustRestrictions.maxActiveSwaps,
        current: activeSwapCount
      }, { status: 400 })
    }

    // Telefon doğrulaması - Şimdilik devre dışı, pek yakında aktif olacak
    // if (!user.isPhoneVerified) {
    //   return NextResponse.json({ 
    //     error: 'Takas yapabilmek için telefon numaranızı doğrulamanız gerekiyor',
    //     requiresPhoneVerification: true 
    //   }, { status: 403 })
    // }

    const body = await request.json()
    
    // Debug log
    console.log('[swap-requests POST] Received body:', JSON.stringify(body, null, 2))
    
    // Input validation
    const { success, error: validationError } = validate(createSwapSchema, body)
    if (!success) {
      console.error('[swap-requests POST] Validation failed:', validationError)
      return NextResponse.json({ 
        error: validationError || 'Geçersiz istek parametreleri',
        details: 'Validation failed'
      }, { status: 400 })
    }
    
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
        { error: 'Kendi ürününüze teklif veremezsiniz' },
        { status: 400 }
      )
    }

    // Block kontrolü: teklif gönderen ↔ ürün sahibi arası engel var mı?
    const block = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: product.userId },
          { blockerId: product.userId, blockedId: user.id },
        ],
      },
    })

    if (block) {
      return NextResponse.json(
        { error: 'Bu kullanıcıya takas teklifi gönderemezsiniz' },
        { status: 403 }
      )
    }

    // Teklif edilen ürünün değerini al
    let offeredProductValue = 0
    let offeredProductTitle = ''
    if (offeredProductId) {
      const offeredProduct = await prisma.product.findUnique({
        where: { id: offeredProductId },
        select: { valorPrice: true, userId: true, status: true, title: true }
      })
      if (offeredProduct && offeredProduct.userId === user.id) {
        // Status kontrolü - sadece active ürünler teklif edilebilir
        if (offeredProduct.status !== 'active') {
          return NextResponse.json(
            { error: 'Bu ürün artık takas için müsait değil' },
            { status: 400 }
          )
        }
        offeredProductValue = offeredProduct.valorPrice
        offeredProductTitle = offeredProduct.title
      }
    }

    // Depozito hesapla
    const depositCalc = await calculateDeposits(
      user.id,
      product.userId,
      product.valorPrice,
      offeredProductValue || undefined
    )

    // Trust kısıtlamalarına göre teminat çarpanı uygula
    if (trustRestrictions.requiresHigherDeposit && trustRestrictions.depositMultiplier > 1) {
      depositCalc.requesterDeposit = Math.ceil(depositCalc.requesterDeposit * trustRestrictions.depositMultiplier)
      depositCalc.ownerDeposit = Math.ceil(depositCalc.ownerDeposit * trustRestrictions.depositMultiplier)
      depositCalc.totalLocked = depositCalc.requesterDeposit + depositCalc.ownerDeposit
    }

    // Kullanıcının güven bilgisini al
    const requesterTrustInfo = await getUserTrustInfo(user.id)
    const trustBadge = getTrustBadgeInfo(requesterTrustInfo.trustLevel)

    // Sadece önizleme mi?
    if (previewOnly) {
      const availableBalance = user.valorBalance - user.lockedValor
      
      // Kapasite bilgisi — ilk takas limiti için
      const { checkFirstSwapGainLimit, getUsableBonusValor, getCompletedSwapCount } = await import('@/lib/valor-system')
      const completedSwaps = await getCompletedSwapCount(user.id)
      const bonusInfo = await getUsableBonusValor(user.id)
      
      let capacityInfo = {
        completedSwaps,
        currentNetGain: 0,
        remainingAllowance: 400,
        maxAllowedGain: 400,
        lockedBonus: bonusInfo.lockedBonus,
      }
      
      if (completedSwaps < 3) {
        const gainCheck = await checkFirstSwapGainLimit(user.id, 0)
        if (gainCheck.details) {
          capacityInfo.currentNetGain = gainCheck.details.currentNetGain
          capacityInfo.remainingAllowance = gainCheck.details.remainingAllowance
          capacityInfo.maxAllowedGain = gainCheck.details.maxAllowedGain
        }
      }
      
      return NextResponse.json({
        preview: true,
        depositRequired: depositCalc.requesterDeposit,
        availableBalance,
        canAfford: availableBalance >= depositCalc.requesterDeposit,
        trustLevel: requesterTrustInfo.trustLevel,
        trustBadge: trustBadge.label,
        depositRate: `%${Math.round(requesterTrustInfo.depositRate * 100)}`,
        // Yeni kapasite bilgileri
        completedSwaps: capacityInfo.completedSwaps,
        currentNetGain: capacityInfo.currentNetGain,
        remainingAllowance: capacityInfo.remainingAllowance,
        maxAllowedGain: capacityInfo.maxAllowedGain,
        lockedBonus: capacityInfo.lockedBonus,
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

    // ========================================
    // SPAM ÖNLEME: Aynı ürüne çoklu teklif kontrolü
    // ========================================
    
    // Aktif statüler - bu statülerde zaten teklif varsa yeni teklif engellenecek
    const activeStatuses = ['pending', 'accepted', 'awaiting_delivery', 'delivered']
    
    // Aktif teklif var mı kontrol et
    const existingActiveOffer = await prisma.swapRequest.findFirst({
      where: {
        productId,
        requesterId: user.id,
        status: { in: activeStatuses },
      },
    })

    if (existingActiveOffer) {
      return NextResponse.json(
        { error: 'Bu ürün için zaten aktif bir teklifiniz var' },
        { status: 400 }
      )
    }
    
    // Reddedilen/iptal edilen teklif var mı kontrol et (24 saat kuralı)
    const recentRejectedRequest = await prisma.swapRequest.findFirst({
      where: {
        productId,
        requesterId: user.id,
        status: { in: ['rejected', 'cancelled'] },
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Son 24 saat
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    if (recentRejectedRequest) {
      const hoursPassed = Math.floor((Date.now() - recentRejectedRequest.updatedAt.getTime()) / (1000 * 60 * 60))
      const hoursRemaining = 24 - hoursPassed
      return NextResponse.json(
        { error: `Bu ürüne tekrar teklif göndermek için ${hoursRemaining} saat beklemeniz gerekiyor.` },
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
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
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
          swapRequestId: swapRequest.id,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({
            type: 'swap_request'
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

    // Ürün sahibine email bildirimi gönder (fire & forget)
    ;(async () => {
      try {
        await sendEmail({
          to: product.user.email,
          subject: `🔄 Ürününüze yeni bir takas teklifi var!`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
              <h2 style="color:#7c3aed">Yeni Takas Teklifi! 🔄</h2>
              <p>Merhaba <strong>${product.user.name || 'Kullanıcı'}</strong>,</p>
              <p><strong>${user.name || 'Bir kullanıcı'}</strong> ürününüz için takas teklifi gönderdi.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr style="background:#f3f4f6">
                  <td style="padding:8px"><strong>Ürününüz:</strong></td>
                  <td style="padding:8px">${product.title}</td>
                </tr>
                ${offeredProductTitle ? `<tr>
                  <td style="padding:8px"><strong>Teklif edilen:</strong></td>
                  <td style="padding:8px">${offeredProductTitle}</td>
                </tr>` : ''}
              </table>
              <a href="https://takas-a.com/takas-firsatlari" 
                 style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
                Teklifi Görüntüle →
              </a>
              <p style="color:#6b7280;font-size:12px;margin-top:24px">
                Takas-A • Para olmadan takas!
              </p>
            </div>
          `
        })
      } catch (e) { console.error('Teklif email hatası:', e) }
    })()

    // Arka planda şüpheli aktivite kontrolü (response'u bekletmez)
    checkSpamSwaps(user.id).then(activity => {
      if (activity) logSuspiciousActivity(activity)
    }).catch(err => console.error('Fraud check error:', err))

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
            swapRequestId: swapId,
            isModerated: true,
            moderationResult: 'approved',
            metadata: JSON.stringify({ type: 'price_agreed', agreedPrice: requesterPrice })
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
          swapRequestId: swapId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({ type: 'price_proposal', proposedPrice })
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
          swapRequestId: swapId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({ type: 'price_accepted', agreedPrice })
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

      // Shape-code canonical akışta QR üretimi yok.
      // Geriye dönük uyumluluk için sadece teslim kodu alanları tutulur (kullanılırsa).
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
      const isProductToProductSwap = !!swapRequest.offeredProductId
      let verificationCodeB: string | null = null

      if (isProductToProductSwap) {
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
        deliveryVerificationCode: verificationCode,
        verificationCodeSentAt: new Date(),
        depositsLocked: true,
        requesterDeposit: deposits.requesterDeposit,
        escrowStatus: 'active',
        riskTier,
        autoCompleteEligible
      }

      if (isProductToProductSwap && verificationCodeB) {
        updateData.deliveryVerificationCodeB = verificationCodeB
        updateData.verificationCodeBSentAt = new Date()
      }
      
      await prisma.swapRequest.update({
        where: { id: swapId },
        data: updateData
      })

      // Not: EscrowLedger kaydı artık lockDeposit() fonksiyonunda otomatik oluşturuluyor

      // Onay mesajı - Shape Code canonical akış
      const swapTypeMessage = isProductToProductSwap
        ? `✅ ÜRÜNE KARŞI ÜRÜN TAKASI ONAYLANDI!\n\n🔄 Her iki taraf da hem satıcı hem alıcı konumundadır.\n\n🔐 Teslim doğrulama için sohbet panelindeki Shape Code adımlarını takip edin.`
        : `✅ Takas onaylandı! Teslim doğrulama Shape Code ile devam eder.`
      
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: isRequester ? swapRequest.ownerId : swapRequest.requesterId,
          content: swapTypeMessage,
          productId: swapRequest.productId,
          swapRequestId: swapId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({ 
            type: isProductToProductSwap ? 'product_swap_confirmed' : 'swap_confirmed', 
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

      // ═══ EMAIL GÖNDERİMİ ═══
      // Her iki tarafa da email gönder
      const ownerUser = await prisma.user.findUnique({
        where: { id: swapRequest.ownerId },
        select: { email: true, name: true, nickname: true }
      })
      const requesterUser = await prisma.user.findUnique({
        where: { id: swapRequest.requesterId },
        select: { email: true, name: true, nickname: true }
      })

      const ownerName = ownerUser?.nickname || ownerUser?.name || 'Kullanıcı'
      const requesterName = requesterUser?.nickname || requesterUser?.name || 'Kullanıcı'
      const offeredProductTitle = (swapRequest as any).offeredProduct?.title

      // Owner'a email
      if (ownerUser?.email) {
        const ownerHtml = buildSwapAcceptedEmail(
          ownerName,
          swapRequest.product.title,
          requesterName,
          true, // isOwner
          isProductToProductSwap,
          offeredProductTitle
        )
        sendSwapEmail(
          ownerUser.email,
          ownerName,
          `✅ Takas Onaylandı: ${swapRequest.product.title}`,
          ownerHtml
        ).catch(err => console.error('Owner email error:', err))
      }

      // Requester'a email
      if (requesterUser?.email) {
        const requesterHtml = buildSwapAcceptedEmail(
          requesterName,
          swapRequest.product.title,
          ownerName,
          false, // isRequester
          isProductToProductSwap,
          offeredProductTitle
        )
        sendSwapEmail(
          requesterUser.email,
          requesterName,
          `✅ Takas Onaylandı: ${swapRequest.product.title}`,
          requesterHtml
        ).catch(err => console.error('Requester email error:', err))
      }

      // ═══ SOHBETE SHAPE CODE BİLGİSİ ═══
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: isRequester ? swapRequest.ownerId : swapRequest.requesterId,
          content: '🔐 Teslim doğrulama artık Shape Code ile yapılır. Lütfen sohbet panelindeki Shape Code adımlarını takip edin.',
          productId: swapRequest.productId,
          swapRequestId: swapId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({
            type: 'shape_code_info'
          })
        }
      })

      return NextResponse.json({
        success: true,
        message: isProductToProductSwap
          ? 'Ürüne karşı ürün takası onaylandı. Teslim doğrulama Shape Code ile ilerler.'
          : 'Takas onaylandı. Teslim doğrulama Shape Code ile ilerler.',
        isProductToProductSwap,
        agreedPrice
      })
    }

    // ========== ÜRÜN TEKLİFİNİ REDDET, VALOR İLE DEVAM ET ==========
    if (action === 'reject_product_offer') {
      const swapRequest = await prisma.swapRequest.findUnique({
        where: { id: swapId },
        include: { 
          product: true, 
          offeredProduct: true,
          owner: { select: { id: true, name: true } },
          requester: { select: { id: true, name: true, email: true } }
        }
      })
      
      if (!swapRequest) {
        return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
      }
      
      // Sadece owner yapabilir
      if (swapRequest.ownerId !== user.id) {
        return NextResponse.json({ error: 'Bu işlemi sadece ürün sahibi yapabilir' }, { status: 403 })
      }
      
      // Ürün teklifi yoksa hata
      if (!swapRequest.offeredProductId) {
        return NextResponse.json({ error: 'Bu talepte ürün teklifi bulunmuyor' }, { status: 400 })
      }
      
      // Ürün teklifini kaldır, sadece Valor ile devam
      const updatedSwap = await prisma.swapRequest.update({
        where: { id: swapId },
        data: {
          offeredProductId: null,
          negotiationStatus: 'counter_proposed',
          pendingValorAmount: swapRequest.product.valorPrice,
          agreedPriceOwner: swapRequest.product.valorPrice,
        },
        include: {
          product: true,
          requester: { select: { id: true, name: true, email: true } },
          owner: { select: { id: true, name: true, email: true } },
        }
      })
      
      // Bildirim mesajı gönder
      const messageContent = body.message || 'Ürün teklifiniz için teşekkürler, ancak Valor ile devam etmeyi tercih ediyorum. Lütfen tam Valor teklifi yapın.'
      
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: swapRequest.requesterId,
          content: `💰 ${messageContent}\n\n📌 İstenen Valor: ${swapRequest.product.valorPrice}V`,
          productId: swapRequest.productId,
          swapRequestId: swapId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({ 
            type: 'product_offer_rejected', 
            requiredValor: swapRequest.product.valorPrice 
          })
        }
      })
      
      // Push bildirim gönder
      sendPushToUser(swapRequest.requesterId, NotificationTypes.PRODUCT_INTEREST, {
        productTitle: swapRequest.product.title,
        productId: swapRequest.productId,
        swapId,
        message: 'Ürün teklifiniz kabul edilmedi, Valor ile devam edilmesi isteniyor.'
      }).catch(err => console.error('Push notification error:', err))
      
      return NextResponse.json({ 
        success: true, 
        swap: updatedSwap,
        message: 'Valor ile devam tercihi iletildi'
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

    if (status === 'completed') {
      return NextResponse.json(
        { error: 'Takas tamamlama işlemi için /api/swap-requests/confirm endpointini kullanın' },
        { status: 400 }
      )
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
          escrowStatus: 'released',
          respondedAt: new Date()
        },
      })

      // Red mesajını sohbete ekle
      await prisma.message.create({
        data: {
          senderId: swapRequest.ownerId,
          receiverId: swapRequest.requesterId,
          content: `❌ Takas talebi reddedildi. Teminatınız iade edildi.`,
          productId: swapRequest.productId,
          swapRequestId: swapId,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({
            type: 'swap_rejected'
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

    // ========== LEGACY ACTIONS (QR / verification-code) DEPRECATED ==========
    if (action === 'ready_for_pickup' || action === 'send_code_to_seller') {
      return NextResponse.json(
        {
          success: false,
          legacy: true,
          error: 'Bu aksiyon kaldırıldı. Teslim doğrulama artık Shape Code ile yapılır.',
          next: {
            generate: '/api/swap-requests/shape-code/generate',
            verify: '/api/swap-requests/shape-code/verify'
          }
        },
        { status: 410 }
      )
    }


    // KABUL DURUMU - Sadece owner kabul edebilir ve sadece pending durumunda
    if (status === 'accepted') {
      if (swapRequest.ownerId !== user.id) {
        return NextResponse.json(
          { error: 'Sadece ürün sahibi teklifi kabul edebilir' },
          { status: 403 }
        )
      }

      if (swapRequest.status !== 'pending') {
        return NextResponse.json(
          { error: 'Bu teklif artık beklemede değil' },
          { status: 400 }
        )
      }

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
    const updateData: any = { status }
    if (status === 'accepted' || status === 'rejected') {
      updateData.respondedAt = new Date()
    }

    const updatedRequest = await prisma.swapRequest.update({
      where: { id: swapId },
      data: updateData,
    })

    // Kabul bildirimi teklif gönderene
    if (status === 'accepted') {
      const conversationId = swapRequest.productId || swapRequest.requesterId

      // MESSAGE IDEMPOTENCY GUARD: aynı swap_accepted mesajı varsa tekrar üretme
      const existingSwapAcceptedMessage = await prisma.message.findFirst({
        where: {
          senderId: swapRequest.ownerId,
          receiverId: swapRequest.requesterId,
          OR: [
            {
              AND: [
                { swapRequestId: swapId },
                { metadata: { contains: '"type":"swap_accepted"' } }
              ]
            },
            {
              AND: [
                { metadata: { contains: '"type":"swap_accepted"' } },
                { metadata: { contains: `"swapRequestId":"${swapId}"` } },
                { metadata: { contains: `"conversationId":"${conversationId}"` } }
              ]
            },
            {
              AND: [
                { metadata: { contains: '"type":"swap_accepted"' } },
                { metadata: { contains: `"swapRequestId":"${swapId}"` } }
              ]
            }
          ]
        }
      })

      if (!existingSwapAcceptedMessage) {
        await prisma.message.create({
          data: {
            senderId: swapRequest.ownerId,
            receiverId: swapRequest.requesterId,
            content: `✅ Takas talebiniz kabul edildi! Teslim noktasında buluşabilirsiniz.`,
            productId: swapRequest.productId,
            swapRequestId: swapId,
            isModerated: true,
            moderationResult: 'approved',
            metadata: JSON.stringify({
              type: 'swap_accepted',
              conversationId
            })
          }
        })
      }

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