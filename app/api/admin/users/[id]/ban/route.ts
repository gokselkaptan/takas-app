import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    // Admin kontrolü
    if (!session?.user?.email || session.user.email !== 'join@takas-a.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Korumalı kullanıcıyı banlama engeli
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { email: true }
    })

    if (targetUser?.email === 'join@takas-a.com') {
      return NextResponse.json({ error: 'Bu kullanıcı banlanamaz' }, { status: 403 })
    }

    await prisma.$transaction([
      // Kullanıcıyı deaktive et
      prisma.user.update({
        where: { id: params.id },
        data: {
          isBanned: true,
          bannedAt: new Date()
        }
      }),
      // Tüm ürünlerini pasife çek
      prisma.product.updateMany({
        where: { userId: params.id },
        data: { status: 'PASSIVE' }
      }),
      // Aktif swaplarını iptal et
      prisma.swapRequest.updateMany({
        where: {
          OR: [
            { requesterId: params.id },
            { ownerId: params.id }
          ],
          status: { in: ['pending', 'accepted'] }
        },
        data: { status: 'cancelled' }
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[UserBan POST] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
