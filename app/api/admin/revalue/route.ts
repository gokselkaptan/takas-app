import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { calculateValorPrice, getCountryFromCity, CATEGORY_EXPERTS } from '@/lib/valor-pricing'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 dakika timeout

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.ABACUSAI_API_KEY,
    baseURL: 'https://routellm.abacus.ai/v1',
  })
}

// Admin kontrolü
async function verifyAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true }
  })
  if (!user || user.role !== 'admin') return null
  return user
}

// AI'dan TL tahmini al (ülke bazlı)
async function getAIEstimate(product: any, country: string): Promise<number> {
  const isTurkey = country === 'TR'
  const categoryName = product.category?.name || 'default'
  
  // Kategori uzmanını al
  const expert = CATEGORY_EXPERTS[categoryName] || CATEGORY_EXPERTS['default']

  const systemMsg = isTurkey
    ? `Sen bir ${expert.role}'sın. Türkiye 2025 güncel piyasa fiyatlarını biliyorsun.

ÖNEMLİ KURALLAR:
1. Ürünün MARKA ve MODEL bilgisine göre Türkiye'deki GÜNCEL İKİNCİ EL piyasa değerini tahmin et.
2. ${expert.referenceNote}
3. ÖTV+KDV nedeniyle Türkiye'de elektronik Avrupa'nın 1.5-2x, araçlar 2-3x pahalıdır.
4. Avrupa/ABD fiyatlarını ASLA referans alma.
5. Önce SIFIR fiyatını belirle, sonra duruma göre ikinci el değerini hesapla:
   - Sıfır Gibi: sıfır fiyatının %70-85'i
   - İyi: sıfır fiyatının %50-70'i
   - Orta: sıfır fiyatının %30-50'i
   - Kötü: sıfır fiyatının %15-30'i

Fiyatı TL olarak ver. SADECE JSON döndür.`
    : `Sen bir ${expert.role}'sın. Avrupa 2025 güncel piyasa fiyatlarını biliyorsun.
${expert.referenceNote}
EUR fiyatı hesapla, 1 EUR = 52 TL ile çevir. SADECE JSON döndür.`

  const prompt = `Bu ürünün güncel Türkiye ikinci el piyasa değerini TL olarak tahmin et.

Ürün: ${product.title}
Açıklama: ${(product.description || '').substring(0, 200)}
Kategori: ${categoryName}
Durum: ${product.condition || 'good'}
Şehir: ${product.city || 'İzmir'}

TÜRKİYE 2025 FİYAT REFERANSLARI (ikinci el, iyi durumda):
- Küçük ev aleti (kahve makinesi, blender): 3.000-8.000₺
- Büyük beyaz eşya (bulaşık, çamaşır): 15.000-35.000₺
- Telefon (iPhone/Samsung üst): 30.000-70.000₺
- Laptop: 20.000-80.000₺
- Tablet: 10.000-40.000₺
- TV 55": 15.000-40.000₺
- Araç multimedya/teyp: 3.000-15.000₺
- GPS navigasyon: 2.000-5.000₺
- Araç kamera: 2.000-8.000₺
- Bahçe mobilya seti: 5.000-20.000₺
- Çim biçme makinesi: 3.000-10.000₺
- Deri mont: 3.000-15.000₺
- Trençkot: 2.000-8.000₺
- Halı 120x180: 1.500-5.000₺
- Perde takımı: 1.000-4.000₺
- Bornoz seti: 800-3.000₺
- Spor çanta: 500-2.000₺

Bu referansları kullanarak ürünün SIFIR fiyatını belirle, sonra duruma göre ikinci el değerini hesapla.

JSON döndür: {"estimatedTL": <sayı>, "reason": "<kısa açıklama>"}`

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.3
    })

    const text = response.choices[0]?.message?.content || '{}'
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return Math.max(50, parsed.estimatedTL || 5000)
  } catch {
    // Fallback: mevcut valor × 50 TL
    return Math.max(5000, (product.valorPrice || 100) * 50)
  }
}

// POST: Toplu yeniden değerleme
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Admin erişimi gerekli' }, { status: 403 })
    }

    const { mode, categoryFilter, limit } = await request.json()
    // mode: 'dry_run' | 'apply'
    const maxLimit = Math.min(limit || 50, 200)

    // Aktif ürünleri çek
    const where: any = { status: 'active' }
    if (categoryFilter && categoryFilter !== 'all') {
      where.category = { slug: categoryFilter }
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        valorPrice: true,
        condition: true,
        city: true,
        checklistData: true,
        category: { select: { name: true, slug: true } },
        user: { select: { name: true } },
      },
      take: maxLimit,
      orderBy: { createdAt: 'desc' }
    })

    const results: any[] = []
    let totalOldValor = 0
    let totalNewValor = 0
    let errors = 0

    for (const product of products) {
      try {
        // Ülke tespiti
        const country = getCountryFromCity(product.city || 'İzmir')
        
        // AI'dan TL tahmini al (ülke bazlı referanslarla)
        const estimatedTL = await getAIEstimate(product, country)

        // Checklist parse
        let checklistObj: Record<string, any> = {}
        try {
          checklistObj = typeof product.checklistData === 'string'
            ? JSON.parse(product.checklistData)
            : (product.checklistData || {}) as Record<string, any>
        } catch { checklistObj = {} }

        // Yeni formülle hesapla
        const valorCalc = calculateValorPrice({
          estimatedTL,
          condition: product.condition || 'good',
          city: product.city || 'İzmir',
          categorySlug: product.category?.slug || 'default',
          checklistData: checklistObj,
        })

        const oldValor = product.valorPrice || 0
        const newValor = valorCalc.valorPrice
        const changePercent = oldValor > 0 
          ? ((newValor - oldValor) / oldValor * 100).toFixed(1) 
          : 'Yeni'

        totalOldValor += oldValor
        totalNewValor += newValor

        results.push({
          id: product.id,
          title: product.title,
          category: product.category?.name,
          owner: product.user?.name,
          city: product.city,
          country,
          estimatedTL,
          oldValor,
          newValor,
          change: `${changePercent}%`,
          formula: valorCalc.breakdown.formula,
        })

        // Dry run değilse güncelle
        if (mode === 'apply') {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              valorPrice: newValor,
              aiValorPrice: newValor,
              aiValorReason: `Yeniden değerleme (${country}): ${valorCalc.breakdown.formula}`,
            }
          })
        }

        // API rate limiting
        await new Promise(r => setTimeout(r, 500))

      } catch (err: any) {
        errors++
        results.push({
          id: product.id,
          title: product.title,
          error: err.message?.substring(0, 100),
        })
      }
    }

    return NextResponse.json({
      mode,
      totalProducts: products.length,
      processed: results.length,
      errors,
      totalOldValor,
      totalNewValor,
      totalChange: totalOldValor > 0
        ? `${((totalNewValor - totalOldValor) / totalOldValor * 100).toFixed(1)}%`
        : 'N/A',
      results,
    })

  } catch (error: any) {
    console.error('Revalue error:', error)
    return NextResponse.json({ error: error.message || 'Hata' }, { status: 500 })
  }
}
