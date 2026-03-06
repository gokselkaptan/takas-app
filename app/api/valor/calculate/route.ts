import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import { calculateValorPrice, getCountryFromCity, CATEGORY_EXPERTS } from '@/lib/valor-pricing'

export const dynamic = 'force-dynamic'

const client = new OpenAI({
  apiKey: process.env.ABACUSAI_API_KEY,
  baseURL: 'https://routellm.abacus.ai/v1',
})

const conditionLabels: Record<string, string> = {
  'new': 'Sıfır/Yeni', 'likeNew': 'Yeni Gibi', 'good': 'İyi', 'fair': 'Orta', 'poor': 'Kötü'
}

// ═══ ÜLKE BAZLI REFERANS FİYATLAR ═══
function getReferencePrompt(country: string, isVehicle: boolean, isRealEstate: boolean): string {
  if (isVehicle) {
    if (country === 'TR') {
      return `
REFERANS: TÜRKİYE 2025 İKİNCİ EL OTOMOBİL FİYATLARI (TL):
- 2014 BMW 520d 150-200bin km: 1.400.000-1.800.000 TL
- 2014 BMW 520d 200bin+ km: 1.200.000-1.500.000 TL
- 2018 BMW 520i: 2.200.000-2.800.000 TL
- 2018 Mercedes C200: 2.200.000-2.800.000 TL
- 2020 Mercedes E200: 3.500.000-4.500.000 TL
- 2020 Volkswagen Passat: 1.800.000-2.400.000 TL
- 2016 Toyota Corolla: 900.000-1.200.000 TL
- 2019 Renault Megane: 1.000.000-1.400.000 TL
- 2015 Fiat Egea: 700.000-1.000.000 TL
- 2022 Hyundai Tucson: 2.000.000-2.600.000 TL

⚠️ TÜRKİYE'DE ÖTV NEDENİYLE ARAÇ FİYATLARI AVRUPA'NIN 2-3 KATI PAHALIDIR!
Avrupa fiyatlarını referans ALMA! Fiyatı TL olarak ver.`
    } else {
      return `
REFERANS: AVRUPA 2025 İKİNCİ EL OTOMOBİL FİYATLARI (EUR):
- 2014 BMW 520d 150-200bin km: 12.000-18.000 EUR
- 2018 BMW 520i: 22.000-28.000 EUR
- 2018 Mercedes C200: 20.000-26.000 EUR
- 2020 Volkswagen Passat: 18.000-24.000 EUR
- 2016 Toyota Corolla: 10.000-14.000 EUR
- 2019 Renault Megane: 12.000-16.000 EUR
- 2022 Hyundai Tucson: 24.000-30.000 EUR

Fiyatı EUR olarak ver. 1 EUR ≈ 52 TL olarak çevir.
Sonucu TL olarak "estimatedTL" alanında döndür.`
    }
  }
  
  if (isRealEstate) {
    if (country === 'TR') {
      return `
REFERANS: TÜRKİYE 2025 GAYRİMENKUL (TL):
- İstanbul Kadıköy/Beşiktaş: 120.000-180.000 TL/m²
- İstanbul Esenyurt: 40.000-70.000 TL/m²
- İzmir Karşıyaka/Alsancak: 60.000-100.000 TL/m²
- İzmir Bornova: 40.000-65.000 TL/m²
- Ankara Çankaya: 50.000-80.000 TL/m²
- Antalya Konyaaltı: 70.000-120.000 TL/m²

⚠️ TÜRKİYE'DE KONUT FİYATLARI 2023-2025 ARASI 3 KAT ARTTI!
Fiyatı TL olarak ver.`
    } else {
      return `
REFERANS: AVRUPA 2025 GAYRİMENKUL (EUR):
- Barcelona merkez: 4.000-6.000 EUR/m²
- Madrid merkez: 4.500-7.000 EUR/m²
- Berlin merkez: 4.000-6.000 EUR/m²
- Paris merkez: 8.000-14.000 EUR/m²
- London merkez: 8.000-15.000 GBP/m²
- Amsterdam merkez: 5.000-8.000 EUR/m²
- Lizbon merkez: 3.000-5.000 EUR/m²
- Milano merkez: 3.500-6.000 EUR/m²

Fiyatı EUR olarak hesapla, 1 EUR ≈ 52 TL olarak çevir.
Sonucu TL olarak "estimatedTL" alanında döndür.`
    }
  }

  // Normal ürünler
  if (country === 'TR') {
    return `
REFERANS: TÜRKİYE 2025 GÜNCEL FİYATLAR (TL):

📱 ELEKTRONİK:
- iPhone 16 Pro Max 256GB: 85.000-95.000 TL
- iPhone 15 Pro Max: 65.000-75.000 TL
- iPhone 14 Pro Max: 50.000-60.000 TL
- iPhone 13 Pro Max: 38.000-45.000 TL
- Samsung S24 Ultra: 65.000-75.000 TL
- Samsung Tab S8: 20.000-28.000 TL
- Samsung Galaxy Watch: 8.000-12.000 TL
- MacBook Air M2: 45.000-55.000 TL
- MacBook Pro M3: 85.000-100.000 TL
- PS5 + 2 Kol: 28.000-35.000 TL
- PS5 Controller: 3.500-5.000 TL
- Bose QC Ultra: 15.000-20.000 TL
- Canon R50: 30.000-38.000 TL
- Canon R5 + 24-105mm: 120.000-150.000 TL
- DJI Mini 3 Pro: 35.000-45.000 TL
- Samsung 55" TV: 22.000-30.000 TL
- Dyson V15: 22.000-28.000 TL
- Garmin Fenix 7X: 30.000-40.000 TL
- Laptop (orta): 25.000-40.000 TL
- Monitor (gaming): 8.000-15.000 TL

🏠 EV & MOBİLYA:
- IKEA Billy: 3.000-5.000 TL
- Berjer Koltuk: 15.000-25.000 TL
- Antika Şifonyer: 20.000-40.000 TL
- Le Creuset Tencere: 10.000-15.000 TL
- KitchenAid Mikser: 18.000-25.000 TL
- Monstera dev boy: 800-1.500 TL
- Kupa bardak: 50-200 TL

🍳 BEYAZ EŞYA:
- Buzdolabı (A+++): 25.000-40.000 TL
- Çamaşır Makinesi: 18.000-30.000 TL
- Klima 12000 BTU: 18.000-25.000 TL

👗 GİYİM:
- Nike Air Max 90: 4.500-6.500 TL
- Jordan 1 High: 8.000-15.000 TL
- Converse Chuck: 1.500-2.500 TL
- Zara Kaşmir Palto: 4.000-7.000 TL
- Canada Goose Parka: 30.000-45.000 TL
- Vintage Deri Ceket: 3.000-8.000 TL
- Levi's 501 Vintage: 2.000-5.000 TL
- Ray-Ban Aviator: 5.000-8.000 TL
- Louis Vuitton Neverfull: 80.000-120.000 TL

⌚ SAAT: Rolex Submariner: 800.000-1.200.000 TL

👶 BEBEK: Bugaboo Fox 3: 30.000-45.000 TL
🐾 HAYVAN: Kedi Tırmalama 180cm: 3.000-6.000 TL
🎸 MÜZİK: Fender Stratocaster: 30.000-45.000 TL
📚 KİTAP: Harry Potter 7li set: 2.000-4.000 TL
⚽ SPOR: Kayak Takımı: 25.000-40.000 TL
🚲 BİSİKLET: Specialized Tarmac SL7: 150.000-200.000 TL
🏡 BAHÇE: Weber Genesis Mangal: 25.000-40.000 TL

⚠️ TÜRKİYE'DE ÖTV+KDV İLE ELEKTRONİK AVRUPA'NIN 1.5-2 KATI PAHALIDIR!
İkinci el ≈ yeni fiyatın %60-85'i.`
  } else {
    return `
REFERANS: AVRUPA 2025 GÜNCEL FİYATLAR (EUR → TL çevir, 1 EUR ≈ 52 TL):

📱 ELEKTRONİK:
- iPhone 16 Pro Max: 1.450-1.600 EUR (75.000-83.000 TL)
- iPhone 15 Pro Max: 1.100-1.300 EUR (57.000-68.000 TL)
- iPhone 13 Pro Max: 600-800 EUR (31.000-42.000 TL)
- Samsung S24 Ultra: 1.100-1.300 EUR (57.000-68.000 TL)
- MacBook Air M2: 1.100-1.300 EUR (57.000-68.000 TL)
- PS5 + 2 Kol: 500-600 EUR (26.000-31.000 TL)
- Samsung 55" TV: 450-650 EUR (23.000-34.000 TL)
- Dyson V15: 550-700 EUR (29.000-36.000 TL)
- Canon R5 + Lens: 3.500-4.500 EUR (182.000-234.000 TL)

🏠 EV & MOBİLYA:
- IKEA Billy: 60-80 EUR (3.100-4.200 TL)
- KitchenAid Mikser: 400-550 EUR (21.000-29.000 TL)
- Le Creuset Tencere: 250-350 EUR (13.000-18.000 TL)

👗 GİYİM:
- Nike Air Max 90: 120-160 EUR (6.200-8.300 TL)
- Canada Goose Parka: 900-1.200 EUR (47.000-62.000 TL)
- Louis Vuitton Neverfull: 1.800-2.500 EUR (94.000-130.000 TL)

⌚ SAAT: Rolex Submariner: 12.000-18.000 EUR (624.000-936.000 TL)
👶 BEBEK: Bugaboo Fox 3: 800-1.100 EUR (42.000-57.000 TL)
🎸 MÜZİK: Fender Stratocaster: 700-1.000 EUR (36.000-52.000 TL)

İkinci el ≈ yeni fiyatın %50-75'i.
Fiyatı EUR olarak hesapla, 1 EUR ≈ 52 TL ile çevir.
Sonucu TL olarak "estimatedTL" alanında döndür.`
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, categoryName, categorySlug, condition, city, checklistData } = body

    if (!title || !categoryName) {
      return NextResponse.json({ error: 'Başlık ve kategori gerekli' }, { status: 400 })
    }

    const checklistText = checklistData 
      ? Object.entries(checklistData).map(([k, v]) => `${k}: ${v}`).join(', ')
      : 'Yok'

    // Ülke tespiti
    const country = getCountryFromCity(city || 'İzmir')
    const isTurkey = country === 'TR'

    // Kategori tespiti
    const slug = categorySlug || ''
    const titleLower = title.toLowerCase()
    const isVehicle = slug === 'oto-yedek-parca' || slug === 'otomobil' || slug === 'oto-moto' ||
      !!titleLower.match(/bmw|mercedes|audi|volkswagen|toyota|honda|renault|fiat|araba|otomobil|araç|suv|sedan|ford|opel|hyundai|kia|volvo|peugeot|citroen|skoda|mazda|nissan|tesla/)
    const isRealEstate = slug === 'gayrimenkul' || slug === 'emlak' ||
      !!titleLower.match(/daire|ev |konut|arsa|villa|residence|apartman|m²|metrekare/)

    // Ülke bazlı referans fiyatları al
    const referenceText = getReferencePrompt(country, isVehicle, isRealEstate)

    // Ürün türüne göre prompt
    let typeContext = ''
    if (isVehicle) {
      typeContext = `Bu bir ARAÇ/OTOMOBİL. Marka, model, yıl, yakıt ve kilometreyi dikkate al.`
    } else if (isRealEstate) {
      typeContext = `Bu bir GAYRİMENKUL. Şehir, ilçe, m², oda sayısı ve bina yaşını dikkate al.`
    }

    const prompt = `${typeContext}

Ürün: ${title}
Açıklama: ${description || 'Yok'}
Kategori: ${categoryName}
Durum: ${conditionLabels[condition] || condition}
Şehir: ${city || 'İzmir'}
Ek Bilgiler: ${checklistText}

${referenceText}

Bu ürünün PİYASA DEĞERİNİ tahmin et.
estimatedTL alanında TL cinsinden değer ver.

JSON döndür:
{
  "estimatedTL": <TL piyasa değeri>,
  "reason": "<kısa açıklama>",
  "marketInsight": "<pazar trendi>"
}
Sadece JSON.`

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

Fiyatı TL olarak ver. SADECE JSON döndür, başka metin yazma.`
      : `Sen bir ${expert.role}'sın. Avrupa 2025 güncel piyasa fiyatlarını biliyorsun.
${expert.referenceNote}
EUR fiyatı hesapla, 1 EUR = 52 TL ile çevir.
SADECE JSON döndür, başka metin yazma.`

    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.3
    })

    const responseText = response.choices[0]?.message?.content || '{}'
    let aiResult
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      aiResult = JSON.parse(cleaned)
    } catch {
      aiResult = { estimatedTL: 5000, reason: 'Tahmin yapılamadı', marketInsight: '' }
    }

    const estimatedTL = Math.max(50, aiResult.estimatedTL || 5000)

    // ═══ FORMÜLLE VALOR HESAPLA ═══
    let checklistObj: Record<string, any> = {}
    try {
      checklistObj = typeof checklistData === 'string' ? JSON.parse(checklistData) : (checklistData || {})
    } catch { checklistObj = {} }

    const valorCalc = calculateValorPrice({
      estimatedTL,
      condition: condition || 'good',
      city: city || 'İzmir',
      categorySlug: categorySlug || 'default',
      checklistData: checklistObj,
    })

    return NextResponse.json({
      valorPrice: valorCalc.valorPrice,
      estimatedTL,
      reason: aiResult.reason || 'AI tarafından hesaplandı',
      marketInsight: aiResult.marketInsight || '',
      formula: valorCalc.breakdown.formula,
      breakdown: valorCalc.breakdown,
      country,
    })

  } catch (error) {
    console.error('Valor calculate error:', error)
    return NextResponse.json({ error: 'Valor hesaplanamadı' }, { status: 500 })
  }
}
