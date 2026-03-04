import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { translateCategory, translateProducts } from '@/lib/product-translations'

export const dynamic = 'force-dynamic'

// Cache stats for 30 seconds to reduce DB load - per language
const cachedStats: Record<string, any> = {}
const cacheTime: Record<string, number> = {}
const CACHE_DURATION = 30000 // 30 seconds

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lang = (searchParams.get('lang') || 'tr') as 'tr' | 'en' | 'es' | 'ca'
    
    // Return cached data if available and fresh
    const now = Date.now()
    if (cachedStats[lang] && (now - (cacheTime[lang] || 0)) < CACHE_DURATION) {
      return NextResponse.json(cachedStats[lang])
    }

    // Sequential queries to avoid connection pool exhaustion
    const productCount = await prisma.product.count({ where: { status: 'active' } }).catch(() => 0)
    const userCount = await prisma.user.count().catch(() => 0)
    const swapCount = await prisma.swapRequest.count({ where: { status: 'completed' } }).catch(() => 0)
    
    const categoryStats = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: {
        products: {
          _count: 'desc'
        }
      },
      take: 5
    }).catch(() => [])
    
    // Bugünün istatistikleri
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayProducts = await prisma.product.count({
      where: {
        createdAt: { gte: today },
        status: 'active'
      }
    }).catch(() => 0)
    
    let todaySwaps = await prisma.swapRequest.count({
      where: {
        updatedAt: { gte: today },
        status: 'completed'
      }
    }).catch(() => 0)
    
    // Simülasyon: Gerçek değer 17'nin altındaysa, asal sayı göster (19, 23)
    if (todaySwaps < 17) {
      // Güne göre tutarlı bir değer seç (her gün aynı değer)
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
      const primeNumbers = [19, 23]
      todaySwaps = primeNumbers[dayOfYear % primeNumbers.length]
    }
    
    // En popüler ürünler
    const popularProducts = await prisma.product.findMany({
      where: { status: 'active' },
      include: {
        category: true,
        _count: {
          select: { favorites: true }
        }
      },
      orderBy: [
        { views: 'desc' }
      ],
      take: 5
    }).catch(() => [])
    
    // Translate categories
    const translatedCategories = categoryStats.map((c: any) => {
      const translatedName = translateCategory(c, lang)
      return {
        id: c.id,
        name: translatedName,
        slug: c.slug,
        productCount: c._count?.products || 0
      }
    })
    
    // Translate products
    const translatedProducts = translateProducts(popularProducts as any[], lang)
    
    const stats = {
      totals: {
        products: productCount,
        users: userCount,
        swaps: swapCount
      },
      today: {
        newProducts: todayProducts,
        completedSwaps: todaySwaps
      },
      trendingCategories: translatedCategories,
      popularProducts: translatedProducts.map((p: any) => ({
        id: p.id,
        title: p.translatedTitle || p.title,
        valorPrice: p.valorPrice,
        views: p.views,
        favoriteCount: p._count?.favorites || 0,
        image: p.images?.[0] || null,
        category: p.translatedCategory || p.category?.name || ''
      }))
    }
    
    // Cache the results per language
    cachedStats[lang] = stats
    cacheTime[lang] = now
    
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Stats error:', error)
    // Return fallback data on error
    return NextResponse.json({
      totals: { products: 0, users: 0, swaps: 0 },
      today: { newProducts: 0, completedSwaps: 0 },
      trendingCategories: [],
      popularProducts: []
    })
  }
}
