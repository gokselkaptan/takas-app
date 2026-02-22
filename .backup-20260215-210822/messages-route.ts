import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { quickModeration, aiModeration, processWarning, checkUserSuspension, WARNING_MESSAGES, POLICY_WARNING_MESSAGES } from '@/lib/message-moderation'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'

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
    const otherUserId = searchParams.get('userId')
    const productId = searchParams.get('productId')

    // Get conversation with specific user about a product
    if (otherUserId && productId) {
      const messages = await prisma.message.findMany({
        where: {
          productId,
          OR: [
            { senderId: user.id, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: user.id },
          ],
        },
        include: {
          sender: {
            select: { id: true, name: true, image: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      })

      // Mark messages as read
      await prisma.message.updateMany({
        where: {
          productId,
          senderId: otherUserId,
          receiverId: user.id,
          isRead: false,
        },
        data: { isRead: true },
      })

      return NextResponse.json(messages)
    }

    // Optimize: Son 100 mesajı al ve grupla (performans için limit)
    const conversations = await prisma.message.findMany({
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
        sender: {
          select: { id: true, name: true, nickname: true, image: true },
        },
        receiver: {
          select: { id: true, name: true, nickname: true, image: true },
        },
        product: {
          select: { id: true, title: true, images: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500, // Son 500 mesaj ile sınırla
    })

    // Group by conversation (other user + product)
    const conversationMap = new Map()
    let totalMessages = 0
    let readMessages = 0
    let unreadMessages = 0
    
    for (const msg of conversations) {
      const otherUser = msg.senderId === user.id ? msg.receiver : msg.sender
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

    return NextResponse.json({
      conversations: Array.from(conversationMap.values()),
      stats: {
        totalMessages,
        readMessages,
        unreadMessages
      }
    })
  } catch (error) {
    console.error('Messages fetch error:', error)
    return NextResponse.json(
      { error: 'Mesajlar yüklenirken hata oluştu' },
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
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
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
    const { receiverId, content, productId, location, lang = 'tr' } = body

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
    
    // Mesajı oluştur (moderasyon sonucuyla birlikte)
    const message = await prisma.message.create({
      data: {
        senderId: user.id,
        receiverId,
        content,
        productId,
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
      preview: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      conversationId: productId || receiverId
    }).catch(err => console.error('Push notification error:', err))

    return NextResponse.json(message)
    
  } catch (error) {
    console.error('Message create error:', error)
    return NextResponse.json(
      { error: 'Mesaj gönderilirken hata oluştu' },
      { status: 500 }
    )
  }
}
