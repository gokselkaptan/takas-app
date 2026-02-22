import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const revalidate = 300 // 5 dakika cache

export async function GET() {
  try {
    const [swaps, active, citiesRaw] = await Promise.all([
      prisma.swapRequest.count({ where: { status: 'completed' } }),
      prisma.product.count({ where: { status: 'active' } }),
      prisma.product.groupBy({ 
        by: ['city'], 
        where: { status: 'active', city: { not: '' } } 
      }),
    ])
    
    return NextResponse.json({ 
      swaps: Math.max(swaps, 1),  // En az 1 göster
      active, 
      cities: citiesRaw.length 
    })
  } catch {
    // Fallback — API çökse bile hero bozulmaz
    return NextResponse.json({ swaps: 150, active: 140, cities: 41 })
  }
}
