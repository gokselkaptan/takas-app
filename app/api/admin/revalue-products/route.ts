import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { assessValorPrice } from '@/lib/valor-economics'
import { CATEGORY_EXPERTS } from '@/lib/valor-pricing'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

const HIGH_VALUE_CATEGORIES = ['Oto & Moto', 'Elektronik', 'Beyaz Eşya', 'Gayrimenkul', 'Tekne & Denizcilik']

async function searchProductPrice(title: string, category: string): Promise<number | null> {
  try {
    const query = category === 'Oto & Moto'
      ? encodeURIComponent(`${title} ikinci el fiyat TL 2026 sahibinden arabam`)
      : encodeURIComponent(`${title} ikinci el kaç para TL 2026`)
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${query}&count=10&country=tr&search_lang=tr`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY || ''
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

// Lazy initialization - only create client when needed
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

// POST: Toplu yeniden değerleme başlat
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 })
    }

    // Admin kontrolü
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    })
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
    }

    const body = await request.json()
    const { batchSize = 20, offset = 0, dryRun = false } = body

    // Aktif ürünleri al (batch halinde)
    const products = await prisma.product.findMany({
      where: { status: 'active' },
      include: {
        category: { select: { name: true } },
        user: { select: { location: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: batchSize,
    })

    if (products.length === 0) {
      // Son değerleme zamanını kaydet
      if (!dryRun) {
        await prisma.systemMetrics.upsert({
          where: { id: 'last_revaluation' },
          update: { data: JSON.stringify({ completedAt: new Date() }), lastUpdated: new Date() },
          create: { id: 'last_revaluation', data: JSON.stringify({ completedAt: new Date() }), lastUpdated: new Date() }
        })
      }
      return NextResponse.json({ 
        success: true, 
        message: 'Tüm ürünler güncellendi!',
        completed: true,
        totalProcessed: offset
      })
    }

    const results: any[] = []
    let errors = 0

    for (const product of products) {
      try {
        // AI'dan TL fiyat tahmini al — VALOR v2 kategori uzmanı entegrasyonu
        const categoryExpert = CATEGORY_EXPERTS[product.category?.name as keyof typeof CATEGORY_EXPERTS] 
          || CATEGORY_EXPERTS['Genel' as keyof typeof CATEGORY_EXPERTS]

        const isVehicleCategory = product.category?.name === 'Oto & Moto'

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
     Kategori: ${product.category?.name || 'Genel'}
     Durum: ${product.condition}
     Sadece sayı döndür.`

        let estimatedTL = 500 // fallback

        // Oto & Moto: kural bazlı (AI/Brave bypass)
        const isHighValueCategory = HIGH_VALUE_CATEGORIES.includes(product.category?.name || '')
        let braveFound = false

        if (product.category?.name === 'Oto & Moto') {
          const desc = ((product.description || '') + ' ' + product.title).toLowerCase()
          let baseTL = 600000
          if (/bmw|mercedes|audi|volvo|lexus|porsche/.test(desc)) baseTL = 2000000
          else if (/duster|qashqai|rav4|tucson|sportage|suv|4x4/.test(desc)) baseTL = 1000000
          else if (/clio|polo|egea|corsa|fabia|1\.2|1\.0/.test(desc)) baseTL = 500000
          else if (/megane|megan|civic|corolla|focus|golf|astra|1\.4|1\.6/.test(desc)) baseTL = 700000
          else if (/motosiklet|motor|scooter/.test(desc)) baseTL = 200000
          const yearMatch = desc.match(/20\d{2}|199\d/)
          const age = 2026 - (yearMatch ? parseInt(yearMatch[0]) : 2012)
          const ageM = age <= 3 ? 0.90 : age <= 8 ? 0.75 : age <= 13 ? 0.55 : age <= 18 ? 0.42 : 0.28
          const kmMatch = desc.match(/(\d[\d.]{2,})\s*km/)
          const km = kmMatch ? parseInt(kmMatch[1].replace(/\./g, '')) : 100000
          const kmM = km > 200000 ? 0.80 : km > 150000 ? 0.90 : km < 50000 ? 1.10 : 1.00
          const hasarM = /tramer|hasar|değişik|boyalı|kaza/.test(desc) ? 0.82 : 1.00
          estimatedTL = Math.round(baseTL * ageM * kmM * hasarM / 1000) * 1000
          braveFound = true
          console.log(`[Kural] ${product.title}: ${estimatedTL} TL (age:${ageM} km:${kmM} hasar:${hasarM})`)
        } else if (isHighValueCategory && process.env.BRAVE_SEARCH_API_KEY) {
          // Elektronik, Beyaz Eşya → Brave Search
          const searchPrice = await searchProductPrice(product.title, product.category?.name || '')
          if (searchPrice && searchPrice > 500) {
            estimatedTL = searchPrice
            braveFound = true
            console.log(`[Brave] ${product.title}: ${searchPrice} TL`)
          } else {
            console.log(`[Brave] ${product.title}: sonuç yok, AI kullanılıyor`)
          }
        }

        // HIGH_VALUE dışı kategoriler veya Brave sonuç bulamazsa: AI çağrısıyla devam
        if (!braveFound) try {
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
        } catch {
          // AI başarısızsa mevcut valor'dan tahmin et
          estimatedTL = (product.valorPrice || 100) * 5
        }

        // Ekonomik motor ile yeni Valor hesapla
        const assessment = await assessValorPrice(
          estimatedTL,
          product.category?.name || 'Genel',
          product.condition,
          product.user?.location || undefined
        )

        const oldValor = product.valorPrice || 0
        const newValor = assessment.valorPrice
        const changePercent = oldValor > 0 
          ? Math.round(((newValor - oldValor) / oldValor) * 100) 
          : 0

        if (!dryRun) {
          // aiValorReason'a eski fiyat ve formül bilgisini ekle
          const reasonWithMeta = `${assessment.humanExplanation} [Önceki: ${oldValor}V, TL: ~${estimatedTL}₺, Güncelleme: ${new Date().toISOString().split('T')[0]}]`
          await prisma.product.update({
            where: { id: product.id },
            data: {
              valorPrice: newValor,
              aiValorPrice: newValor,
              aiValorReason: reasonWithMeta,
            }
          })
        }

        results.push({
          id: product.id,
          title: product.title,
          oldValor,
          newValor,
          changePercent: `${changePercent > 0 ? '+' : ''}${changePercent}%`,
          estimatedTL,
        })

        // Rate limit — her ürün arasında 500ms bekle
        await new Promise(r => setTimeout(r, 500))

      } catch (err: any) {
        errors++
        results.push({
          id: product.id,
          title: product.title,
          error: err.message,
        })
      }
    }

    // Toplam aktif ürün sayısı
    const totalProducts = await prisma.product.count({ where: { status: 'active' } })

    return NextResponse.json({
      success: true,
      completed: offset + products.length >= totalProducts,
      processed: products.length,
      errors,
      totalProducts,
      nextOffset: offset + batchSize,
      dryRun,
      results,
    })

  } catch (error) {
    console.error('Revalue error:', error)
    return NextResponse.json({ error: 'Yeniden değerleme hatası' }, { status: 500 })
  }
}

// GET: Değerleme durumu / istatistikleri
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 })
    }

    const totalProducts = await prisma.product.count({ where: { status: 'active' } })
    
    // Son değerleme zamanı
    const lastRevalued = await prisma.systemMetrics.findUnique({
      where: { id: 'last_revaluation' }
    })

    // Valor dağılımı
    const valorStats = await prisma.product.aggregate({
      where: { status: 'active' },
      _avg: { valorPrice: true },
      _min: { valorPrice: true },
      _max: { valorPrice: true },
      _count: true,
    })

    return NextResponse.json({
      totalProducts,
      lastRevaluedAt: lastRevalued?.lastUpdated || null,
      stats: {
        avgValor: Math.round(valorStats._avg.valorPrice || 0),
        minValor: valorStats._min.valorPrice || 0,
        maxValor: valorStats._max.valorPrice || 0,
        count: valorStats._count,
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'İstatistik hatası' }, { status: 500 })
  }
}