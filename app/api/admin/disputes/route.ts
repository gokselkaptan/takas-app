import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET: Admin için tüm dispute'ları listele
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }
    
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    })
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    // Admin kontrolü
    if (currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin yetkisi gerekli' }, { status: 403 })
    }

    const disputes = await prisma.disputeReport.findMany({
      include: {
        swapRequest: {
          include: {
            product: {
              select: { id: true, title: true, images: true }
            },
            owner: {
              select: { id: true, name: true, email: true }
            },
            requester: {
              select: { id: true, name: true, email: true }
            },
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // Open first, then evidence_pending, under_review, resolved
        { createdAt: 'desc' }
      ],
    })

    return NextResponse.json(disputes)
  } catch (error) {
    console.error('Admin disputes fetch error:', error)
    return NextResponse.json({ error: 'Dispute listesi yüklenemedi' }, { status: 500 })
  }
}
