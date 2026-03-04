import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { translateProduct } from '@/lib/product-translations'

export const dynamic = 'force-dynamic'

// SOFT DELETE - Ürünü kalıcı olarak silmez, deletedAt timestamp ile işaretler
export async function DELETE(
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

    // Only owner or admin can delete
    const isAdmin = user.role === 'admin'
    if (product.userId !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    // Soft delete - ürünü silmek yerine deletedAt ile işaretle
    await prisma.product.update({
      where: { id: params.id },
      data: { 
        deletedAt: new Date(),
        deletedReason: isAdmin ? 'admin_deleted' : 'user_deleted',
        status: 'deleted'
      }
    })

    console.log(`[SOFT DELETE] Ürün soft delete edildi: ${product.id} - ${product.title} by ${user.email}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Ürün başarıyla silindi. 30 gün içinde geri yükleyebilirsiniz.' 
    })
  } catch (error) {
    console.error('Product delete error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}

// Update product status (publish/unpublish/edit)
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

    // Sahiplik kontrolü (admin her şeyi yapabilir)
    if (product.userId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    // ═══ PUBLISH ═══
    if (action === 'publish') {
      await prisma.product.update({
        where: { id: params.id },
        data: { status: 'active' }
      })
      return NextResponse.json({ success: true, message: 'Ürününüz başarıyla yayına alındı!' })
    }
    
    // ═══ UNPUBLISH ═══
    if (action === 'unpublish') {
      await prisma.product.update({
        where: { id: params.id },
        data: { status: 'inactive' }
      })
      return NextResponse.json({ success: true, message: 'Ürününüz yayından kaldırıldı.' })
    }
    
    // ═══ RESTORE ═══
    if (action === 'restore') {
      if (!product.deletedAt) {
        return NextResponse.json({ error: 'Bu ürün silinmemiş' }, { status: 400 })
      }
      const daysSinceDelete = Math.floor((Date.now() - product.deletedAt.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceDelete > 30) {
        return NextResponse.json({ error: 'Bu ürün 30 günden fazla önce silinmiş, geri yüklenemez' }, { status: 400 })
      }
      await prisma.product.update({
        where: { id: params.id },
        data: { deletedAt: null, deletedReason: null, status: 'active' }
      })
      return NextResponse.json({ success: true, message: 'Ürününüz başarıyla geri yüklendi!' })
    }

    // ═══ EDIT — Ürün düzenleme ═══
    if (action === 'edit') {
      const { title, description, condition, images, checklistData, editReason } = body

      // Günlük edit limiti (spam koruması) - admin hariç
      if (user.role !== 'admin') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayEdits = await prisma.productEditHistory.count({
          where: { userId: user.id, createdAt: { gte: today } }
        })
        if (todayEdits >= 10) {
          return NextResponse.json({
            error: 'Günlük düzenleme limitinize ulaştınız (max 10). Yarın tekrar deneyin.'
          }, { status: 429 })
        }
      }

      // Aktif takas varsa düzenleme kısıtla
      const activeSwaps = await prisma.swapRequest.count({
        where: {
          OR: [{ productId: params.id }, { offeredProductId: params.id }],
          status: { in: ['pending', 'accepted', 'meeting_set', 'in_progress', 'qr_generated'] }
        }
      })
      const hasActiveSwap = activeSwaps > 0

      // Değişen alanları tespit et
      const changes: Record<string, { old: any; new: any }> = {}
      const updateData: any = {
        editCount: { increment: 1 },
        lastEditedAt: new Date(),
        lastEditReason: editReason || null,
      }

      if (title && title !== product.title) {
        if (hasActiveSwap) {
          return NextResponse.json({ error: 'Aktif takas sürecindeyken ürün başlığı değiştirilemez.' }, { status: 400 })
        }
        changes.title = { old: product.title, new: title }
        updateData.title = title
      }

      if (description && description !== product.description) {
        changes.description = { old: product.description?.substring(0, 50), new: description.substring(0, 50) }
        updateData.description = description
      }

      if (condition && condition !== product.condition) {
        changes.condition = { old: product.condition, new: condition }
        updateData.condition = condition
      }

      if (images && JSON.stringify(images) !== JSON.stringify(product.images)) {
        changes.images = { old: `${product.images.length} fotoğraf`, new: `${images.length} fotoğraf` }
        updateData.images = images
      }

      if (checklistData) {
        const newChecklist = typeof checklistData === 'string' ? checklistData : JSON.stringify(checklistData)
        if (newChecklist !== product.checklistData) {
          changes.checklistData = { old: 'güncellendi', new: 'güncellendi' }
          updateData.checklistData = newChecklist
        }
      }

      // Hiç değişiklik yoksa
      if (Object.keys(changes).length === 0) {
        return NextResponse.json({ error: 'Herhangi bir değişiklik yapılmadı.' }, { status: 400 })
      }

      // Durum değiştiyse Valor yeniden hesapla
      let newValorPrice = product.valorPrice
      let valorChanged = false

      if (changes.condition || changes.checklistData) {
        try {
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
          const valorRes = await fetch(`${baseUrl}/api/valor/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: title || product.title,
              description: description || product.description,
              categoryName: '',
              categorySlug: '',
              condition: condition || product.condition,
              city: product.city,
              checklistData: checklistData || product.checklistData,
            })
          })
          
          if (valorRes.ok) {
            const valorData = await valorRes.json()
            if (valorData.valorPrice && valorData.valorPrice !== product.valorPrice) {
              newValorPrice = valorData.valorPrice
              valorChanged = true
              updateData.valorPrice = newValorPrice
              updateData.aiValorPrice = newValorPrice
              updateData.aiValorReason = `Düzenleme sonrası yeniden değerleme`
              changes.valorPrice = { old: product.valorPrice, new: newValorPrice }
            }
          }
        } catch (e) {
          console.error('Valor recalc error:', e)
        }
      }

      // Transaction: Ürünü güncelle + Edit geçmişi kaydet
      await prisma.$transaction([
        prisma.product.update({
          where: { id: params.id },
          data: updateData,
        }),
        prisma.productEditHistory.create({
          data: {
            productId: params.id,
            userId: user.id,
            changes: JSON.stringify(changes),
            reason: editReason || null,
            oldValor: product.valorPrice,
            newValor: newValorPrice,
          }
        })
      ])

      return NextResponse.json({
        success: true,
        message: 'Ürününüz güncellendi!',
        changes: Object.keys(changes),
        valorChanged,
        oldValor: product.valorPrice,
        newValor: newValorPrice,
        editCount: (product.editCount || 0) + 1,
      })
    }

    return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 })
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
        // Düzenleme geçmişi
        editHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            changes: true,
            reason: true,
            oldValor: true,
            newValor: true,
            createdAt: true,
          }
        }
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
