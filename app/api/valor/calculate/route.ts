import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const client = new OpenAI({
  apiKey: process.env.ABACUSAI_API_KEY,
  baseURL: 'https://routellm.abacus.ai/v1',
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, categoryName, condition, checklistData } = body;

    if (!title || !categoryName) {
      return NextResponse.json({ error: 'Başlık ve kategori gerekli' }, { status: 400 });
    }

    // Build context for AI
    const checklistText = checklistData 
      ? Object.entries(checklistData).map(([k, v]) => `${k}: ${v}`).join(', ')
      : 'Yok';

    const conditionLabels: Record<string, string> = {
      'new': 'Sıfır/Yeni',
      'likeNew': 'Yeni Gibi',
      'good': 'İyi',
      'fair': 'Orta',
      'poor': 'Kötü'
    };

    const prompt = `Bir takas platformu için ürün değerlendirmesi yap.

Ürün Bilgileri:
- Başlık: ${title}
- Açıklama: ${description || 'Yok'}
- Kategori: ${categoryName}
- Durum: ${conditionLabels[condition] || condition}
- Ek Bilgiler: ${checklistText}

Lütfen bu ürün için bir VALOR değeri öner. Valor, platformun sanal para birimidir ve takas değerini temsil eder.

Değerlendirme kriterleri:
- Elektronik cihazlar: 500-15000 Valor
- Giyim/Aksesuar: 50-500 Valor
- Ev eşyaları/Mobilya: 100-5000 Valor
- Kitap/Hobi: 20-300 Valor
- Spor ekipmanları: 100-3000 Valor
- Bebek ürünleri: 50-1000 Valor
- Genel: 50-2000 Valor

Durum çarpanı:
- Sıfır: x1.0
- Yeni Gibi: x0.85
- İyi: x0.7
- Orta: x0.5
- Kötü: x0.3

JSON formatında yanıt ver:
{
  "valorPrice": <sayı>,
  "reason": "<kısa açıklama>",
  "marketInsight": "<pazar hakkında kısa bilgi>"
}

Sadece JSON döndür.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'Sen bir ürün değerlendirme uzmanısın. Verilen ürün bilgilerine göre adil bir takas değeri belirle. Sadece JSON formatında yanıt ver.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    const responseText = response.choices[0]?.message?.content || '{}';
    
    let result;
    try {
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanedText);
    } catch {
      // Fallback değer
      result = {
        valorPrice: 100,
        reason: 'Standart değerlendirme',
        marketInsight: 'Ortalama pazar değeri'
      };
    }

    // Validate and ensure minimum value
    const valorPrice = Math.max(10, Math.round(result.valorPrice || 100));

    return NextResponse.json({
      valorPrice,
      reason: result.reason || 'AI tarafından hesaplandı',
      marketInsight: result.marketInsight || 'Pazar analizi yapıldı'
    });

  } catch (error) {
    console.error('Valor calculate error:', error);
    return NextResponse.json(
      { error: 'Valor hesaplanamadı' },
      { status: 500 }
    );
  }
}
