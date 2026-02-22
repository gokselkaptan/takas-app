import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { translateDeliveryPoint } from '@/lib/product-translations'
import { getCache, setCache } from '@/lib/cache'

export const dynamic = 'force-dynamic'

// Mesafe hesaplama (Haversine formülü)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Dünya'nın yarıçapı (km)
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lang = searchParams.get('lang') || 'tr'
    const district = searchParams.get('district')
    const userLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null
    const userLon = searchParams.get('lon') ? parseFloat(searchParams.get('lon')!) : null

    // Cache kontrolü (lat/lon yoksa - 10 dakika)
    if (!userLat && !userLon) {
      const cacheKey = `delivery-points-${lang}-${district || 'all'}`
      const cached = getCache(cacheKey)
      if (cached) return NextResponse.json(cached)
    }

    // Filtre oluştur
    const whereClause: { isActive: boolean; district?: string } = { isActive: true }
    if (district) {
      whereClause.district = district
    }

    const points = await prisma.deliveryPoint.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    })

    // Teslim noktalarını seçilen dile göre çevir ve mesafe ekle
    let translatedPoints = points.map((point: { id: string; name: string; address: string; district: string; nameEn?: string | null; nameEs?: string | null; nameCa?: string | null; addressEn?: string | null; addressEs?: string | null; addressCa?: string | null; latitude: number; longitude: number; isActive: boolean; hours?: string | null; phone?: string | null; image?: string | null }) => {
      const translated = {
        ...point,
        ...translateDeliveryPoint(point, lang),
        distance: userLat && userLon 
          ? calculateDistance(userLat, userLon, point.latitude, point.longitude)
          : null
      }
      return translated
    })

    // Kullanıcı konumu varsa mesafeye göre sırala
    if (userLat && userLon) {
      translatedPoints = translatedPoints.sort((a, b) => (a.distance || 0) - (b.distance || 0))
    }

    // Tüm ilçeleri de döndür (filtreleme için) - 10dk cache
    const districtsCacheKey = 'delivery-districts'
    let districts = getCache(districtsCacheKey)
    if (!districts) {
      const allDistricts = await prisma.deliveryPoint.findMany({
        where: { isActive: true },
        select: { district: true },
        distinct: ['district']
      })
      districts = allDistricts.map(d => d.district).sort()
      setCache(districtsCacheKey, districts, 600) // 10 dakika cache
    }

    const result = {
      points: translatedPoints,
      districts,
      total: translatedPoints.length
    }

    // Lat/lon yoksa sonucu cache'le (10dk)
    if (!userLat && !userLon) {
      const cacheKey = `delivery-points-${lang}-${district || 'all'}`
      setCache(cacheKey, result, 600)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Teslim noktaları getirme hatası:', error)
    return NextResponse.json(
      { error: 'Teslim noktaları getirilemedi' },
      { status: 500 }
    )
  }
}
