import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// POST: FCM token'ı kaydet
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Oturum açmanız gerekiyor' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { fcmToken } = body

    if (!fcmToken || typeof fcmToken !== 'string') {
      return NextResponse.json(
        { error: 'Geçerli bir FCM token gerekli' },
        { status: 400 }
      )
    }

    // Token'ı kullanıcıya kaydet
    await prisma.user.update({
      where: { email: session.user.email },
      data: { fcmToken }
    })

    return NextResponse.json(
      { success: true, message: 'FCM token kaydedildi' },
      { status: 200 }
    )
  } catch (error) {
    console.error('FCM token kaydetme hatası:', error)
    return NextResponse.json(
      { error: 'Token kaydedilemedi' },
      { status: 500 }
    )
  }
}

// DELETE: FCM token'ı sil (çıkış yaparken)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Oturum açmanız gerekiyor' },
        { status: 401 }
      )
    }

    // Token'ı sil
    await prisma.user.update({
      where: { email: session.user.email },
      data: { fcmToken: null }
    })

    return NextResponse.json(
      { success: true, message: 'FCM token silindi' },
      { status: 200 }
    )
  } catch (error) {
    console.error('FCM token silme hatası:', error)
    return NextResponse.json(
      { error: 'Token silinemedi' },
      { status: 500 }
    )
  }
}
