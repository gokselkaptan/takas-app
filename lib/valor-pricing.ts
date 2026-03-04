// ═══════════════════════════════════════════
// VALOR FİYATLAMA MOTORU
// Formül: Valor = TL × Kur × Durum × Talep × Bölge × Enflasyon
// ═══════════════════════════════════════════

// ═══ AYLIK GÜNCELLENEBİLİR CONFIG ═══
export const MONTHLY_CONFIG = {
  updatedAt: '2025-02-01',
  inflationMultiplier: 1.025,
  goldPriceTL: 3250,
  baseValorRate: 0.14,
  displayRate: 50, // Kullanıcıya "1V ≈ 50TL" göster
}

// ═══ DURUM ÇARPANLARI ═══
export const CONDITION_MULTIPLIERS: Record<string, number> = {
  'new': 1.0,
  'likeNew': 0.85,
  'good': 0.70,
  'fair': 0.50,
  'poor': 0.30,
}

// ═══ BÖLGE ÇARPANLARI ═══
export const REGION_MULTIPLIERS: Record<string, number> = {
  // Türkiye
  'İstanbul': 1.15, 'Istanbul': 1.15,
  'İzmir': 1.00, 'Izmir': 1.00,
  'Ankara': 1.05,
  'Antalya': 1.02,
  'Bursa': 0.95,
  'Konya': 0.88,
  'Adana': 0.90,
  'Gaziantep': 0.85,
  // Avrupa
  'Barcelona': 1.10,
  'Madrid': 1.08,
  'London': 1.20,
  'Berlin': 1.08,
  'Paris': 1.18,
  'Amsterdam': 1.12,
  'Roma': 1.05, 'Rome': 1.05,
  'Milano': 1.12, 'Milan': 1.12,
  'Lizbon': 0.95, 'Lisbon': 0.95,
  // Varsayılan
  'default': 1.00,
}

// ═══ KATEGORİ TALEP ÇARPANLARI ═══
export const CATEGORY_DEMAND_MULTIPLIERS: Record<string, number> = {
  'elektronik': 1.15,
  'giyim': 0.90,
  'ev-yasam': 1.00,
  'spor-outdoor': 1.05,
  'kitaplar': 0.75,
  'oyuncaklar': 0.85,
  'oto-yedek-parca': 1.10,
  'otomobil': 1.20,
  'gayrimenkul': 1.25,
  'bebek-cocuk': 0.95,
  'taki-aksesuar': 1.10,
  'mutfak': 0.95,
  'bahce': 0.90,
  'beyaz-esya': 1.00,
  'evcil-hayvan': 0.85,
  'default': 1.00,
}

// ═══ OTOMOBİL ÇARPANLARI ═══
export const MILEAGE_MULTIPLIERS: Record<string, number> = {
  '0-50.000 km': 1.00,
  '50.000-100.000 km': 0.90,
  '100.000-150.000 km': 0.80,
  '150.000-200.000 km': 0.70,
  '200.000+ km': 0.60,
}

export const VEHICLE_YEAR_MULTIPLIERS: Record<string, number> = {
  '2024-2025': 1.00,
  '2022-2023': 0.85,
  '2020-2021': 0.75,
  '2018-2019': 0.65,
  '2015-2017': 0.55,
  '2012-2014': 0.45,
  '2010-2011': 0.38,
  '2010 öncesi': 0.30,
}

// ═══ ÜLKE TESPİTİ ═══
export function getCountryFromCity(city: string): 'TR' | 'ES' | 'UK' | 'DE' | 'FR' | 'IT' | 'PT' | 'NL' | 'EU' {
  const turkishCities = ['İstanbul', 'Istanbul', 'İzmir', 'Izmir', 'Ankara', 'Antalya', 'Bursa', 'Konya', 'Adana', 'Gaziantep', 'Mersin', 'Kayseri', 'Eskişehir', 'Trabzon', 'Samsun', 'Denizli', 'Diyarbakır', 'Muğla', 'Manisa', 'Balıkesir']
  const spanishCities = ['Barcelona', 'Madrid', 'Valencia', 'Sevilla', 'Malaga', 'Bilbao', 'Zaragoza']
  const ukCities = ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Liverpool', 'Bristol']
  const germanCities = ['Berlin', 'München', 'Munich', 'Hamburg', 'Frankfurt', 'Köln', 'Cologne', 'Stuttgart', 'Düsseldorf']
  const frenchCities = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Bordeaux', 'Lille']
  const italianCities = ['Roma', 'Rome', 'Milano', 'Milan', 'Napoli', 'Torino', 'Firenze', 'Bologna']
  const portugueseCities = ['Lizbon', 'Lisbon', 'Porto', 'Faro']
  const dutchCities = ['Amsterdam', 'Rotterdam', 'Utrecht', 'Den Haag']

  if (turkishCities.some(c => city.includes(c))) return 'TR'
  if (spanishCities.some(c => city.includes(c))) return 'ES'
  if (ukCities.some(c => city.includes(c))) return 'UK'
  if (germanCities.some(c => city.includes(c))) return 'DE'
  if (frenchCities.some(c => city.includes(c))) return 'FR'
  if (italianCities.some(c => city.includes(c))) return 'IT'
  if (portugueseCities.some(c => city.includes(c))) return 'PT'
  if (dutchCities.some(c => city.includes(c))) return 'NL'
  return 'TR' // Varsayılan Türkiye
}

// ═══ ANA HESAPLAMA ═══
export function calculateValorPrice(params: {
  estimatedTL: number
  condition: string
  city: string
  categorySlug: string
  checklistData?: Record<string, any>
}): {
  valorPrice: number
  breakdown: {
    estimatedTL: number
    baseRate: number
    conditionMultiplier: number
    demandMultiplier: number
    regionMultiplier: number
    inflationMultiplier: number
    formula: string
    simpleFormula: string
  }
} {
  const { estimatedTL, condition, city, categorySlug, checklistData } = params

  const conditionMult = CONDITION_MULTIPLIERS[condition] || 0.70
  const demandMult = CATEGORY_DEMAND_MULTIPLIERS[categorySlug] || 1.00
  const regionMult = REGION_MULTIPLIERS[city] || REGION_MULTIPLIERS['default']
  const inflationMult = MONTHLY_CONFIG.inflationMultiplier
  const realRate = MONTHLY_CONFIG.baseValorRate * inflationMult

  // Otomobil ekstra çarpanları
  let extraMult = 1.0
  if (checklistData?.mileage && MILEAGE_MULTIPLIERS[checklistData.mileage]) {
    extraMult *= MILEAGE_MULTIPLIERS[checklistData.mileage]
  }
  if (checklistData?.modelYear && VEHICLE_YEAR_MULTIPLIERS[checklistData.modelYear]) {
    extraMult *= VEHICLE_YEAR_MULTIPLIERS[checklistData.modelYear]
  }
  if (checklistData?.hasAccidentRecord === true) {
    extraMult *= 0.80
  }

  const rawValor = estimatedTL * realRate * conditionMult * demandMult * regionMult * extraMult
  const valorPrice = Math.max(10, Math.round(rawValor / 10) * 10)

  return {
    valorPrice,
    breakdown: {
      estimatedTL,
      baseRate: realRate,
      conditionMultiplier: conditionMult,
      demandMultiplier: demandMult,
      regionMultiplier: regionMult,
      inflationMultiplier: inflationMult,
      simpleFormula: `${estimatedTL.toLocaleString('tr-TR')}₺ ÷ ${MONTHLY_CONFIG.displayRate} ≈ ${Math.round(estimatedTL / MONTHLY_CONFIG.displayRate).toLocaleString('tr-TR')} V`,
      formula: `${estimatedTL.toLocaleString('tr-TR')}₺ × ${realRate.toFixed(4)} kur × ${conditionMult} durum × ${demandMult} talep × ${regionMult} bölge${extraMult !== 1.0 ? ` × ${extraMult.toFixed(2)} araç` : ''} = ${valorPrice.toLocaleString('tr-TR')} V`
    }
  }
}
