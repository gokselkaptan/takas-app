import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// Takas feedback'i oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const { swapRequestId, isFair, fairnessScore, priceAccuracy, comment } = body

    if (!swapRequestId) {
      return NextResponse.json({ error: 'Takas ID gerekli' }, { status: 400 })
    }

    // Takas bilgisini al
    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      select: {
        id: true,
        requesterId: true,
        ownerId: true,
        status: true
      }
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    // Kullanıcı bu takasın tarafı mı kontrol et
    const isRequester = swapRequest.requesterId === user.id
    const isOwner = swapRequest.ownerId === user.id

    if (!isRequester && !isOwner) {
      return NextResponse.json({ error: 'Bu takas için yetkiniz yok' }, { status: 403 })
    }

    // Takas tamamlanmış mı kontrol et
    if (swapRequest.status !== 'completed') {
      return NextResponse.json({ error: 'Sadece tamamlanmış takaslar için feedback verilebilir' }, { status: 400 })
    }

    // Hedef kullanıcıyı belirle
    const targetUserId = isRequester ? swapRequest.ownerId : swapRequest.requesterId

    // Daha önce feedback verilmiş mi kontrol et
    const existingFeedback = await prisma.swapFeedback.findUnique({
      where: { swapRequestId }
    })

    if (existingFeedback) {
      return NextResponse.json({ error: 'Bu takas için zaten feedback verilmiş' }, { status: 400 })
    }

    // Feedback oluştur
    const feedback = await prisma.swapFeedback.create({
      data: {
        swapRequestId,
        userId: user.id,
        targetUserId,
        isFair: isFair ?? true,
        fairnessScore: Math.min(5, Math.max(1, fairnessScore || 3)),
        priceAccuracy: Math.min(5, Math.max(1, priceAccuracy || 3)),
        comment: comment || null
      }
    })

    // Eğer feedback negatifse, trust score'u düşük ver
    if (!isFair || fairnessScore < 3 || priceAccuracy < 2) {
      // Trust score'u 2 puan düşür (minimum 50)
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          trustScore: {
            decrement: 2
          }
        }
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Geri bildiriminiz kaydedildi. Teşekkürler!',
      feedback: {
        id: feedback.id,
        isFair: feedback.isFair,
        fairnessScore: feedback.fairnessScore
      }
    })
  } catch (error) {
    console.error('Feedback hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// Takas feedback'i kontrol et (kullanıcı için)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const swapRequestId = searchParams.get('swapRequestId')

    if (!swapRequestId) {
      return NextResponse.json({ error: 'Takas ID gerekli' }, { status: 400 })
    }

    // Feedback var mı kontrol et
    const feedback = await prisma.swapFeedback.findUnique({
      where: { swapRequestId }
    })

    return NextResponse.json({ 
      hasFeedback: !!feedback,
      feedback: feedback ? {
        isFair: feedback.isFair,
        fairnessScore: feedback.fairnessScore,
        priceAccuracy: feedback.priceAccuracy,
        createdAt: feedback.createdAt
      } : null
    })
  } catch (error) {
    console.error('Feedback kontrol hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
