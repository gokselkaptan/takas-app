import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    // Admin kontrolü
    if (!session?.user?.email || session.user.email !== 'join@takas-a.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.adminAlert.update({
      where: { id: params.id },
      data: { isRead: true }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[AdminAlert PATCH] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
