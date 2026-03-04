import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// AI Görselleştirme API
// Kullanıcının yüklediği ortam fotoğrafına ürünü yerleştirir
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    let user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        role: true,
        aiVisualizationCredits: true,
        aiCreditsResetAt: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Aylık reset kontrolü - her ayın başında 3 hak yenilenir
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const lastResetDate = user.aiCreditsResetAt ? new Date(user.aiCreditsResetAt) : null
    
    const needsReset = !lastResetDate || 
      lastResetDate.getMonth() !== currentMonth || 
      lastResetDate.getFullYear() !== currentYear

    if (needsReset && user.role !== 'admin') {
      // Aylık kredileri 3'e sıfırla
      await prisma.user.update({
        where: { id: user.id },
        data: {
          aiVisualizationCredits: 3,
          aiCreditsResetAt: now
        }
      })
      user = { ...user, aiVisualizationCredits: 3, aiCreditsResetAt: now }
    }

    // Admin için sınırsız, diğerleri için kredi kontrolü
    const isAdmin = user.role === 'admin'
    if (!isAdmin && user.aiVisualizationCredits <= 0) {
      // Sonraki ay başlangıcını hesapla
      const nextMonth = new Date(currentYear, currentMonth + 1, 1)
      const daysUntilReset = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      return NextResponse.json({ 
        error: 'Bu ay için görselleştirme hakkınız kalmadı',
        remainingCredits: 0,
        daysUntilReset,
        message: `Ücretsiz haklarınız ${daysUntilReset} gün sonra yenilenecek!`
      }, { status: 403 })
    }

    const formData = await request.formData()
    const environmentImage = formData.get('environmentImage') as File
    const productImage = formData.get('productImage') as string // URL veya base64
    const productTitle = formData.get('productTitle') as string
    const category = formData.get('category') as string
    const roomDescription = formData.get('roomDescription') as string // Opsiyonel açıklama

    if (!environmentImage && !roomDescription) {
      return NextResponse.json({ 
        error: 'Ortam fotoğrafı veya oda açıklaması gerekli' 
      }, { status: 400 })
    }

    if (!productImage || !productTitle) {
      return NextResponse.json({ 
        error: 'Ürün görseli ve başlığı gerekli' 
      }, { status: 400 })
    }

    // Ortam görselini base64'e çevir (eğer dosya yüklendiyse)
    let environmentBase64 = ''
    if (environmentImage) {
      const bytes = await environmentImage.arrayBuffer()
      environmentBase64 = Buffer.from(bytes).toString('base64')
    }

    // Kategori bazlı prompt oluştur
    const categoryPrompts: Record<string, string> = {
      'mobilya': 'furniture piece placed naturally in the room, realistic lighting and shadows',
      'elektronik': 'electronic device on a desk or table, realistic reflections and ambient lighting',
      'giyim': 'clothing item being worn by a person or displayed on a mannequin',
      'aksesuar': 'accessory being worn or displayed elegantly',
      'spor': 'sports equipment in an appropriate setting',
      'default': 'item placed naturally in the environment with realistic lighting'
    }

    const categoryHint = categoryPrompts[category] || categoryPrompts['default']

    // AI görsel üretimi için prompt - ürün görselini referans olarak kullan
    const roomContext = roomDescription || 'modern living room'
    
    // Ürün görselinin URL mi yoksa base64 mi olduğunu kontrol et
    let productImageUrl = productImage
    if (!productImage.startsWith('http') && !productImage.startsWith('data:')) {
      // Relative path ise tam URL'ye çevir
      productImageUrl = productImage.startsWith('/') 
        ? `${process.env.NEXTAUTH_URL || 'https://takas-a.com'}${productImage}`
        : productImage
    }

    // Ortam fotoğrafı varsa, önce GPT ile analiz et
    let detailedRoomDescription = roomContext
    
    if (environmentBase64) {
      try {
        // GPT-4.1-mini ile ortam fotoğrafını analiz et
        const envMimeType = environmentImage.type || 'image/jpeg'
        const analysisResponse = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4.1-mini',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Analyze this room/interior photo and provide a detailed description for an AI image generator. Include:
- Room type (living room, bedroom, kitchen, etc.)
- Wall colors and textures
- Floor type (hardwood, carpet, tile, etc.)
- Lighting conditions (natural light, warm, cool, etc.)
- Existing furniture and decor style
- Overall aesthetic (modern, traditional, minimalist, etc.)
- Any distinctive features

Provide the description in a single paragraph, focusing on visual details that would help recreate this exact room style. Be specific and detailed.`
                  },
                  {
                    type: 'image_url',
                    image_url: { url: `data:${envMimeType};base64,${environmentBase64}` }
                  }
                ]
              }
            ],
            max_tokens: 500
          })
        })
        
        if (analysisResponse.ok) {
          const analysisResult = await analysisResponse.json()
          const description = analysisResult.choices?.[0]?.message?.content
          if (description && typeof description === 'string') {
            detailedRoomDescription = description
            console.log('Room analysis:', detailedRoomDescription)
          }
        }
      } catch (err) {
        console.error('Room analysis failed, using default description:', err)
      }
    }

    // flux-2-pro ile görsel üret (sadece text prompt - image input desteklemiyor)
    // Ürün adını daha belirgin hale getir ve prompt'u ürün odaklı yap
    const productEmphasis = productTitle.toUpperCase()
    
    const imagePrompt = `MAIN SUBJECT: A ${productEmphasis} - this ${productTitle} MUST be clearly visible and prominent in the center-front of the image.

ROOM CONTEXT: ${detailedRoomDescription}

IMPORTANT REQUIREMENTS:
1. The ${productTitle} must be the FOCAL POINT of the image
2. The ${productTitle} should be placed on a visible surface (table, counter, shelf) in the foreground
3. Show the ${productTitle} at a natural size, clearly visible and recognizable
4. ${categoryHint}

STYLE: Photorealistic interior design photography, professional lighting, magazine-quality, 4K detail, the ${productTitle} perfectly integrated into the space.`

    // Abacus.AI Image Generation API - flux-2-pro modeli
    const apiResponse = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'flux-2-pro',
        messages: [
          {
            role: 'user',
            content: imagePrompt
          }
        ],
        modalities: ['image']
      })
    })

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      console.error('AI API error:', errorText)
      return NextResponse.json({ 
        error: 'Görselleştirme oluşturulamadı, lütfen tekrar deneyin' 
      }, { status: 500 })
    }

    const result = await apiResponse.json()
    console.log('AI API response:', JSON.stringify(result, null, 2))
    
    // Sonuçtan görsel URL'ini çıkar - chat/completions with modalities formatı
    let generatedImageUrl = ''
    
    // Format 1: flux-2-pro formatı - message.images array'ı
    if (result.choices?.[0]?.message?.images) {
      const images = result.choices[0].message.images
      if (Array.isArray(images) && images.length > 0) {
        const imageContent = images.find((img: { type: string }) => img.type === 'image_url')
        if (imageContent?.image_url?.url) {
          generatedImageUrl = imageContent.image_url.url
        }
      }
    }
    // Format 2: choices array - content array içinde image_url
    else if (result.choices?.[0]?.message?.content) {
      const content = result.choices[0].message.content
      if (Array.isArray(content)) {
        const imageContent = content.find((c: { type: string }) => c.type === 'image_url')
        if (imageContent?.image_url?.url) {
          generatedImageUrl = imageContent.image_url.url
        }
      } else if (typeof content === 'string') {
        // URL içeren string ise çıkar
        const cdnMatch = content.match(/https:\/\/cdn\.abacus\.ai\/[^\s"'\]>]+/i)
        if (cdnMatch) {
          generatedImageUrl = cdnMatch[0]
        }
      }
    }
    // Format 3: data array içinde url
    else if (result.data?.[0]?.url) {
      generatedImageUrl = result.data[0].url
    }
    // Format 4: data array içinde b64_json
    else if (result.data?.[0]?.b64_json) {
      generatedImageUrl = `data:image/png;base64,${result.data[0].b64_json}`
    }
    // Format 5: Doğrudan url field
    else if (result.url) {
      generatedImageUrl = result.url
    }
    // Format 6: image_url doğrudan result içinde
    else if (result.image_url) {
      generatedImageUrl = result.image_url
    }

    if (!generatedImageUrl) {
      console.error('No image URL in response:', JSON.stringify(result, null, 2))
      return NextResponse.json({ 
        error: 'Görsel oluşturulamadı, lütfen farklı bir açıklama deneyin' 
      }, { status: 500 })
    }

    // Admin değilse krediyi düşür
    if (!isAdmin) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          aiVisualizationCredits: { decrement: 1 }
        }
      })
    }

    // Kalan krediyi hesapla
    const remainingCredits = isAdmin ? 999 : user.aiVisualizationCredits - 1

    return NextResponse.json({
      success: true,
      imageUrl: generatedImageUrl,
      remainingCredits,
      isAdmin,
      message: remainingCredits > 0 
        ? `Kalan hakkınız: ${remainingCredits}` 
        : 'Bu son ücretsiz hakkınızdı! Yakında TL ile satın alma seçeneği eklenecek.'
    })

  } catch (error) {
    console.error('AI visualization error:', error)
    return NextResponse.json({ 
      error: 'Bir hata oluştu, lütfen tekrar deneyin' 
    }, { status: 500 })
  }
}

// Kullanıcının kalan kredisini kontrol et
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    let user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        role: true,
        aiVisualizationCredits: true,
        aiCreditsResetAt: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const isAdmin = user.role === 'admin'

    // Aylık reset kontrolü
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const lastResetDate = user.aiCreditsResetAt ? new Date(user.aiCreditsResetAt) : null
    
    const needsReset = !lastResetDate || 
      lastResetDate.getMonth() !== currentMonth || 
      lastResetDate.getFullYear() !== currentYear

    if (needsReset && !isAdmin) {
      // Aylık kredileri 3'e sıfırla
      await prisma.user.update({
        where: { id: user.id },
        data: {
          aiVisualizationCredits: 3,
          aiCreditsResetAt: now
        }
      })
      user = { ...user, aiVisualizationCredits: 3, aiCreditsResetAt: now }
    }

    // Sonraki ay başlangıcını hesapla
    const nextMonth = new Date(currentYear, currentMonth + 1, 1)
    const daysUntilReset = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    const credits = isAdmin ? 999 : user.aiVisualizationCredits

    return NextResponse.json({
      remainingCredits: credits,
      monthlyLimit: 3,
      daysUntilReset: isAdmin ? null : daysUntilReset,
      isAdmin,
      pricePerCredit: 49.99, // TL - ileride kullanılacak
      message: isAdmin 
        ? 'Admin olarak sınırsız kullanım hakkınız var!' 
        : credits > 0
          ? `Bu ay ${credits}/3 ücretsiz hakkınız kaldı`
          : `Haklarınız ${daysUntilReset} gün sonra yenilenecek`
    })

  } catch (error) {
    console.error('Credit check error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}