import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'
import { DISPUTE_WINDOW_HOURS, calculateNewTrustScore } from '@/lib/swap-config'

export const dynamic = 'force-dynamic'

// Dispute türlerini Türkçe'ye çevir
const disputeTypeLabels: Record<string, string> = {
  defect: 'Ürün kusurlu',
  not_as_described: 'Açıklamayla uyuşmuyor',
  missing_parts: 'Eksik parça',
  damaged: 'Hasar var',
  wrong_item: 'Yanlış ürün gönderilmiş',
  no_show: 'Karşı taraf gelmedi',
  other: 'Diğer'
}

// Uzlaşma seçenekleri (Nash Dengesi tabanlı) - Güncellenmiş Ceza Felsefesi
const SETTLEMENT_OPTIONS = [
  {
    id: '50_50',
    title: 'Eşit Paylaşım',
    description: 'Teminatın %50\'si her iki tarafa iade edilir',
    reporterRefundPercent: 50,
    reportedRefundPercent: 50,
    trustScorePenalty: 3      // İki taraf da hafif ceza
  },
  {
    id: '70_30',
    title: 'Alıcı Lehine',
    description: 'Teminatın %70\'i alıcıya, %30\'u satıcıya iade',
    reporterRefundPercent: 70,
    reportedRefundPercent: 30,
    trustScorePenalty: 8      // Satıcıya orta ceza
  },
  {
    id: 'full_refund',
    title: 'Tam İade',
    description: 'Tüm teminat alıcıya iade, satıcıya trust puanı cezası',
    reporterRefundPercent: 100,
    reportedRefundPercent: 0,
    trustScorePenalty: 15     // Satıcıya ağır ceza
  },
  {
    id: 'cancel_no_penalty',
    title: 'Cezasız İptal',
    description: 'Takas iptal, teminat iade, trust puanı etkilenmez',
    reporterRefundPercent: 100,
    reportedRefundPercent: 100, // Herkes kendi teminatını alır
    trustScorePenalty: 0
  }
]

// POST: Sorun raporu aç
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }
    
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    const { swapRequestId, type, description, evidence } = await request.json()

    if (!swapRequestId) {
      return NextResponse.json({ error: 'Takas ID gerekli' }, { status: 400 })
    }

    if (!type || !['defect', 'not_as_described', 'missing_parts', 'damaged', 'wrong_item', 'no_show', 'other'].includes(type)) {
      return NextResponse.json({ error: 'Geçerli bir sorun türü seçin' }, { status: 400 })
    }

    if (!description || description.length < 20) {
      return NextResponse.json({ error: 'Açıklama en az 20 karakter olmalı' }, { status: 400 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      include: {
        product: { select: { id: true, title: true } },
        owner: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
        disputes: true,
      },
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas isteği bulunamadı' }, { status: 404 })
    }

    // Sadece "delivered" durumundaki takaslar için rapor açılabilir
    if (swapRequest.status !== 'delivered') {
      return NextResponse.json({ error: 'Sadece teslim alınmış takaslar için sorun bildirilebilir' }, { status: 400 })
    }

    // Alıcı (requester) rapor açabilir
    if (swapRequest.requesterId !== currentUser.id) {
      return NextResponse.json({ error: 'Sadece alıcı sorun bildirebilir' }, { status: 403 })
    }

    // Zaten açık rapor varsa
    const existingDispute = swapRequest.disputes.find((d: { status: string }) => d.status === 'open' || d.status === 'under_review')
    if (existingDispute) {
      return NextResponse.json({ error: 'Bu takas için zaten açık bir rapor var' }, { status: 400 })
    }

    // Dispute window kontrolü (Faz 1)
    const now = new Date()
    const disputeDeadline = swapRequest.disputeWindowEndsAt || swapRequest.deliveryConfirmDeadline
    
    if (disputeDeadline && now > disputeDeadline) {
      return NextResponse.json({ 
        error: `${DISPUTE_WINDOW_HOURS} saatlik itiraz süresi dolmuş. Takas otomatik onaylandı.`,
      }, { status: 400 })
    }

    // Kanıt yükleme için 48 saatlik süre
    const evidenceDeadline = new Date()
    evidenceDeadline.setHours(evidenceDeadline.getHours() + 48)
    
    // Rapor oluştur
    const dispute = await prisma.disputeReport.create({
      data: {
        swapRequestId,
        reporterId: currentUser.id,
        reportedUserId: swapRequest.ownerId,
        type,
        description,
        evidence: evidence || [],
        status: 'evidence_pending', // Kanıt bekleme durumu
        evidenceDeadline,
        settlementOptions: JSON.stringify(SETTLEMENT_OPTIONS),
      },
    })

    // SwapRequest durumunu güncelle
    await prisma.swapRequest.update({
      where: { id: swapRequestId },
      data: { status: 'disputed' },
    })

    // Activity feed'e ekle
    await prisma.activityFeed.create({
      data: {
        type: 'dispute_opened',
        userId: currentUser.id,
        userName: swapRequest.requester.name,
        productId: swapRequest.productId,
        productTitle: swapRequest.product.title,
        targetUserId: swapRequest.ownerId,
        targetUserName: swapRequest.owner.name,
        metadata: JSON.stringify({
          disputeId: dispute.id,
          type,
        }),
      },
    })

    // Ürün sahibine sorun bildirildi bildirimi gönder
    sendPushToUser(swapRequest.ownerId, NotificationTypes.SWAP_DISPUTE, {
      productTitle: swapRequest.product.title,
      swapId: swapRequestId,
      reporterName: swapRequest.requester.name || 'Alıcı',
      reason: disputeTypeLabels[type] || type
    }).catch(err => console.error('Push notification error:', err))
    
    // Her iki tarafa kanıt yükleme bildirimi gönder
    sendPushToUser(swapRequest.ownerId, NotificationTypes.DISPUTE_EVIDENCE_REQUEST, {
      productTitle: swapRequest.product.title,
      disputeId: dispute.id
    }).catch(err => console.error('Push notification error:', err))
    
    sendPushToUser(currentUser.id, NotificationTypes.DISPUTE_EVIDENCE_REQUEST, {
      productTitle: swapRequest.product.title,
      disputeId: dispute.id
    }).catch(err => console.error('Push notification error:', err))

    return NextResponse.json({
      success: true,
      disputeId: dispute.id,
      message: 'Sorun raporu oluşturuldu. 48 saat içinde kanıt yükleyebilirsiniz.',
      status: 'evidence_pending',
      evidenceDeadline,
      settlementOptions: SETTLEMENT_OPTIONS,
    })
  } catch (error) {
    console.error('Dispute creation error:', error)
    return NextResponse.json({ error: 'Rapor oluşturulamadı' }, { status: 500 })
  }
}

// GET: Raporları listele
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }
    
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const swapRequestId = searchParams.get('swapRequestId')

    // Kullanıcının raporlarını getir
    const disputes = await prisma.disputeReport.findMany({
      where: swapRequestId 
        ? { swapRequestId }
        : {
            OR: [
              { reporterId: currentUser.id },
              { reportedUserId: currentUser.id },
            ],
          },
      include: {
        swapRequest: {
          include: {
            product: { select: { id: true, title: true, images: true } },
            owner: { select: { id: true, name: true } },
            requester: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(disputes)
  } catch (error) {
    console.error('Disputes fetch error:', error)
    return NextResponse.json({ error: 'Raporlar yüklenemedi' }, { status: 500 })
  }
}

// PATCH: Rapor durumunu güncelle (Admin)
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }
    
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    })
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    // Admin kontrolü
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin yetkisi gerekli' }, { status: 403 })
    }

    const { disputeId, status, resolution, penaltyAmount, refundApproved, adminNotes } = await request.json()

    if (!disputeId) {
      return NextResponse.json({ error: 'Rapor ID gerekli' }, { status: 400 })
    }

    const dispute = await prisma.disputeReport.findUnique({
      where: { id: disputeId },
      include: {
        swapRequest: {
          include: {
            product: true,
            owner: true,
            requester: true,
          },
        },
      },
    })

    if (!dispute) {
      return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 })
    }

    // Transaction ile güncelle
    const result = await prisma.$transaction(async (tx) => {
      // Raporu güncelle
      const updated = await tx.disputeReport.update({
        where: { id: disputeId },
        data: {
          status: status || dispute.status,
          resolution,
          penaltyApplied: penaltyAmount ? true : false,
          penaltyAmount,
          refundApproved: refundApproved || false,
          adminNotes,
        },
      })

      // Ceza uygulanacaksa
      if (penaltyAmount && penaltyAmount > 0) {
        // Mevcut trust score'u al
        const penalizedUser = await tx.user.findUnique({ 
          where: { id: dispute.reportedUserId }, 
          select: { trustScore: true } 
        })
        const newTrustScore = calculateNewTrustScore(
          penalizedUser?.trustScore || 100, 
          -penaltyAmount
        )
        
        await tx.user.update({
          where: { id: dispute.reportedUserId },
          data: {
            trustScore: newTrustScore, // SET, decrement değil!
            totalWarnings: { increment: 1 },
          },
        })

        // Uyarı kaydı oluştur
        await tx.userWarning.create({
          data: {
            userId: dispute.reportedUserId,
            type: 'dispute_penalty',
            severity: penaltyAmount >= 20 ? 'high' : penaltyAmount >= 10 ? 'medium' : 'low',
            description: `Takas anlaşmazlığı: ${resolution}`,
          },
        })
      }

      // İade onaylandıysa
      if (refundApproved && dispute.swapRequest.pendingValorAmount) {
        // Alıcıya Valor iade et
        await tx.user.update({
          where: { id: dispute.swapRequest.requesterId },
          data: {
            valorBalance: { increment: dispute.swapRequest.pendingValorAmount },
          },
        })

        // Takas durumunu güncelle
        await tx.swapRequest.update({
          where: { id: dispute.swapRequestId },
          data: { status: 'refunded' },
        })

        // Transaction kaydı
        await tx.valorTransaction.create({
          data: {
            toUserId: dispute.swapRequest.requesterId,
            amount: dispute.swapRequest.pendingValorAmount,
            fee: 0,
            netAmount: dispute.swapRequest.pendingValorAmount,
            type: 'refund',
            swapRequestId: dispute.swapRequestId,
            description: `İade: ${dispute.swapRequest.product.title}`,
          },
        })
      }

      // Rapor çözüldüyse ve iade yoksa
      if (status === 'resolved' && !refundApproved) {
        await tx.swapRequest.update({
          where: { id: dispute.swapRequestId },
          data: { status: 'completed' },
        })
      }

      return updated
    })

    // Bildirimler gönder
    if (refundApproved) {
      // Alıcıya iade bildirimi
      sendPushToUser(dispute.swapRequest.requesterId, NotificationTypes.SWAP_REFUNDED, {
        productTitle: dispute.swapRequest.product.title,
        swapId: dispute.swapRequestId,
        valorAmount: dispute.swapRequest.pendingValorAmount
      }).catch(err => console.error('Push notification error:', err))
      
      // Satıcıya da bilgi ver
      sendPushToUser(dispute.swapRequest.ownerId, NotificationTypes.SYSTEM, {
        title: 'Takas İptal Edildi',
        body: `"${dispute.swapRequest.product.title}" takası iptal edildi ve alıcıya iade yapıldı.`,
        url: '/profil?tab=swaps'
      }).catch(err => console.error('Push notification error:', err))
    } else if (status === 'resolved') {
      // Her iki tarafa çözüm bildirimi
      sendPushToUser(dispute.swapRequest.requesterId, NotificationTypes.SYSTEM, {
        title: 'Sorun Çözüldü',
        body: `"${dispute.swapRequest.product.title}" için bildirdiğiniz sorun çözüldü.`,
        url: '/profil?tab=swaps'
      }).catch(err => console.error('Push notification error:', err))
      
      sendPushToUser(dispute.swapRequest.ownerId, NotificationTypes.SYSTEM, {
        title: 'Sorun Çözüldü',
        body: `"${dispute.swapRequest.product.title}" için bildirilen sorun çözüldü.`,
        url: '/profil?tab=swaps'
      }).catch(err => console.error('Push notification error:', err))
    }

    return NextResponse.json({
      success: true,
      dispute: result,
      message: 'Rapor güncellendi',
    })
  } catch (error) {
    console.error('Dispute update error:', error)
    return NextResponse.json({ error: 'Rapor güncellenemedi' }, { status: 500 })
  }
}

// PUT: Kanıt yükle veya Uzlaşma teklifi gönder
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }
    
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true },
    })
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    const body = await request.json()
    const { disputeId, action, evidence, evidenceNote, settlementChoice } = body

    if (!disputeId) {
      return NextResponse.json({ error: 'Rapor ID gerekli' }, { status: 400 })
    }

    const dispute = await prisma.disputeReport.findUnique({
      where: { id: disputeId },
      include: {
        swapRequest: {
          include: {
            product: { select: { id: true, title: true } },
            owner: { select: { id: true, name: true } },
            requester: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!dispute) {
      return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 })
    }

    // Kullanıcının bu dispute'a dahil olduğunu kontrol et
    const isReporter = dispute.reporterId === currentUser.id
    const isReported = dispute.reportedUserId === currentUser.id
    
    if (!isReporter && !isReported) {
      return NextResponse.json({ error: 'Bu rapora erişim yetkiniz yok' }, { status: 403 })
    }

    // ACTION: Kanıt Yükle
    if (action === 'upload_evidence') {
      // Süre kontrolü
      if (dispute.evidenceDeadline && new Date() > dispute.evidenceDeadline) {
        return NextResponse.json({ error: 'Kanıt yükleme süresi dolmuş' }, { status: 400 })
      }

      if (!evidence || !Array.isArray(evidence) || evidence.length === 0) {
        return NextResponse.json({ error: 'En az bir kanıt yüklemelisiniz' }, { status: 400 })
      }

      if (evidence.length > 5) {
        return NextResponse.json({ error: 'En fazla 5 kanıt yükleyebilirsiniz' }, { status: 400 })
      }

      const updateData = isReporter
        ? {
            reporterEvidence: evidence,
            reporterEvidenceNote: evidenceNote || null,
            reporterEvidenceAt: new Date(),
          }
        : {
            reportedEvidence: evidence,
            reportedEvidenceNote: evidenceNote || null,
            reportedEvidenceAt: new Date(),
          }

      const updated = await prisma.disputeReport.update({
        where: { id: disputeId },
        data: updateData,
      })

      // Karşı tarafa bildirim gönder
      const otherUserId = isReporter ? dispute.reportedUserId : dispute.reporterId
      sendPushToUser(otherUserId, NotificationTypes.DISPUTE_EVIDENCE_SUBMITTED, {
        productTitle: dispute.swapRequest.product.title,
        disputeId,
        submitterName: currentUser.name || 'Kullanıcı'
      }).catch(err => console.error('Push notification error:', err))

      // Her iki taraf da kanıt yüklediyse durum güncelle
      if (updated.reporterEvidenceAt && updated.reportedEvidenceAt) {
        await prisma.disputeReport.update({
          where: { id: disputeId },
          data: { status: 'settlement_pending' }, // Uzlaşma bekleniyor
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Kanıtlarınız başarıyla yüklendi',
        evidenceCount: evidence.length,
      })
    }

    // ACTION: Uzlaşma Seçimi Yap
    if (action === 'submit_settlement') {
      if (!settlementChoice) {
        return NextResponse.json({ error: 'Uzlaşma seçimi gerekli' }, { status: 400 })
      }

      const validChoices = SETTLEMENT_OPTIONS.map(o => o.id)
      if (!validChoices.includes(settlementChoice)) {
        return NextResponse.json({ error: 'Geçersiz uzlaşma seçimi' }, { status: 400 })
      }

      const updateData = isReporter
        ? { reporterSettlementChoice: settlementChoice }
        : { reportedSettlementChoice: settlementChoice }

      const updated = await prisma.disputeReport.update({
        where: { id: disputeId },
        data: updateData,
      })

      // Karşı tarafa bildirim gönder
      const otherUserId = isReporter ? dispute.reportedUserId : dispute.reporterId
      const selectedOption = SETTLEMENT_OPTIONS.find(o => o.id === settlementChoice)
      
      sendPushToUser(otherUserId, NotificationTypes.DISPUTE_SETTLEMENT_OFFER, {
        productTitle: dispute.swapRequest.product.title,
        disputeId,
        offerDescription: selectedOption?.title || settlementChoice
      }).catch(err => console.error('Push notification error:', err))

      // Her iki taraf da aynı seçimi yaptıysa otomatik uzlaş
      if (updated.reporterSettlementChoice && updated.reportedSettlementChoice) {
        if (updated.reporterSettlementChoice === updated.reportedSettlementChoice) {
          // Uzlaşma sağlandı!
          const selectedOption = SETTLEMENT_OPTIONS.find(o => o.id === updated.reporterSettlementChoice)
          
          if (selectedOption) {
            await processSettlement(dispute, selectedOption)
            
            // Her iki tarafa bildirim
            sendPushToUser(dispute.reporterId, NotificationTypes.DISPUTE_SETTLEMENT_ACCEPTED, {
              productTitle: dispute.swapRequest.product.title,
              disputeId,
              resolution: selectedOption.title
            }).catch(err => console.error('Push notification error:', err))
            
            sendPushToUser(dispute.reportedUserId, NotificationTypes.DISPUTE_SETTLEMENT_ACCEPTED, {
              productTitle: dispute.swapRequest.product.title,
              disputeId,
              resolution: selectedOption.title
            }).catch(err => console.error('Push notification error:', err))

            return NextResponse.json({
              success: true,
              message: 'Uzlaşma sağlandı! Her iki taraf aynı seçimi yaptı.',
              settlementReached: true,
              settlementType: selectedOption.id,
              settlementTitle: selectedOption.title,
            })
          }
        } else {
          // Seçimler farklı - admin incelemesine gönder
          await prisma.disputeReport.update({
            where: { id: disputeId },
            data: { status: 'under_review' },
          })

          return NextResponse.json({
            success: true,
            message: 'Uzlaşma sağlanamadı. Rapor admin incelemesine alındı.',
            settlementReached: false,
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Uzlaşma tercihiniz kaydedildi. Karşı tarafın seçimi bekleniyor.',
        yourChoice: settlementChoice,
      })
    }

    return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 })
  } catch (error) {
    console.error('Dispute PUT error:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// Uzlaşma işlemini gerçekleştir
async function processSettlement(
  dispute: any,
  settlementOption: typeof SETTLEMENT_OPTIONS[0]
) {
  const { swapRequest } = dispute
  
  await prisma.$transaction(async (tx) => {
    // Raporu güncelle
    await tx.disputeReport.update({
      where: { id: dispute.id },
      data: {
        status: 'resolved',
        settlementType: settlementOption.id,
        settlementReachedAt: new Date(),
        resolution: `Otomatik uzlaşma: ${settlementOption.title}`,
      },
    })

    // İadeleri yap
    const reporterRefund = swapRequest.pendingValorAmount
      ? Math.floor((swapRequest.pendingValorAmount * settlementOption.reporterRefundPercent) / 100)
      : 0

    if (reporterRefund > 0) {
      await tx.user.update({
        where: { id: swapRequest.requesterId },
        data: { valorBalance: { increment: reporterRefund } },
      })

      await tx.valorTransaction.create({
        data: {
          toUserId: swapRequest.requesterId,
          amount: reporterRefund,
          fee: 0,
          netAmount: reporterRefund,
          type: 'settlement_refund',
          swapRequestId: swapRequest.id,
          description: `Uzlaşma iadesi: ${settlementOption.title}`,
        },
      })
    }

    // Trust score cezası uygula (max 100 sınırıyla)
    if (settlementOption.trustScorePenalty > 0) {
      const penalizedUser = await tx.user.findUnique({ 
        where: { id: dispute.reportedUserId }, 
        select: { trustScore: true } 
      })
      const newTrustScore = calculateNewTrustScore(
        penalizedUser?.trustScore || 100, 
        -settlementOption.trustScorePenalty
      )
      
      await tx.user.update({
        where: { id: dispute.reportedUserId },
        data: {
          trustScore: newTrustScore, // SET, decrement değil!
        },
      })
    }

    // Takas durumunu güncelle
    await tx.swapRequest.update({
      where: { id: swapRequest.id },
      data: {
        status: settlementOption.id === 'full_refund' ? 'refunded' : 'completed',
        valorReleased: true,
      },
    })
  })
}
