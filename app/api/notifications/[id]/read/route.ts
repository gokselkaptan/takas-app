import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Only update if notification belongs to this user
    const result = await prisma.notification.updateMany({
      where: {
        id,
        userId: session.user.id,
        read: false
      },
      data: {
        read: true,
        readAt: new Date()
      }
    })

    return NextResponse.json({ success: true, updated: result.count })
  } catch (error) {
    console.error('[Notification PATCH single] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
