import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { assessValorPrice } from '@/lib/valor-economics'
import { CATEGORY_EXPERTS } from '@/lib/valor-pricing'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

function getOpenAIClient() {
  const apiKey = process.env.ABACUSAI_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('API key not configured')
  return new OpenAI({
    apiKey,
    baseURL: process.env.ABACUSAI_API_KEY ? 'https://routellm.abacus.ai/v1' : undefined,
  })
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
    return prices[Math.floor(prices.length / 2)]
  } catch {
    return null
  }
}

// POST: Tek ürün için revaluation
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
    const { productId, adminEstimatedPrice } = body

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'productId gerekli' }, { status: 400 })
    }

    if (adminEstimatedPrice !== undefined && adminEstimatedPrice !== null) {
      if (typeof adminEstimatedPrice !== 'number' || adminEstimatedPrice < 1 || !Number.isInteger(adminEstimatedPrice)) {
        return NextResponse.json({ error: 'adminEstimatedPrice pozitif tam sayı olmalı' }, { status: 400 })
      }
    }

    // Ürünü getir
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { name: true } },
        user: { select: { location: true } },
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 })
    }

    // Admin fiyatı varsa kaydet
    if (adminEstimatedPrice !== undefined && adminEstimatedPrice !== null) {
      await prisma.product.update({
        where: { id: productId },
        data: { adminEstimatedPrice }
      })
    }

    // ═══ FİYAT TAHMİNİ — ÖNCELİK SIRASI ═══
    let estimatedTL = 500
    let priceSource = 'fallback'
    const effectiveAdminPrice = adminEstimatedPrice ?? product.adminEstimatedPrice

    if (effectiveAdminPrice && effectiveAdminPrice > 0) {
      // 1. Öncelik: Admin manuel fiyatı
      estimatedTL = effectiveAdminPrice
      priceSource = 'admin'
      console.log(`[Admin] ${product.title}: Admin fiyatı ${estimatedTL} TL`)
    } else if (product.userPriceMin && product.userPriceMax && product.userPriceMin > 0 && product.userPriceMax > 0) {
      // 2. Öncelik: Kullanıcı fiyat aralığı + Brave+AI doğrulama
      const userMidpoint = Math.round((product.userPriceMin + product.userPriceMax) / 2)
      let braveValidated = false

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
              braveValidated = true
              priceSource = 'user+brave+ai'
              console.log(`[User+Brave+AI] ${product.title}: Kullanıcı aralığı ${product.userPriceMin}-${product.userPriceMax}, AI: ${estimatedTL} TL`)
            }
          }
        }
      } catch (e) {
        console.log(`[User+Brave+AI Error] ${product.title}:`, e)
      }

      if (!braveValidated) {
        estimatedTL = userMidpoint
        priceSource = 'user-midpoint'
        console.log(`[User midpoint] ${product.title}: Kullanıcı aralığı ${product.userPriceMin}-${product.userPriceMax}, Midpoint: ${estimatedTL} TL`)
      }
    } else {
      // 3. Öncelik: Brave Search + AI
      const HIGH_VALUE_CATEGORIES = ['Oto & Moto', 'Elektronik', 'Beyaz Eşya', 'Gayrimenkul', 'Tekne & Denizcilik']
      const categoryName = product.category?.name || 'Genel'
      const isHighValue = HIGH_VALUE_CATEGORIES.includes(categoryName)
      let braveFound = false

      if (categoryName === 'Oto & Moto') {
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
      } else if (isHighValue && process.env.BRAVE_SEARCH_API_KEY) {
        const searchPrice = await searchProductPrice(product.title, categoryName)
        if (searchPrice && searchPrice > 500) {
          estimatedTL = searchPrice
          braveFound = true
          priceSource = 'brave'
          console.log(`[Brave] ${product.title}: ${searchPrice} TL`)
        }
      }

      // AI fallback
      if (!braveFound) {
        try {
          const categoryExpert = CATEGORY_EXPERTS[categoryName as keyof typeof CATEGORY_EXPERTS]
            || CATEGORY_EXPERTS['Genel' as keyof typeof CATEGORY_EXPERTS]
          const isVehicle = categoryName === 'Oto & Moto'
          const conditionGuide = isVehicle
            ? `Araçlar için doğrudan ikinci el piyasa değerini tahmin et.`
            : `Önce sıfır fiyatını belirle, sonra ürün durumuna göre ikinci el değerini hesapla.`
          const systemMsg = `Sen bir ${categoryExpert.role} olarak çalışıyorsun.\nTürkiye 2026 ikinci el piyasasında ürün değerlemesi yapıyorsun.\nReferans: ${categoryExpert.referenceNote}\n${conditionGuide}\nSadece sayısal TL değeri döndür.`
          const prompt = `Bu ürünün güncel piyasa değerini TL olarak tahmin et.\nÜrün: ${product.title}\nAçıklama: ${product.description || 'Yok'}\nKategori: ${categoryName}\nDurum: ${product.condition}\nSadece sayı döndür.`

          const client = getOpenAIClient()
          const aiRes = await client.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: systemMsg },
              { role: 'user', content: prompt }
            ],
            max_tokens: 50,
            temperature: 0.2,
          })
          const text = aiRes.choices[0]?.message?.content?.trim() || '500'
          estimatedTL = Math.max(10, parseInt(text.replace(/\D/g, '')) || 500)
          priceSource = 'ai'
          console.log(`[AI] ${product.title}: ${estimatedTL} TL`)
        } catch {
          estimatedTL = (product.valorPrice || 100) * 5
          priceSource = 'fallback'
          console.log(`[Fallback] ${product.title}: ${estimatedTL} TL`)
        }
      }
    }

    // Ekonomik motor ile Valor hesapla
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

    // Güncelle
    const reasonWithMeta = `${assessment.humanExplanation} [Kaynak: ${priceSource}, Önceki: ${oldValor}V, TL: ~${estimatedTL}₺, Güncelleme: ${new Date().toISOString().split('T')[0]}]`
    const updatedProduct = await prisma.product.update({
      where: { id: product.id },
      data: {
        valorPrice: newValor,
        aiValorPrice: newValor,
        aiValorReason: reasonWithMeta,
      },
      include: {
        category: { select: { name: true } },
        user: { select: { name: true, email: true, location: true } },
      }
    })

    return NextResponse.json({
      success: true,
      product: {
        id: updatedProduct.id,
        title: updatedProduct.title,
        category: updatedProduct.category?.name,
        condition: updatedProduct.condition,
        adminEstimatedPrice: updatedProduct.adminEstimatedPrice,
        userPriceMin: updatedProduct.userPriceMin,
        userPriceMax: updatedProduct.userPriceMax,
        estimatedTL,
        priceSource,
      },
      valorScore: newValor,
      oldValor,
      newValor,
      changePercent: `${changePercent > 0 ? '+' : ''}${changePercent}%`,
      assessment: {
        formula: assessment.formula,
        humanExplanation: assessment.humanExplanation,
      }
    })

  } catch (error: any) {
    console.error('Single revalue error:', error)
    return NextResponse.json({ error: error.message || 'Yeniden değerleme hatası' }, { status: 500 })
  }
}
