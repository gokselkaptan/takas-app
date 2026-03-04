import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Admin email that can delete messages
const ADMIN_EMAIL = 'join@takas-a.com'

async function checkAdminAccess(session: any) {
  if (!session?.user?.email) {
    return { error: 'Giriş yapmalısınız', status: 401 }
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })

  if (!user || (user.role !== 'admin' && session.user.email !== ADMIN_EMAIL)) {
    return { error: 'Yetkisiz erişim', status: 403 }
  }

  return { user }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const accessCheck = await checkAdminAccess(session)
    if ('error' in accessCheck) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'

    // Get all messages
    if (type === 'all') {
      const messages = await prisma.message.findMany({
        include: {
          sender: {
            select: { id: true, name: true, email: true, image: true },
          },
          receiver: {
            select: { id: true, name: true, email: true, image: true },
          },
          product: {
            select: { id: true, title: true, images: true, valorPrice: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      return NextResponse.json(messages)
    }

    // Get conversations grouped by product
    if (type === 'conversations') {
      const messages = await prisma.message.findMany({
        include: {
          sender: {
            select: { id: true, name: true, email: true },
          },
          receiver: {
            select: { id: true, name: true, email: true },
          },
          product: {
            select: { id: true, title: true, images: true, valorPrice: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      // Group by product and conversation
      const grouped: Record<string, any> = {}
      messages.forEach((msg: { productId: string | null; senderId: string; receiverId: string; product: { id: string; title: string } | null; sender: { id: string; name: string | null }; receiver: { id: string; name: string | null }; createdAt: Date }) => {
        const key = msg.productId ? `${msg.productId}-${[msg.senderId, msg.receiverId].sort().join('-')}` : `no-product-${[msg.senderId, msg.receiverId].sort().join('-')}`
        if (!grouped[key]) {
          grouped[key] = {
            product: msg.product,
            participants: [msg.sender, msg.receiver],
            messages: [],
            lastMessage: msg.createdAt,
          }
        }
        grouped[key].messages.push(msg)
      })

      return NextResponse.json(Object.values(grouped))
    }

    // Belirli bir konuşmanın detayını getir
    if (type === 'conversation-detail') {
      const user1 = searchParams.get('user1')
      const user2 = searchParams.get('user2')
      const productId = searchParams.get('productId')
      
      if (!user1 || !user2) {
        return NextResponse.json({ error: 'user1 ve user2 gerekli' }, { status: 400 })
      }
      
      const where: any = {
        OR: [
          { senderId: user1, receiverId: user2 },
          { senderId: user2, receiverId: user1 },
        ]
      }
      if (productId && productId !== 'null') {
        where.productId = productId
      }
      
      const messages = await prisma.message.findMany({
        where,
        include: {
          sender: { select: { id: true, name: true, email: true, image: true } },
          receiver: { select: { id: true, name: true, email: true, image: true } },
          product: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 500,
      })
      
      return NextResponse.json({ messages })
    }

    // Kullanıcı arama (mesaj gönderen/alan)
    if (type === 'search-users') {
      const query = searchParams.get('q')
      if (!query) return NextResponse.json({ users: [] })
      
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ]
        },
        select: { id: true, name: true, email: true, image: true },
        take: 20,
      })
      return NextResponse.json({ users })
    }

    return NextResponse.json({ error: 'Geçersiz tip' }, { status: 400 })
  } catch (error) {
    console.error('Admin messages fetch error:', error)
    return NextResponse.json(
      { error: 'Mesajlar yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Admin mesaj silme
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const accessCheck = await checkAdminAccess(session)
    if ('error' in accessCheck) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status })
    }

    const body = await request.json()
    const { messageId, messageIds, conversationKey } = body

    // Tek mesaj silme
    if (messageId) {
      await prisma.message.delete({
        where: { id: messageId }
      })
      return NextResponse.json({ success: true, deleted: 1 })
    }

    // Birden fazla mesaj silme
    if (messageIds && Array.isArray(messageIds)) {
      const result = await prisma.message.deleteMany({
        where: { id: { in: messageIds } }
      })
      return NextResponse.json({ success: true, deleted: result.count })
    }

    // Tüm konuşmayı silme (productId ve kullanıcılar arası)
    if (conversationKey) {
      const [productId, ...userIds] = conversationKey.split('-')
      const sortedUserIds = userIds.sort()
      
      if (productId === 'no-product') {
        // Ürünsüz konuşma
        const result = await prisma.message.deleteMany({
          where: {
            productId: null,
            OR: [
              { senderId: sortedUserIds[0], receiverId: sortedUserIds[1] },
              { senderId: sortedUserIds[1], receiverId: sortedUserIds[0] }
            ]
          }
        })
        return NextResponse.json({ success: true, deleted: result.count })
      } else {
        // Ürünlü konuşma
        const result = await prisma.message.deleteMany({
          where: {
            productId: productId,
            OR: [
              { senderId: sortedUserIds[0], receiverId: sortedUserIds[1] },
              { senderId: sortedUserIds[1], receiverId: sortedUserIds[0] }
            ]
          }
        })
        return NextResponse.json({ success: true, deleted: result.count })
      }
    }

    return NextResponse.json({ error: 'messageId, messageIds veya conversationKey gerekli' }, { status: 400 })
  } catch (error) {
    console.error('Admin message delete error:', error)
    return NextResponse.json(
      { error: 'Mesaj silinirken hata oluştu' },
      { status: 500 }
    )
  }
}
