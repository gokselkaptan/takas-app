// GÖREV 46: Dispute kanıt fotoğrafları S3 upload endpoint'i
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getBucketConfig, createS3Client } from '@/lib/aws-config'

export const dynamic = 'force-dynamic'

const s3Client = createS3Client()

// POST: Presigned URL al (disputes/ klasörüne yükleme için)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const { fileName, contentType, disputeId } = await request.json()

    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'Dosya adı ve türü gerekli' }, { status: 400 })
    }

    // Sadece resim dosyaları kabul et
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json({ 
        error: 'Sadece resim dosyaları yüklenebilir (JPEG, PNG, WebP, GIF)' 
      }, { status: 400 })
    }

    // Dosya boyutu limiti (5MB)
    const maxSize = 5 * 1024 * 1024
    
    const { bucketName } = getBucketConfig()
    const region = process.env.AWS_REGION || 'eu-north-1'
    
    // Dosya yolu: disputes/{disputeId veya timestamp}/{timestamp}-{fileName}
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const folderPath = disputeId ? `disputes/${disputeId}` : `disputes/${timestamp}`
    const key = `${folderPath}/${timestamp}-${sanitizedFileName}`

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
    
    // Public URL (yükleme sonrası erişim için)
    const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`

    return NextResponse.json({
      success: true,
      uploadUrl,
      publicUrl,
      key,
      maxSize,
    })
  } catch (error) {
    console.error('Dispute photo presign error:', error)
    return NextResponse.json({ error: 'Yükleme URL\'i oluşturulamadı' }, { status: 500 })
  }
}
