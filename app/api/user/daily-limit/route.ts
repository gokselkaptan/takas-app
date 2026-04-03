import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ═══ GÜVENİLİR KULLANICI SİSTEMİ ═══
const TRUSTED_EMAILS = [
  'join@takas-a.com',        // En yüksek öncelik
  'isiluslu@gmail.com',
  'goksel035@gmail.com',
  'takasabarty@gmail.com'
]

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        dailyProductCount: true,
        lastProductDate: true,
        isPremium: true,
        role: true,
        email: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isTrusted = TRUSTED_EMAILS.includes(user.email?.toLowerCase() || '')
    const limit = isTrusted || user.isPremium || user.role === 'admin' ? 999 : 3

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const isSameDay = user.lastProductDate &&
      new Date(user.lastProductDate).getTime() >= today.getTime()

    const count = isSameDay ? user.dailyProductCount : 0

    return NextResponse.json({
      count,
      limit,
      canAdd: count < limit,
      isPremium: isTrusted || user.isPremium || user.role === 'admin'
    })
  } catch (error) {
    console.error('Daily limit check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
