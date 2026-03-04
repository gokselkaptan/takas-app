import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { calculateValorPrice, getCountryFromCity } from '@/lib/valor-pricing'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 dakika timeout

const client = new OpenAI({
  apiKey: process.env.ABACUSAI_API_KEY,
  baseURL: 'https://routellm.abacus.ai/v1',
})

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
  
  const systemMsg = isTurkey
    ? `Türkiye piyasa uzmanısın. Türkiye 2025 fiyatlarını kullan. ÖTV+KDV nedeniyle elektronik Avrupa'nın 1.5-2x, araçlar 2-3x pahalıdır. Avrupa fiyatlarını ASLA referans alma. SADECE JSON döndür.`
    : `Avrupa piyasa uzmanısın. EUR fiyatı hesapla, 1 EUR = 37 TL ile çevir. SADECE JSON döndür.`

  const prompt = `Bu ürünün güncel piyasa değerini TL olarak tahmin et.
Ürün: ${product.title}
Açıklama: ${(product.description || '').substring(0, 200)}
Kategori: ${product.category?.name || 'Genel'}
Durum: ${product.condition || 'good'}
Şehir: ${product.city || 'İzmir'}
JSON döndür: {"estimatedTL": <sayı>}`

  try {
    const response = await client.chat.completions.create({
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
