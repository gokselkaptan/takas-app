import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { generatePresignedUploadUrl, getFileUrl } from '@/lib/s3'
import { checkRateLimit } from '@/lib/rate-limit'

// GET - Profil fotoğrafı URL'i getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { image: true }
    })

    if (!user?.image) {
      return NextResponse.json({ imageUrl: null })
    }

    // Cloud storage path ise URL oluştur
    if (user.image.startsWith('public/') || user.image.includes('/uploads/')) {
      const url = await getFileUrl(user.image, true)
      return NextResponse.json({ imageUrl: url })
    }

    // Direkt URL ise olduğu gibi döndür
    return NextResponse.json({ imageUrl: user.image })
  } catch (error) {
    console.error('Profil fotoğrafı getirme hatası:', error)
    return NextResponse.json({ error: 'Fotoğraf yüklenemedi' }, { status: 500 })
  }
}

// POST - Profil fotoğrafı yükleme için presigned URL oluştur
export async function POST(request: NextRequest) {
  try {
    // Rate limit kontrolü (5 dakikada 10 yükleme)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = await checkRateLimit(ip, 'api/profile/photo')
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Çok fazla yükleme denemesi. 5 dakika bekleyin.' }, { status: 429 })
    }

    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
    }

    const body = await request.json()
    const { fileName, contentType } = body

    // Dosya türü kontrolü
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json({ error: 'Geçersiz dosya türü. Sadece JPEG, PNG, WebP ve GIF kabul edilir.' }, { status: 400 })
    }

    // Presigned URL oluştur (public olarak, profil fotoğrafları herkese açık)
    // forceDownload: false - profil fotoğrafları tarayıcıda görüntülenecek, download olmayacak
    const sanitizedFileName = `profile-${session.user.email.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.${contentType.split('/')[1]}`
    const { uploadUrl, cloud_storage_path, requiresContentDisposition } = await generatePresignedUploadUrl(
      sanitizedFileName,
      contentType,
      true, // isPublic
      false // forceDownload - profil fotoğrafları için false
    )

    return NextResponse.json({ uploadUrl, cloud_storage_path, requiresContentDisposition })
  } catch (error) {
    console.error('Presigned URL oluşturma hatası:', error)
    return NextResponse.json({ error: 'Yükleme URL oluşturulamadı' }, { status: 500 })
  }
}

// PUT - Profil fotoğrafını güncelle
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
    }

    const body = await request.json()
    const { cloud_storage_path, base64Image, fileName, contentType } = body

    let finalPath = cloud_storage_path
    
    // Base64 varsa → server-side S3 yükleme (CORS bypass)
    if (base64Image) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      const { createS3Client, getBucketConfig } = await import('@/lib/aws-config')
      
      // Base64'ü buffer'a çevir
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      
      const detectedContentType = contentType || 'image/jpeg'
      const ext = detectedContentType.split('/')[1] || 'jpg'
      const safeEmail = session.user.email.replace(/[^a-zA-Z0-9]/g, '_')
      const { bucketName, folderPrefix } = getBucketConfig()
      
      finalPath = `${folderPrefix}public/uploads/profiles/${safeEmail}-${Date.now()}.${ext}`
      
      const s3Client = createS3Client()
      
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: finalPath,
        Body: buffer,
        ContentType: detectedContentType,
      }))
      
      console.log('[ProfilePhoto] Server-side S3 upload başarılı:', finalPath)
    }

    if (!finalPath) {
      return NextResponse.json({ error: 'cloud_storage_path veya base64Image gerekli' }, { status: 400 })
    }

    // Veritabanını güncelle
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: { image: finalPath },
      select: { image: true }
    })

    // Yeni URL'i döndür
    const imageUrl = await getFileUrl(finalPath, true)

    return NextResponse.json({ 
      success: true, 
      image: updatedUser.image,
      imageUrl 
    })
  } catch (error) {
    console.error('Profil fotoğrafı güncelleme hatası:', error)
    return NextResponse.json({ error: 'Fotoğraf güncellenemedi' }, { status: 500 })
  }
}

// DELETE - Profil fotoğrafını kaldır
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
    }

    // Veritabanından fotoğrafı kaldır
    await prisma.user.update({
      where: { email: session.user.email },
      data: { image: null }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Profil fotoğrafı silme hatası:', error)
    return NextResponse.json({ error: 'Fotoğraf silinemedi' }, { status: 500 })
  }
}
