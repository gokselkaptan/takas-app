import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { generatePresignedUploadUrl } from '@/lib/s3'

export const dynamic = 'force-dynamic'

// POST: Fotoğraf yükleme için presigned URL oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const { swapRequestId, photoType, fileName, contentType } = await request.json()

    if (!swapRequestId || !photoType || !fileName || !contentType) {
      return NextResponse.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    if (!['packaging', 'delivery', 'receiving'].includes(photoType)) {
      return NextResponse.json({ error: 'Geçersiz fotoğraf türü' }, { status: 400 })
    }

    // Dosya türü kontrolü
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json({ error: 'Sadece JPEG, PNG, WebP kabul edilir' }, { status: 400 })
    }

    // Yetki kontrolü
    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      select: { requesterId: true, ownerId: true }
    })
    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    const isOwner = swapRequest.ownerId === user.id
    const isRequester = swapRequest.requesterId === user.id
    if (!isOwner && !isRequester) {
      return NextResponse.json({ error: 'Bu takas size ait değil' }, { status: 403 })
    }
    if ((photoType === 'packaging' || photoType === 'delivery') && !isOwner) {
      return NextResponse.json({ error: 'Bu fotoğrafı sadece satıcı yükleyebilir' }, { status: 403 })
    }
    if (photoType === 'receiving' && !isRequester) {
      return NextResponse.json({ error: 'Bu fotoğrafı sadece alıcı yükleyebilir' }, { status: 403 })
    }

    // Presigned URL oluştur
    const ext = contentType.split('/')[1] || 'jpg'
    const sanitizedFileName = `swap-${photoType}-${swapRequestId}-${Date.now()}.${ext}`
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      sanitizedFileName,
      contentType,
      true // public
    )

    const bucketName = process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || 'takas-a-storage'
    const region = process.env.AWS_REGION || 'eu-central-1'
    const photoUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${cloud_storage_path}`

    return NextResponse.json({
      success: true,
      uploadUrl,
      cloud_storage_path,
      photoUrl
    })
  } catch (error) {
    console.error('Swap photo upload error:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// PUT: Fotoğraf URL'lerini SwapRequest'e kaydet
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const { swapRequestId, photoType, photos } = await request.json()

    if (!swapRequestId || !photoType || !photos || !Array.isArray(photos)) {
      return NextResponse.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    if (!['packaging', 'delivery', 'receiving'].includes(photoType)) {
      return NextResponse.json({ error: 'Geçersiz fotoğraf türü' }, { status: 400 })
    }

    if (photos.length > 5) {
      return NextResponse.json({ error: 'En fazla 5 fotoğraf' }, { status: 400 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      select: { requesterId: true, ownerId: true }
    })
    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    const isOwner = swapRequest.ownerId === user.id
    const isRequester = swapRequest.requesterId === user.id
    if (!isOwner && !isRequester) {
      return NextResponse.json({ error: 'Bu takas size ait değil' }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}
    if (photoType === 'packaging') updateData.packagingPhotos = photos
    else if (photoType === 'delivery') updateData.deliveryPhotos = photos
    else if (photoType === 'receiving') updateData.receivingPhotos = photos

    await prisma.swapRequest.update({
      where: { id: swapRequestId },
      data: updateData,
    })

    return NextResponse.json({ success: true, message: 'Fotoğraflar kaydedildi' })
  } catch (error) {
    console.error('Photo save error:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// Fotoğrafları getir
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const swapRequestId = searchParams.get('swapRequestId')

    if (!swapRequestId) {
      return NextResponse.json({ error: 'swapRequestId gerekli' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    const swapRequest = await prisma.swapRequest.findUnique({
      where: { id: swapRequestId },
      select: { 
        requesterId: true, 
        ownerId: true,
        packagingPhotos: true,
        deliveryPhotos: true,
        receivingPhotos: true
      }
    })

    if (!swapRequest) {
      return NextResponse.json({ error: 'Takas bulunamadı' }, { status: 404 })
    }

    const isOwner = swapRequest.ownerId === user.id
    const isRequester = swapRequest.requesterId === user.id
    if (!isOwner && !isRequester) {
      return NextResponse.json({ error: 'Bu takas size ait değil' }, { status: 403 })
    }

    return NextResponse.json({
      packagingPhotos: swapRequest.packagingPhotos || [],
      deliveryPhotos: swapRequest.deliveryPhotos || [],
      receivingPhotos: swapRequest.receivingPhotos || []
    })

  } catch (error) {
    console.error('Photo fetch error:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
