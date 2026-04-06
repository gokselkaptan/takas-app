import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

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
      return NextResponse.json({ error: 'Kendinizi engelleyemezsiniz' }, { status: 400 })
    }

    // Hedef kullanıcının var olduğunu doğrula
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Hedef kullanıcı bulunamadı' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))

    await prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: user.id,
          blockedId: params.id,
        },
      },
      update: {},
      create: {
        blockerId: user.id,
        blockedId: params.id,
        reason: body.reason || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Block POST] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
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

    await prisma.userBlock.deleteMany({
      where: {
        blockerId: user.id,
        blockedId: params.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Block DELETE] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(
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

    const block = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: user.id,
          blockedId: params.id,
        },
      },
    })

    return NextResponse.json({ isBlocked: !!block })
  } catch (error) {
    console.error('[Block GET] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
