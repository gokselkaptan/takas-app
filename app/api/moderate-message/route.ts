import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { quickModeration, aiModeration } from '@/lib/message-moderation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const body = await request.json()
    const { content, useAI = true } = body

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Mesaj içeriği gerekli' },
        { status: 400 }
      )
    }

    // Önce hızlı regex kontrolü
    const quickResult = quickModeration(content)
    
    // Eğer quick moderation bir sorun bulduysa, AI'a gerek yok
    if (!quickResult.isApproved) {
      return NextResponse.json(quickResult)
    }
    
    // AI moderasyonu (isteğe bağlı)
    if (useAI) {
      const aiResult = await aiModeration(content)
      return NextResponse.json(aiResult)
    }
    
    return NextResponse.json(quickResult)
    
  } catch (error) {
    console.error('Message moderation error:', error)
    return NextResponse.json(
      { error: 'Moderasyon sırasında hata oluştu' },
      { status: 500 }
    )
  }
}
