import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// POST - Beğen
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }
    
    const { activityId } = await request.json()
    
    if (!activityId) {
      return NextResponse.json({ error: 'Activity ID gerekli' }, { status: 400 })
    }
    
    // Zaten beğenmiş mi?
    const existingLike = await prisma.activityLike.findUnique({
      where: {
        activityId_userId: {
          activityId,
          userId
        }
      }
    })
    
    if (existingLike) {
      return NextResponse.json({ error: 'Zaten beğendiniz' }, { status: 400 })
    }
    
    // Beğeni oluştur
    await prisma.activityLike.create({
      data: {
        activityId,
        userId
      }
    })
    
    // Like count güncelle
    await prisma.activityFeed.update({
      where: { id: activityId },
      data: { likeCount: { increment: 1 } }
    })
    
    const likeCount = await prisma.activityLike.count({ where: { activityId } })
    
    return NextResponse.json({ success: true, likeCount })
  } catch (error) {
    console.error('Activity like error:', error)
    return NextResponse.json({ error: 'Beğenilemedi' }, { status: 500 })
  }
}

// DELETE - Beğeniyi kaldır
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const activityId = searchParams.get('activityId')
    
    if (!activityId) {
      return NextResponse.json({ error: 'Activity ID gerekli' }, { status: 400 })
    }
    
    await prisma.activityLike.deleteMany({
      where: {
        activityId,
        userId
      }
    })
    
    // Like count güncelle
    await prisma.activityFeed.update({
      where: { id: activityId },
      data: { likeCount: { decrement: 1 } }
    })
    
    const likeCount = await prisma.activityLike.count({ where: { activityId } })
    
    return NextResponse.json({ success: true, likeCount })
  } catch (error) {
    console.error('Activity unlike error:', error)
    return NextResponse.json({ error: 'Beğeni kaldırılamadı' }, { status: 500 })
  }
}
