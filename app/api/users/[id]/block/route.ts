import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// PROTECTED IDENTITIES — asla engellenemez
const PROTECTED_EMAIL = 'join@takas-a.com'

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
      select: { id: true, name: true, email: true },
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
      select: { id: true, email: true, name: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Hedef kullanıcı bulunamadı' }, { status: 404 })
    }

    // ⛔ Chairman/Admin Koruma Kontrolü
    const isProtected = targetUser.email === PROTECTED_EMAIL

    if (isProtected) {
      // 1. AdminAlert kaydı oluştur
      await prisma.adminAlert.create({
        data: {
          type: 'BLOCK_ATTEMPT',
          triggeredById: user.id,
          targetUserId: params.id,
          metadata: JSON.stringify({
            attemptedAt: new Date().toISOString(),
            triggeredByEmail: user.email,
            triggeredByName: user.name,
          })
        }
      })

      // 2. Admin'e email gönder
      try {
        await sendEmail({
          to: PROTECTED_EMAIL,
          subject: '⚠️ Güvenlik Uyarısı — Admin Engelleme Girişimi',
          html: `
            <p><strong>${user.name || user.email}</strong> adlı kullanıcı sizi engellemeye çalıştı.</p>
            <p>Kullanıcı ID: ${user.id}</p>
            <p>Zaman: ${new Date().toLocaleString('tr-TR')}</p>
            <p><a href="https://takas-a.com/admin/guvenlik-uyarilari">Admin panelinde görüntüle →</a></p>
          `
        })
      } catch (emailError) {
        console.error('[Block POST] Email error:', emailError)
      }

      // 3. İstemciye sessiz 403 dön
      return NextResponse.json(
        { error: 'Bu işlem gerçekleştirilemez' },
        { status: 403 }
      )
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
