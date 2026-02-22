import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { sendPushToUsers, NotificationTypes } from '@/lib/push-notifications'

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

// PATCH - Add or remove members from the group
export async function PATCH(
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
      select: { id: true, name: true, nickname: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const groupId = params.id
    const { action, userIds, userId } = await request.json()

    // Check if current user is a member of this group
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

    const group = await prisma.groupConversation.findUnique({
      where: { id: groupId },
      select: { name: true, creatorId: true }
    })

    if (!group) {
      return NextResponse.json({ error: 'Grup bulunamadı' }, { status: 404 })
    }

    // Handle add members action
    if (action === 'add_members' || action === 'add') {
      const idsToAdd = userIds || (userId ? [userId] : [])
      
      if (!idsToAdd || idsToAdd.length === 0) {
        return NextResponse.json({ error: 'Eklenecek kullanıcı belirtilmedi' }, { status: 400 })
      }

      // Verify all users exist
      const usersToAdd = await prisma.user.findMany({
        where: { id: { in: idsToAdd } },
        select: { id: true, name: true, nickname: true }
      })

      if (usersToAdd.length === 0) {
        return NextResponse.json({ error: 'Geçersiz kullanıcılar' }, { status: 400 })
      }

      const addedMembers: { id: string; name: string | null; nickname: string | null }[] = []
      const alreadyMembers: { id: string; name: string | null; nickname: string | null }[] = []

      for (const user of usersToAdd) {
        // Check if already a member
        const existingMembership = await prisma.groupConversationMember.findFirst({
          where: {
            groupConversationId: groupId,
            userId: user.id
          }
        })

        if (existingMembership) {
          if (existingMembership.isActive) {
            alreadyMembers.push(user)
          } else {
            // Reactivate membership
            await prisma.groupConversationMember.update({
              where: { id: existingMembership.id },
              data: { isActive: true }
            })
            addedMembers.push(user)
          }
        } else {
          // Create new membership
          await prisma.groupConversationMember.create({
            data: {
              groupConversationId: groupId,
              userId: user.id,
              role: 'member'
            }
          })
          addedMembers.push(user)
        }
      }

      // Add system message for each added member
      if (addedMembers.length > 0) {
        const addedNames = addedMembers.map(u => u.nickname || u.name).join(', ')
        await prisma.groupMessage.create({
          data: {
            groupConversationId: groupId,
            senderId: currentUser.id,
            content: `${currentUser.nickname || currentUser.name} gruba ${addedNames} kullanıcısını ekledi.`,
            isSystem: true
          }
        })

        // Update group timestamp
        await prisma.groupConversation.update({
          where: { id: groupId },
          data: { updatedAt: new Date() }
        })
      }

      // Get updated members list
      const updatedMembers = await prisma.groupConversationMember.findMany({
        where: {
          groupConversationId: groupId,
          isActive: true
        },
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
      })

      return NextResponse.json({
        success: true,
        message: addedMembers.length > 0 
          ? `${addedMembers.length} kullanıcı eklendi` 
          : 'Kullanıcılar zaten grupta',
        addedCount: addedMembers.length,
        alreadyMemberCount: alreadyMembers.length,
        members: updatedMembers.map(m => ({
          id: m.user.id,
          name: m.user.name,
          nickname: m.user.nickname,
          image: m.user.image,
          role: m.role
        }))
      })
    }

    // Handle remove member action
    if (action === 'remove_member' || action === 'remove') {
      const idToRemove = userId || (userIds && userIds[0])
      
      if (!idToRemove) {
        return NextResponse.json({ error: 'Çıkarılacak kullanıcı belirtilmedi' }, { status: 400 })
      }

      // Can't remove yourself using this action
      if (idToRemove === currentUser.id) {
        return NextResponse.json({ error: 'Kendinizi bu şekilde çıkaramazsınız, grubu terk et seçeneğini kullanın' }, { status: 400 })
      }

      // Only creator can remove others
      if (group.creatorId !== currentUser.id) {
        return NextResponse.json({ error: 'Sadece grup kurucusu üye çıkarabilir' }, { status: 403 })
      }

      await prisma.groupConversationMember.updateMany({
        where: {
          groupConversationId: groupId,
          userId: idToRemove
        },
        data: { isActive: false }
      })

      const removedUser = await prisma.user.findUnique({
        where: { id: idToRemove },
        select: { name: true, nickname: true }
      })

      // Add system message
      await prisma.groupMessage.create({
        data: {
          groupConversationId: groupId,
          senderId: currentUser.id,
          content: `${removedUser?.nickname || removedUser?.name || 'Kullanıcı'} gruptan çıkarıldı.`,
          isSystem: true
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Kullanıcı gruptan çıkarıldı'
      })
    }

    // Handle leave group action
    if (action === 'leave') {
      await prisma.groupConversationMember.updateMany({
        where: {
          groupConversationId: groupId,
          userId: currentUser.id
        },
        data: { isActive: false }
      })

      // Add system message
      await prisma.groupMessage.create({
        data: {
          groupConversationId: groupId,
          senderId: currentUser.id,
          content: `${currentUser.nickname || currentUser.name} gruptan ayrıldı.`,
          isSystem: true
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Gruptan ayrıldınız'
      })
    }

    return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 })
  } catch (error) {
    console.error('Group member operation error:', error)
    return NextResponse.json(
      { error: 'İşlem gerçekleştirilemedi' },
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

    // Get group members for push notification (exclude sender)
    const groupMembers = await prisma.groupConversationMember.findMany({
      where: {
        groupConversationId: groupId,
        userId: { not: currentUser.id },
        isActive: true
      },
      select: { userId: true }
    })

    // Send push notification to group members
    if (groupMembers.length > 0) {
      const memberIds = groupMembers.map(m => m.userId)
      const group = await prisma.groupConversation.findUnique({
        where: { id: groupId },
        select: { name: true }
      })
      
      try {
        await sendPushToUsers(memberIds, NotificationTypes.NEW_MESSAGE, {
          senderName: currentUser.nickname || currentUser.name || 'Bir kullanıcı',
          groupName: group?.name || 'Grup',
          preview: content.trim().slice(0, 50) + (content.trim().length > 50 ? '...' : ''),
          url: '/mesajlar'
        })
      } catch (pushError) {
        console.error('Push notification error:', pushError)
        // Continue even if push fails
      }
    }

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
