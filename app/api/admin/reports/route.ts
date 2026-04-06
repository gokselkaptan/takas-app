import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CHAIRMAN_EMAIL = process.env.CHAIRMAN_EMAIL ?? 'join@takas-a.com'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== CHAIRMAN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')    // PENDING | REVIEWED | RESOLVED | DISMISSED
  const reason = searchParams.get('reason')    // spam | harassment | ...
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const skip = (page - 1) * limit

  const where: any = {}
  if (status) where.status = status
  if (reason) where.reason = reason

  try {
    const [reports, total] = await Promise.all([
      prisma.userReport.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, email: true, image: true } },
          reported: { select: { id: true, name: true, email: true, image: true, isBanned: true } },
          resolver: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.userReport.count({ where }),
    ])

    // Özet istatistikler
    const [pending, reviewed, resolved, dismissed] = await Promise.all([
      prisma.userReport.count({ where: { status: 'PENDING' } }),
      prisma.userReport.count({ where: { status: 'REVIEWED' } }),
      prisma.userReport.count({ where: { status: 'RESOLVED' } }),
      prisma.userReport.count({ where: { status: 'DISMISSED' } }),
    ])

    return NextResponse.json({
      reports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending,
        reviewed,
        resolved,
        dismissed,
      },
    })
  } catch (error) {
    console.error('Admin reports error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
