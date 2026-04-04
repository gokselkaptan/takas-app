import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true }
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const history = await prisma.swapHistory.findMany({
    where: {
      OR: [
        { senderUserId: user.id },
        { receiverUserId: user.id }
      ]
    },
    orderBy: { swappedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      swappedAt: true,
      senderProductSnapshot: true,
      receiverProductSnapshot: true,
      senderValor: true,
      receiverValor: true,
      valorDifference: true,
      senderUser: { select: { id: true, name: true, image: true } },
      receiverUser: { select: { id: true, name: true, image: true } }
    }
  })

  return NextResponse.json({
    history,
    totalSwaps: history.length
  })
}
