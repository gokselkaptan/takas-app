import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    // Admin kontrolü
    if (!session?.user?.email || session.user.email !== 'join@takas-a.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const [user, products, swaps, reports, alerts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          image: true,
          isBanned: true,
          bannedAt: true
        }
      }),
      prisma.product.findMany({
        where: { userId: params.id },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.swapRequest.findMany({
        where: {
          OR: [
            { requesterId: params.id },
            { ownerId: params.id }
          ]
        },
        select: {
          id: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.userReport.findMany({
        where: { reportedId: params.id },
        select: {
          id: true,
          reason: true,
          createdAt: true,
          reporter: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.adminAlert.findMany({
        where: { triggeredById: params.id },
        select: {
          id: true,
          type: true,
          createdAt: true,
          targetUserId: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      })
    ])

    return NextResponse.json({
      user,
      products,
      swaps,
      reports,
      alerts
    })
  } catch (error) {
    console.error('[UserHistory GET] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
