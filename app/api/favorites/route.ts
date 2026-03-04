import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Favorileri getir
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    
    // Tek ürün kontrolü
    if (productId) {
      const favorite = await prisma.favorite.findUnique({
        where: {
          userId_productId: {
            userId: user.id,
            productId
          }
        }
      })
      return NextResponse.json({ isFavorite: !!favorite })
    }
    
    // Tüm favoriler
    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      include: {
        product: {
          include: {
            category: true,
            user: {
              select: { id: true, name: true, image: true }
            },
            _count: {
              select: { favorites: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({
      favorites: favorites.map((f: { product: { id: string; title: string; valorPrice: number; images: string[]; condition: string; status: string; _count: { favorites: number } }; createdAt: Date }) => ({
        ...f.product,
        favoriteCount: f.product._count.favorites,
        favoritedAt: f.createdAt
      }))
    })
  } catch (error) {
    console.error('Favorites GET error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Favori ekle/çıkar (toggle)
export async function POST(request: Request) {
  try {
    // Rate limit kontrolü
    const clientId = getClientIdentifier(request)
    const rateLimit = await checkRateLimit(clientId, 'api/favorites')
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', resetAt: rateLimit.resetAt },
        { status: 429 }
      )
    }
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    const { productId } = await request.json()
    
    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    }
    
    // Ürün var mı kontrol et
    const product = await prisma.product.findUnique({
      where: { id: productId }
    })
    
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    
    // Mevcut favori kontrolü
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_productId: {
          userId: user.id,
          productId
        }
      }
    })
    
    if (existingFavorite) {
      // Favoriden çıkar
      await prisma.favorite.delete({
        where: { id: existingFavorite.id }
      })
      
      const newCount = await prisma.favorite.count({
        where: { productId }
      })
      
      return NextResponse.json({
        isFavorite: false,
        favoriteCount: newCount,
        message: 'Favorilerden çıkarıldı'
      })
    } else {
      // Favoriye ekle
      await prisma.favorite.create({
        data: {
          userId: user.id,
          productId
        }
      })
      
      const newCount = await prisma.favorite.count({
        where: { productId }
      })
      
      return NextResponse.json({
        isFavorite: true,
        favoriteCount: newCount,
        message: 'Favorilere eklendi'
      })
    }
  } catch (error) {
    console.error('Favorites POST error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
