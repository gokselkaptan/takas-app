// ═══════════════════════════════════════════════════════════════
// VALOR EKONOMİK DEĞERLEME MOTORU
// ═══════════════════════════════════════════════════════════════

import prisma from '@/lib/db'
import { analyzeCategoryDemand } from '@/lib/demand-pricing'

// ═══ REFERANS ENDEKS SEPETİ ═══

interface EconomicIndices {
  goldPerOunce: number       // Altın / ONS (USD)
  wheatIndex: number         // Buğday endeksi (USD/ton)
  oliveOilIndex: number      // Zeytinyağı endeksi (USD/ton)
  consumerPriceIndex: number // TÜFE (baz: 100)
  usdTryRate: number         // USD/TRY kuru
  fetchedAt: Date
}

// Referans değerler (baz tarih: Ocak 2025)
const BASE_INDICES: EconomicIndices = {
  goldPerOunce: 2650,        // Ocak 2025 altın fiyatı
  wheatIndex: 220,           // Buğday (USD/ton)
  oliveOilIndex: 8500,       // Zeytinyağı (USD/ton)
  consumerPriceIndex: 100,   // Baz TÜFE
  usdTryRate: 35.5,          // USD/TRY Ocak 2025
  fetchedAt: new Date('2025-01-01')
}

// ═══ PARA BİRİMİ KURLARI (Baz: TRY) ═══
interface CurrencyRates {
  TRY: number  // Referans = 1
  EUR: number  // 1 TRY = X EUR
  USD: number  // 1 TRY = X USD
  GBP: number  // 1 TRY = X GBP
  fetchedAt: Date
}

const BASE_CURRENCY_RATES: CurrencyRates = {
  TRY: 1,
  EUR: 0.026,     // 1 TRY ≈ 0.026 EUR (Şubat 2026 tahmini)
  USD: 0.028,     // 1 TRY ≈ 0.028 USD
  GBP: 0.022,     // 1 TRY ≈ 0.022 GBP
  fetchedAt: new Date('2026-01-01')
}

// Güncel kurları al (DB'den veya varsayılan)
async function getCurrencyRates(): Promise<CurrencyRates> {
  try {
    const stored = await prisma.systemMetrics.findUnique({
      where: { id: 'currency_rates' }
    })
    if (stored?.data) {
      const rates = JSON.parse(stored.data)
      if (Date.now() - new Date(rates.fetchedAt).getTime() < 24 * 60 * 60 * 1000) {
        return rates
      }
    }
  } catch {}
  return BASE_CURRENCY_RATES
}

// Kur güncelleme (Admin/Cron)
export async function updateCurrencyRates(rates: Partial<CurrencyRates>): Promise<void> {
  const current = await getCurrencyRates()
  const updated = { ...current, ...rates, fetchedAt: new Date() }
  await prisma.systemMetrics.upsert({
    where: { id: 'currency_rates' },
    update: { data: JSON.stringify(updated), lastUpdated: new Date() },
    create: { id: 'currency_rates', data: JSON.stringify(updated), lastUpdated: new Date() }
  })
}

// ═══ AVRUPA ENDEKS SİSTEMİ ═══
// Eurostat HICP bazlı (Harmonised Index of Consumer Prices)

interface EuropeanIndices {
  hicpEurozone: number      // Euro bölgesi HICP (baz: 100)
  energyIndex: number       // Enerji endeksi
  foodIndexEU: number       // AB gıda endeksi
  fetchedAt: Date
}

const BASE_EUROPEAN_INDICES: EuropeanIndices = {
  hicpEurozone: 100,
  energyIndex: 100,
  foodIndexEU: 100,
  fetchedAt: new Date('2026-01-01')
}

// Avrupa bölgesel çarpanlar (yaşam maliyeti endeksi bazlı)
const EUROPEAN_REGIONAL_MULTIPLIERS: Record<string, {
  region: string
  country: string
  multiplier: number
  costOfLivingIndex: number
  currency: 'EUR' | 'GBP' | 'USD'
  vatRate: number
}> = {
  'barcelona': { region: 'Barcelona', country: 'ES', multiplier: 1.10, costOfLivingIndex: 110, currency: 'EUR', vatRate: 0.21 },
  'madrid':    { region: 'Madrid', country: 'ES', multiplier: 1.12, costOfLivingIndex: 112, currency: 'EUR', vatRate: 0.21 },
  'valencia':  { region: 'Valencia', country: 'ES', multiplier: 1.00, costOfLivingIndex: 100, currency: 'EUR', vatRate: 0.21 },
  'paris':     { region: 'Paris', country: 'FR', multiplier: 1.25, costOfLivingIndex: 125, currency: 'EUR', vatRate: 0.20 },
  'lyon':      { region: 'Lyon', country: 'FR', multiplier: 1.08, costOfLivingIndex: 108, currency: 'EUR', vatRate: 0.20 },
  'berlin':    { region: 'Berlin', country: 'DE', multiplier: 1.10, costOfLivingIndex: 110, currency: 'EUR', vatRate: 0.19 },
  'munich':    { region: 'München', country: 'DE', multiplier: 1.22, costOfLivingIndex: 122, currency: 'EUR', vatRate: 0.19 },
  'milan':     { region: 'Milano', country: 'IT', multiplier: 1.15, costOfLivingIndex: 115, currency: 'EUR', vatRate: 0.22 },
  'rome':      { region: 'Roma', country: 'IT', multiplier: 1.08, costOfLivingIndex: 108, currency: 'EUR', vatRate: 0.22 },
  'amsterdam': { region: 'Amsterdam', country: 'NL', multiplier: 1.20, costOfLivingIndex: 120, currency: 'EUR', vatRate: 0.21 },
  'brussels':  { region: 'Bruxelles', country: 'BE', multiplier: 1.12, costOfLivingIndex: 112, currency: 'EUR', vatRate: 0.21 },
  'lisbon':    { region: 'Lisboa', country: 'PT', multiplier: 0.95, costOfLivingIndex: 95, currency: 'EUR', vatRate: 0.23 },
  'london':    { region: 'London', country: 'GB', multiplier: 1.30, costOfLivingIndex: 130, currency: 'GBP', vatRate: 0.20 },
  'manchester':{ region: 'Manchester', country: 'GB', multiplier: 1.05, costOfLivingIndex: 105, currency: 'GBP', vatRate: 0.20 },
  'zurich':    { region: 'Zürich', country: 'CH', multiplier: 1.45, costOfLivingIndex: 145, currency: 'EUR', vatRate: 0.077 },
  'vienna':    { region: 'Wien', country: 'AT', multiplier: 1.12, costOfLivingIndex: 112, currency: 'EUR', vatRate: 0.20 },
  'athens':    { region: 'Atina', country: 'GR', multiplier: 0.90, costOfLivingIndex: 90, currency: 'EUR', vatRate: 0.24 },
}

// Türkiye bölgesel çarpanlar (genişletilmiş)
const TURKEY_REGIONAL_MULTIPLIERS: Record<string, {
  region: string
  multiplier: number
  costOfLivingIndex: number
}> = {
  'istanbul':    { region: 'İstanbul', multiplier: 1.15, costOfLivingIndex: 115 },
  'ankara':      { region: 'Ankara', multiplier: 1.05, costOfLivingIndex: 105 },
  'izmir':       { region: 'İzmir', multiplier: 1.00, costOfLivingIndex: 100 },
  'antalya':     { region: 'Antalya', multiplier: 1.02, costOfLivingIndex: 102 },
  'bursa':       { region: 'Bursa', multiplier: 0.95, costOfLivingIndex: 95 },
  'adana':       { region: 'Adana', multiplier: 0.90, costOfLivingIndex: 90 },
  'gaziantep':   { region: 'Gaziantep', multiplier: 0.88, costOfLivingIndex: 88 },
  'konya':       { region: 'Konya', multiplier: 0.88, costOfLivingIndex: 88 },
  'trabzon':     { region: 'Trabzon', multiplier: 0.85, costOfLivingIndex: 85 },
  'diyarbakir':  { region: 'Diyarbakır', multiplier: 0.82, costOfLivingIndex: 82 },
  'mersin':      { region: 'Mersin', multiplier: 0.90, costOfLivingIndex: 90 },
  'kayseri':     { region: 'Kayseri', multiplier: 0.85, costOfLivingIndex: 85 },
  'eskisehir':   { region: 'Eskişehir', multiplier: 0.92, costOfLivingIndex: 92 },
  'mugla':       { region: 'Muğla', multiplier: 0.98, costOfLivingIndex: 98 },
  'denizli':     { region: 'Denizli', multiplier: 0.88, costOfLivingIndex: 88 },
}

// Endeks ağırlıkları
const INDEX_WEIGHTS = {
  gold: 0.30,       // Kararlı değer deposu
  food: 0.25,       // Temel gıda (buğday + zeytinyağı ortalaması)
  consumer: 0.25,   // Tüketici endeksi (TÜFE)
  platform: 0.20    // Platform iç verisi
}

// ═══ VALOR KURU HESAPLAMA ═══

interface ValorExchangeRate {
  rate: number              // 1 TL = X Valor
  compositeIndex: number    // Bileşik endeks değeri
  goldFactor: number        // Altın etkisi
  foodFactor: number        // Gıda etkisi  
  consumerFactor: number    // Tüketici etkisi
  platformFactor: number    // Platform etkisi
  calculatedAt: Date
  explanation: string       // İnsanlar için açıklama
}

// Mevcut endeks değerlerini al (DB'den veya varsayılan)
async function getCurrentIndices(): Promise<EconomicIndices> {
  try {
    const stored = await prisma.systemMetrics.findUnique({
      where: { id: 'economic_indices' }
    })
    if (stored?.data) {
      const indices = JSON.parse(stored.data)
      // 24 saatten eskiyse varsayılana dön
      if (Date.now() - new Date(indices.fetchedAt).getTime() < 24 * 60 * 60 * 1000) {
        return indices
      }
    }
  } catch {}
  return BASE_INDICES
}

// Platform iç verisini hesapla
async function getPlatformMetrics(): Promise<{
  avgValorPerSwap: number
  totalActiveProducts: number
  swapsLast7Days: number
  valorInflationRate: number
}> {
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const [activeProducts, recentSwaps, allSwaps] = await Promise.all([
    prisma.product.count({ where: { status: 'active' } }),
    prisma.swapRequest.count({ where: { status: 'completed', updatedAt: { gte: oneWeekAgo } } }),
    prisma.swapRequest.findMany({
      where: { status: 'completed' },
      select: { pendingValorAmount: true },
      take: 100,
      orderBy: { updatedAt: 'desc' }
    })
  ])

  const avgValor = allSwaps.length > 0
    ? allSwaps.reduce((sum, s) => sum + (s.pendingValorAmount || 0), 0) / allSwaps.length
    : 200

  // Enflasyon oranı: Son 30 gün vs önceki 30 gün ortalama valor karşılaştırması
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const [recentAvg, olderAvg] = await Promise.all([
    prisma.swapRequest.aggregate({
      where: { status: 'completed', updatedAt: { gte: thirtyDaysAgo } },
      _avg: { pendingValorAmount: true }
    }),
    prisma.swapRequest.aggregate({
      where: { status: 'completed', updatedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      _avg: { pendingValorAmount: true }
    })
  ])

  const recentVal = recentAvg._avg.pendingValorAmount || 200
  const olderVal = olderAvg._avg.pendingValorAmount || 200
  const inflationRate = olderVal > 0 ? (recentVal - olderVal) / olderVal : 0

  return {
    avgValorPerSwap: Math.round(avgValor),
    totalActiveProducts: activeProducts,
    swapsLast7Days: recentSwaps,
    valorInflationRate: Math.round(inflationRate * 100) / 100
  }
}

// Valor kurunu hesapla
export async function calculateValorExchangeRate(): Promise<ValorExchangeRate> {
  const indices = await getCurrentIndices()
  const platform = await getPlatformMetrics()

  // Her endeksin baz değere göre değişim oranı
  const goldChange = indices.goldPerOunce / BASE_INDICES.goldPerOunce
  const foodChange = (
    (indices.wheatIndex / BASE_INDICES.wheatIndex) + 
    (indices.oliveOilIndex / BASE_INDICES.oliveOilIndex)
  ) / 2
  const consumerChange = indices.consumerPriceIndex / BASE_INDICES.consumerPriceIndex
  const currencyChange = indices.usdTryRate / BASE_INDICES.usdTryRate

  // Platform faktörü: Arz/talep dengesi
  // Çok fazla ürün az takas = Valor düşmeli, tam tersi artmalı
  const supplyDemandRatio = platform.totalActiveProducts > 0 
    ? platform.swapsLast7Days / (platform.totalActiveProducts * 0.1) 
    : 1
  const platformFactor = Math.max(0.8, Math.min(1.2, supplyDemandRatio))

  // Bileşik endeks
  const compositeIndex = (
    goldChange * INDEX_WEIGHTS.gold +
    foodChange * INDEX_WEIGHTS.food +
    consumerChange * INDEX_WEIGHTS.consumer +
    platformFactor * INDEX_WEIGHTS.platform
  )

  // Kur ayarı: TL değer kaybettiyse Valor/TL oranı artar
  const currencyAdjustedIndex = compositeIndex * currencyChange

  // Baz kur: 1 TL = 1 Valor (başlangıç)
  // Endeksle ayarlı kur
  const rate = Math.round((1 / currencyAdjustedIndex) * 100) / 100

  // İnsanlar için açıklama
  const explanation = generateHumanExplanation(goldChange, foodChange, consumerChange, platformFactor, platform.valorInflationRate)

  return {
    rate,
    compositeIndex: Math.round(compositeIndex * 100) / 100,
    goldFactor: Math.round(goldChange * 100) / 100,
    foodFactor: Math.round(foodChange * 100) / 100,
    consumerFactor: Math.round(consumerChange * 100) / 100,
    platformFactor: Math.round(platformFactor * 100) / 100,
    calculatedAt: new Date(),
    explanation
  }
}

// ═══ BÖLGESEL ÇARPAN ═══

export function getRegionalMultiplier(location: string): { 
  region: string, multiplier: number, costOfLivingIndex: number, currency: string 
} {
  const normalized = location?.toLowerCase().trim() || ''
  
  // Türkiye
  for (const [key, value] of Object.entries(TURKEY_REGIONAL_MULTIPLIERS)) {
    if (normalized.includes(key)) return { ...value, currency: 'TRY' }
  }
  
  // Avrupa
  for (const [key, value] of Object.entries(EUROPEAN_REGIONAL_MULTIPLIERS)) {
    if (normalized.includes(key)) return { 
      region: value.region, 
      multiplier: value.multiplier, 
      costOfLivingIndex: value.costOfLivingIndex,
      currency: value.currency 
    }
  }
  
  return { region: 'Genel', multiplier: 1.00, costOfLivingIndex: 100, currency: 'TRY' }
}

// ═══ VALOR → YEREL PARA ÇEVİRİ FONKSİYONU ═══

export interface ValorPriceBreakdown {
  valorPrice: number
  city: string
  country: string
  localPrices: {
    TRY: number
    EUR: number
    USD: number
    GBP: number
  }
  primaryCurrency: string     // Şehre göre ana para birimi
  primaryPrice: number        // Ana para birimi cinsinden fiyat
  regionalMultiplier: number
  costOfLivingIndex: number
  demandLevel: string
  explanation: string
}

export async function getValorPriceBreakdown(
  valorPrice: number,
  city: string
): Promise<ValorPriceBreakdown> {
  const rates = await getCurrencyRates()
  const exchangeRate = await calculateValorExchangeRate()
  
  // Şehri bul — önce Türkiye, sonra Avrupa
  const normalizedCity = city?.toLowerCase().trim() || ''
  
  let region: any = null
  let country = 'TR'
  let primaryCurrency = 'TRY'
  
  // Türkiye kontrolü
  for (const [key, value] of Object.entries(TURKEY_REGIONAL_MULTIPLIERS)) {
    if (normalizedCity.includes(key)) {
      region = value
      country = 'TR'
      primaryCurrency = 'TRY'
      break
    }
  }
  
  // Avrupa kontrolü
  if (!region) {
    for (const [key, value] of Object.entries(EUROPEAN_REGIONAL_MULTIPLIERS)) {
      if (normalizedCity.includes(key)) {
        region = value
        country = value.country
        primaryCurrency = value.currency
        break
      }
    }
  }
  
  // Varsayılan: İzmir
  if (!region) {
    region = TURKEY_REGIONAL_MULTIPLIERS['izmir'] || { region: city || 'Bilinmeyen', multiplier: 1.0, costOfLivingIndex: 100 }
  }
  
  // Valor → TL çevrimi (ters hesap: valor / kur)
  const baseTLPrice = Math.round(valorPrice / exchangeRate.rate)
  
  // Bölgesel ayarlı TL fiyat
  const adjustedTLPrice = Math.round(baseTLPrice * region.multiplier)
  
  // Diğer para birimlerine çevir
  const localPrices = {
    TRY: adjustedTLPrice,
    EUR: Math.round(adjustedTLPrice * rates.EUR * 100) / 100,
    USD: Math.round(adjustedTLPrice * rates.USD * 100) / 100,
    GBP: Math.round(adjustedTLPrice * rates.GBP * 100) / 100,
  }
  
  // Ana para birimi fiyatı
  const primaryPrice = localPrices[primaryCurrency as keyof typeof localPrices] || localPrices.TRY
  
  // Talep bilgisi
  const demandAnalysis = await analyzeCategoryDemand()
  const avgDemand = demandAnalysis.globalStats.avgDemandScore
  const demandLevel = avgDemand > 65 ? '🔥 Yüksek' : avgDemand < 35 ? '❄️ Düşük' : '⚖️ Normal'

  // İnsan açıklaması
  const currencySymbols: Record<string, string> = { TRY: '₺', EUR: '€', USD: '$', GBP: '£' }
  const explanation = `Bu ürün ${region.region} bölgesinde yaklaşık ${primaryPrice} ${currencySymbols[primaryCurrency]} değerinde. ` +
    `Yaşam maliyeti endeksi: ${region.costOfLivingIndex}. Talep: ${demandLevel}.`

  return {
    valorPrice,
    city: region.region || city,
    country,
    localPrices,
    primaryCurrency,
    primaryPrice,
    regionalMultiplier: region.multiplier,
    costOfLivingIndex: region.costOfLivingIndex,
    demandLevel,
    explanation,
  }
}

// ═══ ENFLASYON CONTROL — Sistem İçi Valor Enflasyonu ═══

export async function getInflationCorrection(): Promise<number> {
  const platform = await getPlatformMetrics()
  
  // Enflasyon %5'ten fazlaysa düzeltme uygula
  if (platform.valorInflationRate > 0.05) {
    // Deflasyonist baskı — yeni ürünlerin Valor'unu hafif düşür
    return Math.max(0.90, 1 - (platform.valorInflationRate - 0.05))
  }
  // Deflasyon %5'ten fazlaysa düzeltme uygula
  if (platform.valorInflationRate < -0.05) {
    // Enflasyonist destek — yeni ürünlerin Valor'unu hafif artır
    return Math.min(1.10, 1 + Math.abs(platform.valorInflationRate + 0.05))
  }
  return 1.0 // Stabil
}

// ═══ KATEGORİ BAZLI REFERANS FİYATLAR (TL) ═══

const CATEGORY_BASE_PRICES_TL: Record<string, { min: number; max: number }> = {
  'Elektronik':      { min: 500, max: 50000 },
  'Telefon':         { min: 1000, max: 40000 },
  'Bilgisayar':      { min: 2000, max: 60000 },
  'Giyim':           { min: 50, max: 3000 },
  'Ayakkabı':        { min: 100, max: 5000 },
  'Ev Eşyası':       { min: 100, max: 20000 },
  'Beyaz Eşya':      { min: 2000, max: 30000 },
  'Mobilya':         { min: 500, max: 25000 },
  'Mutfak':          { min: 50, max: 5000 },
  'Kitap':           { min: 20, max: 500 },
  'Spor':            { min: 100, max: 10000 },
  'Bebek':           { min: 50, max: 5000 },
  'Oyuncak':         { min: 30, max: 2000 },
  'Hobi':            { min: 50, max: 5000 },
  'Müzik':           { min: 200, max: 15000 },
  'Bahçe':           { min: 50, max: 3000 },
  'Evcil Hayvan':    { min: 30, max: 2000 },
  'Oto':             { min: 100, max: 10000 },
  'Aksesuar':        { min: 30, max: 3000 },
  'Saat':            { min: 100, max: 20000 },
  'default':         { min: 50, max: 5000 },
}

// ═══ ANA DEĞERLEME FONKSİYONU ═══

export interface ValorAssessment {
  valorPrice: number
  breakdown: {
    baseValueTL: number
    valorRate: number
    rawValor: number
    conditionMultiplier: number
    demandMultiplier: number
    regionalMultiplier: number
    inflationCorrection: number
    finalValor: number
  }
  marketContext: {
    goldTrend: string
    foodTrend: string
    demandLevel: string
    inflationStatus: string
    region: string
  }
  humanExplanation: string
  formula: string
  confidence: 'high' | 'medium' | 'low'
}

export async function assessValorPrice(
  estimatedPriceTL: number,
  categoryName: string,
  condition: string,
  location?: string
): Promise<ValorAssessment> {
  // 1. Valor kuru
  const exchangeRate = await calculateValorExchangeRate()
  
  // 2. Durum çarpanı
  const conditionMultipliers: Record<string, number> = {
    'new': 1.0,
    'likeNew': 0.85,
    'good': 0.70,
    'fair': 0.50,
    'poor': 0.30,
  }
  const conditionMult = conditionMultipliers[condition] || 0.7

  // 3. Talep çarpanı
  const demandAnalysis = await analyzeCategoryDemand()
  const categoryDemand = demandAnalysis.categories.find(
    c => c.categoryName.toLowerCase().includes(categoryName.toLowerCase())
  )
  const demandMult = categoryDemand?.priceMultiplier || 1.0

  // 4. Bölge çarpanı
  const regional = getRegionalMultiplier(location || '')

  // 5. Enflasyon düzeltmesi
  const inflationCorr = await getInflationCorrection()

  // 6. Hesaplama
  const rawValor = estimatedPriceTL * exchangeRate.rate
  const finalValor = Math.round(
    rawValor * conditionMult * demandMult * regional.multiplier * inflationCorr
  )

  // 7. Min/Max sınır (kategoriye göre)
  const catPrices = CATEGORY_BASE_PRICES_TL[categoryName] || CATEGORY_BASE_PRICES_TL['default']
  const minValor = Math.round(catPrices.min * exchangeRate.rate * 0.3) // En düşük durum
  const maxValor = Math.round(catPrices.max * exchangeRate.rate * 1.3) // En yüksek talep
  const clampedValor = Math.max(10, Math.min(maxValor, Math.max(minValor, finalValor)))

  // 8. İnsan açıklaması
  const humanExplanation = generateValorExplanation(
    estimatedPriceTL, clampedValor, conditionMult, demandMult, 
    regional, inflationCorr, exchangeRate
  )

  // 9. Formül string
  const formula = `${estimatedPriceTL}₺ × ${exchangeRate.rate} kur × ${conditionMult} durum × ${demandMult.toFixed(2)} talep × ${regional.multiplier} bölge × ${inflationCorr} enflasyon = ${clampedValor} Valor`

  return {
    valorPrice: clampedValor,
    breakdown: {
      baseValueTL: estimatedPriceTL,
      valorRate: exchangeRate.rate,
      rawValor: Math.round(rawValor),
      conditionMultiplier: conditionMult,
      demandMultiplier: demandMult,
      regionalMultiplier: regional.multiplier,
      inflationCorrection: inflationCorr,
      finalValor: clampedValor,
    },
    marketContext: {
      goldTrend: exchangeRate.goldFactor > 1.02 ? '📈 Yükseliyor' : exchangeRate.goldFactor < 0.98 ? '📉 Düşüyor' : '➡️ Stabil',
      foodTrend: exchangeRate.foodFactor > 1.05 ? '📈 Yükseliyor' : '➡️ Stabil',
      demandLevel: (categoryDemand?.demandScore || 50) > 65 ? '🔥 Yüksek talep' : (categoryDemand?.demandScore || 50) < 35 ? '❄️ Düşük talep' : '⚖️ Normal',
      inflationStatus: inflationCorr < 0.95 ? '⚠️ Valor enflasyonu (düzeltme uygulandı)' : inflationCorr > 1.05 ? '📉 Valor deflasyonu (destek uygulandı)' : '✅ Stabil',
      region: regional.region,
    },
    humanExplanation,
    formula,
    confidence: estimatedPriceTL > 0 ? 'high' : 'medium',
  }
}

// ═══ İNSAN DOSTU AÇIKLAMALAR ═══

function generateHumanExplanation(
  goldChange: number, foodChange: number, consumerChange: number,
  platformFactor: number, inflationRate: number
): string {
  const parts: string[] = []
  
  if (goldChange > 1.05) parts.push('Altın fiyatları yükseldi, değerli eşyalar daha kıymetli')
  if (foodChange > 1.05) parts.push('Gıda endeksi arttı, temel ihtiyaç ürünleri değerlendi')
  if (consumerChange > 1.05) parts.push('Tüketici fiyatları yükseldi')
  if (platformFactor > 1.1) parts.push('Platformda yüksek takas aktivitesi var')
  if (platformFactor < 0.9) parts.push('Platformda takas aktivitesi düşük')
  if (inflationRate > 0.05) parts.push('Valor enflasyonu tespit edildi, fiyatlar dengeleniyor')
  
  return parts.length > 0 ? parts.join('. ') + '.' : 'Piyasa koşulları stabil.'
}

function generateValorExplanation(
  priceTL: number, valor: number, condMult: number, demandMult: number,
  regional: { region: string, multiplier: number, costOfLivingIndex: number, currency: string }, 
  inflCorr: number, rate: ValorExchangeRate
): string {
  const condLabel = condMult >= 0.85 ? 'çok iyi' : condMult >= 0.7 ? 'iyi' : condMult >= 0.5 ? 'orta' : 'düşük'
  const demandLabel = demandMult > 1.1 ? 'yüksek talep (+%' + Math.round((demandMult-1)*100) + ')' 
    : demandMult < 0.9 ? 'düşük talep (-%' + Math.round((1-demandMult)*100) + ')'
    : 'normal talep'
  
  return `Bu ürünün tahmini piyasa değeri ~${priceTL}₺. ` +
    `Ürün durumu ${condLabel}. ` +
    `Kategoride ${demandLabel}. ` +
    `${regional.region} bölgesinde yaşam maliyeti endeksi: ${regional.costOfLivingIndex}. ` +
    `Sonuç: ${valor} Valor.`
}

// ═══ ENDEKS GÜNCELLEME (Admin/Cron) ═══

export async function updateEconomicIndices(indices: Partial<EconomicIndices>): Promise<void> {
  const current = await getCurrentIndices()
  const updated = { ...current, ...indices, fetchedAt: new Date() }
  
  await prisma.systemMetrics.upsert({
    where: { id: 'economic_indices' },
    update: { data: JSON.stringify(updated), lastUpdated: new Date() },
    create: { id: 'economic_indices', data: JSON.stringify(updated), lastUpdated: new Date() }
  })
}
