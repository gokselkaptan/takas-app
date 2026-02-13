import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Fetch user's group conversations
export async function GET(request: Request) {
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

    // Get all group conversations user is a member of
    const groupConversations = await prisma.groupConversation.findMany({
      where: {
        isActive: true,
        members: {
          some: {
            userId: currentUser.id,
            isActive: true
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                nickname: true,
                image: true
              }
            }
          },
          where: { isActive: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { name: true, nickname: true }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    // Format response
    const formatted = groupConversations.map(group => ({
      id: group.id,
      name: group.name,
      type: group.type,
      createdAt: group.createdAt,
      members: group.members.map(m => ({
        id: m.user.id,
        name: m.user.name,
        nickname: m.user.nickname,
        image: m.user.image,
        role: m.role,
        joinedAt: m.joinedAt
      })),
      lastMessage: group.messages[0] ? {
        content: group.messages[0].content,
        senderName: group.messages[0].sender.nickname || group.messages[0].sender.name,
        createdAt: group.messages[0].createdAt
      } : null,
      memberCount: group.members.length
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Get group conversations error:', error)
    return NextResponse.json(
      { error: 'Grup konuşmaları alınamadı' },
      { status: 500 }
    )
  }
}

// POST - Create a new group conversation
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, nickname: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const { name, memberIds, multiSwapId } = await request.json()

    if (!memberIds || memberIds.length === 0) {
      return NextResponse.json({ error: 'En az bir üye seçmelisiniz' }, { status: 400 })
    }

    // Verify all members exist
    const members = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, nickname: true, image: true }
    })

    if (members.length !== memberIds.length) {
      return NextResponse.json({ error: 'Bazı kullanıcılar bulunamadı' }, { status: 400 })
    }

    // Create group conversation
    const groupConversation = await prisma.groupConversation.create({
      data: {
        name: name || null,
        type: multiSwapId ? 'multi_swap' : 'general',
        creatorId: currentUser.id,
        multiSwapId: multiSwapId || null,
        members: {
          create: [
            // Creator as admin
            {
              userId: currentUser.id,
              role: 'admin'
            },
            // Other members
            ...memberIds.map((memberId: string) => ({
              userId: memberId,
              role: 'member'
            }))
          ]
        }
      },
      include: {
        members: {
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

    // Create welcome message
    const welcomeMessage = await prisma.groupMessage.create({
      data: {
        groupConversationId: groupConversation.id,
        senderId: currentUser.id,
        content: `🎉 ${currentUser.nickname || currentUser.name} grubu oluşturdu. Çoklu takas görüşmelerine başlayabilirsiniz!`
      }
    })

    return NextResponse.json({
      id: groupConversation.id,
      name: groupConversation.name,
      type: groupConversation.type,
      createdAt: groupConversation.createdAt,
      members: groupConversation.members.map(m => ({
        id: m.user.id,
        name: m.user.name,
        nickname: m.user.nickname,
        image: m.user.image,
        role: m.role
      })),
      lastMessage: {
        content: welcomeMessage.content,
        senderName: currentUser.nickname || currentUser.name,
        createdAt: welcomeMessage.createdAt
      },
      memberCount: groupConversation.members.length
    })
  } catch (error) {
    console.error('Create group conversation error:', error)
    return NextResponse.json(
      { error: 'Grup oluşturulamadı' },
      { status: 500 }
    )
  }
}
