import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CHAIRMAN_EMAIL = process.env.CHAIRMAN_EMAIL ?? 'join@takas-a.com'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== CHAIRMAN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { status, adminNote } = body

    const validStatuses = ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Geçersiz status' }, { status: 400 })
    }

    // Rapor var mı kontrol et
    const existing = await prisma.userReport.findUnique({
      where: { id: params.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 })
    }

    // Chairman kullanıcı ID'sini al
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    const updateData: any = {}
    if (status) updateData.status = status
    if (adminNote !== undefined) updateData.adminNote = adminNote

    // RESOLVED veya DISMISSED ise resolvedBy + resolvedAt set et
    if (status === 'RESOLVED' || status === 'DISMISSED') {
      updateData.resolvedBy = currentUser.id
      updateData.resolvedAt = new Date()
    }

    const report = await prisma.userReport.update({
      where: { id: params.id },
      data: updateData,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        reported: { select: { id: true, name: true, email: true } },
        resolver: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(report)
  } catch (error) {
    console.error('Admin report update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
