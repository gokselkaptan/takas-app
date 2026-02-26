import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'join@takas-a.com'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
    }

    // Kırık profil fotoğraflarını temizle
    const result1 = await prisma.user.updateMany({
      where: {
        image: { startsWith: '/24003/' }
      },
      data: { image: null }
    })

    const result2 = await prisma.user.updateMany({
      where: {
        image: { startsWith: '/uploads/' }
      },
      data: { image: null }
    })

    const result3 = await prisma.user.updateMany({
      where: {
        image: { startsWith: '/public/' }
      },
      data: { image: null }
    })

    // Ek olarak localhost ve relative path'leri de temizle
    const result4 = await prisma.user.updateMany({
      where: {
        image: { startsWith: 'http://localhost' }
      },
      data: { image: null }
    })

    const result5 = await prisma.user.updateMany({
      where: {
        image: { startsWith: './' }
      },
      data: { image: null }
    })

    const totalFixed = result1.count + result2.count + result3.count + result4.count + result5.count

    console.log('[fix-photos] Cleaned broken images:', {
      '/24003/': result1.count,
      '/uploads/': result2.count,
      '/public/': result3.count,
      'localhost': result4.count,
      './': result5.count,
      total: totalFixed
    })

    return NextResponse.json({
      success: true,
      message: `${totalFixed} kırık profil fotoğrafı temizlendi`,
      details: {
        '/24003/': result1.count,
        '/uploads/': result2.count,
        '/public/': result3.count,
        'localhost': result4.count,
        './': result5.count
      }
    })
  } catch (error) {
    console.error('[fix-photos] Error:', error)
    return NextResponse.json(
      { error: 'Temizleme başarısız' },
      { status: 500 }
    )
  }
}

// GET ile de çalıştırılabilir (kolaylık için)
export async function GET(request: Request) {
  return POST(request)
}
