import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { translateProducts } from '@/lib/product-translations'
import { markPendingProductBonus } from '@/lib/valor-system'
import { validate, createProductSchema } from '@/lib/validations'
import { sanitizeText } from '@/lib/sanitize'
import { getCache, setCache } from '@/lib/cache'

export const dynamic = 'force-dynamic'

// Haversine formülü ile iki koordinat arasındaki mesafeyi hesapla (km cinsinden)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Dünya'nın yarıçapı (km)
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Boost cleanup için basit throttle (5 dakikada bir)
let lastBoostCleanup = 0

export async function GET(request: NextRequest) {
  try {
    // Expired boost'ları temizle (5 dakikada bir, async)
    const now = Date.now()
    if (now - lastBoostCleanup > 5 * 60 * 1000) {
      lastBoostCleanup = now
      prisma.product.updateMany({
        where: { isBoosted: true, boostExpiresAt: { lt: new Date() } },
        data: { isBoosted: false }
      }).catch(() => {}) // Fire and forget
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'newest'
    const limit = parseInt(searchParams.get('limit') || '50')
    const mine = searchParams.get('mine') === 'true'
    const lang = searchParams.get('lang') || 'tr'
    const page = parseInt(searchParams.get('page') || '1')
    
    // Mesafe bazlı filtreleme parametreleri
    const userLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null
    const userLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null
    const radiusKm = searchParams.get('radius') ? parseFloat(searchParams.get('radius')!) : null
    
    // Hızlı filtre chip parametreleri
    const city = searchParams.get('city')
    const district = searchParams.get('district')
    const valorMin = searchParams.get('valorMin')
    const valorMax = searchParams.get('valorMax')

    // Cache kontrolü - sadece basit sorgular için (30 saniye)
    // Search, lat/lng, mine=true ve chip filtrelerinde cache kullanılmaz
    const canUseCache = !search && !userLat && !userLng && !mine && !city && !district && !valorMin && !valorMax && page === 1
    if (canUseCache) {
      const cacheKey = `products-${category || 'all'}-${sort}-${limit}-${lang}`
      const cached = getCache(cacheKey)
      if (cached) return NextResponse.json(cached)
    }

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
          createdAt: true,
          isBoosted: true,
          boostExpiresAt: true
        }
      })
      return NextResponse.json({ products: myProducts })
    }

    const where: Record<string, unknown> = {
      status: 'active',
      deletedAt: null  // Soft delete edilmiş ürünleri hariç tut
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
    
    // Hızlı filtre chip koşulları
    if (city) where.city = city
    if (district) where.district = district
    if (valorMin || valorMax) {
      where.valorPrice = {}
      if (valorMin) (where.valorPrice as Record<string, number>).gte = parseInt(valorMin)
      if (valorMax) (where.valorPrice as Record<string, number>).lte = parseInt(valorMax)
    }

    // Boosted ürünler her zaman önce gelir
    let secondaryOrderBy: Record<string, string> = { createdAt: 'desc' }
    if (sort === 'oldest') secondaryOrderBy = { createdAt: 'asc' }
    if (sort === 'priceHigh') secondaryOrderBy = { valorPrice: 'desc' }
    if (sort === 'priceLow') secondaryOrderBy = { valorPrice: 'asc' }

    // Pagination support
    const skip = (page - 1) * limit

    // Get total count for pagination
    const total = await prisma.product.count({ where })

    const products = await prisma.product.findMany({
      where,
      orderBy: [
        { isBoosted: 'desc' },    // Boosted ürünler en üstte
        { boostedAt: 'desc' },    // En yeni boost önce
        secondaryOrderBy          // Sonra normal sıralama
      ],
      take: limit,
      skip,
      include: {
        category: true,
        user: {
          select: {
            id: true,
            name: true,
            nickname: true,
            trustScore: true,
            isPhoneVerified: true,
          }
        },
        _count: {
          select: {
            swapRequestsForProduct: true,
          }
        }
      }
    })

    // Mesafe hesaplama ve filtreleme
    type ProductWithDistance = typeof products[0] & { distance: number | null }
    let filteredProducts: ProductWithDistance[] = products.map(p => ({ ...p, distance: null }))
    
    if (userLat !== null && userLng !== null) {
      filteredProducts = products.map(product => {
        // Ürünün koordinatları varsa mesafe hesapla
        if (product.latitude && product.longitude) {
          const distance = calculateDistance(userLat, userLng, product.latitude, product.longitude)
          return { ...product, distance: Math.round(distance * 10) / 10 } // 0.1 km hassasiyeti
        }
        return { ...product, distance: null }
      }).filter(product => {
        // Mesafe filtresi aktifse, sadece belirtilen yarıçap içindeki ürünleri döndür
        if (radiusKm !== null && radiusKm > 0) {
          if (product.distance === null) return false // Koordinatı olmayan ürünleri hariç tut
          return product.distance <= radiusKm
        }
        return true // Mesafe filtresi yoksa tüm ürünleri döndür
      })
      
      // Mesafeye göre sıralama seçeneği
      if (sort === 'distance') {
        filteredProducts.sort((a, b) => {
          if (a.distance === null) return 1
          if (b.distance === null) return -1
          return a.distance - b.distance
        })
      }
    }
    
    // Dil parametresine göre ürünleri çevir
    const translatedProducts = translateProducts(filteredProducts, lang)
    
    // Mesafe filtresi uygulandığında toplam sayıyı güncelle
    const filteredTotal = (userLat !== null && userLng !== null && radiusKm !== null) 
      ? filteredProducts.length 
      : total

    const result = { 
      products: translatedProducts, 
      total: filteredTotal,
      page,
      limit,
      hasMore: skip + filteredProducts.length < filteredTotal
    }

    // Basit sorgular için sonucu cache'le (30 saniye)
    if (canUseCache) {
      const cacheKey = `products-${category || 'all'}-${sort}-${limit}-${lang}`
      setCache(cacheKey, result, 30)
    }

    return NextResponse.json(result)
  } catch (error: any) {
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

    // 🔓 ADMIN BYPASS: Admin için günlük limit kontrolünü atla
    const ADMIN_EMAILS = ['join@takas-a.com']
    const isAdmin = user.role === 'admin' || ADMIN_EMAILS.includes(user.email || '')

    // Check daily limit (Admin bypass)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const isSameDay = user.lastProductDate && 
      new Date(user.lastProductDate).setHours(0, 0, 0, 0) === today.getTime()
    
    const currentCount = isSameDay ? user.dailyProductCount : 0
    const dailyLimit = isAdmin ? 999 : (user.isPremium ? 999 : 3)

    if (currentCount >= dailyLimit && !isAdmin) {
      return NextResponse.json(
        { error: `Günlük ${dailyLimit} ürün ekleme limitinize ulaştınız. Premium üyelik ile sınırsız ürün ekleyebilirsiniz.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    
    // Input validation
    const { success, error: validationError } = validate(createProductSchema, {
      ...body,
      valorPrice: Number(body.valorPrice) || body.valorPrice,
    })
    if (!success) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
    
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
    
    // XSS temizleme
    const cleanTitle = sanitizeText(title)
    const cleanDescription = sanitizeText(description)

    // ═══ DUPLICATE ÜRÜN KONTROLÜ + SPAM TESPİTİ (OPTİMİZE) ═══
    // Tek sorguda tüm kontrolleri paralel yap
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const firstImage = images?.[0]

    const [duplicateChecks] = await Promise.all([
      prisma.$transaction([
        // 1. Spam warning sayısı
        prisma.userWarning.count({
          where: { userId: user.id, type: 'duplicate_product', createdAt: { gte: twentyFourHoursAgo } }
        }),
        // 2. Kullanıcının aktif ürünleri (title + images kontrolü için)
        prisma.product.findMany({
          where: { userId: user.id, status: 'active' },
          select: { id: true, title: true, images: true, createdAt: true }
        }),
      ])
    ])

    const [recentDuplicateWarnings, userProducts] = duplicateChecks

    // 3+ spam uyarısı = hesap kısıtla
    if (recentDuplicateWarnings >= 3 && !isAdmin) {
      return NextResponse.json({
        error: '🚫 Hesabınız spam aktivitesi nedeniyle geçici olarak ürün ekleme özelliğinden kısıtlanmıştır. 24 saat sonra tekrar deneyin.',
        blocked: true
      }, { status: 403 })
    }

    // Flood koruması: 5 dk'da 3+ ürün
    const recentProductCount = userProducts.filter(p => p.createdAt >= fiveMinutesAgo).length
    if (recentProductCount >= 3 && !isAdmin) {
      return NextResponse.json({ error: 'Çok hızlı ürün ekliyorsunuz. Lütfen 5 dakika bekleyin.' }, { status: 429 })
    }

    // Normalize başlık
    const normalizedTitle = cleanTitle.toLowerCase().replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ\s]/g, '').replace(/\s+/g, ' ')

    // Memory'de tüm kontrolleri yap
    let duplicateMatch: { id: string; title: string; type: 'exact' | 'similar' | 'image' } | null = null

    for (const p of userProducts) {
      const pNormalized = p.title.trim().toLowerCase().replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ\s]/g, '').replace(/\s+/g, ' ')
      
      // Tam eşleşme (24 saat)
      if (pNormalized === normalizedTitle && p.createdAt >= twentyFourHoursAgo) {
        duplicateMatch = { id: p.id, title: p.title, type: 'exact' }
        break
      }
      
      // Benzer başlık (%80+)
      if (!duplicateMatch) {
        const words1 = normalizedTitle.split(' ').filter(w => w.length > 2)
        const words2 = pNormalized.split(' ').filter(w => w.length > 2)
        if (words1.length > 0 && words2.length > 0) {
          const commonWords = words1.filter(w => words2.includes(w))
          const similarity = commonWords.length / Math.max(words1.length, words2.length)
          if (similarity >= 0.8) {
            duplicateMatch = { id: p.id, title: p.title, type: 'similar' }
          }
        }
      }
      
      // Aynı görsel
      if (!duplicateMatch && firstImage && p.images?.includes(firstImage)) {
        duplicateMatch = { id: p.id, title: p.title, type: 'image' }
      }
    }

    // Duplicate bulundu - ceza uygula
    if (duplicateMatch) {
      const isHighSeverity = duplicateMatch.type === 'image' || recentDuplicateWarnings >= 1
      const trustPenalty = duplicateMatch.type === 'image' ? 30 : (recentDuplicateWarnings >= 1 ? 30 : (duplicateMatch.type === 'exact' ? 10 : 0))

      // Sadece ceza varsa DB'ye yaz (async, beklemeden)
      if (trustPenalty > 0 || duplicateMatch.type !== 'similar') {
        prisma.$transaction([
          prisma.userWarning.create({
            data: {
              userId: user.id,
              type: 'duplicate_product',
              severity: isHighSeverity ? 'high' : (duplicateMatch.type === 'exact' ? 'medium' : 'low'),
              description: `${duplicateMatch.type} ürün denemesi: "${cleanTitle}" (mevcut: ${duplicateMatch.id})`
            }
          }),
          ...(trustPenalty > 0 ? [prisma.user.update({ where: { id: user.id }, data: { trustScore: { decrement: trustPenalty } } })] : [])
        ]).catch(() => {}) // Fire and forget
      }

      const errorMsg = duplicateMatch.type === 'image'
        ? `Bu fotoğrafı kullanan aktif bir ürününüz var: "${duplicateMatch.title}".`
        : `Bu ürünü zaten eklediniz: "${duplicateMatch.title}".`
      
      const penaltyMsg = trustPenalty > 0
        ? `\n\n🔴 Güven puanınız ${trustPenalty} puan düşürüldü.`
        : ''

      return NextResponse.json({
        error: `${errorMsg}${penaltyMsg}`,
        existingProductId: duplicateMatch.id,
        trustPenalty
      }, { status: 409 })
    }

    // Create product and update user's daily count
    const [product] = await prisma.$transaction([
      prisma.product.create({
        data: {
          title: cleanTitle,
          description: cleanDescription,
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
