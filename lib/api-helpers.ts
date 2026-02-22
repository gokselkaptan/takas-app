import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

/**
 * API Route Auth Wrapper
 * Her endpoint'te tekrarlanan session kontrolünü merkeze alır.
 * 
 * Kullanım:
 *   export async function GET(req: NextRequest) {
 *     return withAuth(req, async (session, user) => {
 *       // session.user ve prisma user objesi hazır
 *       return NextResponse.json({ ok: true })
 *     })
 *   }
 */
export async function withAuth(
  req: NextRequest,
  handler: (session: any, user: any) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Giriş yapmanız gerekiyor' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        role: true,
        trustScore: true,
        valorBalance: true,
        lockedValor: true,
        isPremium: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    return await handler(session, user)
  } catch (error: any) {
    console.error('[API Error]', req.nextUrl.pathname, error.message)
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}

/**
 * Admin-only wrapper
 */
export async function withAdmin(
  req: NextRequest,
  handler: (session: any, user: any) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(req, async (session, user) => {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
    }
    return handler(session, user)
  })
}

/**
 * Cron job / internal API secret kontrolü
 * Auto-cancel, auto-complete gibi zamanlı görevler için
 */
export function withCronSecret(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  
  if (secret !== process.env.CRON_SECRET) {
    return Promise.resolve(
      NextResponse.json({ error: 'Geçersiz secret' }, { status: 403 })
    )
  }

  return handler()
}
