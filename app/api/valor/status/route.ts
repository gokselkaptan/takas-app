import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { getUserEconomicStatus } from '@/lib/valor-system'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/valor/status
 * Kullanıcının ekonomik durumunu getirir (bonus kısıtlaması, kazanç limiti vb.)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Giriş yapmanız gerekiyor' },
        { status: 401 }
      )
    }

    // Kullanıcı ID'sini bul
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    // Ekonomik durumu getir
    const status = await getUserEconomicStatus(user.id)

    return NextResponse.json(status)

  } catch (error) {
    console.error('Valor status error:', error)
    return NextResponse.json(
      { error: 'Durum alınamadı' },
      { status: 500 }
    )
  }
}
