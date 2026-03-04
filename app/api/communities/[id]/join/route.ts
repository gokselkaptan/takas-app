import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// POST - Topluluğa katıl
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    const { id: communityId } = params
    const userId = user.id

    // Topluluk var mı?
    const community = await prisma.community.findUnique({
      where: { id: communityId }
    })

    if (!community) {
      return NextResponse.json(
        { error: 'Topluluk bulunamadı' },
        { status: 404 }
      )
    }

    // Zaten üye mi?
    const existing = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: { communityId, userId }
      }
    })

    if (existing) {
      if (existing.isActive) {
        return NextResponse.json(
          { error: 'Zaten bu topluluğun üyesisiniz' },
          { status: 400 }
        )
      }
      // Tekrar aktifleştir
      await prisma.communityMember.update({
        where: { id: existing.id },
        data: { isActive: true, lastActiveAt: new Date() }
      })
    } else {
      // Yeni üyelik
      await prisma.communityMember.create({
        data: {
          communityId,
          userId,
          role: 'member'
        }
      })
    }

    // Üye sayısını güncelle
    await prisma.community.update({
      where: { id: communityId },
      data: { memberCount: { increment: 1 } }
    })

    return NextResponse.json({
      success: true,
      message: 'Topluluğa başarıyla katıldınız!'
    })
  } catch (error) {
    console.error('Join community error:', error)
    return NextResponse.json(
      { error: 'Katılım sırasında hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Topluluktan ayrıl
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    const { id: communityId } = params
    const userId = user.id

    const membership = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: { communityId, userId }
      }
    })

    if (!membership || !membership.isActive) {
      return NextResponse.json(
        { error: 'Bu topluluğun üyesi değilsiniz' },
        { status: 400 }
      )
    }

    // Admin tek başına ayrılamaz
    if (membership.role === 'admin') {
      const otherAdmins = await prisma.communityMember.count({
        where: {
          communityId,
          role: 'admin',
          isActive: true,
          NOT: { userId }
        }
      })
      if (otherAdmins === 0) {
        return NextResponse.json(
          { error: 'Tek admin olarak ayrılamazsınız. Önce başka bir admin atayın.' },
          { status: 400 }
        )
      }
    }

    // Pasif yap (soft delete)
    await prisma.communityMember.update({
      where: { id: membership.id },
      data: { isActive: false }
    })

    // Üye sayısını güncelle
    await prisma.community.update({
      where: { id: communityId },
      data: { memberCount: { decrement: 1 } }
    })

    return NextResponse.json({
      success: true,
      message: 'Topluluktan ayrıldınız'
    })
  } catch (error) {
    console.error('Leave community error:', error)
    return NextResponse.json(
      { error: 'Ayrılma sırasında hata oluştu' },
      { status: 500 }
    )
  }
}
