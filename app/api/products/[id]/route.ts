import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { translateProduct } from '@/lib/product-translations'

export const dynamic = 'force-dynamic'

// Update product status (publish/unpublish)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const product = await prisma.product.findUnique({
      where: { id: params.id }
    })

    if (!product) {
      return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 })
    }

    // Only owner can update
    if (product.userId !== user.id) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { action } = await request.json()

    if (action === 'publish') {
      await prisma.product.update({
        where: { id: params.id },
        data: { status: 'active' }
      })
      return NextResponse.json({ success: true, message: 'Ürününüz başarıyla yayına alındı!' })
    } else if (action === 'unpublish') {
      await prisma.product.update({
        where: { id: params.id },
        data: { status: 'inactive' }
      })
      return NextResponse.json({ success: true, message: 'Ürününüz yayından kaldırıldı.' })
    } else {
      return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 })
    }
  } catch (error) {
    console.error('Product update error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const lang = searchParams.get('lang') || 'tr'

    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        user: {
          select: {
            id: true,
            name: true,
            nickname: true,
            image: true,
            createdAt: true,
            trustScore: true,
            _count: {
              select: {
                products: true,
              },
            },
          },
        },
        _count: {
          select: {
            favorites: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Ürün bulunamadı' },
        { status: 404 }
      )
    }

    // Increment views
    await prisma.product.update({
      where: { id: params.id },
      data: { views: { increment: 1 } },
    })

    // Dil parametresine göre ürünü çevir
    const translatedProduct = translateProduct(product, lang)

    return NextResponse.json(translatedProduct)
  } catch (error) {
    console.error('Product fetch error:', error)
    return NextResponse.json(
      { error: 'Ürün yüklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
