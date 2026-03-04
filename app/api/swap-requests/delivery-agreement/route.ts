import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST: Teslimat anlaşması aksiyonları
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true },
    })
    
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    const body = await request.json()
    const { swapId, action } = body

    if (!swapId || !action) {
      return NextResponse.json({ error: 'swapId ve action gerekli' }, { status: 400 })
    }

    // Takas isteğini getir
    const swap = await prisma.swapRequest.findUnique({
      where: { id: swapId },
      include: {
        product: { select: { id: true, title: true } },
        owner: { select: { id: true, name: true, email: true } },
        requester: { select: { id: true, name: true, email: true } },
      },
    })

    if (!swap) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    const isOwner = swap.ownerId === user.id
    const isRequester = swap.requesterId === user.id

    if (!isOwner && !isRequester) {
      return NextResponse.json({ error: 'Bu takasa erişim yetkiniz yok' }, { status: 403 })
    }

    // ═══ AKSİYON: KARŞILIKLI İPTAL (iki taraf uzlaşmalı) ═══
    if (action === 'request_mutual_cancel') {
      const { cancelReason, cancelNote } = body
      
      if (!cancelReason) {
        return NextResponse.json({ error: 'İptal sebebi gerekli' }, { status: 400 })
      }

      // İptal talebini kaydet (diğer tarafın onayı gerekli)
      await prisma.swapRequest.update({
        where: { id: swapId },
        data: {
          status: 'cancel_requested',
        }
      })

      // İptal detaylarını status log'a kaydet
      await prisma.swapStatusLog.create({
        data: {
          swapRequestId: swapId,
          fromStatus: swap.status,
          toStatus: 'cancel_requested',
          changedBy: user.id,
          reason: `MUTUAL_CANCEL_REQUEST|${cancelReason}|${cancelNote || ''}`,
        }
      })

      // Diğer tarafa bildirim
      const otherUserId = isOwner ? swap.requesterId : swap.ownerId
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: otherUserId,
          productId: swap.productId,
          content: `⚠️ TAKAS İPTAL TALEBİ\n\n${user.name || 'Kullanıcı'} takası karşılıklı iptal etmek istiyor.\n\n📋 Sebep: ${cancelReason}\n${cancelNote ? `📝 Not: ${cancelNote}` : ''}\n\n✅ Kabul ederseniz takas iptal edilir, iki tarafın da güven puanı DÜŞMEZ.\n❌ Reddederseniz takas devam eder.`,
          isModerated: true,
          moderationResult: 'approved',
          metadata: JSON.stringify({
            type: 'cancel_request',
            swapRequestId: swap.id
          })
        }
      })

      return NextResponse.json({ success: true, message: 'İptal talebi gönderildi. Karşı tarafın onayı bekleniyor.' })
    }

    // ═══ AKSİYON: KARŞILIKLI İPTAL ONAYLA ═══
    if (action === 'accept_mutual_cancel') {
      if (swap.status !== 'cancel_requested') {
        return NextResponse.json({ error: 'İptal talebi bulunamadı' }, { status: 400 })
      }

      // İptal talebini yapanı status log'dan bul
      const cancelLog = await prisma.swapStatusLog.findFirst({
        where: { 
          swapRequestId: swapId, 
          toStatus: 'cancel_requested',
          reason: { startsWith: 'MUTUAL_CANCEL_REQUEST' }
        },
        orderBy: { createdAt: 'desc' }
      })
      
      // İptal talep eden kendisi olamaz
      if (cancelLog?.changedBy === user.id) {
        return NextResponse.json({ error: 'Kendi talebinizi onaylayamazsınız' }, { status: 400 })
      }

      // Teminatları serbest bırak
      if (swap.requesterDeposit) {
        await prisma.user.update({
          where: { id: swap.requesterId },
          data: { lockedValor: { decrement: swap.requesterDeposit } }
        })
      }
      if (swap.ownerDeposit) {
        await prisma.user.update({
          where: { id: swap.ownerId },
          data: { lockedValor: { decrement: swap.ownerDeposit } }
        })
      }

      // Ürünü tekrar aktif yap
      await prisma.product.update({
        where: { id: swap.productId },
        data: { status: 'active' }
      })

      await prisma.swapRequest.update({
        where: { id: swapId },
        data: {
          status: 'cancelled_mutual',
          escrowStatus: 'refunded',
        }
      })

      // İki tarafa da bildirim — TRUST PUANI DÜŞMEZ
      const cancelMsg = `✅ TAKAS KARŞILIKLI İPTAL EDİLDİ\n\nHer iki taraf da iptal konusunda anlaştı.\n🛡️ Güven puanınız ETKİLENMEDİ.\n💰 Teminatınız iade edildi.\n\nTakas: "${swap.product.title}"`
      
      await prisma.message.createMany({
        data: [
          { senderId: 'system', receiverId: swap.requesterId, productId: swap.productId, content: cancelMsg, isModerated: true, moderationResult: 'approved' },
          { senderId: 'system', receiverId: swap.ownerId, productId: swap.productId, content: cancelMsg, isModerated: true, moderationResult: 'approved' },
        ]
      })

      return NextResponse.json({ success: true, message: 'Takas karşılıklı iptal edildi. Güven puanları etkilenmedi.' })
    }

    // ═══ AKSİYON: KARŞILIKLI İPTAL REDDET ═══
    if (action === 'reject_mutual_cancel') {
      if (swap.status !== 'cancel_requested') {
        return NextResponse.json({ error: 'İptal talebi bulunamadı' }, { status: 400 })
      }

      // Önceki status'a geri dön
      await prisma.swapRequest.update({
        where: { id: swapId },
        data: { status: 'qr_scanned' } // QR okutulmuş haline geri dön
      })

      const otherUserId = isOwner ? swap.requesterId : swap.ownerId
      await prisma.message.create({
        data: {
          senderId: user.id,
          receiverId: otherUserId,
          productId: swap.productId,
          content: `❌ İptal talebi reddedildi. Takas devam ediyor.`,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      return NextResponse.json({ success: true, message: 'İptal talebi reddedildi, takas devam ediyor.' })
    }

    // ═══ AKSİYON: ANLAŞMAZLIK BİLDİR (Dispute) ═══
    if (action === 'open_dispute') {
      const { disputeType, disputeDescription, evidencePhotos } = body
      
      if (!disputeType || !disputeDescription) {
        return NextResponse.json({ error: 'Anlaşmazlık türü ve açıklama gerekli' }, { status: 400 })
      }

      // Dispute raporu oluştur
      const dispute = await prisma.disputeReport.create({
        data: {
          swapRequestId: swapId,
          reporterId: user.id,
          reportedUserId: isRequester ? swap.ownerId : swap.requesterId,
          type: disputeType,
          description: disputeDescription,
          evidence: evidencePhotos || [],
          status: 'open',
          evidenceDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 saat
        }
      })

      await prisma.swapRequest.update({
        where: { id: swapId },
        data: { status: 'disputed' }
      })

      // Diğer tarafa bildirim + kanıt talebi
      const otherUserId = isOwner ? swap.requesterId : swap.ownerId
      await prisma.message.create({
        data: {
          senderId: 'system',
          receiverId: otherUserId,
          productId: swap.productId,
          content: `⚠️ ANLAŞMAZLIK BİLDİRİMİ\n\n"${swap.product.title}" takası için anlaşmazlık bildirildi.\n\n📋 Tür: ${disputeType}\n📝 Açıklama: ${disputeDescription}\n\n📸 48 saat içinde fotoğraflı kanıt sunmanız gerekmektedir.\nTakaslarım sayfasından kanıtlarınızı yükleyebilirsiniz.\n\n⚖️ AI ve Admin incelemesinden sonra karar bildirilecektir.`,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      // Admin'e bildirim
      await prisma.message.create({
        data: {
          senderId: 'system',
          receiverId: 'admin',
          productId: swap.productId,
          content: `🔴 YENİ ANLAŞMAZLIK\n\nTakas: ${swap.product.title}\nBildiren: ${user.name}\nTür: ${disputeType}\nAçıklama: ${disputeDescription}\nKanıt: ${(evidencePhotos || []).length} fotoğraf`,
          isModerated: true,
          moderationResult: 'approved',
        }
      })

      return NextResponse.json({ 
        success: true, 
        disputeId: dispute.id,
        message: 'Anlaşmazlık bildirildi. 48 saat içinde incelenecek.' 
      })
    }

    // ═══ AKSİYON: DİSPUTE İÇİN KANIT YÜKLE (diğer taraf) ═══
    if (action === 'submit_dispute_evidence') {
      const { disputeId, evidencePhotos, evidenceNote } = body
      
      if (!disputeId) {
        return NextResponse.json({ error: 'disputeId gerekli' }, { status: 400 })
      }

      const dispute = await prisma.disputeReport.findUnique({
        where: { id: disputeId }
      })

      if (!dispute) {
        return NextResponse.json({ error: 'Anlaşmazlık bulunamadı' }, { status: 404 })
      }

      // Sadece raporlanan kişi kanıt yükleyebilir
      if (dispute.reportedUserId !== user.id) {
        return NextResponse.json({ error: 'Sadece raporlanan taraf kanıt yükleyebilir' }, { status: 403 })
      }

      await prisma.disputeReport.update({
        where: { id: disputeId },
        data: {
          reportedEvidence: evidencePhotos || [],
          reportedEvidenceAt: new Date(),
          reportedEvidenceNote: evidenceNote || '',
          status: 'evidence_submitted',
        }
      })

      return NextResponse.json({ success: true, message: 'Kanıtlar yüklendi. İnceleme başlayacak.' })
    }

    // ═══ AKSİYON: FOTOĞRAF KANIT YÜKLE (her adım için) ═══
    if (action === 'upload_step_photo') {
      const { stepType, base64Photo } = body
      // stepType: 'packaged' | 'meeting' | 'received' | 'opened'
      
      if (!stepType || !base64Photo) {
        return NextResponse.json({ error: 'Fotoğraf ve adım tipi gerekli' }, { status: 400 })
      }

      // Base64'ü S3'e yükle
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      const { createS3Client, getBucketConfig } = await import('@/lib/aws-config')
      
      const base64Data = base64Photo.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const { bucketName, folderPrefix } = getBucketConfig()
      const key = `${folderPrefix}public/uploads/swap-evidence/${swapId}/${stepType}-${Date.now()}.jpg`
      
      const s3Client = createS3Client()
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg',
      }))

      // Fotoğraf path'ini swap'a kaydet
      const photoField = stepType === 'packaged' ? 'senderPhotos' 
        : stepType === 'received' ? 'receiverPhotos'
        : 'senderPhotos' // default
      
      const currentPhotos = (swap as any)[photoField] || []
      await prisma.swapRequest.update({
        where: { id: swapId },
        data: {
          [photoField]: [...currentPhotos, key]
        }
      })

      const { getFileUrl } = await import('@/lib/s3')
      const photoUrl = await getFileUrl(key, true)

      return NextResponse.json({ success: true, photoUrl, message: 'Fotoğraf yüklendi' })
    }

    return NextResponse.json({ error: 'Geçersiz aksiyon' }, { status: 400 })
  } catch (error) {
    console.error('Delivery agreement error:', error)
    return NextResponse.json({ error: 'İşlem sırasında bir hata oluştu' }, { status: 500 })
  }
}
