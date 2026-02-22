import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const revalidate = 60 // 1 dakika cache

export async function GET(request: NextRequest) {
  try {
    // Tüm aktif ürünlerin şehir+semt bilgisini TEK SORGUDA çek
    const products = await prisma.product.findMany({
      where: { status: 'active' },
      select: { city: true, district: true },
    })

    // Şehirleri say
    const cityMap = new Map<string, number>()
    const districtsByCityMap = new Map<string, Map<string, number>>()

    products.forEach(p => {
      const city = (p.city || '').trim()
      if (!city) return
      
      cityMap.set(city, (cityMap.get(city) || 0) + 1)
      
      const dist = (p.district || '').trim()
      if (!dist) return
      
      if (!districtsByCityMap.has(city)) {
        districtsByCityMap.set(city, new Map())
      }
      const distMap = districtsByCityMap.get(city)!
      distMap.set(dist, (distMap.get(dist) || 0) + 1)
    })

    // Şehirleri count'a göre sırala
    const cities = Array.from(cityMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    // Semtleri şehir bazında objye çevir
    const districtsByCity: Record<string, Array<{ name: string; count: number }>> = {}
    districtsByCityMap.forEach((distMap, city) => {
      districtsByCity[city] = Array.from(distMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)
    })

    return NextResponse.json({ cities, districtsByCity })
  } catch (error) {
    console.error('Filters error:', error)
    return NextResponse.json({ cities: [], districtsByCity: {} })
  }
}
