import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET - Kullanıcı profilini getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        image: true,
        bio: true,
        phone: true,
        location: true,
        trustScore: true,
        valorBalance: true,
        lockedValor: true,
        isPremium: true,
        surveyCompleted: true,
        surveyData: true,
        createdAt: true,
        isPhoneVerified: true,
        isIdentityVerified: true,
        _count: {
          select: {
            products: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // surveyData'yı JSON parse et
    const profileData = {
      ...user,
      surveyData: user.surveyData ? JSON.parse(user.surveyData) : null
    }

    return NextResponse.json(profileData)
  } catch (error) {
    console.error('Profil getirme hatası:', error)
    return NextResponse.json({ error: 'Profil yüklenemedi' }, { status: 500 })
  }
}

// PUT - Profil güncelle
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
    }

    const body = await request.json()
    const { name, nickname, bio, phone, location } = body

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        name: name || undefined,
        nickname: nickname !== undefined ? (nickname || null) : undefined,
        bio: bio || null,
        phone: phone || null,
        location: location || null
      },
      select: {
        id: true,
        name: true,
        nickname: true,
        bio: true,
        phone: true,
        location: true
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Profil güncelleme hatası:', error)
    return NextResponse.json({ error: 'Profil güncellenemedi' }, { status: 500 })
  }
}
