import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Fetch messages for a specific group
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const groupId = params.id

    // Check if user is a member of this group
    const membership = await prisma.groupConversationMember.findFirst({
      where: {
        groupConversationId: groupId,
        userId: currentUser.id,
        isActive: true
      }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Bu gruba erişim yetkiniz yok' }, { status: 403 })
    }

    // Get group details with members
    const group = await prisma.groupConversation.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                nickname: true,
                image: true
              }
            }
          }
        }
      }
    })

    if (!group) {
      return NextResponse.json({ error: 'Grup bulunamadı' }, { status: 404 })
    }

    // Fetch messages
    const messages = await prisma.groupMessage.findMany({
      where: { groupConversationId: groupId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            nickname: true,
            image: true
          }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: 100 // Limit to last 100 messages
    })

    // Mark messages as read for current user
    await prisma.groupMessage.updateMany({
      where: {
        groupConversationId: groupId,
        senderId: { not: currentUser.id },
        isRead: false
      },
      data: { isRead: true }
    })

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        type: group.type,
        createdAt: group.createdAt,
        members: group.members.map(m => ({
          id: m.user.id,
          name: m.user.name,
          nickname: m.user.nickname,
          image: m.user.image,
          role: m.role
        }))
      },
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        senderId: msg.senderId,
        sender: {
          id: msg.sender.id,
          name: msg.sender.name,
          nickname: msg.sender.nickname,
          image: msg.sender.image
        },
        createdAt: msg.createdAt,
        isRead: msg.isRead,
        isSystem: msg.isSystem
      }))
    })
  } catch (error) {
    console.error('Get group messages error:', error)
    return NextResponse.json(
      { error: 'Mesajlar alınamadı' },
      { status: 500 }
    )
  }
}

// POST - Send a message to the group
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, nickname: true, image: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const groupId = params.id
    const { content } = await request.json()

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Mesaj içeriği gerekli' }, { status: 400 })
    }

    // Check if user is a member of this group
    const membership = await prisma.groupConversationMember.findFirst({
      where: {
        groupConversationId: groupId,
        userId: currentUser.id,
        isActive: true
      }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Bu gruba mesaj gönderme yetkiniz yok' }, { status: 403 })
    }

    // Create the message
    const message = await prisma.groupMessage.create({
      data: {
        groupConversationId: groupId,
        senderId: currentUser.id,
        content: content.trim()
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            nickname: true,
            image: true
          }
        }
      }
    })

    // Update group's updatedAt timestamp
    await prisma.groupConversation.update({
      where: { id: groupId },
      data: { updatedAt: new Date() }
    })

    return NextResponse.json({
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        nickname: message.sender.nickname,
        image: message.sender.image
      },
      createdAt: message.createdAt,
      isRead: message.isRead,
      isSystem: message.isSystem
    })
  } catch (error) {
    console.error('Send group message error:', error)
    return NextResponse.json(
      { error: 'Mesaj gönderilemedi' },
      { status: 500 }
    )
  }
}
