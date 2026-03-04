import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'join@takas-a.com'

// GET: Mevcut image değerlerini listele
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
    }

    // Tüm kullanıcıların image alanlarını kontrol et
    const users = await prisma.user.findMany({
      where: {
        image: { not: null }
      },
      select: { id: true, email: true, image: true }
    })
    
    console.log('[fix-photos] Users with images:', JSON.stringify(users, null, 2))

    return NextResponse.json({ 
      totalUsersWithImage: users.length,
      users: users.map(u => ({ email: u.email, image: u.image }))
    })
  } catch (error) {
    console.error('[fix-photos] Error:', error)
    return NextResponse.json({ error: 'Listeleme başarısız' }, { status: 500 })
  }
}

// POST: Kırık fotoğrafları temizle
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
    }

    // Önce mevcut durumu logla
    const usersWithImages = await prisma.user.findMany({
      where: { image: { not: null } },
      select: { email: true, image: true }
    })
    console.log('[fix-photos] Before cleanup:', usersWithImages)

    // Kırık profil fotoğraflarını temizle - çeşitli pattern'ler
    const patterns = [
      '/24003/',
      '/uploads/',
      '/public/',
      'http://localhost',
      './',
      'blob:',
      'data:image',  // base64 inline images
    ]
    
    let totalFixed = 0
    const details: Record<string, number> = {}
    
    for (const pattern of patterns) {
      const result = await prisma.user.updateMany({
        where: {
          image: { startsWith: pattern }
        },
        data: { image: null }
      })
      details[pattern] = result.count
      totalFixed += result.count
    }

    // Ayrıca geçersiz URL'leri de temizle (https ile başlamayan veya boş olan)
    const invalidUrls = await prisma.user.updateMany({
      where: {
        AND: [
          { image: { not: null } },
          { image: { not: { startsWith: 'https://' } } }
        ]
      },
      data: { image: null }
    })
    details['invalid_urls'] = invalidUrls.count
    totalFixed += invalidUrls.count

    console.log('[fix-photos] Cleaned:', details, 'Total:', totalFixed)

    return NextResponse.json({
      success: true,
      message: `${totalFixed} kırık profil fotoğrafı temizlendi`,
      details
    })
  } catch (error) {
    console.error('[fix-photos] Error:', error)
    return NextResponse.json({ error: 'Temizleme başarısız' }, { status: 500 })
  }
}
