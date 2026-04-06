import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    // Admin kontrolü
    if (!session?.user?.email || session.user.email !== 'join@takas-a.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const alerts = await prisma.adminAlert.findMany({
      include: {
        triggeredBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json({ alerts })
  } catch (error) {
    console.error('[AdminAlerts GET] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
