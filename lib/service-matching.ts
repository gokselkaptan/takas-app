// =============================================================================
// TAKAS-A Service Matching Algorithm
// Hizmet-Hizmet Eşleştirme: Karşılıklı eşleşme tespiti
// =============================================================================

import prisma from './db'

export interface ServiceMatch {
  service: any
  score: number
  isMutual: boolean
  matchReason: string
}

/**
 * Bir hizmet için eşleşen diğer hizmetleri bul
 * Karşılıklı eşleşme: A'nın teklif ettiği = B'nin aradığı VE B'nin teklif ettiği = A'nın aradığı
 */
export async function findServiceMatches(serviceId: string): Promise<ServiceMatch[]> {
  const service = await prisma.serviceListing.findUnique({
    where: { id: serviceId },
    include: { user: { select: { id: true, name: true, image: true, location: true } } }
  })
  
  if (!service || service.status !== 'active') return []
  
  // Diğer aktif hizmetleri al (kendi hizmetleri hariç)
  const otherServices = await prisma.serviceListing.findMany({
    where: {
      id: { not: serviceId },
      status: 'active',
      userId: { not: service.userId }
    },
    include: { user: { select: { id: true, name: true, image: true, location: true } } }
  })
  
  const matches: ServiceMatch[] = []
  
  for (const other of otherServices) {
    let score = 0
    let isMutual = false
    let matchReason = ''
    
    // 1. Karşılıklı eşleştirme kontrolü (%40)
    // Benim hizmet kategorim = Onun aradığı kategori
    const myServiceMatchesTheirWant = service.category === other.wantCategory
    // Onun hizmet kategorisi = Benim aradığım kategori  
    const theirServiceMatchesMyWant = other.category === service.wantCategory
    
    if (myServiceMatchesTheirWant && theirServiceMatchesMyWant) {
      score += 40
      isMutual = true
      matchReason = 'Karşılıklı kategori eşleşmesi'
    } else if (myServiceMatchesTheirWant) {
      score += 20
      matchReason = 'Sizin hizmetiniz onların aradığına uyuyor'
    } else if (theirServiceMatchesMyWant) {
      score += 20
      matchReason = 'Onların hizmeti sizin aradığınıza uyuyor'
    }
    
    // 2. VALOR dengesi kontrolü (%20)
    const valorDiff = Math.abs(service.valorPrice - other.valorPrice)
    const avgValor = (service.valorPrice + other.valorPrice) / 2
    const valorTolerance = avgValor * 0.2 // %20 tolerans
    
    if (valorDiff <= valorTolerance) {
      score += 20
    } else if (valorDiff <= avgValor * 0.4) {
      // %40 tolerans içinde kısmi puan
      score += 10
    }
    
    // 3. Konum eşleşmesi (%30)
    if (service.city && other.city) {
      if (service.city.toLowerCase() === other.city.toLowerCase()) {
        score += 30
      } else {
        // Farklı şehir, ama online hizmet olabilir
        if (service.serviceArea === 'online' || other.serviceArea === 'online') {
          score += 15
        }
      }
    } else {
      score += 10 // Konum bilgisi yoksa varsayılan bonus
    }
    
    // 4. Hizmet tipi eşleşmesi (%10)
    if (service.listingType === other.listingType) {
      score += 10
    }
    
    // En az %40 skor gerekli
    if (score >= 40) {
      matches.push({ 
        service: other, 
        score: Math.min(100, Math.round(score)), 
        isMutual,
        matchReason: matchReason || 'Genel eşleşme'
      })
    }
  }
  
  // Skora göre sırala, karşılıklı eşleşmeler önce
  return matches.sort((a, b) => {
    if (a.isMutual && !b.isMutual) return -1
    if (!a.isMutual && b.isMutual) return 1
    return b.score - a.score
  })
}

/**
 * Bir kullanıcının tüm hizmetleri için karşılıklı eşleşme sayısını hesapla
 */
export async function getUserMutualMatchCount(userId: string): Promise<number> {
  const userServices = await prisma.serviceListing.findMany({
    where: { userId, status: 'active' },
    select: { id: true }
  })
  
  let mutualCount = 0
  
  for (const service of userServices) {
    const matches = await findServiceMatches(service.id)
    mutualCount += matches.filter(m => m.isMutual).length
  }
  
  return mutualCount
}

/**
 * Belirli bir hizmet için karşılıklı eşleşme var mı kontrol et
 */
export async function hasMutualMatch(serviceId: string): Promise<boolean> {
  const matches = await findServiceMatches(serviceId)
  return matches.some(m => m.isMutual)
}

/**
 * Sistemdeki tüm karşılıklı eşleşmeleri bul
 */
export async function findAllMutualMatches(): Promise<{
  serviceA: any
  serviceB: any
  score: number
}[]> {
  const activeServices = await prisma.serviceListing.findMany({
    where: { status: 'active' },
    include: { user: { select: { id: true, name: true, image: true, location: true } } }
  })
  
  const mutualMatches: { serviceA: any; serviceB: any; score: number }[] = []
  const processedPairs = new Set<string>()
  
  for (const serviceA of activeServices) {
    const matches = await findServiceMatches(serviceA.id)
    
    for (const match of matches) {
      if (match.isMutual) {
        // Çift zaten işlendiyse atla
        const pairKey = [serviceA.id, match.service.id].sort().join('-')
        if (processedPairs.has(pairKey)) continue
        
        processedPairs.add(pairKey)
        mutualMatches.push({
          serviceA,
          serviceB: match.service,
          score: match.score
        })
      }
    }
  }
  
  return mutualMatches.sort((a, b) => b.score - a.score)
}

/**
 * Hizmet listesi için eşleşme sayılarını hesapla (batch)
 */
export async function enrichServicesWithMatchCount(services: any[]): Promise<any[]> {
  const enriched = await Promise.all(
    services.map(async (service) => {
      const matches = await findServiceMatches(service.id)
      return {
        ...service,
        matchCount: matches.length,
        mutualMatchCount: matches.filter(m => m.isMutual).length,
        topMatch: matches[0] || null
      }
    })
  )
  
  return enriched
}
