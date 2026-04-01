import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    })
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const statusFilter = searchParams.get('status') || 'active'
    const sort = searchParams.get('sort') || 'createdAt'
    const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'
    const search = searchParams.get('search') || ''

    // Build where clause
    const where: any = {}
    if (statusFilter !== 'all') {
      if (statusFilter === 'deleted') {
        where.deletedAt = { not: null }
      } else {
        where.status = statusFilter
        where.deletedAt = null
      }
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Build orderBy
    const allowedSorts = ['createdAt', 'valorPrice', 'views', 'title']
    const orderBy: any = {}
    orderBy[allowedSorts.includes(sort) ? sort : 'createdAt'] = dir

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({
      products: products.map(p => ({
        id: p.id,
        title: p.title,
        valorPrice: p.valorPrice,
        condition: p.condition,
        status: p.status,
        images: p.images,
        createdAt: p.createdAt.toISOString(),
        views: p.views,
        adminEstimatedPrice: p.adminEstimatedPrice,
        userPriceMin: p.userPriceMin,
        userPriceMax: p.userPriceMax,
        aiValorReason: p.aiValorReason,
        category: p.category,
        user: p.user,
      })),
      total,
      page,
      pageSize,
    })
  } catch (error: any) {
    console.error('Admin products error:', error)
    return NextResponse.json({ error: 'Ürün listesi hatası' }, { status: 500 })
  }
}
