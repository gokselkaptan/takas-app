import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { assessValorPrice } from '@/lib/valor-economics'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

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
        // AI'dan TL fiyat tahmini al
        const prompt = `Türkiye ikinci el piyasasında bu ürünün TL değerini tahmin et.
Ürün: ${product.title}
Açıklama: ${product.description || 'Yok'}
Kategori: ${product.category?.name || 'Genel'}
Durum: ${product.condition}
Sadece sayı döndür (TL cinsinden, sadece rakam).`

        let estimatedTL = 500 // fallback
        try {
          const client = getOpenAIClient()
          const aiRes = await client.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: 'Sadece bir sayı döndür. Başka hiçbir şey yazma.' },
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
