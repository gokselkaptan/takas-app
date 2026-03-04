import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

// GET - Ürünün doğrulama durumunu getir
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json(
        { error: 'Ürün ID gerekli' },
        { status: 400 }
      )
    }

    const verification = await prisma.productVerification.findUnique({
      where: { productId }
    })

    if (!verification) {
      return NextResponse.json({
        verified: false,
        score: null,
        message: 'Bu ürün henüz doğrulanmamış'
      })
    }

    return NextResponse.json({
      verified: verification.isVerified,
      score: verification.overallScore,
      verifiedAt: verification.verifiedAt,
      checks: {
        resolution: verification.resolutionPassed,
        clarity: verification.clarityScore,
        authenticity: verification.authenticityPassed,
        isStockPhoto: verification.isStockPhoto,
        content: verification.contentPassed,
        lighting: verification.lightingScore
      },
      recommendations: verification.recommendations,
      blockReason: verification.blockReason
    })
  } catch (error) {
    console.error('Product verification fetch error:', error)
    return NextResponse.json(
      { error: 'Doğrulama bilgisi alınırken hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Ürün doğrulaması kaydet (internal use)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Giriş yapmanız gerekiyor' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      productId,
      overallScore,
      resolutionPassed,
      clarityScore,
      authenticityPassed,
      isStockPhoto,
      contentPassed,
      lightingScore,
      recommendations,
      blockReason
    } = body

    if (!productId) {
      return NextResponse.json(
        { error: 'Ürün ID gerekli' },
        { status: 400 }
      )
    }

    // Ürün sahibi mi kontrol et
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { userId: true }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Ürün bulunamadı' },
        { status: 404 }
      )
    }

    if (product.userId !== user.id) {
      return NextResponse.json(
        { error: 'Bu ürün size ait değil' },
        { status: 403 }
      )
    }

    // Doğrulama kaydını oluştur veya güncelle
    const isVerified = overallScore >= 50 && !isStockPhoto && authenticityPassed

    const verification = await prisma.productVerification.upsert({
      where: { productId },
      create: {
        productId,
        overallScore: overallScore || 0,
        isVerified,
        verifiedAt: isVerified ? new Date() : null,
        resolutionPassed: resolutionPassed || false,
        clarityScore: clarityScore || 0,
        authenticityPassed: authenticityPassed || false,
        isStockPhoto: isStockPhoto || false,
        contentPassed: contentPassed || false,
        lightingScore: lightingScore || 0,
        recommendations: recommendations || [],
        blockReason
      },
      update: {
        overallScore: overallScore || 0,
        isVerified,
        verifiedAt: isVerified ? new Date() : null,
        resolutionPassed: resolutionPassed || false,
        clarityScore: clarityScore || 0,
        authenticityPassed: authenticityPassed || false,
        isStockPhoto: isStockPhoto || false,
        contentPassed: contentPassed || false,
        lightingScore: lightingScore || 0,
        recommendations: recommendations || [],
        blockReason
      }
    })

    return NextResponse.json({
      success: true,
      verification: {
        verified: verification.isVerified,
        score: verification.overallScore
      }
    })
  } catch (error) {
    console.error('Product verification save error:', error)
    return NextResponse.json(
      { error: 'Doğrulama kaydedilirken hata oluştu' },
      { status: 500 }
    )
  }
}
