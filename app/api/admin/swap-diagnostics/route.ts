import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// Cache'i devre dışı bırak - her istekte güncel veri çek
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GEÇİCİ TEŞHİS ENDPOINT'İ
 * Takas durumlarını DB'den okuyup gösterir.
 * Sadece okuma yapar, hiçbir veriyi değiştirmez.
 * Admin korumalı - sadece admin veya chairman erişebilir.
 *
 * Teşhis bitince bu endpoint kaldırılacak.
 */
export async function GET() {
  try {
    // Admin kontrolü - mevcut admin endpoint'lerindeki pattern
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Yetkisiz - Oturum gerekli' },
        { status: 401 }
      )
    }

    // Kullanıcı rolünü kontrol et
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        role: true,
        isChairman: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    // Admin veya Chairman kontrolü
    if (user.role !== 'admin' && !user.isChairman) {
      return NextResponse.json(
        { error: 'Yetkisiz - Admin veya Chairman erişimi gerekli' },
        { status: 403 }
      )
    }

    // ============================================
    // TEŞHİS VERİLERİ - SADECE OKUMA
    // ============================================

    // 1. Durum dağılımı (tüm status'lerin sayısı)
    const byStatus = await prisma.swapRequest.groupBy({
      by: ['status'],
      _count: { status: true },
    })

    // 2. Delivered'da takılı takas sayısı
    const stuckDelivered = await prisma.swapRequest.count({
      where: { status: 'delivered' },
    })

    // 3. Aynı ürüne çoklu takas analizi
    const allSwaps = await prisma.swapRequest.findMany({
      select: {
        id: true,
        productId: true,
        status: true,
        createdAt: true,
        product: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Ürün bazında grupla
    const byProduct: Record<
      string,
      {
        title: string
        swapIds: string[]
        statuses: string[]
        dates: Date[]
      }
    > = {}

    for (const swap of allSwaps) {
      const key = swap.productId || 'null'
      if (!byProduct[key]) {
        byProduct[key] = {
          title: swap.product?.title || '(Ürün Bulunamadı)',
          swapIds: [],
          statuses: [],
          dates: [],
        }
      }
      byProduct[key].swapIds.push(swap.id)
      byProduct[key].statuses.push(swap.status)
      byProduct[key].dates.push(swap.createdAt)
    }

    // Birden fazla takası olan ürünleri filtrele ve sırala
    const multiSwap = Object.entries(byProduct)
      .filter(([, v]) => v.statuses.length > 1)
      .sort((a, b) => b[1].statuses.length - a[1].statuses.length)
      .map(([productId, v]) => ({
        product_id: productId,
        urun: v.title,
        takas_sayisi: v.statuses.length,
        durumlar: v.statuses,
        swap_ids: v.swapIds,
        oldest_date: new Date(Math.min(...v.dates.map((d) => d.getTime()))),
        newest_date: new Date(Math.max(...v.dates.map((d) => d.getTime()))),
      }))

    // 4. Delivered takasların detaylı listesi
    const deliveredDetails = await prisma.swapRequest.findMany({
      where: { status: 'delivered' },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        ownerReceivedProduct: true,
        requesterReceivedProduct: true,
        product: {
          select: {
            title: true,
          },
        },
        requester: {
          select: {
            name: true,
            email: true,
          },
        },
        owner: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: 'asc' },
    })

    // 5. Genel istatistikler
    const totalSwaps = await prisma.swapRequest.count()
    const activeStatuses = [
      'pending',
      'accepted',
      'awaiting_delivery',
      'delivered',
      'cancel_requested',
    ]
    const activeCount = await prisma.swapRequest.count({
      where: { status: { in: activeStatuses } },
    })
    const completedCount = await prisma.swapRequest.count({
      where: { status: 'completed' },
    })

    // Yanıtı oluştur
    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        diagnostic_type: 'swap-status-analysis',

        genel_istatistikler: {
          toplam_takas: totalSwaps,
          aktif_takas: activeCount,
          tamamlanan_takas: completedCount,
        },

        durum_dagilimi: byStatus
          .map((s) => ({
            status: s.status,
            adet: s._count.status,
          }))
          .sort((a, b) => b.adet - a.adet),

        delivered_takili: {
          adet: stuckDelivered,
          detaylar: deliveredDetails.map((d) => ({
            id: d.id,
            urun: d.product?.title || 'N/A',
            gonderen: d.requester?.name || 'N/A',
            alan: d.owner?.name || 'N/A',
            owner_teslim_aldi: d.ownerReceivedProduct,
            requester_teslim_aldi: d.requesterReceivedProduct,
            olusturma: d.createdAt,
            guncelleme: d.updatedAt,
            gun_oncesi: Math.floor(
              (Date.now() - d.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
            ),
          })),
        },

        ayni_urune_coklu_takas: {
          adet: multiSwap.length,
          detaylar: multiSwap.slice(0, 20), // İlk 20 tanesi
        },

        notlar: [
          'Bu endpoint geçici teşhis amaçlıdır',
          'Sadece okuma yapar, hiçbir veriyi değiştirmez',
          'Teşhis bitince kaldırılacak',
        ],
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Swap diagnostics error:', error)
    return NextResponse.json(
      {
        error: 'Sunucu hatası',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    )
  }
}


// ============================================
// TEK SEFERLİK TEMİZLİK - POST
// ============================================
// 56-57 gün önce delivered'da takılı kalmış 6 test takasını cancelled yapar.
// Güvenlik: body'de { confirm: true } şartı + sadece hâlâ delivered olanları günceller.
// Teşhis/temizlik bitince bu endpoint kaldırılacak.

const STUCK_IDS = [
  'cmo0h4w2j0001jp04xynyigtn', // Ses bombası
  'cmo0otj240005ik045naj289o', // www.veraoi.com
  'cmo1wsd7t0001jp04jtpw8t7n', // New Vessel
  'test_swap_valor_20260417', // Hint Arabası Minyatürü
  'cmo2qmatc0001le04t5wypn8j', // New Vessel
  'cmo2vkr3t0001jq04n9xwd6e7', // New Vessel
]

export async function POST(req: NextRequest) {
  try {
    // GET ile AYNI admin auth kontrolü
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Yetkisiz - Oturum gerekli' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true, isChairman: true },
    })

    if (user?.role !== 'admin' && !user?.isChairman) {
      return NextResponse.json(
        { error: 'Yetkisiz - Admin veya Chairman erişimi gerekli' },
        { status: 403 }
      )
    }

    // Onay şartı - kazara tetiklenmesin
    const body = await req.json().catch(() => ({}))
    if (body?.confirm !== true) {
      return NextResponse.json(
        { error: 'confirm:true gerekli' },
        { status: 400 }
      )
    }

    // ÖNCE durumu oku
    const once = await prisma.swapRequest.findMany({
      where: { id: { in: STUCK_IDS } },
      select: {
        id: true,
        status: true,
        product: { select: { title: true } },
      },
    })

    // Sadece HÂLÂ delivered olanları cancelled yap (güvenlik filtresi)
    const result = await prisma.swapRequest.updateMany({
      where: { id: { in: STUCK_IDS }, status: 'delivered' },
      data: { status: 'cancelled', cancelledAt: new Date() },
    })

    // SONRA durumu oku
    const sonra = await prisma.swapRequest.findMany({
      where: { id: { in: STUCK_IDS } },
      select: { id: true, status: true },
    })

    return NextResponse.json(
      {
        success: true,
        once,
        guncellenen_adet: result.count,
        sonra,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Swap cleanup error:', error)
    return NextResponse.json(
      {
        error: 'Sunucu hatası',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    )
  }
}
