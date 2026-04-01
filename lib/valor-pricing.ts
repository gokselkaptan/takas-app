// ============ VALOR HESAPLAMA SİSTEMİ v2 ============

// === 1. KATEGORİ UZMAN PERSONA'LARI ===
export const CATEGORY_EXPERTS: Record<string, { role: string; referenceNote: string }> = {
  'Gayrimenkul': {
    role: 'Kıdemli Emlak Değerleme Uzmanı',
    referenceNote: 'Sahibinden.com, Hepsiemlak, bölgesel m² fiyatları, kat, cephe, yapı yaşı referans al.'
  },
  'Oto & Moto': {
    role: 'Oto Ekspertiz ve Değerleme Uzmanı',
    referenceNote: 'Sahibinden araç ilanları, km, yıl, hasar kaydı, tramer, yakıt tipi, vites, marka/model bazlı ikinci el fiyat referans al. 2026 Türkiye ikinci el araç fiyat aralıkları: küçük araçlar (Fiat Egea, Renault Clio, Volkswagen Polo) 400.000-700.000₺, orta segment (Renault Megane, Honda Civic, Toyota Corolla) 600.000-1.200.000₺, üst segment (BMW 3 Serisi, Mercedes C Serisi, Audi A4) 1.500.000-3.500.000₺, SUV/Crossover (Dacia Duster, Nissan Qashqai, Toyota RAV4) 700.000-2.500.000₺, motosiklet 100.000-500.000₺, ticari araç (minibüs, kamyonet) 500.000-2.000.000₺. Yaş düzeltmesi: 2015-2020 model araçlar baz fiyatın %75-90\'ı, 2010-2015 arası %60-75\'i, 2005-2010 arası %40-60\'ı, 2005 öncesi %20-40\'ı. Km düzeltmesi: 200.000km+ araçlarda %20 indirim uygula, 100.000km altı araçlarda %10 prim ekle. Hasar/tramer kaydı varsa %15-25 ek indirim. LPG dönüşümlü araçlarda %5-10 indirim. Komple boya %5-10 indirim (kaza geçmişi şüphesi).'
  },
  'Tekne & Denizcilik': {
    role: 'Denizcilik ve Tekne Değerleme Uzmanı',
    referenceNote: 'Sahibinden tekne ilanları, motor saati, tekne boyu, motor tipi, bakım durumu, marina fiyatları referans al.'
  },
  'Beyaz Esya': {
    role: 'Beyaz Eşya ve Ev Aletleri Piyasa Analisti',
    referenceNote: 'Trendyol, Hepsiburada, MediaMarkt fiyatları, marka/model bazlı sıfır ve ikinci el karşılaştırması yap.'
  },
  'Elektronik': {
    role: 'Elektronik ve Teknoloji Değerleme Uzmanı',
    referenceNote: 'Laptop, telefon, tablet için Hepsiburada, Trendyol, Apple/Samsung resmi fiyatlar, ikinci el için Letgo/Dolap referans al. Model yılı, RAM, depolama, işlemci detayları kritik.'
  },
  'Ev & Yasam': {
    role: 'Ev Tekstili ve Dekorasyon Uzmanı',
    referenceNote: 'Marka değeri, kumaş kalitesi, el yapımı/fabrikasyon ayrımı, set/tekil fiyat farkı dikkate al.'
  },
  'Giyim': {
    role: 'Moda ve Tekstil Değerleme Uzmanı',
    referenceNote: 'Marka değeri, sezon uygunluğu, vintage/koleksiyon değeri, durum ve beden dikkate al.'
  },
  'Bahce': {
    role: 'Bahçe ve Hobi Uzmanı',
    referenceNote: 'Mevsimsel fiyat dalgalanmaları, fidan yaşı, makine gücü, marka referans al.'
  },
  'Kitap & Hobi': {
    role: 'Koleksiyon ve Antika Değerleme Uzmanı',
    referenceNote: 'Baskı yılı, nadir eser durumu, yazarın popülerliği, cilt durumu dikkate al.'
  },
  'Spor & Outdoor': {
    role: 'Spor Ekipman Uzmanı',
    referenceNote: 'Profesyonel/amatör seviye, marka (Decathlon vs premium), kullanım ömrü dikkate al.'
  },
  'Çocuk & Bebek': {
    role: 'Çocuk Ürünleri Uzmanı',
    referenceNote: 'Bebek arabası, oyuncak, giyim fiyatları Trendyol/Hepsiburada referanslı. 2026 TR: bebek arabası 5.000-50.000₺, oyuncak 200-5.000₺, bebek kıyafet seti 500-3.000₺'
  },
  'Oyuncak': {
    role: 'Oyuncak Uzmanı',
    referenceNote: 'Trendyol, Hepsiburada oyuncak fiyatları. 2026 TR: Lego set 500-5.000₺, peluş 200-1.500₺, puzzle 200-1.000₺'
  },
  'Evcil Hayvan': {
    role: 'Evcil Hayvan Ürünleri Uzmanı',
    referenceNote: 'Petshop fiyatları. 2026 TR: mama 500-3.000₺, kafes 1.000-10.000₺, oyuncak 100-1.000₺'
  },
  'Antika & Koleksiyon': {
    role: 'Antika Uzmanı',
    referenceNote: 'Antika ve koleksiyon eşya fiyatları. 2026 TR: değişken, 1.000-100.000₺+'
  },
  'default': {
    role: 'Genel Piyasa Değerleme Uzmanı',
    referenceNote: 'Sahibinden.com, Letgo, Dolap.com ikinci el fiyatlarını referans al.'
  }
}

// === 2. ENDEKS SEPETİ ===
export const INDEX_WEIGHTS = {
  gold: 0.25,        // Altın (XAU/TRY)
  inflation: 0.20,   // TÜFE Enflasyon
  sector: 0.20,      // Sektör bazlı endeks
  crypto: 0.10,      // BTC endeksi
  ppp: 0.15,         // Satın Alma Gücü Paritesi
  supplyDemand: 0.10 // Platform iç arz-talep
}

// Sektör endeks çarpanları (baz: 1.0 = normal piyasa)
export const SECTOR_INDICES: Record<string, number> = {
  'Gayrimenkul': 1.15,
  'Oto & Moto': 1.20,
  'Tekne & Denizcilik': 1.10,
  'Beyaz Esya': 1.05,
  'Elektronik': 0.95,  // Teknoloji hızlı değer kaybeder
  'Ev & Yasam': 1.00,
  'Giyim': 0.90,       // Sezonluk değer kaybı
  'Bahce': 1.00,
  'Kitap & Hobi': 1.05,
  'Spor & Outdoor': 0.95,
  'default': 1.00
}

// === 3. BÖLGESEL ÇARPANLAR ===
export const REGIONAL_MULTIPLIERS: Record<string, { multiplier: number; currency: string; exchangeRate: number }> = {
  'TR': { multiplier: 1.0, currency: 'TRY', exchangeRate: 1 },
  'EU': { multiplier: 0.45, currency: 'EUR', exchangeRate: 52 },
  'US': { multiplier: 0.40, currency: 'USD', exchangeRate: 45 },
  'UK': { multiplier: 0.42, currency: 'GBP', exchangeRate: 57 },
  'ASIA': { multiplier: 0.50, currency: 'CNY', exchangeRate: 5 },
  'LATAM': { multiplier: 0.55, currency: 'BRL', exchangeRate: 7 },
  'default': { multiplier: 1.0, currency: 'TRY', exchangeRate: 1 }
}

// === 4. DURUM ÇARPANLARI ===
export const CONDITION_MULTIPLIERS: Record<string, number> = {
  'new': 1.00,
  'likeNew': 0.85,
  'like_new': 0.85,
  'good': 0.70,
  'fair': 0.50,
  'poor': 0.30,
  'default': 0.70
}

// === 5. TALEP ÇARPANLARI ===
export const DEMAND_MULTIPLIERS: Record<string, number> = {
  'Gayrimenkul': 1.15,
  'Oto & Moto': 1.10,
  'Tekne & Denizcilik': 1.05,
  'Elektronik': 1.10,
  'Beyaz Esya': 1.00,
  'Ev & Yasam': 0.95,
  'Giyim': 0.90,
  'Bahce': 0.95,
  'Kitap & Hobi': 0.85,
  'Spor & Outdoor': 1.00,
  'default': 1.00
}

// === 6. VALOR KURU HESAPLAMA ===
export const BASE_CONFIG = {
  goldIndexTRY: 7500,      // Güncel gram altın TL (güncellenmeli)
  inflationRate: 0.45,     // Yıllık TÜFE (güncellenmeli)
  cryptoIndex: 1.05,       // BTC bazlı stabilite endeksi
  pppIndex: 1.0,           // Satın alma gücü baz
  baseValorRate: 0.10,     // 1V ≈ 10TL baz
  displayRate: 10,         // Gösterim: 1V = 10TL
  minValor: 10,
  maxValor: 100000
}

// Bölge tespiti
export function getRegionFromCity(city: string): string {
  const turkishCities = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Eskişehir', 'Bornova', 'Muğla', 'Erzurum']
  const europeanCities = ['Barcelona', 'Madrid', 'Berlin', 'Paris', 'London', 'Amsterdam', 'Roma', 'Milano', 'Londra']
  const usCities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'San Francisco']
  
  if (turkishCities.some(c => city?.toLowerCase().includes(c.toLowerCase()))) return 'TR'
  if (europeanCities.some(c => city?.toLowerCase().includes(c.toLowerCase()))) return 'EU'
  if (usCities.some(c => city?.toLowerCase().includes(c.toLowerCase()))) return 'US'
  return 'TR' // Default
}

// Ana hesaplama fonksiyonu
export function calculateValorPrice(params: {
  estimatedTL: number
  condition: string
  city: string
  categorySlug: string
  checklistData?: any
}): {
  valorPrice: number
  breakdown: {
    estimatedTL: number
    baseValor: number
    conditionMult: number
    demandMult: number
    regionMult: number
    sectorIndex: number
    finalValor: number
    displayRate: number
    formula: string
  }
} {
  const { estimatedTL, condition, city, categorySlug } = params
  
  const region = getRegionFromCity(city)
  const regionConfig = REGIONAL_MULTIPLIERS[region] || REGIONAL_MULTIPLIERS['default']
  const conditionMult = CONDITION_MULTIPLIERS[condition] || CONDITION_MULTIPLIERS['default']
  const demandMult = DEMAND_MULTIPLIERS[categorySlug] || DEMAND_MULTIPLIERS['default']
  const sectorIndex = SECTOR_INDICES[categorySlug] || SECTOR_INDICES['default']
  
  // Valor kuru hesaplama
  const valorKuru = BASE_CONFIG.baseValorRate * sectorIndex * (1 + BASE_CONFIG.inflationRate * INDEX_WEIGHTS.inflation) * BASE_CONFIG.cryptoIndex
  
  // Ham valor
  const baseValor = estimatedTL * valorKuru
  
  // Çarpanlar uygula
  const rawValor = baseValor * conditionMult * demandMult * regionConfig.multiplier
  
  // Yuvarla ve sınırla
  const finalValor = Math.max(BASE_CONFIG.minValor, Math.min(BASE_CONFIG.maxValor, Math.round(rawValor / 10) * 10))
  
  return {
    valorPrice: finalValor,
    breakdown: {
      estimatedTL,
      baseValor: Math.round(baseValor),
      conditionMult,
      demandMult,
      regionMult: regionConfig.multiplier,
      sectorIndex,
      finalValor,
      displayRate: BASE_CONFIG.displayRate,
      formula: `${estimatedTL}₺ × ${valorKuru.toFixed(4)} × ${conditionMult} × ${demandMult} × ${regionConfig.multiplier} = ${finalValor}V`
    }
  }
}

// Eski fonksiyon uyumluluğu için
export function getCountryFromCity(city: string): string {
  const region = getRegionFromCity(city)
  if (region === 'TR') return 'TR'
  if (region === 'EU') return 'EU'
  if (region === 'US') return 'US'
  return 'TR'
}