import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDynamicConfig, updateDynamicConfig } from '@/lib/valor-system'
import prisma from '@/lib/db'
import { checkAdminIPWhitelist, getClientIP } from '@/lib/security'

// Dinamik config getir
export async function GET(request: NextRequest) {
  try {
    // IP Whitelist kontrolü - Admin paneli için
    const ip = getClientIP(request)
    const ipCheck = await checkAdminIPWhitelist(ip)
    if (!ipCheck.allowed) {
      return NextResponse.json({ error: ipCheck.reason || 'IP erişimi engellendi' }, { status: 403 })
    }
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    })

    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin yetkisi gerekli' }, { status: 403 })
    }

    const config = await getDynamicConfig()
    
    return NextResponse.json({ config })
  } catch (error) {
    console.error('Config getirme hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// Dinamik config güncelle
export async function PATCH(request: NextRequest) {
  try {
    // IP Whitelist kontrolü - Admin paneli için
    const ip = getClientIP(request)
    const ipCheck = await checkAdminIPWhitelist(ip)
    if (!ipCheck.allowed) {
      return NextResponse.json({ error: ipCheck.reason || 'IP erişimi engellendi' }, { status: 403 })
    }
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    })

    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin yetkisi gerekli' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      welcomeBonusAmount,
      dailyBonusBase,
      productBonusAmount,
      referralBonusAmount,
      reviewBonusAmount,
      minAccountAgeDays,
      requireVerification
    } = body

    // Değerleri doğrula
    const updates: Record<string, number | boolean> = {}

    if (welcomeBonusAmount !== undefined) {
      if (welcomeBonusAmount < 0 || welcomeBonusAmount > 500) {
        return NextResponse.json({ error: 'Hoşgeldin bonusu 0-500 arasında olmalı' }, { status: 400 })
      }
      updates.welcomeBonusAmount = welcomeBonusAmount
    }

    if (dailyBonusBase !== undefined) {
      if (dailyBonusBase < 0 || dailyBonusBase > 50) {
        return NextResponse.json({ error: 'Günlük bonus 0-50 arasında olmalı' }, { status: 400 })
      }
      updates.dailyBonusBase = dailyBonusBase
    }

    if (productBonusAmount !== undefined) {
      if (productBonusAmount < 0 || productBonusAmount > 100) {
        return NextResponse.json({ error: 'Ürün bonusu 0-100 arasında olmalı' }, { status: 400 })
      }
      updates.productBonusAmount = productBonusAmount
    }

    if (referralBonusAmount !== undefined) {
      if (referralBonusAmount < 0 || referralBonusAmount > 100) {
        return NextResponse.json({ error: 'Davet bonusu 0-100 arasında olmalı' }, { status: 400 })
      }
      updates.referralBonusAmount = referralBonusAmount
    }

    if (reviewBonusAmount !== undefined) {
      if (reviewBonusAmount < 0 || reviewBonusAmount > 50) {
        return NextResponse.json({ error: 'Değerlendirme bonusu 0-50 arasında olmalı' }, { status: 400 })
      }
      updates.reviewBonusAmount = reviewBonusAmount
    }

    if (minAccountAgeDays !== undefined) {
      if (minAccountAgeDays < 0 || minAccountAgeDays > 30) {
        return NextResponse.json({ error: 'Minimum hesap yaşı 0-30 gün arasında olmalı' }, { status: 400 })
      }
      updates.minAccountAgeDays = minAccountAgeDays
    }

    if (requireVerification !== undefined) {
      updates.requireVerification = requireVerification
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Güncellenecek değer yok' }, { status: 400 })
    }

    const result = await updateDynamicConfig(updates)
    
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    // Güncel config'i döndür
    const newConfig = await getDynamicConfig()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Konfigürasyon güncellendi',
      config: newConfig
    })
  } catch (error) {
    console.error('Config güncelleme hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
