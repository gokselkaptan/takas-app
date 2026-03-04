import { NextRequest, NextResponse } from 'next/server'

// AI-powered image moderation endpoint
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'Dosya bulunamadı', isAppropriate: false },
        { status: 400 }
      )
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Geçersiz dosya türü. Sadece JPEG, PNG, GIF ve WebP desteklenir.', isAppropriate: false },
        { status: 400 }
      )
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Dosya boyutu 10MB\'dan büyük olamaz.', isAppropriate: false },
        { status: 400 }
      )
    }

    // Convert image to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64String = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type

    // Call LLM API for image moderation
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
            content: `Sen bir içerik moderasyon uzmanısın. Yüklenen görselleri etik ve ahlaki uygunluk açısından analiz ediyorsun.

Bu platform Atatürkçü ve laik bir vizyona sahiptir.

Bir takas platformu için ürün görseli olarak şunları REDDET:
1. Pornografik veya cinsel içerik
2. Şiddet veya kanlı görüntüler
3. Uyuşturucu veya yasadışı maddeler
4. Nefret sembolleri veya ırkçı içerik
5. Çocuk istismarı içeren herhangi bir şey
6. Silah veya patlayıcı maddeler
7. Kişisel kimlik bilgileri (TC no, kredi kartı vb. görünüyorsa)
8. Siyasal islam propagandası içeren materyaller
9. Dini aşırılık, yobazlık veya radikal dini içerik
10. Tarikat, cemaat propagandası içeren materyaller
11. Laiklik karşıtı içerikler

MUTLAKA KABUL ET (bunlar kesinlikle uygundur):
- Kitaplar (özellikle Atatürk, Cumhuriyet, laiklik, tarih kitapları)
- Atatürk görseli içeren ürünler (kitap, poster, heykel vb.)
- Akademik ve eğitim materyalleri
- Ürün fotoğrafları (elektronik, giyim, oyuncak, mobilya vb.)
- Günlük nesneler
- İnsanların normal kıyafetli fotoğrafları

ÖNEMLİ: Başlığında "saldırı" gibi kelimeler geçse bile, bu kitabın içeriğini değerlendir. Örneğin "Atatürk'e Saldırmanın Dayanılmaz Hafifliği" Atatürk'ü savunan bir kitaptır ve kesinlikle KABUL edilmelidir.

YANIT FORMATI (sadece JSON):
{"isAppropriate": true/false, "reason": "kısa açıklama", "category": "UYGUN/UYGUNSUZ"}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Bu görseli bir takas platformu için ürün fotoğrafı olarak uygun olup olmadığını değerlendir. Sadece JSON formatında yanıt ver.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64String}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      console.error('LLM API error:', await response.text())
      return NextResponse.json(
        { error: 'Görsel analizi başarısız oldu', isAppropriate: false },
        { status: 500 }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: 'Analiz sonucu alınamadı', isAppropriate: false },
        { status: 500 }
      )
    }

    try {
      const result = JSON.parse(content)
      return NextResponse.json({
        isAppropriate: result.isAppropriate ?? false,
        reason: result.reason || 'Bilinmeyen neden',
        category: result.category || 'BELIRSIZ'
      })
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Analiz sonucu işlenemedi', isAppropriate: false },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Image moderation error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu', isAppropriate: false },
      { status: 500 }
    )
  }
}
