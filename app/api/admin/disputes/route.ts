import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// GÖREV 47: Dispute türü etiketleri
const disputeTypeLabels: Record<string, string> = {
  product_mismatch: 'Ürün açıklamayla uyuşmuyor',
  product_damaged: 'Ürün hasarlı/kusurlu geldi',
  product_not_delivered: 'Ürün teslim edilmedi',
  wrong_product: 'Yanlış ürün gönderildi',
  valor_dispute: 'VALOR değeri anlaşmazlığı',
  communication_issue: 'İletişim sorunu',
  fraud_suspicion: 'Dolandırıcılık şüphesi',
  defect: 'Ürün kusurlu',
  not_as_described: 'Açıklamayla uyuşmuyor',
  missing_parts: 'Eksik parça',
  damaged: 'Hasar var',
  wrong_item: 'Yanlış ürün gönderilmiş',
  no_show: 'Karşı taraf gelmedi',
  other: 'Diğer'
}

const expectedResolutionLabels: Record<string, string> = {
  refund_valor: 'VALOR iadesi',
  product_return: 'Ürün iadesi',
  replacement: 'Değişim',
  partial_refund: 'Kısmi VALOR iadesi',
  apology: 'Özür / uyarı yeterli',
  other: 'Diğer'
}

// GET: Admin için tüm dispute'ları detaylı listele — GÖREV 47
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }
    
    // Admin kontrolü: role veya email bazlı
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, email: true },
    })
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    // Admin kontrolü
    if (currentUser.role !== 'admin' && currentUser.email !== 'join@takas-a.com') {
      return NextResponse.json({ error: 'Admin yetkisi gerekli' }, { status: 403 })
    }

    // GÖREV 47: Detaylı dispute bilgileri
    const disputes = await prisma.disputeReport.findMany({
      include: {
        swapRequest: {
          include: {
            product: {
              select: { 
                id: true, 
                title: true, 
                images: true, 
                valorPrice: true, 
                description: true,
                status: true 
              }
            },
            offeredProduct: {
              select: { 
                id: true, 
                title: true, 
                images: true, 
                valorPrice: true, 
                description: true,
                status: true 
              }
            },
            owner: {
              select: { 
                id: true, 
                name: true, 
                email: true, 
                image: true, 
                trustScore: true,
                nickname: true
              }
            },
            requester: {
              select: { 
                id: true, 
                name: true, 
                email: true, 
                image: true, 
                trustScore: true,
                nickname: true
              }
            },
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // Open first, then evidence_pending, under_review, resolved
        { createdAt: 'desc' }
      ],
    })

    // GÖREV 47: Her dispute için takas sayısını hesapla
    const enrichedDisputes = await Promise.all(disputes.map(async (dispute) => {
      // Reporter ve owner'ın tamamlanmış takas sayıları
      const [reporterSwaps, ownerSwaps] = await Promise.all([
        prisma.swapRequest.count({
          where: {
            OR: [
              { requesterId: dispute.reporterId },
              { ownerId: dispute.reporterId }
            ],
            status: 'completed'
          }
        }),
        prisma.swapRequest.count({
          where: {
            OR: [
              { requesterId: dispute.reportedUserId },
              { ownerId: dispute.reportedUserId }
            ],
            status: 'completed'
          }
        })
      ])

      return {
        ...dispute,
        disputeTypeLabel: disputeTypeLabels[dispute.disputeType || dispute.type] || dispute.type,
        expectedResolutionLabel: expectedResolutionLabels[dispute.expectedResolution || ''] || dispute.expectedResolution,
        reporterSwapCount: reporterSwaps,
        ownerSwapCount: ownerSwaps
      }
    }))

    return NextResponse.json(enrichedDisputes)
  } catch (error) {
    console.error('Admin disputes fetch error:', error)
    return NextResponse.json({ error: 'Dispute listesi yüklenemedi' }, { status: 500 })
  }
}

// PUT: Admin kararını kaydet — GÖREV 47
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }
    
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, email: true },
    })
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    // Admin kontrolü
    if (currentUser.role !== 'admin' && currentUser.email !== 'join@takas-a.com') {
      return NextResponse.json({ error: 'Admin yetkisi gerekli' }, { status: 403 })
    }

    const { disputeId, status, adminNotes, resolution, action, rightParty } = await request.json()

    if (!disputeId) {
      return NextResponse.json({ error: 'Dispute ID gerekli' }, { status: 400 })
    }

    // Dispute'u çek
    const dispute = await prisma.disputeReport.findUnique({
      where: { id: disputeId },
      include: {
        swapRequest: {
          include: {
            product: true,
            offeredProduct: true,
            owner: { select: { id: true, name: true, email: true, trustScore: true } },
            requester: { select: { id: true, name: true, email: true, trustScore: true } },
          },
        },
      },
    })

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute bulunamadı' }, { status: 404 })
    }

    // Transaction ile güncelle
    const result = await prisma.$transaction(async (tx) => {
      // Dispute'u güncelle
      const updated = await tx.disputeReport.update({
        where: { id: disputeId },
        data: {
          status: status || dispute.status,
          adminNotes,
          resolution,
          resolvedAt: status === 'resolved' || status === 'resolved_reporter' || status === 'resolved_respondent' || status === 'resolved_mutual' || status === 'closed' 
            ? new Date() 
            : undefined
        },
      })

      // Aksiyonlara göre işlem yap
      if (action === 'cancel_swap') {
        await tx.swapRequest.update({
          where: { id: dispute.swapRequestId },
          data: { status: 'cancelled', cancelReason: resolution, cancelledBy: currentUser.id, cancelledAt: new Date() }
        })
      }

      if (action === 'refund_valor' && dispute.swapRequest.pendingValorAmount) {
        // VALOR iade işlemi - bildirene iade
        await tx.user.update({
          where: { id: dispute.reporterId },
          data: { valorBalance: { increment: dispute.swapRequest.pendingValorAmount } }
        })
        
        await tx.valorTransaction.create({
          data: {
            toUserId: dispute.reporterId,
            amount: dispute.swapRequest.pendingValorAmount,
            fee: 0,
            netAmount: dispute.swapRequest.pendingValorAmount,
            type: 'dispute_refund',
            swapRequestId: dispute.swapRequestId,
            description: `Anlaşmazlık iadesi: ${resolution}`
          }
        })
        
        await tx.swapRequest.update({
          where: { id: dispute.swapRequestId },
          data: { status: 'refunded' }
        })
      }

      if (action === 'warn_user') {
        // Haksız tarafa uyarı ver
        const warnUserId = rightParty === 'reporter' ? dispute.reportedUserId : dispute.reporterId
        const warnUser = await tx.user.findUnique({ where: { id: warnUserId }, select: { trustScore: true } })
        
        await tx.user.update({
          where: { id: warnUserId },
          data: {
            trustScore: Math.max(0, (warnUser?.trustScore || 100) - 10),
            totalWarnings: { increment: 1 }
          }
        })
        
        await tx.userWarning.create({
          data: {
            userId: warnUserId,
            type: 'dispute_warning',
            severity: 'medium',
            description: `Anlaşmazlık sonucu uyarı: ${resolution}`
          }
        })
      }

      return updated
    })

    // GÖREV 47: Email bildirim gönder (başarısız olsa bile devam et)
    try {
      const statusLabel = status === 'resolved' || status === 'resolved_reporter' || status === 'resolved_mutual' 
        ? 'Çözüldü' 
        : status === 'resolved_respondent' ? 'Reddedildi' : 'Güncellendi'
      
      // Bildirene email
      const reporterEmail = dispute.contactEmail || dispute.swapRequest.requester.email
      if (reporterEmail) {
        await sendEmail({
          to: reporterEmail,
          subject: `TAKAS-A | Anlaşmazlık Durumu: ${statusLabel}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #8B5CF6, #7C3AED); padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">⚖️ Anlaşmazlık Güncellendi</h1>
              </div>
              <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 12px 12px;">
                <p style="color: #333; font-size: 16px;">Merhaba,</p>
                <p style="color: #666;">Raporladığınız anlaşmazlık hakkında karar verildi.</p>
                
                <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #8B5CF6;">
                  <p style="margin: 0; font-weight: bold; color: #8B5CF6;">Ürün: ${dispute.swapRequest.product.title}</p>
                  <p style="margin: 8px 0 0; color: #666;">Durum: <strong style="color: ${status?.includes('resolved') ? '#22c55e' : '#f59e0b'}">${statusLabel}</strong></p>
                  ${resolution ? `<p style="margin: 8px 0 0; color: #333;">Karar: ${resolution}</p>` : ''}
                </div>
                
                <p style="color: #666; font-size: 14px;">Detaylar için lütfen TAKAS-A hesabınıza giriş yapın.</p>
                
                <div style="text-align: center; margin-top: 24px;">
                  <a href="https://takas-a.com/takas-firsatlari" style="background: #8B5CF6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Hesabıma Git</a>
                </div>
                
                <p style="color: #999; font-size: 12px; margin-top: 24px; text-align: center;">
                  Bu email TAKAS-A tarafından gönderilmiştir.
                </p>
              </div>
            </div>
          `
        })
        console.log(`Dispute email sent to reporter: ${reporterEmail}`)
      }

      // Karşı tarafa email
      const ownerEmail = dispute.swapRequest.owner.email
      if (ownerEmail && ownerEmail !== reporterEmail) {
        await sendEmail({
          to: ownerEmail,
          subject: `TAKAS-A | Anlaşmazlık Durumu: ${statusLabel}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #8B5CF6, #7C3AED); padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">⚖️ Anlaşmazlık Güncellendi</h1>
              </div>
              <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 12px 12px;">
                <p style="color: #333; font-size: 16px;">Merhaba,</p>
                <p style="color: #666;">Bir anlaşmazlık hakkında karar verildi.</p>
                
                <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #8B5CF6;">
                  <p style="margin: 0; font-weight: bold; color: #8B5CF6;">Ürün: ${dispute.swapRequest.product.title}</p>
                  <p style="margin: 8px 0 0; color: #666;">Durum: <strong style="color: ${status?.includes('resolved') ? '#22c55e' : '#f59e0b'}">${statusLabel}</strong></p>
                  ${resolution ? `<p style="margin: 8px 0 0; color: #333;">Karar: ${resolution}</p>` : ''}
                </div>
                
                <p style="color: #666; font-size: 14px;">Detaylar için lütfen TAKAS-A hesabınıza giriş yapın.</p>
                
                <div style="text-align: center; margin-top: 24px;">
                  <a href="https://takas-a.com/takas-firsatlari" style="background: #8B5CF6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Hesabıma Git</a>
                </div>
                
                <p style="color: #999; font-size: 12px; margin-top: 24px; text-align: center;">
                  Bu email TAKAS-A tarafından gönderilmiştir.
                </p>
              </div>
            </div>
          `
        })
        console.log(`Dispute email sent to owner: ${ownerEmail}`)
      }
    } catch (emailError) {
      console.error('Email sending failed:', emailError)
    }

    return NextResponse.json({ 
      success: true, 
      dispute: result,
      message: 'Karar başarıyla kaydedildi'
    })
  } catch (error) {
    console.error('Admin dispute update error:', error)
    return NextResponse.json({ error: 'Karar kaydedilemedi' }, { status: 500 })
  }
}
