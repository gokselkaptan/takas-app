import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { generatePresignedUploadUrl, getFileUrl, transformProfileImageUrl } from '@/lib/s3'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  console.log('[ProfilePhoto PUT] ===== BAŞLADI =====')
  
  try {
    // 1. Session kontrolü
    console.log('[ProfilePhoto PUT] 1. Session kontrolü yapılıyor...')
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      console.log('[ProfilePhoto PUT] ❌ Session yok veya email eksik')
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
    }
    console.log('[ProfilePhoto PUT] ✅ Session OK, email:', session.user.email)

    // 2. Body parse
    console.log('[ProfilePhoto PUT] 2. Body parse ediliyor...')
    let body: any
    try {
      body = await request.json()
      console.log('[ProfilePhoto PUT] ✅ Body parse OK, keys:', Object.keys(body || {}))
    } catch (parseError: any) {
      console.log('[ProfilePhoto PUT] ❌ Body parse hatası:', parseError.message)
      return NextResponse.json({ error: 'Geçersiz JSON body' }, { status: 400 })
    }
    
    const { cloud_storage_path, base64Image, fileName, contentType } = body
    console.log('[ProfilePhoto PUT] cloud_storage_path:', cloud_storage_path ? 'VAR' : 'YOK')
    console.log('[ProfilePhoto PUT] base64Image:', base64Image ? `VAR (${base64Image.length} chars)` : 'YOK')
    console.log('[ProfilePhoto PUT] contentType:', contentType)

    let finalPath = cloud_storage_path
    
    // Base64 varsa → server-side S3 yükleme (CORS bypass)
    if (base64Image) {
      console.log('[ProfilePhoto PUT] 3. Base64 S3 yükleme başlıyor...')
      
      // AWS credentials kontrolü
      console.log('[ProfilePhoto PUT] AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'VAR' : 'YOK')
      console.log('[ProfilePhoto PUT] AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'VAR' : 'YOK')
      console.log('[ProfilePhoto PUT] AWS_REGION:', process.env.AWS_REGION)
      console.log('[ProfilePhoto PUT] AWS_BUCKET_NAME:', process.env.AWS_BUCKET_NAME)
      
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      const { createS3Client, getBucketConfig } = await import('@/lib/aws-config')
      
      // Base64'ü buffer'a çevir
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      console.log('[ProfilePhoto PUT] Buffer boyutu:', buffer.length, 'bytes')
      
      const detectedContentType = contentType || 'image/jpeg'
      const ext = detectedContentType.split('/')[1] || 'jpg'
      const safeEmail = session.user.email.replace(/[^a-zA-Z0-9]/g, '_')
      const { bucketName, folderPrefix } = getBucketConfig()
      
      console.log('[ProfilePhoto PUT] Bucket:', bucketName)
      console.log('[ProfilePhoto PUT] folderPrefix:', folderPrefix)
      
      finalPath = `${folderPrefix}public/uploads/profiles/${safeEmail}-${Date.now()}.${ext}`
      console.log('[ProfilePhoto PUT] finalPath:', finalPath)
      
      const s3Client = createS3Client()
      
      console.log('[ProfilePhoto PUT] S3 PutObject gönderiliyor...')
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: finalPath,
        Body: buffer,
        ContentType: detectedContentType,
      }))
      
      console.log('[ProfilePhoto PUT] ✅ S3 yükleme başarılı:', finalPath)
    }

    if (!finalPath) {
      console.log('[ProfilePhoto PUT] ❌ finalPath boş!')
      return NextResponse.json({ error: 'cloud_storage_path veya base64Image gerekli' }, { status: 400 })
    }

    // 4. Full S3 URL oluştur ve veritabanına kaydet
    console.log('[ProfilePhoto PUT] 4. Full S3 URL oluşturuluyor...')
    const imageUrl = transformProfileImageUrl(finalPath)
    console.log('[ProfilePhoto PUT] ✅ imageUrl:', imageUrl)

    // 5. Veritabanını güncelle - artık FULL URL kaydediyoruz
    console.log('[ProfilePhoto PUT] 5. Prisma update başlıyor...')
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: { image: imageUrl }, // Full S3 URL kaydediliyor
      select: { image: true }
    })
    console.log('[ProfilePhoto PUT] ✅ Prisma update OK')

    console.log('[ProfilePhoto PUT] ===== BAŞARILI =====')
    return NextResponse.json({ 
      success: true, 
      image: updatedUser.image,
      imageUrl 
    })
  } catch (error: any) {
    console.error('[ProfilePhoto PUT] ❌❌❌ HATA:', {
      message: error?.message,
      code: error?.code || error?.$metadata?.httpStatusCode,
      name: error?.name,
      stack: error?.stack?.slice(0, 800)
    })
    
    // S3 hatalarını özel olarak işle
    if (error?.name === 'CredentialsProviderError' || error?.code === 'CredentialsError') {
      return NextResponse.json({ error: 'AWS kimlik doğrulama hatası', detail: error?.message }, { status: 500 })
    }
    if (error?.code === 'AccessDenied' || error?.$metadata?.httpStatusCode === 403) {
      return NextResponse.json({ error: 'S3 erişim izni hatası', detail: error?.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      error: error?.message || 'Fotoğraf güncellenemedi',
      errorCode: error?.code || error?.name
    }, { status: 500 })
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
