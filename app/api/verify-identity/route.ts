import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'
import { uploadBuffer } from '@/lib/s3'

export const dynamic = 'force-dynamic'

// TC Kimlik doğrulama - AI ile kimlik kartı analizi
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, isIdentityVerified: true, trustScore: true, identityDocUrl: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    if (user.isIdentityVerified) {
      return NextResponse.json({ error: 'Kimliğiniz zaten doğrulanmış' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json({ error: 'Kimlik fotoğrafı gerekli' }, { status: 400 })
    }

    // Dosya boyutu kontrolü (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Dosya boyutu 10MB\'ı aşamaz' }, { status: 400 })
    }

    // Dosya tipini kontrol et
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Sadece resim dosyaları kabul edilir' }, { status: 400 })
    }

    // Resmi buffer'a çevir
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')
    const mimeType = file.type
    
    // Dosyayı S3'e yükle (private - sadece admin erişebilir)
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const safeFileName = `identity_${user.id}_${Date.now()}.${fileExtension}`
    
    let cloud_storage_path: string | null = null
    try {
      cloud_storage_path = await uploadBuffer(buffer, safeFileName, mimeType, false)
      console.log('[Identity] Document uploaded to S3:', cloud_storage_path)
    } catch (uploadError) {
      console.error('[Identity] S3 upload error:', uploadError)
      // S3 hatası olsa bile AI analizi devam etsin
    }

    // AI ile kimlik kartı analizi
    const apiKey = process.env.ABACUSAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AI servisi yapılandırılmamış' }, { status: 500 })
    }

    const aiResponse = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `You are an international identity document verification expert. Analyze whether the uploaded photo is a valid government-issued ID document.

ACCEPTED DOCUMENT TYPES (any country):
- National ID cards (TC Kimlik, DNI, Carta d'Identità, Personalausweis, etc.)
- Passports (all countries)
- Driver's licenses (all countries)
- Residence permits / Green cards
- Any other official government-issued photo ID

VERIFICATION CHECKS:
1. Is this a valid government-issued ID document?
2. Is the document clearly readable?
3. Is the photo side (with face) visible?
4. Are there signs of manipulation or forgery?
5. What type and country is the document from?

CRITICAL SECURITY RULES:
- NEVER reveal ID numbers, birthdates, addresses or sensitive personal data
- Only confirm validity and return the name for matching
- For privacy, only extract and return the full name

Respond in JSON format:
{
  "isValidIdCard": boolean,
  "isReadable": boolean,
  "isFrontSide": boolean,
  "suspiciousActivity": boolean,
  "documentType": "national_id" | "passport" | "drivers_license" | "residence_permit" | "other",
  "documentCountry": "Country name or code (e.g., Turkey, Spain, USA)",
  "extractedName": "Full Name" or null (if unreadable),
  "reason": "Brief explanation in English"
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this photo and verify if it is a valid government-issued identity document.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    })

    if (!aiResponse.ok) {
      console.error('AI API error:', await aiResponse.text())
      return NextResponse.json({ error: 'Kimlik analizi başarısız' }, { status: 500 })
    }

    const aiData = await aiResponse.json()
    const content = aiData.choices?.[0]?.message?.content || ''

    // JSON yanıtını parse et
    let analysis
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('JSON bulunamadı')
      }
    } catch {
      console.error('AI yanıtı parse edilemedi:', content)
      return NextResponse.json({ 
        error: 'Kimlik analizi sonucu işlenemedi. Lütfen daha net bir fotoğraf çekin.' 
      }, { status: 400 })
    }

    // Doğrulama kontrolleri / Validation checks
    if (!analysis.isValidIdCard) {
      return NextResponse.json({
        success: false,
        error: 'No valid government ID detected. Please upload a clear photo of your ID card, passport, or driver\'s license.',
        errorTR: 'Geçerli bir kimlik belgesi tespit edilemedi. Lütfen kimlik kartı, pasaport veya ehliyet fotoğrafı yükleyin.',
        reason: analysis.reason
      }, { status: 400 })
    }

    if (!analysis.isReadable) {
      return NextResponse.json({
        success: false,
        error: 'Document is not clearly readable. Please take a photo with better lighting.',
        errorTR: 'Belge net okunamıyor. Lütfen daha iyi aydınlatılmış bir fotoğraf çekin.',
        reason: analysis.reason
      }, { status: 400 })
    }

    if (!analysis.isFrontSide) {
      return NextResponse.json({
        success: false,
        error: 'Please show the front side of your ID (the side with your photo).',
        errorTR: 'Lütfen kimliğinizin ön yüzünü (fotoğraflı tarafını) gösterin.',
        reason: analysis.reason
      }, { status: 400 })
    }

    if (analysis.suspiciousActivity) {
      return NextResponse.json({
        success: false,
        error: 'Suspicious activity detected. Please use your original ID document.',
        errorTR: 'Şüpheli aktivite tespit edildi. Orijinal kimlik belgenizi kullanın.',
        reason: analysis.reason
      }, { status: 400 })
    }

    // İsim eşleştirmesi (basit kontrol) / Name matching
    const extractedName = analysis.extractedName?.toLowerCase().trim()
    const userName = user.name?.toLowerCase().trim()

    if (!extractedName) {
      return NextResponse.json({
        success: false,
        error: 'Could not read the name on your document. Please upload a clearer photo.',
        errorTR: 'Belgedeki isim okunamadı. Lütfen daha net bir fotoğraf yükleyin.',
        reason: analysis.reason
      }, { status: 400 })
    }

    // İsim benzerlik kontrolü (en az bir kelime eşleşmeli)
    const extractedParts = extractedName.split(/\s+/)
    const userParts = userName?.split(/\s+/) || []
    const hasMatch = extractedParts.some((part: string) => 
      userParts.some((userPart: string) => 
        part.length > 2 && userPart.length > 2 && 
        (part.includes(userPart) || userPart.includes(part))
      )
    )

    if (!hasMatch && userName) {
      return NextResponse.json({
        success: false,
        error: 'The name on your ID does not match your account. Please update your profile or contact support@takas-a.com',
        errorTR: 'Belgedeki isim hesap bilgilerinizle eşleşmiyor. Profil bilgilerinizi güncelleyin veya support@takas-a.com ile iletişime geçin.',
        reason: 'Name mismatch'
      }, { status: 400 })
    }
    
    // Log document type and country for analytics
    console.log(`[Identity] Verified: ${analysis.documentType} from ${analysis.documentCountry} for user ${user.id}`)

    // Başarılı doğrulama - kullanıcıyı güncelle
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isIdentityVerified: true,
        trustScore: Math.min(100, user.trustScore + 15), // Güven puanı artışı
        identityDocUrl: cloud_storage_path, // S3'teki dosya yolu
        identityVerifiedAt: new Date(),
        identityVerifyStatus: 'verified'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Your identity has been verified! 🎉',
      messageTR: 'Kimliğiniz başarıyla doğrulandı! 🎉',
      trustScoreBonus: 15,
      documentType: analysis.documentType,
      documentCountry: analysis.documentCountry,
      newBenefit: 'You now only need 5% deposit for swaps.',
      newBenefitTR: 'Artık takaslarda sadece %5 teminat yatırmanız yeterli.'
    })

  } catch (error) {
    console.error('Identity verification error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
