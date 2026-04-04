import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { quickModeration, aiModeration, processWarning, checkUserSuspension, WARNING_MESSAGES, POLICY_WARNING_MESSAGES } from '@/lib/message-moderation'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'
import { validate, createMessageSchema } from '@/lib/validations'
import { sanitizeText } from '@/lib/sanitize'
import { withRetry } from '@/lib/prisma-retry'
import { transformProfileImageUrl } from '@/lib/s3'
import { sendEmail } from '@/lib/email'

// In-memory rate limiter for message sending
const messageRateLimitMap = new Map<string, { count: number; resetTime: number }>()

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const startTime = Date.now()
  console.log('[Messages API] GET request started')
  
  try {
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email
    console.log('[Messages API] Session check:', userEmail ? 'authenticated' : 'no session')
    
    if (!userEmail) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }
    
    const user = await withRetry(() => prisma.user.findUnique({
      where: { email: userEmail },
    }))
    console.log('[Messages API] User found:', user?.id ? 'yes' : 'no')

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const otherUserId = searchParams.get('userId')
    const productId = searchParams.get('productId')
    const swapRequestId = searchParams.get('swapRequestId')
    const unreadOnly = searchParams.get('unreadOnly')
    console.log('[Messages API] Params:', { otherUserId, productId, swapRequestId, unreadOnly })

    // Sadece okunmamış mesaj sayısını döndür (badge için)
    if (unreadOnly === 'true') {
      const unreadCount = await withRetry(() => prisma.message.count({
        where: {
          receiverId: user.id,
          isRead: false,
        },
      }))
      console.log('[Messages API] Unread count:', unreadCount, 'in', Date.now() - startTime, 'ms')
      return NextResponse.json({ unreadCount })
    }

    // Get conversation with specific user (productId ve swapRequestId opsiyonel)
    if (otherUserId) {
      console.log('[Messages API] Fetching messages for userId:', otherUserId, 'productId:', productId, 'swapRequestId:', swapRequestId)
      
      // Where koşulu oluştur
      const whereCondition: any = {
        OR: [
          { senderId: user.id, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: user.id },
        ],
      }
      
      // swapRequestId varsa SADECE bu takasın mesajlarını getir (Takas Merkezi için)
      if (swapRequestId) {
        whereCondition.swapRequestId = swapRequestId
      }
      // productId varsa ekle (eski davranış)
      else if (productId) {
        whereCondition.productId = productId
      }
      
      const messages = await withRetry(() => prisma.message.findMany({
        where: whereCondition,
        include: {
          sender: {
            select: { id: true, name: true, image: true },
          },
          swapRequest: {
            select: { 
              id: true, 
              status: true,
              product: { select: { id: true, title: true } }
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }))
      
      console.log('[Messages API] Found messages:', messages.length, 'in', Date.now() - startTime, 'ms')

      // Mark messages as read (fire and forget - hata olursa önemli değil)
      const updateWhere: any = {
        senderId: otherUserId,
        receiverId: user.id,
        isRead: false,
      }
      if (swapRequestId) {
        updateWhere.swapRequestId = swapRequestId
      } else if (productId) {
        updateWhere.productId = productId
      }
      
      prisma.message.updateMany({
        where: updateWhere,
        data: { isRead: true, readAt: new Date() },
      }).catch(() => {})

      return NextResponse.json(messages)
    }

    // Optimize: Son 200 mesajı al ve grupla (performans için limit azaltıldı)
    // GÖREV 29: swapRequest bilgisi de dahil edildi
    console.log('[Messages API] Fetching conversation list...')
    const conversations = await withRetry(() => prisma.message.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { receiverId: user.id },
        ],
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        isRead: true,
        senderId: true,
        receiverId: true,
        productId: true,
        swapRequestId: true,
        sender: {
          select: { id: true, name: true, nickname: true, image: true },
        },
        receiver: {
          select: { id: true, name: true, nickname: true, image: true },
        },
        product: {
          select: { id: true, title: true, images: true },
        },
        swapRequest: {
          select: { 
            id: true, 
            status: true,
            product: { select: { id: true, title: true } }
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200, // 500'den 200'e düşürüldü - performans için
    }))
    console.log('[Messages API] Fetched', conversations.length, 'messages in', Date.now() - startTime, 'ms')

    // Group by conversation (other user + product)
    const conversationMap = new Map()
    let totalMessages = 0
    let readMessages = 0
    let unreadMessages = 0
    
    for (const msg of conversations) {
      const rawOtherUser = msg.senderId === user.id ? msg.receiver : msg.sender
      // Profil fotoğrafı path'ini full URL'e dönüştür
      const otherUser = {
        ...rawOtherUser,
        image: transformProfileImageUrl(rawOtherUser.image)
      }
      const key = `${otherUser.id}-${msg.productId || 'general'}`
      
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          otherUser,
          product: msg.product,
          lastMessage: {
            content: msg.content,
            createdAt: msg.createdAt,
            senderId: msg.senderId
          },
          unreadCount: 0,
        })
      }
      
      // Mesaj istatistikleri (sadece gelen mesajlar için)
      if (msg.receiverId === user.id) {
        totalMessages++
        if (msg.isRead) {
          readMessages++
        } else {
          unreadMessages++
          const conv = conversationMap.get(key)
          if (conv) conv.unreadCount++
        }
      }
    }

    const result = {
      conversations: Array.from(conversationMap.values()),
      stats: {
        totalMessages,
        readMessages,
        unreadMessages
      }
    }
    console.log('[Messages API] Returning', result.conversations.length, 'conversations in', Date.now() - startTime, 'ms')
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Messages API] Error:', error?.message || error, 'after', Date.now() - startTime, 'ms')
    return NextResponse.json(
      { error: 'Mesajlar yüklenirken hata oluştu', details: error?.message },
      { status: 500 }
    )
  }
}

// Email bildirimi gönder — fire and forget
async function sendMessageEmailNotification(
  receiverId: string,
  senderName: string,
  messagePreview: string,
  lang: string = 'tr'
) {
  try {
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { email: true, name: true },
    })
    if (!receiver?.email) return

    const receiverLang = (lang || 'tr') as 'tr' | 'en' | 'es' | 'ca'

    const subjects: Record<string, string> = {
      tr: '💬 Yeni Mesajınız Var — TAKAS-A',
      en: '💬 You Have a New Message — TAKAS-A',
      es: '💬 Tienes un Nuevo Mensaje — TAKAS-A',
      ca: '💬 Teniu un Nou Missatge — TAKAS-A',
    }

    const labels: Record<string, { heading: string; sentBy: string; btnText: string; footer: string }> = {
      tr: {
        heading: '💬 Yeni Mesajınız Var!',
        sentBy: 'size bir mesaj gönderdi:',
        btnText: 'Mesajı Görüntüle →',
        footer: 'Bu bildirimi TAKAS-A\'dan alıyorsunuz.',
      },
      en: {
        heading: '💬 You Have a New Message!',
        sentBy: 'sent you a message:',
        btnText: 'View Message →',
        footer: 'You are receiving this from TAKAS-A.',
      },
      es: {
        heading: '💬 ¡Tienes un Nuevo Mensaje!',
        sentBy: 'te envió un mensaje:',
        btnText: 'Ver Mensaje →',
        footer: 'Recibes este correo de TAKAS-A.',
      },
      ca: {
        heading: '💬 Teniu un Nou Missatge!',
        sentBy: 'us ha enviat un missatge:',
        btnText: 'Veure Missatge →',
        footer: 'Rebeu aquest correu de TAKAS-A.',
      },
    }

    const l = labels[receiverLang] || labels.tr
    const subject = subjects[receiverLang] || subjects.tr

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px">
        <h2 style="color:#FF6B35">${l.heading}</h2>
        <p><strong>${senderName}</strong> ${l.sentBy}</p>
        <div style="background:#f5f5f5;border-left:4px solid #FF6B35;padding:12px;margin:16px 0;border-radius:4px">
          <p style="margin:0;color:#333">"${messagePreview}"</p>
        </div>
        <a href="https://takas-a.com/mesajlar" 
           style="display:inline-block;background:#FF6B35;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
          ${l.btnText}
        </a>
        <p style="color:#999;font-size:12px;margin-top:20px">
          ${l.footer}
          <a href="https://takas-a.com/profil">Bildirim ayarları</a>
        </p>
      </div>
    `

    await sendEmail({ to: receiver.email, subject, html })
  } catch (emailError) {
    console.error('[Message Email] Gönderim hatası:', emailError)
    // Email hatası mesaj gönderimini engellemesin
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
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Rate limiting - dakikada max 20 mesaj
    const now = Date.now()
    const MSG_LIMIT = 20
    const MSG_WINDOW = 60 * 1000 // 1 dakika
    const userRateData = messageRateLimitMap.get(user.id) || { count: 0, resetTime: 0 }
    if (now > userRateData.resetTime) {
      messageRateLimitMap.set(user.id, { count: 1, resetTime: now + MSG_WINDOW })
    } else if (userRateData.count >= MSG_LIMIT) {
      return NextResponse.json(
        { error: 'Çok fazla mesaj gönderdiniz. Lütfen 1 dakika bekleyin.' },
        { status: 429, headers: SECURITY_HEADERS }
      )
    } else {
      userRateData.count++
      messageRateLimitMap.set(user.id, userRateData)
    }

    // Askıya alma kontrolü
    const suspensionCheck = await checkUserSuspension(user.id)
    if (suspensionCheck.isSuspended) {
      return NextResponse.json(
        { 
          error: suspensionCheck.reason,
          suspended: true,
          suspendedUntil: suspensionCheck.suspendedUntil
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { receiverId, content, productId, swapRequestId, location, lang = 'tr' } = body
    
    // Input validation (content zorunlu değil - location ile mesaj gönderilebilir)
    if (content) {
      const { success, error: validationError } = validate(createMessageSchema, { receiverId, content, productId })
      if (!success) {
        return NextResponse.json({ error: validationError }, { status: 400 })
      }
    }

    if (!receiverId || (!content && !location)) {
      return NextResponse.json(
        { error: 'Alıcı ve mesaj içeriği veya konum gerekli' },
        { status: 400 }
      )
    }

    if (receiverId === user.id) {
      return NextResponse.json(
        { error: 'Kendinize mesaj gönderemezsiniz' },
        { status: 400 }
      )
    }

    // Eğer sadece konum gönderiliyorsa, moderasyon gerekmiyor
    if (location && !content) {
      // Konum mesajı oluştur
      const locationMessage = await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId,
          content: `📍 Konum paylaşıldı`,
          productId,
          swapRequestId: swapRequestId || null,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({
            type: 'location',
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address || null
          })
        },
        include: {
          sender: {
            select: { id: true, name: true, image: true },
          },
        },
      })

      // Push bildirim gönder
      sendPushToUser(receiverId, NotificationTypes.NEW_MESSAGE, {
        senderName: user.name || 'Birisi',
        preview: '📍 Konum paylaşıldı',
        conversationId: productId || receiverId
      }).catch(err => console.error('Push notification error:', err))

      // Email bildirimi — fire and forget
      sendMessageEmailNotification(receiverId, user.name || 'Birisi', '📍 Konum paylaşıldı', lang)
        .catch(err => console.error('[Message Email] Error:', err))

      return NextResponse.json({
        ...locationMessage,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address
        }
      })
    }

    // Önce hızlı regex kontrolü yap (dil parametresiyle)
    const quickCheck = quickModeration(content, lang)
    
    // Eğer hızlı kontrol bir sorun bulursa, uyarı ile engelle
    let moderationResult = quickCheck
    
    // POLİTİKA İHLALİ - Mesaj iletilmez, kullanıcıya uyarı gösterilir
    if (moderationResult.result === 'policy_violation') {
      // Mesajı kaydetme, bildirimi gönderme
      console.log(`[POLICY VIOLATION] User ${user.id} message blocked. Type: ${moderationResult.violationType}, Patterns: ${moderationResult.detectedPatterns?.join(', ')}`)
      
      // Kullanıcıya uyarı mesajı döndür
      return NextResponse.json(
        { 
          error: 'policy_violation',
          blocked: true,
          warningMessage: moderationResult.warningMessage,
          violationType: moderationResult.violationType,
          reason: moderationResult.reason
        },
        { status: 422 } // Unprocessable Entity - işlenebilir ama kabul edilemez
      )
    }
    
    // XSS temizleme
    const cleanContent = sanitizeText(content)
    
    // Mesajı oluştur (moderasyon sonucuyla birlikte)
    const message = await prisma.message.create({
      data: {
        senderId: user.id,
        receiverId,
        content: cleanContent,
        productId,
        swapRequestId: swapRequestId || null,
        isModerated: true,
        moderationResult: moderationResult.result,
        moderationReason: moderationResult.reason,
        containsPersonalInfo: moderationResult.containsPersonalInfo,
        metadata: location ? JSON.stringify({
          type: 'location',
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address || null
        }) : undefined
      },
      include: {
        sender: {
          select: { id: true, name: true, image: true },
        },
      },
    })

    // Mesaj onaylandı - Push bildirim gönder
    sendPushToUser(receiverId, NotificationTypes.NEW_MESSAGE, {
      senderName: user.name || 'Birisi',
      preview: cleanContent.substring(0, 50) + (cleanContent.length > 50 ? '...' : ''),
      conversationId: productId || receiverId
    }).catch(err => console.error('Push notification error:', err))

    // Email bildirimi — fire and forget
    const emailPreview = cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : '')
    sendMessageEmailNotification(receiverId, user.name || 'Birisi', emailPreview, lang)
      .catch(err => console.error('[Message Email] Error:', err))

    // Backward compatible: wrap in { message } but also spread for old consumers
    return NextResponse.json({ ...message, message })
    
  } catch (error) {
    console.error('Message create error:', error)
    return NextResponse.json(
      { error: 'Mesaj gönderilirken hata oluştu' },
      { status: 500 }
    )
  }
}

// Admin email for message deletion
const ADMIN_EMAIL = 'join@takas-a.com'

// DELETE - Admin mesaj silme (gelen/giden)
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    // Sadece admin mesaj silebilir
    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const { messageId, messageIds, conversationUserId, productId, deleteType } = body

    // Tek mesaj silme
    if (messageId) {
      // Admin kendi gelen/giden mesajlarını silebilir
      const message = await prisma.message.findFirst({
        where: {
          id: messageId,
          OR: [
            { senderId: user.id },
            { receiverId: user.id }
          ]
        }
      })

      if (!message) {
        return NextResponse.json({ error: 'Mesaj bulunamadı veya silme yetkiniz yok' }, { status: 404 })
      }

      await prisma.message.delete({
        where: { id: messageId }
      })
      return NextResponse.json({ success: true, deleted: 1 })
    }

    // Birden fazla mesaj silme
    if (messageIds && Array.isArray(messageIds)) {
      const result = await prisma.message.deleteMany({
        where: {
          id: { in: messageIds },
          OR: [
            { senderId: user.id },
            { receiverId: user.id }
          ]
        }
      })
      return NextResponse.json({ success: true, deleted: result.count })
    }

    // Belirli bir kullanıcı ile tüm konuşmayı silme
    if (conversationUserId) {
      const whereClause: any = {
        OR: [
          { senderId: user.id, receiverId: conversationUserId },
          { senderId: conversationUserId, receiverId: user.id }
        ]
      }

      // deleteType ile gelen/giden filtreleme
      if (deleteType === 'sent') {
        whereClause.OR = [{ senderId: user.id, receiverId: conversationUserId }]
      } else if (deleteType === 'received') {
        whereClause.OR = [{ senderId: conversationUserId, receiverId: user.id }]
      }

      // Ürün bazlı filtreleme
      if (productId) {
        whereClause.productId = productId
      }

      const result = await prisma.message.deleteMany({
        where: whereClause
      })
      return NextResponse.json({ success: true, deleted: result.count })
    }

    return NextResponse.json({ error: 'messageId, messageIds veya conversationUserId gerekli' }, { status: 400 })
  } catch (error) {
    console.error('Message delete error:', error)
    return NextResponse.json(
      { error: 'Mesaj silinirken hata oluştu' },
      { status: 500 }
    )
  }
}
