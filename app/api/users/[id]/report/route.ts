import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

const VALID_REASONS = [
  'spam',
  'harassment',
  'fake_product',
  'fraud',
  'inappropriate_content',
  'other',
]

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    if (params.id === user.id) {
      return NextResponse.json({ error: 'Kendinizi şikayet edemezsiniz' }, { status: 400 })
    }

    // Hedef kullanıcının var olduğunu doğrula
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Hedef kullanıcı bulunamadı' }, { status: 404 })
    }

    const body = await req.json()
    const { reason, description } = body

    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Geçersiz şikayet nedeni' }, { status: 400 })
    }

    // 24 saat içinde aynı kullanıcıyı tekrar şikayet etme kontrolü
    const recentReport = await prisma.userReport.findFirst({
      where: {
        reporterId: user.id,
        reportedId: params.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })

    if (recentReport) {
      return NextResponse.json(
        { error: 'Bu kullanıcıyı yakın zamanda zaten şikayet ettiniz' },
        { status: 429 }
      )
    }

    await prisma.userReport.create({
      data: {
        reporterId: user.id,
        reportedId: params.id,
        reason,
        description: description?.slice(0, 500) || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Report POST] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
