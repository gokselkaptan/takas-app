import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { translateCategory } from '@/lib/product-translations'
import { getCache, setCache } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lang = searchParams.get('lang') || 'tr'

    // Cache kontrolü (5 dakika)
    const cacheKey = `categories-${lang}`
    const cached = getCache(cacheKey)
    if (cached) return NextResponse.json(cached)

    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true }
        }
      }
    })

    // Kategorileri seçilen dile göre çevir
    const translatedCategories = categories.map((cat: { id: string; name: string; slug: string; nameEn?: string | null; nameEs?: string | null; nameCa?: string | null; _count: { products: number } }) => ({
      ...cat,
      translatedName: translateCategory(cat, lang)
    }))

    setCache(cacheKey, translatedCategories, 300) // 5 dakika cache
    return NextResponse.json(translatedCategories)
  } catch (error) {
    console.error('Kategoriler getirme hatası:', error)
    return NextResponse.json(
      { error: 'Kategoriler getirilemedi' },
      { status: 500 }
    )
  }
}
