import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { validate, createServiceSchema } from '@/lib/validations'
import { sanitizeText } from '@/lib/sanitize'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// HİZMET LİSTESİ
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const city = searchParams.get('city')
    const type = searchParams.get('type') // individual, business
    const my = searchParams.get('my')
    const limit = parseInt(searchParams.get('limit') || '20')
    const id = searchParams.get('id') // Tek hizmet detayı
    
    // Tek hizmet detayı
    if (id) {
      const service = await prisma.serviceListing.findUnique({
        where: { id },
        include: { user: { select: { id: true, name: true, image: true, trustScore: true } } }
      })
      if (!service) return NextResponse.json({ error: 'Hizmet bulunamadı' }, { status: 404 })
      
      // Görüntülenme sayısını artır
      await prisma.serviceListing.update({
        where: { id },
        data: { views: { increment: 1 } }
      })
      
      return NextResponse.json({ service })
    }
    
    // Kendi hizmetlerim
    if (my === 'true') {
      const session = await getServerSession(authOptions)
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Giriş yapınız' }, { status: 401 })
      }
      const user = await prisma.user.findUnique({ where: { email: session.user.email } })
      if (!user) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
      
      const services = await prisma.serviceListing.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, image: true } } }
      })
      return NextResponse.json({ services })
    }
    
    // Genel listeleme
    const where: Record<string, unknown> = { status: 'active' }
    if (category && category !== 'all') where.category = category
    if (city && city !== 'all') where.city = city
    if (type && type !== 'all') where.listingType = type
    
    const services = await prisma.serviceListing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, name: true, image: true, trustScore: true } }
      }
    })
    
    const total = await prisma.serviceListing.count({ where })
    
    // Kategori istatistikleri
    const stats = await prisma.serviceListing.groupBy({
      by: ['category'],
      where: { status: 'active' },
      _count: true,
    })
    
    return NextResponse.json({ services, total, stats })
  } catch (error) {
    console.error('Services GET error:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// HİZMET OLUŞTUR
export async function POST(request: NextRequest) {
  try {
    // Rate limit kontrolü
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = await checkRateLimit(ip, 'api/services')
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Çok fazla istek. Lütfen biraz bekleyin.' }, { status: 429 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapınız' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    
    const body = await request.json()
    
    // Input validation
    const { success, error: validationError } = validate(createServiceSchema, {
      ...body,
      valorPrice: Number(body.valorPrice) || body.valorPrice,
    })
    if (!success) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
    
    if (!body.title || !body.category || !body.valorPrice) {
      return NextResponse.json({ error: 'Başlık, kategori ve değer zorunludur' }, { status: 400 })
    }
    
    // XSS temizleme
    const cleanTitle = sanitizeText(body.title)
    const cleanDescription = sanitizeText(body.description || '')
    
    const service = await prisma.serviceListing.create({
      data: {
        userId: user.id,
        title: cleanTitle,
        description: cleanDescription,
        category: body.category,
        duration: body.duration || '1 saat',
        unitType: body.unitType || 'hour',
        unitCount: body.unitCount || 1,
        valorPrice: parseInt(body.valorPrice),
        city: body.city || 'İzmir',
        district: body.district,
        serviceArea: body.serviceArea,
        wantCategory: body.wantCategory,
        wantDescription: body.wantDescription?.trim(),
        listingType: body.listingType || 'individual',
        businessName: body.businessName?.trim(),
        businessType: body.businessType,
        images: body.images || [],
      }
    })
    
    return NextResponse.json({ success: true, service })
  } catch (error) {
    console.error('Services POST error:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// HİZMET GÜNCELLE / SİL
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapınız' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    
    const body = await request.json()
    
    // Silme
    if (body.action === 'delete') {
      await prisma.serviceListing.deleteMany({
        where: { id: body.id, userId: user.id }
      })
      return NextResponse.json({ success: true })
    }
    
    // Durum değiştirme (active/paused)
    if (body.action === 'toggleStatus') {
      const service = await prisma.serviceListing.findFirst({
        where: { id: body.id, userId: user.id }
      })
      if (!service) return NextResponse.json({ error: 'Hizmet bulunamadı' }, { status: 404 })
      
      await prisma.serviceListing.update({
        where: { id: body.id },
        data: { status: service.status === 'active' ? 'paused' : 'active' }
      })
      return NextResponse.json({ success: true })
    }
    
    // Güncelleme
    const updateData: Record<string, unknown> = {}
    if (body.title) updateData.title = body.title.trim()
    if (body.description !== undefined) updateData.description = body.description.trim()
    if (body.valorPrice) updateData.valorPrice = parseInt(body.valorPrice)
    if (body.wantDescription !== undefined) updateData.wantDescription = body.wantDescription.trim()
    if (body.status) updateData.status = body.status
    if (body.duration) updateData.duration = body.duration
    if (body.serviceArea !== undefined) updateData.serviceArea = body.serviceArea
    if (body.category) updateData.category = body.category
    
    await prisma.serviceListing.update({
      where: { id: body.id },
      data: updateData,
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Services PUT error:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
