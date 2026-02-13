import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { giveReviewBonus } from '@/lib/valor-system'

export const dynamic = 'force-dynamic'

// Yorum etiketleri (internal use only)
const REVIEW_TAGS = {
  fast_delivery: {
    tr: 'Hızlı Teslimat',
    en: 'Fast Delivery',
    es: 'Entrega Rápida',
    ca: 'Lliurament Ràpid'
  },
  accurate_description: {
    tr: 'Doğru Açıklama',
    en: 'Accurate Description',
    es: 'Descripción Precisa',
    ca: 'Descripció Precisa'
  },
  good_communication: {
    tr: 'İyi İletişim',
    en: 'Good Communication',
    es: 'Buena Comunicación',
    ca: 'Bona Comunicació'
  },
  friendly: {
    tr: 'Samimi',
    en: 'Friendly',
    es: 'Amigable',
    ca: 'Amigable'
  },
  professional: {
    tr: 'Profesyonel',
    en: 'Professional',
    es: 'Profesional',
    ca: 'Professional'
  },
  punctual: {
    tr: 'Dakik',
    en: 'Punctual',
    es: 'Puntual',
    ca: 'Puntual'
  }
}

// Yorumları getir
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const swapRequestId = searchParams.get('swapRequestId')
    const checkPending = searchParams.get('checkPending') === 'true'
    
    // Bekleyen yorum kontrolü (takas sonrası)
    if (checkPending) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      const user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      // Tamamlanmış ama henüz değerlendirilmemiş takaslar
      const pendingReviews = await prisma.swapRequest.findMany({
        where: {
          status: 'completed',
          OR: [
            { requesterId: user.id },
            { ownerId: user.id }
          ],
          NOT: {
            reviews: {
              some: {
                authorId: user.id
              }
            }
          }
        },
        include: {
          product: {
            select: { id: true, title: true, images: true }
          },
          offeredProduct: {
            select: { id: true, title: true, images: true }
          },
          requester: {
            select: { id: true, name: true, image: true }
          },
          owner: {
            select: { id: true, name: true, image: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 5
      })
      
      return NextResponse.json({
        pendingReviews: pendingReviews.map((swap: { id: string; product: { id: string; title: string }; offeredProduct: { id: string; title: string } | null; requesterId: string; owner: { id: string; name: string | null }; requester: { id: string; name: string | null }; updatedAt: Date }) => ({
          swapId: swap.id,
          product: swap.product,
          offeredProduct: swap.offeredProduct,
          otherUser: swap.requesterId === user.id ? swap.owner : swap.requester,
          completedAt: swap.updatedAt
        }))
      })
    }
    
    // Belirli kullanıcının aldığı yorumlar
    if (userId) {
      const reviews = await prisma.review.findMany({
        where: { 
          targetUserId: userId,
          isPublic: true
        },
        include: {
          author: {
            select: { id: true, name: true, image: true }
          },
          swapRequest: {
            include: {
              product: {
                select: { id: true, title: true, images: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
      
      // İstatistikleri hesapla
      const stats = await calculateUserReviewStats(userId)
      
      return NextResponse.json({ reviews, stats })
    }
    
    // Belirli takasın yorumları
    if (swapRequestId) {
      const reviews = await prisma.review.findMany({
        where: { swapRequestId },
        include: {
          author: {
            select: { id: true, name: true, image: true }
          },
          targetUser: {
            select: { id: true, name: true, image: true }
          }
        }
      })
      
      return NextResponse.json({ reviews })
    }
    
    return NextResponse.json({ error: 'userId or swapRequestId required' }, { status: 400 })
    
  } catch (error) {
    console.error('Reviews GET error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Yeni yorum ekle
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    const { swapRequestId, rating, comment, tags } = await request.json()
    
    if (!swapRequestId || !rating) {
      return NextResponse.json({ error: 'swapRequestId and rating required' }, { status: 400 })
    }
    
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }
    
    // Takas kontrolü
    const swap = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      include: {
        requester: true,
        owner: true
      }
    })
    
    if (!swap) {
      return NextResponse.json({ error: 'Swap not found' }, { status: 404 })
    }
    
    // Tamamlanmış mı?
    if (swap.status !== 'completed') {
      return NextResponse.json({ error: 'Swap not completed yet' }, { status: 400 })
    }
    
    // Kullanıcı bu takasın parçası mı?
    const isRequester = swap.requesterId === user.id
    const isOwner = swap.ownerId === user.id
    
    if (!isRequester && !isOwner) {
      return NextResponse.json({ error: 'You are not part of this swap' }, { status: 403 })
    }
    
    // Zaten yorum yapılmış mı?
    const existingReview = await prisma.review.findUnique({
      where: {
        authorId_swapRequestId: {
          authorId: user.id,
          swapRequestId
        }
      }
    })
    
    if (existingReview) {
      return NextResponse.json({ error: 'You already reviewed this swap' }, { status: 400 })
    }
    
    // Hedef kullanıcı
    const targetUserId = isRequester ? swap.ownerId : swap.requesterId
    
    // Yorum oluştur
    const review = await prisma.review.create({
      data: {
        authorId: user.id,
        targetUserId,
        swapRequestId,
        rating,
        comment: comment || null,
        tags: tags || []
      },
      include: {
        author: {
          select: { id: true, name: true, image: true }
        },
        targetUser: {
          select: { id: true, name: true, image: true }
        }
      }
    })
    
    // Trust score güncelle
    await updateUserTrustScore(targetUserId)
    
    // Değerlendirme bonusu ver
    let bonusResult: { success: boolean; bonus?: number; message?: string } | null = null
    try {
      bonusResult = await giveReviewBonus(user.id)
    } catch (e) {
      console.log('Review bonus verilemedi:', e)
    }
    
    return NextResponse.json({
      review,
      message: 'Değerlendirmeniz kaydedildi. Teşekkürler!',
      bonusAwarded: bonusResult?.success ? bonusResult.bonus : null,
      bonusMessage: bonusResult?.message || null
    })
    
  } catch (error) {
    console.error('Reviews POST error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Yoruma yanıt ekle
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    const { reviewId, response } = await request.json()
    
    if (!reviewId || !response) {
      return NextResponse.json({ error: 'reviewId and response required' }, { status: 400 })
    }
    
    // Yorum kontrolü
    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    })
    
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }
    
    // Sadece değerlendirilen kişi yanıt verebilir
    if (review.targetUserId !== user.id) {
      return NextResponse.json({ error: 'Only the reviewed user can respond' }, { status: 403 })
    }
    
    // Zaten yanıt var mı?
    if (review.response) {
      return NextResponse.json({ error: 'Already responded' }, { status: 400 })
    }
    
    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        response,
        responseAt: new Date()
      }
    })
    
    return NextResponse.json({
      review: updatedReview,
      message: 'Yanıtınız kaydedildi'
    })
    
  } catch (error) {
    console.error('Reviews PATCH error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Kullanıcı istatistiklerini hesapla
async function calculateUserReviewStats(userId: string) {
  const reviews = await prisma.review.findMany({
    where: { targetUserId: userId, isPublic: true }
  })
  
  if (reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      topTags: []
    }
  }
  
  const totalRating = reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0)
  const averageRating = totalRating / reviews.length
  
  // Puan dağılımı
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  reviews.forEach((r: { rating: number }) => {
    ratingDistribution[r.rating as keyof typeof ratingDistribution]++
  })
  
  // En çok kullanılan etiketler
  const tagCounts: Record<string, number> = {}
  reviews.forEach((r: { tags: string[] }) => {
    r.tags.forEach((tag: string) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    })
  })
  
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }))
  
  return {
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews: reviews.length,
    ratingDistribution,
    topTags
  }
}

// Trust score güncelle
async function updateUserTrustScore(userId: string) {
  const reviews = await prisma.review.findMany({
    where: { targetUserId: userId }
  })
  
  if (reviews.length === 0) return
  
  const avgRating = reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length
  
  // Trust score: 60 (base) + (avgRating * 8) = max 100
  const newTrustScore = Math.min(100, Math.round(60 + (avgRating * 8)))
  
  await prisma.user.update({
    where: { id: userId },
    data: { trustScore: newTrustScore }
  })
}
