import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { sendPushToUser, NotificationTypes } from '@/lib/push-notifications'

export const dynamic = 'force-dynamic'

// GET: Ürünün sorularını listele
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const questions = await prisma.productQuestion.findMany({
      where: { productId: params.id },
      include: {
        asker: {
          select: { id: true, name: true, image: true }
        },
        product: {
          select: { id: true, title: true, images: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ questions })
  } catch (error) {
    console.error('Get product questions error:', error)
    return NextResponse.json({ error: 'Sorular yüklenemedi' }, { status: 500 })
  }
}

// POST: Yeni soru sor
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const { question } = await request.json()

    if (!question || question.trim().length < 5) {
      return NextResponse.json({ error: 'Soru en az 5 karakter olmalıdır' }, { status: 400 })
    }

    // Ürünü ve satıcıyı bul
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: { user: { select: { id: true, name: true } } }
    })

    if (!product) {
      return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 })
    }

    // Kendi ürününe soru soramasın
    if (product.userId === user.id) {
      return NextResponse.json({ error: 'Kendi ürününüze soru soramazsınız' }, { status: 400 })
    }

    // Soruyu oluştur
    const newQuestion = await prisma.productQuestion.create({
      data: {
        productId: params.id,
        askerId: user.id,
        sellerId: product.userId,
        question: question.trim(),
        status: 'pending'
      },
      include: {
        asker: { select: { id: true, name: true, image: true } },
        product: { select: { id: true, title: true, images: true } }
      }
    })

    // Satıcıya bildirim gönder
    try {
      await sendPushToUser(product.userId, NotificationTypes.NEW_MESSAGE, {
        title: '🔔 Ürününüz hakkında yeni bir soru var!',
        body: `${user.name || 'Bir kullanıcı'}: "${question.slice(0, 50)}${question.length > 50 ? '...' : ''}"`,
        url: `/takas-firsatlari?tab=questions`
      })
    } catch (e) {
      console.error('Push notification error:', e)
    }

    return NextResponse.json({ 
      success: true, 
      question: newQuestion,
      message: 'Sorunuz satıcıya iletildi!'
    })
  } catch (error) {
    console.error('Create product question error:', error)
    return NextResponse.json({ error: 'Soru gönderilemedi' }, { status: 500 })
  }
}
