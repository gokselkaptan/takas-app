import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Admin yetki kontrolü.
 * Mevcut admin API pattern'i ile birebir aynı: oturum + DB'den role === 'admin'.
 * (Sibling route: app/api/admin/products/route.ts)
 */
async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { error: 'Giriş gerekli', status: 401 as const, user: null }
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true, email: true }
  })

  if (user?.role !== 'admin') {
    return { error: 'Yetkisiz', status: 403 as const, user: null }
  }

  return { error: null, status: 200 as const, user }
}

/**
 * DELETE — Ürünü soft delete yapar.
 * Kayıt veritabanından silinmez; deletedAt + status='deleted' ile işaretlenir.
 * (Hard delete kullanılmaz.)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin()
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json().catch(() => ({}))
    const reason = body?.reason || 'Admin tarafından kaldırıldı'

    const existing = await prisma.product.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, title: true, deletedAt: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 })
    }

    if (existing.status === 'deleted' || existing.deletedAt) {
      return NextResponse.json(
        { error: 'Ürün zaten silinmiş durumda' },
        { status: 400 }
      )
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        status: 'deleted',
        deletedAt: new Date(),
        deletedReason: reason
      },
      select: { id: true, title: true, status: true, deletedAt: true }
    })

    return NextResponse.json({
      success: true,
      message: 'Ürün başarıyla kaldırıldı',
      product
    })
  } catch (error) {
    console.error('Admin product delete error:', error)
    return NextResponse.json(
      { error: 'Ürün kaldırılırken hata oluştu' },
      { status: 500 }
    )
  }
}

/**
 * PATCH — Silinmiş ürünü geri yükler (restore).
 * deletedAt=null, deletedReason=null, status='active' olarak günceller.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin()
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const existing = await prisma.product.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, title: true, deletedAt: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 })
    }

    if (existing.status === 'active' && !existing.deletedAt) {
      return NextResponse.json(
        { error: 'Ürün zaten aktif durumda' },
        { status: 400 }
      )
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        status: 'active',
        deletedAt: null,
        deletedReason: null
      },
      select: { id: true, title: true, status: true, deletedAt: true }
    })

    return NextResponse.json({
      success: true,
      message: 'Ürün başarıyla geri yüklendi',
      product
    })
  } catch (error) {
    console.error('Admin product restore error:', error)
    return NextResponse.json(
      { error: 'Ürün geri yüklenirken hata oluştu' },
      { status: 500 }
    )
  }
}
