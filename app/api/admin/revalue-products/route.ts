import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { assessValorPrice } from '@/lib/valor-economics'
import { CATEGORY_EXPERTS } from '@/lib/valor-pricing'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Vercel Pro max: 300s

const HIGH_VALUE_CATEGORIES = ['Oto & Moto', 'Elektronik', 'Beyaz Eşya', 'Beyaz Esya', 'Gayrimenkul', 'Tekne & Denizcilik']

const VALID_CATEGORIES = [
  'Elektronik', 'Oto & Moto', 'Gayrimenkul', 'Tekne & Denizcilik',
  'Beyaz Eşya', 'Ev & Yaşam', 'Giyim', 'Bahçe', 'Kitap & Hobi',
  'Spor & Outdoor'
]

// Kategori adını normalize et (DB'deki 'Beyaz Esya' → CATEGORY_EXPERTS'taki 'Beyaz Eşya' eşleşmesi)
function normalizeCategoryName(name: string | undefined | null): string {
  if (!name) return 'Genel'
  const map: Record<string, string> = {
    'Beyaz Esya': 'Beyaz Eşya',
    'Ev & Yasam': 'Ev & Yaşam',
    'Bahce': 'Bahçe',
    // Diğer olası eşleşmeler
  }
  return map[name] || name
}

async function searchProductPrice(title: string, category: string): Promise<number | null> {
  try {
    const query = category === 'Oto & Moto'
      ? encodeURIComponent(`${title} ikinci el fiyat TL 2026 sahibinden arabam`)
      : encodeURIComponent(`${title} ikinci el kaç para TL 2026`)
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${query}&count=10&country=tr&search_lang=tr`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY || ''
      }
    })
    if (!res.ok) return null
    const data = await res.json()
    const snippets = data.web?.results?.map((r: { description?: string; title?: string }) =>
      `${r.title} ${r.description}`).join(' ') || ''

    const prices: number[] = []
    const matches = snippets.matchAll(/(\d{1,3})[.,](\d{3})(?:[.,](\d{3}))?\s*(?:TL|₺|tl)/gi)
    for (const m of matches) {
      const price = parseInt(m[0].replace(/[^\d]/g, ''))
      const minPrice = category === 'Oto & Moto' ? 50000 : 500
      const maxPrice = category === 'Oto & Moto' ? 50000000 : 10000000
      if (price >= minPrice && price <= maxPrice) prices.push(price)
    }

    if (prices.length === 0) return null
    prices.sort((a, b) => a - b)
    const mid = Math.floor(prices.length / 2)
    return prices[mid]
  } catch {
    return null
  }
}

// Lazy initialization
function getOpenAIClient() {
  const apiKey = process.env.ABACUSAI_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('API key not configured')
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.ABACUSAI_API_KEY ? 'https://routellm.abacus.ai/v1' : undefined,
  })
}

// Tek bir ürünü değerle (modüler)
async function revalueOneProduct(product: any): Promise<{ success: boolean; result: any }> {
  let inferredCategoryId: string | null = null

  // ═══ KATEGORİSİZ ÜRÜNLER İÇİN AI KATEGORİ TAHMİNİ ═══
  if (!product.category || !product.category.name || product.category.name.trim() === '') {
    let inferredCategoryName = 'Ev & Yaşam'

    try {
      const client = getOpenAIClient()
      const categoryPrompt = `Aşağıdaki ürün için en uygun kategoriyi seç.
Sadece şu kategorilerden birini yaz, başka hiçbir şey yazma:
${VALID_CATEGORIES.join(', ')}

Ürün adı: ${product.title}
Açıklama: ${product.description || ''}

Kategori:`

      const categoryResponse = await client.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: categoryPrompt }],
        max_tokens: 20,
        temperature: 0.1,
      })

      const aiCategory = categoryResponse.choices[0]?.message?.content?.trim() || ''

      // Geçerli kategori kontrolü
      if (VALID_CATEGORIES.includes(aiCategory)) {
        inferredCategoryName = aiCategory
      }

      console.log(`[KategoriTahmin] ${product.title}: ${inferredCategoryName}`)
    } catch (catErr: any) {
      console.log(`[KategoriTahmin Hata] ${product.title}:`, catErr.message)
    }

    // DB'den kategori kaydını bul (name veya nameEn ile)
    const categoryVariants = [inferredCategoryName, ...getCategoryVariants(inferredCategoryName)]
    const categoryRecord = await prisma.category.findFirst({
      where: {
        OR: [
          { name: { in: categoryVariants } },
          { nameEn: inferredCategoryName },
        ]
      },
      select: { id: true, name: true },
    })

    if (categoryRecord) {
      inferredCategoryId = categoryRecord.id
      // In-memory objeyi güncelle (bu çalıştırma için kategori adını kullan)
      product.category = { name: categoryRecord.name }
      console.log(`[KategoriDB] ${product.title}: ${categoryRecord.name} (id: ${categoryRecord.id})`)
    } else {
      // Fallback: "Ev & Yaşam" kategorisini DB'den bul
      const fallbackCategory = await prisma.category.findFirst({
        where: { OR: [{ name: 'Ev & Yaşam' }, { name: 'Ev & Yasam' }] },
        select: { id: true, name: true },
      })
      if (fallbackCategory) {
        inferredCategoryId = fallbackCategory.id
        product.category = { name: fallbackCategory.name }
        console.log(`[KategoriFallback] ${product.title}: ${fallbackCategory.name} (id: ${fallbackCategory.id})`)
      } else {
        product.category = { name: inferredCategoryName }
        console.log(`[KategoriWarn] ${product.title}: DB'de kategori bulunamadı, in-memory: ${inferredCategoryName}`)
      }
    }
  }

  const categoryName = normalizeCategoryName(product.category?.name)
  const categoryExpert = CATEGORY_EXPERTS[categoryName as keyof typeof CATEGORY_EXPERTS]
    || CATEGORY_EXPERTS['Genel' as keyof typeof CATEGORY_EXPERTS]

  const isVehicleCategory = categoryName === 'Oto & Moto'

  const conditionGuide = isVehicleCategory
    ? `Araçlar için doğrudan ikinci el piyasa değerini tahmin et. 
   Sıfır fiyatı kullanma — yaş, km, hasar kaydı ve yakıt tipine göre 
   referans aralıklarındaki gerçek satış fiyatlarını baz al.`
    : `Önce sıfır fiyatını belirle, sonra ürün durumuna göre ikinci el değerini hesapla:
   - Sıfır Gibi: sıfır fiyatının %70-85'i
   - İyi: sıfır fiyatının %50-70'i
   - Orta: sıfır fiyatının %30-50'i
   - Kötü: sıfır fiyatının %15-30'i`

  const systemMsg = `Sen bir ${categoryExpert.role} olarak çalışıyorsun.
Türkiye 2026 ikinci el piyasasında ürün değerlemesi yapıyorsun.
Referans kaynaklar ve fiyat aralıkları: ${categoryExpert.referenceNote}
Avrupa/ABD fiyatlarını ASLA referans alma.
${conditionGuide}
Sadece sayısal TL değeri döndür, başka hiçbir şey yazma.`

  const prompt = isVehicleCategory
    ? `Aşağıdaki aracın segmentini belirle ve 2026 Türkiye ikinci el piyasa değerini TL olarak tahmin et.
   Mutlaka referans fiyat aralıklarını kullan:
   - Küçük araç (Clio, Polo, Egea vb): 400.000-700.000₺
   - Orta segment (Megane, Civic, Corolla vb): 600.000-1.200.000₺
   - Üst segment (BMW, Mercedes, Audi vb): 1.500.000-3.500.000₺
   - SUV/Crossover: 700.000-2.500.000₺
   - Motosiklet: 100.000-500.000₺
   2005 model = baz fiyatın %40-60'ı. 251.000km = %20 indirim. Tramer = %20 indirim.

   Ürün: ${product.title}
   Açıklama: ${product.description || 'Yok'}
   Durum: ${product.condition}

   Sadece sayı döndür (TL).`
    : `Bu ürünün güncel piyasa değerini TL olarak tahmin et.
   Ürün: ${product.title}
   Açıklama: ${product.description || 'Yok'}
   Kategori: ${categoryName}
   Durum: ${product.condition}
   Sadece sayı döndür.`

  let estimatedTL = 500 // fallback
  let braveFound = false
  let priceSource = 'fallback'

  // ═══ 1. ÖNCELİK: ADMİN MANUEL FİYATI ═══
  if (product.adminEstimatedPrice && product.adminEstimatedPrice > 0) {
    estimatedTL = product.adminEstimatedPrice
    braveFound = true
    priceSource = 'admin'
    console.log(`[Admin] ${product.title}: ${estimatedTL} TL`)
  }

  // ═══ 2. ÖNCELİK: KULLANICI FİYAT ARALIĞI ═══
  const hasUserPrice = !braveFound && product.userPriceMin && product.userPriceMax && product.userPriceMin > 0 && product.userPriceMax > 0
  const userMidpoint = hasUserPrice ? Math.round(((product.userPriceMin as number) + (product.userPriceMax as number)) / 2) : 0

  if (hasUserPrice) {
    try {
      const query = `${product.title} ikinci el fiyat Türkiye sahibinden arabam`
      const braveRes = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&country=tr&search_lang=tr`,
        {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY || '',
          },
        }
      )

      if (braveRes.ok) {
        const braveData = await braveRes.json()
        const braveResults = braveData.web?.results
          ?.map((r: any) => `${r.title}: ${r.description}`)
          .join('\n') || ''

        if (braveResults) {
          const client = getOpenAIClient()
          const aiRes = await client.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [{
              role: 'user',
              content: `Kullanıcı "${product.title}" ürünü için ${product.userPriceMin}-${product.userPriceMax} TL piyasa değeri aralığı belirtti. Aşağıdaki arama sonuçlarına göre bu aralık gerçekçi mi? Gerçekçiyse en doğru fiyatı TL olarak döndür, gerçekçi değilse kendi tahminini döndür. Sadece sayı döndür.\n\nArama sonuçları:\n${braveResults}`
            }],
            max_tokens: 20,
            temperature: 0.1,
          })

          const aiText = aiRes.choices[0]?.message?.content?.trim() || ''
          const aiPrice = parseInt(aiText.replace(/\D/g, ''))
          if (aiPrice && aiPrice >= 1000) {
            estimatedTL = aiPrice
            braveFound = true
            priceSource = 'user+brave+ai'
            console.log(`[User+Brave+AI] ${product.title}: ${estimatedTL} TL`)
          }
        }
      }
    } catch (e) {
      console.log(`[User+Brave+AI Error] ${product.title}:`, e)
    }

    if (!braveFound) {
      estimatedTL = userMidpoint
      braveFound = true
      priceSource = 'user-midpoint'
      console.log(`[User midpoint] ${product.title}: ${estimatedTL} TL`)
    }
  }

  // ═══ 3. KULLANICI FİYAT GİRMEMİŞ — MEVCUT AKIŞ ═══
  if (!braveFound && categoryName === 'Oto & Moto') {
    try {
      const query = `${product.title} ikinci el fiyat Türkiye sahibinden arabam`
      const braveRes = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&country=tr&search_lang=tr`,
        {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY || '',
          },
        }
      )

      if (braveRes.ok) {
        const braveData = await braveRes.json()
        const braveResults = braveData.web?.results
          ?.map((r: any) => `${r.title}: ${r.description}`)
          .join('\n') || ''

        if (braveResults) {
          const client = getOpenAIClient()
          const aiRes = await client.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [{
              role: 'user',
              content: `Aşağıdaki arama sonuçlarına göre "${product.title}" aracının Türkiye 2026 ikinci el piyasasındaki güncel fiyatını TL olarak tahmin et. Sadece sayı döndür.\n\nArama sonuçları:\n${braveResults}`
            }],
            max_tokens: 20,
            temperature: 0.1,
          })

          const aiText = aiRes.choices[0]?.message?.content?.trim() || ''
          const aiPrice = parseInt(aiText.replace(/\D/g, ''))
          if (aiPrice >= 50000 && aiPrice <= 50000000) {
            estimatedTL = aiPrice
            braveFound = true
            priceSource = 'brave+ai'
            console.log(`[Brave+AI] ${product.title}: ${estimatedTL} TL`)
          }
        }
      }
    } catch (e) {
      console.log(`[Brave+AI Error] ${product.title}:`, e)
    }

    // Rule-based fallback for Oto & Moto
    if (!braveFound) {
      const desc = (product.title + ' ' + (product.description || '')).toLowerCase()
      let baseTL = 600000
      if (/bmw|mercedes|audi|volvo|lexus|porsche/.test(desc)) baseTL = 2000000
      else if (/duster|qashqai|rav4|tucson|sportage|suv|4x4/.test(desc)) baseTL = 1000000
      else if (/megane|civic|corolla|focus|golf|astra|1\.4|1\.6/.test(desc)) baseTL = 700000
      else if (/clio|polo|egea|corsa|fabia|1\.2|1\.0/.test(desc)) baseTL = 500000
      else if (/motosiklet|motor|scooter/.test(desc)) baseTL = 200000

      const yearMatch = desc.match(/20\d{2}|199\d/)
      const year = yearMatch ? parseInt(yearMatch[0]) : 2012
      const age = new Date().getFullYear() - year
      const ageM = age <= 3 ? 0.90 : age <= 8 ? 0.75 : age <= 13 ? 0.55 : age <= 18 ? 0.42 : 0.28
      const kmMatch = desc.match(/(\d[\d.]{2,})\s*km/)
      const km = kmMatch ? parseInt(kmMatch[1].replace(/\./g, '')) : 100000
      const kmM = km > 200000 ? 0.80 : km > 150000 ? 0.90 : km < 50000 ? 1.10 : 1.00
      const hasarM = /tramer|hasar|değişik|boyalı|kaza/.test(desc) ? 0.82 : 1.00

      estimatedTL = Math.round((baseTL * ageM * kmM * hasarM) / 1000) * 1000
      priceSource = 'rule-based'
      braveFound = true
    }
  } else if (!braveFound && HIGH_VALUE_CATEGORIES.includes(categoryName) && (process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY)) {
    const searchPrice = await searchProductPrice(product.title, categoryName)
    if (searchPrice && searchPrice > 500) {
      estimatedTL = searchPrice
      braveFound = true
      priceSource = 'brave-search'
    }
  }

  // AI fallback
  if (!braveFound) {
    try {
      const client = getOpenAIClient()
      const aiRes = await client.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: prompt }
        ],
        max_tokens: 50,
        temperature: 0.2
      })
      const text = aiRes.choices[0]?.message?.content?.trim() || '500'
      estimatedTL = Math.max(10, parseInt(text.replace(/\D/g, '')) || 500)
      priceSource = 'ai-only'
    } catch {
      estimatedTL = (product.valorPrice || 100) * 5
      priceSource = 'valor-fallback'
    }
  }

  // Ekonomik motor ile yeni Valor hesapla
  const assessment = await assessValorPrice(
    estimatedTL,
    categoryName,
    product.condition,
    product.user?.location || undefined
  )

  const oldValor = product.valorPrice || 0
  const newValor = assessment.valorPrice
  const changePercent = oldValor > 0
    ? Math.round(((newValor - oldValor) / oldValor) * 100)
    : 0

  return {
    success: true,
    result: {
      id: product.id,
      title: product.title,
      category: categoryName,
      inferredCategoryId,
      oldValor,
      newValor,
      changePercent: `${changePercent > 0 ? '+' : ''}${changePercent}%`,
      estimatedTL,
      priceSource,
      assessment,
    }
  }
}

// POST: Toplu yeniden değerleme — Batch processing ile
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    })
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
    }

    const body = await request.json()
    const {
      batchSize = 10,       // Küçültüldü: 20 → 10
      offset = 0,
      dryRun = false,
      categoryFilter = '',  // Kategori filtresi eklendi
      delayMs = 200,        // Rate limit delay (ms)
    } = body

    // Filtre oluştur
    const whereClause: any = { status: 'active' }
    if (categoryFilter) {
      // Kategori adına göre filtrele (normalize edilmiş veya ham)
      whereClause.category = {
        name: { in: [categoryFilter, ...getCategoryVariants(categoryFilter)] }
      }
    }

    // Toplam sayı
    const totalProducts = await prisma.product.count({ where: whereClause })

    // Bu batch'teki ürünleri al
    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: { select: { name: true } },
        user: { select: { location: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: batchSize,
    })

    if (products.length === 0) {
      // Tüm ürünler işlendi
      if (!dryRun) {
        await prisma.systemMetrics.upsert({
          where: { id: 'last_revaluation' },
          update: { data: JSON.stringify({ completedAt: new Date(), category: categoryFilter || 'all' }), lastUpdated: new Date() },
          create: { id: 'last_revaluation', data: JSON.stringify({ completedAt: new Date(), category: categoryFilter || 'all' }), lastUpdated: new Date() }
        })
      }
      return NextResponse.json({
        success: true,
        message: 'Tüm ürünler güncellendi!',
        completed: true,
        totalProcessed: offset,
        totalProducts,
      })
    }

    const results: any[] = []
    let errors = 0
    const startTime = Date.now()

    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      try {
        const { result } = await revalueOneProduct(product)

        if (!dryRun) {
          const reasonWithMeta = `${result.assessment.humanExplanation} [Önceki: ${result.oldValor}V, TL: ~${result.estimatedTL}₺, Kaynak: ${result.priceSource}, Güncelleme: ${new Date().toISOString().split('T')[0]}]`
          const updateData: any = {
            valorPrice: result.newValor,
            aiValorPrice: result.newValor,
            aiValorReason: reasonWithMeta,
          }
          // AI tahmini ile bulunan categoryId'yi de kaydet
          if (result.inferredCategoryId) {
            updateData.categoryId = result.inferredCategoryId
          }
          await prisma.product.update({
            where: { id: product.id },
            data: updateData,
          })
        }

        results.push({
          id: result.id,
          title: result.title,
          category: result.category,
          oldValor: result.oldValor,
          newValor: result.newValor,
          changePercent: result.changePercent,
          estimatedTL: result.estimatedTL,
          priceSource: result.priceSource,
        })

        // Rate limit — her ürün arasında delay (son ürün hariç)
        if (i < products.length - 1) {
          await new Promise(r => setTimeout(r, delayMs))
        }

      } catch (err: any) {
        errors++
        results.push({
          id: product.id,
          title: product.title,
          error: err.message,
        })
      }
    }

    const elapsed = Date.now() - startTime

    return NextResponse.json({
      success: true,
      completed: offset + products.length >= totalProducts,
      processed: products.length,
      errors,
      totalProducts,
      nextOffset: offset + batchSize,
      batchSize,
      dryRun,
      categoryFilter: categoryFilter || null,
      elapsed: `${(elapsed / 1000).toFixed(1)}s`,
      results,
    })

  } catch (error) {
    console.error('Revalue error:', error)
    return NextResponse.json({ error: 'Yeniden değerleme hatası' }, { status: 500 })
  }
}

// Kategori varyantlarını döndür
function getCategoryVariants(name: string): string[] {
  const variants: Record<string, string[]> = {
    'Beyaz Eşya': ['Beyaz Esya'],
    'Beyaz Esya': ['Beyaz Eşya'],
    'Ev & Yaşam': ['Ev & Yasam'],
    'Ev & Yasam': ['Ev & Yaşam'],
    'Bahçe': ['Bahce'],
    'Bahce': ['Bahçe'],
  }
  return variants[name] || []
}

// GET: Değerleme durumu / istatistikleri + kategori listesi
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 })
    }

    const totalProducts = await prisma.product.count({ where: { status: 'active' } })

    const lastRevalued = await prisma.systemMetrics.findUnique({
      where: { id: 'last_revaluation' }
    })

    const valorStats = await prisma.product.aggregate({
      where: { status: 'active' },
      _avg: { valorPrice: true },
      _min: { valorPrice: true },
      _max: { valorPrice: true },
      _count: true,
    })

    // Kategori bazlı ürün sayıları
    const categoryStats = await prisma.product.groupBy({
      by: ['categoryId'],
      where: { status: 'active' },
      _count: true,
    })

    // Kategori isimlerini al
    const categoryIds = categoryStats.map(c => c.categoryId).filter(Boolean) as string[]
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    })

    const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]))
    const categoryBreakdown = categoryStats.map(c => ({
      name: c.categoryId ? (categoryMap[c.categoryId] || 'Bilinmeyen') : 'Kategorisiz',
      count: c._count,
    })).sort((a, b) => b.count - a.count)

    return NextResponse.json({
      totalProducts,
      lastRevaluedAt: lastRevalued?.lastUpdated || null,
      stats: {
        avgValor: Math.round(valorStats._avg.valorPrice || 0),
        minValor: valorStats._min.valorPrice || 0,
        maxValor: valorStats._max.valorPrice || 0,
        count: valorStats._count,
      },
      categories: categoryBreakdown,
    })
  } catch (error) {
    return NextResponse.json({ error: 'İstatistik hatası' }, { status: 500 })
  }
}
