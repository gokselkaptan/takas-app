import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { giveSurveyBonus, SURVEY_BONUS } from '@/lib/valor-system'

// POST - Anket cevaplarını kaydet ve bonus ver
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
    }

    const body = await request.json()
    const { surveyData } = body

    if (!surveyData || typeof surveyData !== 'object') {
      return NextResponse.json({ error: 'Geçersiz anket verisi' }, { status: 400 })
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, surveyCompleted: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Anket zaten tamamlandıysa bonus verme
    if (user.surveyCompleted) {
      return NextResponse.json({ 
        success: true, 
        message: 'Anket zaten tamamlanmış',
        bonus: 0 
      })
    }

    // Anket verisini kaydet
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        surveyData: JSON.stringify(surveyData)
      }
    })

    // 🎁 Anket bonusu ver (25 Valor)
    let bonusGiven = false
    try {
      bonusGiven = await giveSurveyBonus(user.id)
    } catch (bonusError) {
      console.error('Anket bonusu hatası:', bonusError)
    }

    return NextResponse.json({ 
      success: true, 
      message: bonusGiven 
        ? `🎉 Teşekkürler! ${SURVEY_BONUS} Valor anket bonusu hesabınıza eklendi.`
        : 'Anket başarıyla kaydedildi.',
      bonus: bonusGiven ? SURVEY_BONUS : 0,
      surveyCompleted: true
    })
  } catch (error) {
    console.error('Anket kaydetme hatası:', error)
    return NextResponse.json({ error: 'Anket kaydedilemedi' }, { status: 500 })
  }
}
