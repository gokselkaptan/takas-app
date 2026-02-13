import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

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

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 })
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

    return NextResponse.json({ error: 'Geçersiz tip' }, { status: 400 })
  } catch (error) {
    console.error('Admin messages fetch error:', error)
    return NextResponse.json(
      { error: 'Mesajlar yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}
