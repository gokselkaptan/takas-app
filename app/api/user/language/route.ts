import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { NextResponse } from 'next/server'

const validLanguages = ['tr', 'en', 'es', 'ca']

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const language = body?.language

    if (!language || !validLanguages.includes(language)) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
    }

    await prisma.user.update({
      where: { email: session.user.email },
      data: { language }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Language update error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
