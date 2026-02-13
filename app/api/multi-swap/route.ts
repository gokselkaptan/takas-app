import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import {
  findMultiSwapOpportunities,
  createMultiSwap,
  confirmMultiSwapParticipation,
  rejectMultiSwap,
  getSwapAlgorithmStats,
  expireOldMultiSwaps,
  markParticipantNotified,
  suggestAlternativeCycles,
  MULTI_SWAP_CONFIG,
  type SwapNode,
} from '@/lib/multi-swap-algorithm'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'

// Rejection reasons for feedback collection
const REJECTION_REASONS = [
  { id: 'value_difference', label: 'Değer farkı çok fazla' },
  { id: 'not_interested', label: 'Artık ilgilenmiyorum' },
  { id: 'location_far', label: 'Konum çok uzak' },
  { id: 'changed_mind', label: 'Fikrimi değiştirdim' },
  { id: 'trust_concern', label: 'Güven endişesi' },
  { id: 'other', label: 'Diğer' },
]

// Quality tier labels in Turkish
const QUALITY_TIER_LABELS = {
  excellent: { label: 'Mükemmel', emoji: '⭐⭐⭐' },
  good: { label: 'İyi', emoji: '⭐⭐' },
  fair: { label: 'Orta', emoji: '⭐' },
  poor: { label: 'Düşük', emoji: '🔻' },
}

/**
 * Create group chat room for multi-swap
 */
async function createMultiSwapChatRoom(multiSwapId: string, participants: SwapNode[], initiatorId: string) {
  try {
    const existingChat = await prisma.groupConversation.findUnique({
      where: { multiSwapId }
    })
    
    if (existingChat) return existingChat

    const chatRoom = await prisma.groupConversation.create({
      data: {
        name: `Çoklu Takas #${multiSwapId.slice(-6).toUpperCase()}`,
        type: 'multi_swap',
        multiSwapId,
        creatorId: initiatorId,
        isActive: true,
        members: {
          create: participants.map((p, idx) => ({
            userId: p.userId,
            role: p.userId === initiatorId ? 'admin' : 'member',
          }))
        }
      }
    })

    // Add system welcome message
    await prisma.groupMessage.create({
      data: {
        groupConversationId: chatRoom.id,
        senderId: initiatorId,
        content: `🔄 Çoklu takas başlatıldı! ${participants.length} katılımcı onay bekleniyor. Onay süresi: 48 saat.`,
        isSystem: true,
      }
    })

    return chatRoom
  } catch (error) {
    console.error('Chat room creation error:', error)
    return null
  }
}

/**
 * Send system message to multi-swap chat
 */
async function sendSystemMessage(multiSwapId: string, message: string, senderId: string) {
  try {
    const chatRoom = await prisma.groupConversation.findUnique({
      where: { multiSwapId }
    })
    
    if (!chatRoom) return

    await prisma.groupMessage.create({
      data: {
        groupConversationId: chatRoom.id,
        senderId,
        content: message,
        isSystem: true,
      }
    })
  } catch (error) {
    console.error('System message error:', error)
  }
}

// Get multi-swap opportunities for current user
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
    const type = searchParams.get('type')
    const onlyBalanced = searchParams.get('balanced') === 'true'
    const minScore = parseInt(searchParams.get('minScore') || '0')

    // Auto-expire old swaps on every request
    await expireOldMultiSwaps()

    if (type === 'active') {
      // Get user's active multi-swaps
      const multiSwaps = await prisma.multiSwap.findMany({
        where: {
          participants: {
            some: { userId: user.id },
          },
          status: { in: ['pending', 'confirmed'] },
        },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, name: true, image: true },
              },
              givesProduct: {
                select: { id: true, title: true, images: true, valorPrice: true, city: true, district: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      // Add time remaining for pending swaps
      const swapsWithTimeInfo = multiSwaps.map((swap: typeof multiSwaps[number]) => ({
        ...swap,
        timeRemaining: swap.status === 'pending' 
          ? Math.max(0, Math.floor((new Date(swap.expiresAt).getTime() - Date.now()) / 1000 / 60)) // minutes
          : null,
        isInitiator: swap.initiatorId === user.id,
        myParticipation: swap.participants.find((p: { userId: string }) => p.userId === user.id),
      }))

      return NextResponse.json(swapsWithTimeInfo)
    }

    if (type === 'history') {
      // Get user's multi-swap history
      const history = await prisma.multiSwap.findMany({
        where: {
          participants: {
            some: { userId: user.id },
          },
          status: { in: ['rejected', 'expired', 'completed'] },
        },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true } },
              givesProduct: { select: { id: true, title: true, images: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      })

      return NextResponse.json(history)
    }

    if (type === 'stats') {
      // Get algorithm statistics (admin/debug)
      const stats = await getSwapAlgorithmStats()
      return NextResponse.json(stats)
    }

    if (type === 'rejection_reasons') {
      // Return available rejection reasons for UI
      return NextResponse.json({ reasons: REJECTION_REASONS })
    }

    if (type === 'config') {
      // Return algorithm configuration for UI display
      return NextResponse.json({
        config: MULTI_SWAP_CONFIG,
        qualityTiers: QUALITY_TIER_LABELS,
      })
    }

    // Find new opportunities with enhanced scoring (v2.0)
    const minTrustScore = parseInt(searchParams.get('minTrust') || String(MULTI_SWAP_CONFIG.MIN_TRUST_SCORE))
    const categoryFilter = searchParams.get('category') || undefined

    const opportunities = await findMultiSwapOpportunities(user.id, {
      onlyBalanced,
      minScore,
      minTrustScore,
      categoryFilter,
    })

    // Separate by quality tier
    const excellentOpportunities = opportunities.filter(o => o.qualityTier === 'excellent')
    const goodOpportunities = opportunities.filter(o => o.qualityTier === 'good')
    const fairOpportunities = opportunities.filter(o => o.qualityTier === 'fair')

    // Separate balanced and unbalanced opportunities
    const balancedOpportunities = opportunities.filter(o => o.isValueBalanced)
    const unbalancedOpportunities = opportunities.filter(o => !o.isValueBalanced)

    return NextResponse.json({
      opportunities,
      balancedOpportunities,
      unbalancedOpportunities,
      count: opportunities.length,
      balancedCount: balancedOpportunities.length,
      // Quality tier breakdown
      qualityBreakdown: {
        excellent: excellentOpportunities.length,
        good: goodOpportunities.length,
        fair: fairOpportunities.length,
      },
      // Summary stats
      stats: {
        totalFound: opportunities.length,
        balanced: balancedOpportunities.length,
        unbalanced: unbalancedOpportunities.length,
        averageScore: opportunities.length > 0
          ? Math.round(opportunities.reduce((sum, o) => sum + o.totalScore, 0) / opportunities.length)
          : 0,
        averageTrustScore: opportunities.length > 0
          ? Math.round(opportunities.reduce((sum, o) => sum + o.trustScore, 0) / opportunities.length)
          : 0,
        averageLocationScore: opportunities.length > 0
          ? Math.round(opportunities.reduce((sum, o) => sum + o.locationScore, 0) / opportunities.length)
          : 0,
      },
      // Include quality tier labels for UI
      qualityTiers: QUALITY_TIER_LABELS,
    })
  } catch (error) {
    console.error('Multi-swap fetch error:', error)
    return NextResponse.json(
      { error: 'Çoklu takas fırsatları yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}

// Create, confirm, or reject a multi-swap
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const { action, multiSwapId, participants, reason } = body

    if (action === 'create' && participants) {
      // Create a new multi-swap with initiator
      const { id, expiresAt } = await createMultiSwap(participants, user.id)
      
      // Create group chat room for the swap
      const chatRoom = await createMultiSwapChatRoom(id, participants, user.id)
      
      // Send notifications to other participants
      for (const participant of participants) {
        if (participant.userId !== user.id) {
          // Send push notification using template
          await sendPushToUser(
            participant.userId,
            NotificationTypes.MULTI_SWAP_INVITE,
            {
              initiatorName: user.name || 'Bir kullanıcı',
              participantCount: participants.length,
              multiSwapId: id
            }
          )
          
          // Mark as notified
          await markParticipantNotified(id, participant.userId)
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        multiSwapId: id,
        expiresAt,
        chatRoomId: chatRoom?.id || null,
        message: 'Takas başlatıldı! Grup sohbeti oluşturuldu ve diğer katılımcılara bildirim gönderildi.',
        participantsNotified: participants.length - 1,
      })
    }

    if (action === 'confirm' && multiSwapId) {
      try {
        // Confirm participation
        const result = await confirmMultiSwapParticipation(multiSwapId, user.id)
        
        // Send system message to chat
        await sendSystemMessage(
          multiSwapId, 
          `✅ ${user.name || 'Bir katılımcı'} onayladı! (${result.participants.filter(p => p.confirmed).length}/${result.participants.length})`,
          user.id
        )
        
        // Send notification based on result
        if (result.allConfirmed) {
          // Send system message for full confirmation
          await sendSystemMessage(
            multiSwapId,
            `🎉 Tüm katılımcılar onayladı! Artık teslimat planlaması yapabilirsiniz.`,
            user.id
          )
          
          // Notify all participants that swap is confirmed
          for (const p of result.participants) {
            if (p.userId !== user.id) {
              await sendPushToUser(
                p.userId,
                NotificationTypes.MULTI_SWAP_CONFIRMED,
                {
                  participantCount: result.participants.length,
                  multiSwapId
                }
              )
            }
          }
        } else {
          // Notify others about the new confirmation
          for (const p of result.participants) {
            if (p.userId !== user.id && p.confirmed) {
              await sendPushToUser(
                p.userId,
                NotificationTypes.MULTI_SWAP_PROGRESS,
                {
                  confirmerName: user.name || 'Bir katılımcı',
                  remainingCount: result.remainingCount,
                  multiSwapId
                }
              )
            }
          }
        }
        
        return NextResponse.json({ 
          success: true, 
          allConfirmed: result.allConfirmed,
          remainingCount: result.remainingCount,
          message: result.allConfirmed 
            ? '🎉 Tüm katılımcılar onayladı! Takas gerçekleşebilir.' 
            : `✓ Katılımınız onaylandı. ${result.remainingCount} kişi daha bekleniyor.`,
        })
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
        return NextResponse.json({ error: errorMessage }, { status: 400 })
      }
    }

    if (action === 'reject' && multiSwapId) {
      try {
        // Get rejection reason label
        const reasonLabel = reason 
          ? REJECTION_REASONS.find(r => r.id === reason)?.label || reason
          : 'Belirtilmedi'
        
        // Send system message before rejection
        await sendSystemMessage(
          multiSwapId,
          `❌ ${user.name || 'Bir katılımcı'} takası reddetti. Sebep: ${reasonLabel}`,
          user.id
        )
        
        // Reject and cancel the swap (now returns alternatives)
        const result = await rejectMultiSwap(multiSwapId, user.id, reason)
        
        // Notify all affected participants
        for (const p of result.affectedParticipants) {
          await sendPushToUser(
            p.userId,
            NotificationTypes.MULTI_SWAP_REJECTED,
            {
              rejecterName: user.name || 'Bir katılımcı',
              reason: reasonLabel,
              multiSwapId
            }
          )
        }

        // If alternatives were found, notify participants
        if (result.alternatives.length > 0) {
          await sendSystemMessage(
            multiSwapId,
            `💡 ${result.alternatives.length} alternatif takas fırsatı bulundu. Etkilenen kullanıcılar "Takas Fırsatları" sayfasından yeni fırsatları görebilir.`,
            user.id
          )
        }
        
        return NextResponse.json({
          success: true,
          message: 'Takas reddedildi ve diğer katılımcılara bildirim gönderildi.',
          affectedCount: result.affectedParticipants.length,
          alternativesFound: result.alternatives.length,
          alternatives: result.alternatives.slice(0, 3), // Return top 3 alternatives
        })
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
        return NextResponse.json({ error: errorMessage }, { status: 400 })
      }
    }

    return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 })
  } catch (error) {
    console.error('Multi-swap action error:', error)
    return NextResponse.json(
      { error: 'İşlem sırasında hata oluştu' },
      { status: 500 }
    )
  }
}
