import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET - Yorumları getir
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activityId = searchParams.get('activityId')
    
    if (!activityId) {
      return NextResponse.json({ error: 'Activity ID gerekli' }, { status: 400 })
    }
    
    const comments = await prisma.activityComment.findMany({
      where: { activityId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            nickname: true,
            image: true
          }
        }
      }
    })
    
    return NextResponse.json(comments)
  } catch (error) {
    console.error('Comments fetch error:', error)
    return NextResponse.json({ error: 'Yorumlar yüklenemedi' }, { status: 500 })
  }
}

// POST - Yorum ekle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }
    
    const { activityId, content } = await request.json()
    
    if (!activityId || !content?.trim()) {
      return NextResponse.json({ error: 'Activity ID ve içerik gerekli' }, { status: 400 })
    }
    
    // Yorum oluştur
    const comment = await prisma.activityComment.create({
      data: {
        activityId,
        userId,
        content: content.trim().substring(0, 500) // Max 500 karakter
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            nickname: true,
            image: true
          }
        }
      }
    })
    
    // Comment count güncelle
    await prisma.activityFeed.update({
      where: { id: activityId },
      data: { commentCount: { increment: 1 } }
    })
    
    return NextResponse.json(comment)
  } catch (error) {
    console.error('Comment create error:', error)
    return NextResponse.json({ error: 'Yorum eklenemedi' }, { status: 500 })
  }
}

// DELETE - Yorum sil
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')
    
    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID gerekli' }, { status: 400 })
    }
    
    const comment = await prisma.activityComment.findUnique({
      where: { id: commentId }
    })
    
    if (!comment) {
      return NextResponse.json({ error: 'Yorum bulunamadı' }, { status: 404 })
    }
    
    if (comment.userId !== userId) {
      return NextResponse.json({ error: 'Bu yorumu silme yetkiniz yok' }, { status: 403 })
    }
    
    await prisma.activityComment.delete({
      where: { id: commentId }
    })
    
    // Comment count güncelle
    await prisma.activityFeed.update({
      where: { id: comment.activityId },
      data: { commentCount: { decrement: 1 } }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Comment delete error:', error)
    return NextResponse.json({ error: 'Yorum silinemedi' }, { status: 500 })
  }
}
