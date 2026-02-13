import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { translateProducts } from '@/lib/product-translations'
import { markPendingProductBonus } from '@/lib/valor-system'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'newest'
    const limit = parseInt(searchParams.get('limit') || '50')
    const mine = searchParams.get('mine') === 'true'
    const lang = searchParams.get('lang') || 'tr'

    // If fetching user's own products
    if (mine) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.email) {
        return NextResponse.json({ products: [] })
      }
      const user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })
      if (!user) {
        return NextResponse.json({ products: [] })
      }
      const showAll = searchParams.get('all') === 'true'
      const myProducts = await prisma.product.findMany({
        where: { 
          userId: user.id, 
          ...(showAll ? {} : { status: 'active' })
        },
        orderBy: { createdAt: 'desc' },
        select: { 
          id: true, 
          title: true, 
          images: true, 
          valorPrice: true, 
          status: true, 
          views: true,
          createdAt: true 
        }
      })
      return NextResponse.json({ products: myProducts })
    }

    const where: Record<string, unknown> = {
      status: 'active'
    }

    if (category && category !== 'all') {
      // Support both category slug and categoryId
      const categoryRecord = await prisma.category.findFirst({
        where: { 
          OR: [
            { slug: category },
            { id: category }
          ]
        }
      })
      if (categoryRecord) {
        where.categoryId = categoryRecord.id
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    let orderBy: Record<string, string> = { createdAt: 'desc' }
    if (sort === 'oldest') orderBy = { createdAt: 'asc' }
    if (sort === 'priceHigh') orderBy = { valorPrice: 'desc' }
    if (sort === 'priceLow') orderBy = { valorPrice: 'asc' }

    // Pagination support
    const page = parseInt(searchParams.get('page') || '1')
    const skip = (page - 1) * limit

    // Get total count for pagination
    const total = await prisma.product.count({ where })

    const products = await prisma.product.findMany({
      where,
      orderBy,
      take: limit,
      skip,
      include: {
        category: true,
        user: {
          select: {
            id: true,
            name: true,
            nickname: true
          }
        }
      }
    })

    // Dil parametresine göre ürünleri çevir
    const translatedProducts = translateProducts(products, lang)

    return NextResponse.json({ 
      products: translatedProducts, 
      total,
      page,
      limit,
      hasMore: skip + products.length < total
    })
  } catch (error) {
    console.error('Ürünler getirme hatası:', error)
    return NextResponse.json(
      { error: 'Ürünler getirilemedi' },
      { status: 500 }
    )
  }
}

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
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    // Check daily limit
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const isSameDay = user.lastProductDate && 
      new Date(user.lastProductDate).setHours(0, 0, 0, 0) === today.getTime()
    
    const currentCount = isSameDay ? user.dailyProductCount : 0
    const dailyLimit = user.isPremium ? 999 : 3

    if (currentCount >= dailyLimit) {
      return NextResponse.json(
        { error: `Günlük ${dailyLimit} ürün ekleme limitinize ulaştınız. Premium üyelik ile sınırsız ürün ekleyebilirsiniz.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { 
      title, description, categoryId, condition, valorPrice, 
      userValorPrice, aiValorPrice, aiValorReason, checklistData,
      usageInfo, images, latitude, longitude, district, city,
      isFreeAvailable, acceptsNegotiation
    } = body

    if (!title || !description || !categoryId) {
      return NextResponse.json(
        { error: 'Gerekli alanlar eksik' },
        { status: 400 }
      )
    }

    // Bedelsiz ürünler için valorPrice 0 olabilir
    const finalValorPrice = isFreeAvailable ? 0 : parseInt(valorPrice || '0')

    // Create product and update user's daily count
    const [product] = await prisma.$transaction([
      prisma.product.create({
        data: {
          title,
          description,
          categoryId,
          condition: condition || 'good',
          valorPrice: finalValorPrice,
          userValorPrice: isFreeAvailable ? 0 : (userValorPrice ? parseInt(userValorPrice) : null),
          aiValorPrice: aiValorPrice ? parseInt(aiValorPrice) : null,
          aiValorReason,
          checklistData,
          usageInfo,
          images: images || [],
          userId: user.id,
          city: city || 'İzmir',
          latitude: latitude || 38.4237,
          longitude: longitude || 27.1428,
          district: district || 'Alsancak',
          isFreeAvailable: isFreeAvailable || false,
          acceptsNegotiation: acceptsNegotiation !== false, // default true
        },
        include: {
          category: true
        }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          dailyProductCount: isSameDay ? currentCount + 1 : 1,
          lastProductDate: new Date(),
        }
      })
    ])

    // Canlı aktivite akışına ekle (gerçek kullanıcı ismiyle)
    await prisma.activityFeed.create({
      data: {
        type: 'product_added',
        userId: user.id,
        userName: user.name || 'Kullanıcı',
        productId: product.id,
        productTitle: product.title,
        city: city || 'İzmir',
      }
    })

    // Ürün ekleme - Bekleyen bonus işaretle (takas tamamlanınca verilecek)
    let bonusResult: { success: boolean; message?: string } | null = null
    try {
      bonusResult = await markPendingProductBonus(user.id)
    } catch (e) {
      console.log('Bonus işaretlenemedi:', e)
    }

    return NextResponse.json({
      ...product,
      bonusPending: bonusResult?.success || false,
      bonusMessage: bonusResult?.message || 'İlk 3 takas tamamlandığında bonus kazanacaksınız!'
    })
  } catch (error) {
    console.error('Ürün ekleme hatası:', error)
    return NextResponse.json(
      { error: 'Ürün eklenemedi' },
      { status: 500 }
    )
  }
}
