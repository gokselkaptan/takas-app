import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

// Minimum resolution requirements
const MIN_WIDTH = 400
const MIN_HEIGHT = 400
const MIN_TOTAL_PIXELS = 250000 // ~500x500
const MAX_BLUR_SCORE = 0.7 // 0-1 scale, lower is blurrier
const MIN_QUALITY_SCORE = 50 // 0-100 scale

export interface QualityCheckResult {
  passed: boolean
  overallScore: number // 0-100
  checks: {
    resolution: {
      passed: boolean
      width?: number
      height?: number
      message: string
    }
    clarity: {
      passed: boolean
      score: number
      message: string
    }
    authenticity: {
      passed: boolean
      isStockPhoto: boolean
      isFakeProduct: boolean
      confidence: number
      message: string
    }
    content: {
      passed: boolean
      hasProduct: boolean
      productVisible: boolean
      message: string
    }
    lighting: {
      passed: boolean
      score: number
      message: string
    }
  }
  recommendations: string[]
  blockedReason?: string
}

/**
 * AI-powered Product Quality Check API
 * Checks: Resolution, Clarity, Authenticity, Content, Lighting
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Giriş yapmanız gerekiyor' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const productTitle = formData.get('title') as string || ''
    const productCategory = formData.get('category') as string || ''

    if (!file) {
      return NextResponse.json(
        { error: 'Dosya bulunamadı', passed: false },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { 
          error: 'Geçersiz dosya türü. Sadece JPEG, PNG ve WebP desteklenir.',
          passed: false 
        },
        { status: 400 }
      )
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Dosya boyutu 10MB\'dan büyük olamaz.', passed: false },
        { status: 400 }
      )
    }

    // Convert to base64 for AI analysis
    const arrayBuffer = await file.arrayBuffer()
    const base64String = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type

    // Call AI for comprehensive quality analysis
    const aiAnalysis = await analyzeImageWithAI(
      base64String,
      mimeType,
      productTitle,
      productCategory
    )

    return NextResponse.json(aiAnalysis)

  } catch (error) {
    console.error('Product quality check error:', error)
    return NextResponse.json(
      { error: 'Kalite kontrolü sırasında bir hata oluştu', passed: false },
      { status: 500 }
    )
  }
}

async function analyzeImageWithAI(
  base64: string,
  mimeType: string,
  title: string,
  category: string
): Promise<QualityCheckResult> {
  try {
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `Sen bir ürün fotoğrafı kalite kontrol uzmanısın. Takas platformu için yüklenen ürün fotoğraflarını analiz ediyorsun.

GÖREVLERİN:
1. **Çözünürlük/Netlik Analizi**: Fotoğrafın bulanık olup olmadığını, çözünürlüğün yeterli olup olmadığını değerlendir.
2. **Gerçeklik Kontrolü**: 
   - Stock fotoğraf mı? (Shutterstock, iStock, Getty vb. watermark veya tipik stock tarzı)
   - İnternetten indirilen sahte/aldatıcı görsel mi?
   - Gerçek bir ürün fotoğrafı mı?
3. **Ürün Görünürlüğü**: Ürün net şekilde görünüyor mu? Ana ürün mi yoksa arka plan mı ön planda?
4. **Aydınlatma Kalitesi**: Fotoğraf iyi aydınlatılmış mı? Çok karanlık veya aşırı parlak mı?
5. **İçerik Uygunluğu**: Yasadışı, uygunsuz veya yasaklı içerik var mı?

ŞÜPHELİ BELİRTİLER (dikkat et):
- Çok profesyonel stüdyo çekimi (genellikle stock photo)
- Watermark izleri veya bulanıklaştırılmış logolar
- Google görsel arama sonucu gibi görünen fotoğraflar
- Ürünle uyumsuz arka plan (Türkiye'de satılıyor ama yabancı mağaza etiketi görünüyor)
- Aşırı düşük kalite veya pikselleşme
- Ekran görüntüsü veya screenshot
- Katalog/tanıtım görseli

PUAN SİSTEMİ (0-100):
- 90-100: Mükemmel, gerçek ürün fotoğrafı
- 70-89: İyi, kabul edilebilir
- 50-69: Orta, iyileştirme önerilir
- 30-49: Düşük kalite, muhtemelen reddedilmeli
- 0-29: Kabul edilemez (stock photo, sahte, uygunsuz)

YANIT FORMATI (sadece JSON):
{
  "resolution": {
    "estimatedWidth": number,
    "estimatedHeight": number,
    "isAdequate": boolean,
    "message": "string"
  },
  "clarity": {
    "score": number (0-100),
    "isBlurry": boolean,
    "message": "string"
  },
  "authenticity": {
    "isStockPhoto": boolean,
    "isFakeProduct": boolean,
    "isScreenshot": boolean,
    "isCatalogImage": boolean,
    "confidence": number (0-100),
    "suspiciousElements": ["string"],
    "message": "string"
  },
  "content": {
    "hasProduct": boolean,
    "productVisible": boolean,
    "productType": "string",
    "matchesTitle": boolean,
    "message": "string"
  },
  "lighting": {
    "score": number (0-100),
    "isTooD ark": boolean,
    "isOverexposed": boolean,
    "message": "string"
  },
  "overallScore": number (0-100),
  "shouldBlock": boolean,
  "blockReason": "string or null",
  "recommendations": ["string"]
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Bu fotoğrafı analiz et. ${title ? `Ürün başlığı: "${title}"` : ''} ${category ? `Kategori: ${category}` : ''}

Fotoğrafın:
1. Çözünürlük ve netlik kalitesini değerlendir
2. Stock photo veya sahte ürün görseli olup olmadığını kontrol et
3. Gerçek bir ürün fotoğrafı olup olmadığını belirle
4. Aydınlatma ve görünürlük kalitesini puanla
5. Genel kalite puanı ver (0-100)

Sadece JSON formatında yanıt ver.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      console.error('AI API error:', await response.text())
      // Return a permissive default on API error
      return createDefaultResult(true, 'AI analizi şu anda kullanılamıyor')
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return createDefaultResult(true, 'Analiz sonucu alınamadı')
    }

    const aiResult = JSON.parse(content)
    return transformAIResult(aiResult)

  } catch (error) {
    console.error('AI analysis error:', error)
    return createDefaultResult(true, 'Analiz hatası, varsayılan olarak kabul edildi')
  }
}

function transformAIResult(ai: any): QualityCheckResult {
  const overallScore = ai.overallScore ?? 70
  
  // Determine if should block
  const shouldBlock = ai.shouldBlock || 
    ai.authenticity?.isStockPhoto || 
    ai.authenticity?.isFakeProduct ||
    overallScore < 30

  const recommendations: string[] = ai.recommendations || []

  // Add recommendations based on checks
  if (ai.clarity?.isBlurry) {
    recommendations.push('Daha net bir fotoğraf çekin, kameranızı sabit tutun')
  }
  if (ai.lighting?.isTooDark) {
    recommendations.push('Daha aydınlık bir ortamda fotoğraf çekin')
  }
  if (ai.lighting?.isOverexposed) {
    recommendations.push('Doğrudan güneş ışığından kaçının')
  }
  if (!ai.content?.productVisible) {
    recommendations.push('Ürünü daha yakından ve net şekilde çekin')
  }
  if (ai.authenticity?.isScreenshot) {
    recommendations.push('Ekran görüntüsü yerine gerçek ürün fotoğrafı yükleyin')
  }

  return {
    passed: !shouldBlock && overallScore >= MIN_QUALITY_SCORE,
    overallScore,
    checks: {
      resolution: {
        passed: ai.resolution?.isAdequate ?? true,
        width: ai.resolution?.estimatedWidth,
        height: ai.resolution?.estimatedHeight,
        message: ai.resolution?.message || 'Çözünürlük kontrolü yapıldı'
      },
      clarity: {
        passed: !ai.clarity?.isBlurry && (ai.clarity?.score ?? 70) >= 50,
        score: ai.clarity?.score ?? 70,
        message: ai.clarity?.message || 'Netlik kontrolü yapıldı'
      },
      authenticity: {
        passed: !ai.authenticity?.isStockPhoto && !ai.authenticity?.isFakeProduct,
        isStockPhoto: ai.authenticity?.isStockPhoto ?? false,
        isFakeProduct: ai.authenticity?.isFakeProduct ?? false,
        confidence: ai.authenticity?.confidence ?? 80,
        message: ai.authenticity?.message || 'Gerçeklik kontrolü yapıldı'
      },
      content: {
        passed: ai.content?.hasProduct && ai.content?.productVisible,
        hasProduct: ai.content?.hasProduct ?? true,
        productVisible: ai.content?.productVisible ?? true,
        message: ai.content?.message || 'İçerik kontrolü yapıldı'
      },
      lighting: {
        passed: (ai.lighting?.score ?? 70) >= 50,
        score: ai.lighting?.score ?? 70,
        message: ai.lighting?.message || 'Aydınlatma kontrolü yapıldı'
      }
    },
    recommendations: [...new Set(recommendations)], // Remove duplicates
    blockedReason: shouldBlock ? (ai.blockReason || getBlockReason(ai)) : undefined
  }
}

function getBlockReason(ai: any): string {
  if (ai.authenticity?.isStockPhoto) {
    return 'Bu fotoğraf bir stock fotoğraf olarak tespit edildi. Lütfen kendi çektiğiniz ürün fotoğrafını yükleyin.'
  }
  if (ai.authenticity?.isFakeProduct) {
    return 'Bu fotoğraf internetten alınmış veya sahte bir ürün görseli olarak tespit edildi.'
  }
  if (ai.authenticity?.isScreenshot) {
    return 'Ekran görüntüleri kabul edilmiyor. Lütfen gerçek ürün fotoğrafı yükleyin.'
  }
  if (ai.authenticity?.isCatalogImage) {
    return 'Katalog görselleri kabul edilmiyor. Lütfen kendi çektiğiniz fotoğrafı yükleyin.'
  }
  if (ai.overallScore < 30) {
    return 'Fotoğraf kalitesi çok düşük. Lütfen daha net ve aydınlık bir fotoğraf çekin.'
  }
  return 'Fotoğraf kalite standartlarını karşılamıyor.'
}

function createDefaultResult(passed: boolean, message: string): QualityCheckResult {
  return {
    passed,
    overallScore: passed ? 70 : 30,
    checks: {
      resolution: { passed: true, message },
      clarity: { passed: true, score: 70, message },
      authenticity: {
        passed: true,
        isStockPhoto: false,
        isFakeProduct: false,
        confidence: 50,
        message
      },
      content: {
        passed: true,
        hasProduct: true,
        productVisible: true,
        message
      },
      lighting: { passed: true, score: 70, message }
    },
    recommendations: [],
    blockedReason: passed ? undefined : message
  }
}
