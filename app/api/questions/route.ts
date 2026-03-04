import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'

// GET: Kullanıcının sorularını listele (sorduğu ve aldığı)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'asked' | 'received' | 'all'

    let where: any = {}
    
    if (type === 'asked') {
      where = { askerId: user.id }
    } else if (type === 'received') {
      where = { sellerId: user.id }
    } else {
      // all - hem sorduğu hem aldığı
      where = {
        OR: [
          { askerId: user.id },
          { sellerId: user.id }
        ]
      }
    }

    const questions = await prisma.productQuestion.findMany({
      where,
      include: {
        asker: { select: { id: true, name: true, image: true } },
        seller: { select: { id: true, name: true, image: true } },
        product: { select: { id: true, title: true, images: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Okunmamış soru sayısı (satıcı için cevaplanmamış sorular)
    const pendingCount = await prisma.productQuestion.count({
      where: {
        sellerId: user.id,
        status: 'pending'
      }
    })

    return NextResponse.json({ 
      questions,
      pendingCount,
      currentUserId: user.id
    })
  } catch (error) {
    console.error('Get questions error:', error)
    return NextResponse.json({ error: 'Sorular yüklenemedi' }, { status: 500 })
  }
}

// POST: Soruyu cevapla
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const { questionId, answer } = await request.json()

    if (!questionId || !answer || answer.trim().length < 2) {
      return NextResponse.json({ error: 'Geçersiz cevap' }, { status: 400 })
    }

    // Soruyu bul
    const question = await prisma.productQuestion.findUnique({
      where: { id: questionId },
      include: {
        product: { select: { title: true } },
        asker: { select: { id: true, name: true } }
      }
    })

    if (!question) {
      return NextResponse.json({ error: 'Soru bulunamadı' }, { status: 404 })
    }

    // Sadece satıcı cevaplayabilir
    if (question.sellerId !== user.id) {
      return NextResponse.json({ error: 'Bu soruyu cevaplama yetkiniz yok' }, { status: 403 })
    }

    // Soruyu cevapla
    const updatedQuestion = await prisma.productQuestion.update({
      where: { id: questionId },
      data: {
        answer: answer.trim(),
        status: 'answered',
        answeredAt: new Date()
      },
      include: {
        asker: { select: { id: true, name: true, image: true } },
        seller: { select: { id: true, name: true, image: true } },
        product: { select: { id: true, title: true, images: true } }
      }
    })

    // Soru sorana bildirim gönder
    try {
      await sendPushToUser(question.askerId, NotificationTypes.NEW_MESSAGE, {
        title: '💬 Sorunuz cevaplandı!',
        body: `${user.name || 'Satıcı'} "${question.product.title}" hakkındaki sorunuzu cevapladı`,
        url: `/takas-firsatlari?tab=questions`
      })
    } catch (e) {
      console.error('Push notification error:', e)
    }

    return NextResponse.json({ 
      success: true, 
      question: updatedQuestion,
      message: 'Cevabınız iletildi!'
    })
  } catch (error) {
    console.error('Answer question error:', error)
    return NextResponse.json({ error: 'Cevap gönderilemedi' }, { status: 500 })
  }
}
