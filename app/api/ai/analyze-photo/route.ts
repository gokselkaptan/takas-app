import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, category } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ questions: [] }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured')
      return NextResponse.json({ questions: [] })
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Sen bir ikinci el ürün platformu asistanısın. Kullanıcının yüklediği ürün fotoğrafını analiz edip, alıcıların bilmesi gereken 2-3 spesifik soru oluşturuyorsun. Sorular kısa, net ve Türkçe olmalı. Sadece JSON array formatında döndür, başka hiçbir şey yazma.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Bu ürün fotoğrafına bak.${category ? ` Kategori: ${category}.` : ''} Ürünü tanımla ve alıcının bilmesi gereken 2-3 spesifik soru oluştur. Genel sorular sorma, fotoğrafta gördüklerine göre spesifik sorular sor. JSON formatında döndür: [{"id": "ai_q1", "label": "Soru metni?"}]`
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'low' }
              }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenAI API error:', response.status, errorData)
      return NextResponse.json({ questions: [] })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '[]'
    
    // JSON parse et — markdown code block temizle
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.slice(7)
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.slice(3)
    }
    if (cleanContent.endsWith('```')) {
      cleanContent = cleanContent.slice(0, -3)
    }
    cleanContent = cleanContent.trim()

    try {
      const questions = JSON.parse(cleanContent)
      
      // Validate structure
      if (Array.isArray(questions) && questions.every((q: any) => q.id && q.label)) {
        return NextResponse.json({ questions: questions.slice(0, 3) })
      }
      
      return NextResponse.json({ questions: [] })
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', cleanContent)
      return NextResponse.json({ questions: [] })
    }
  } catch (error) {
    console.error('AI analiz hatası:', error)
    return NextResponse.json({ questions: [] }, { status: 500 })
  }
}
