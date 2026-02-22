import prisma from '@/lib/db'

// SADECE TELEFON VE EMAIL ENGELLENİR
// Diğer tüm mesajlar serbesttir - kullanıcılar rahatça iletişim kurabilir
const EXTERNAL_CONTACT_PATTERNS = [
  // Türk cep telefonu formatları
  /\b0\s*5\s*[0-9]{2}\s*[0-9]{3}\s*[0-9]{2}\s*[0-9]{2}\b/gi, // 05XX XXX XX XX (boşluklu)
  /\b05[0-9]{9}\b/g, // 05XXXXXXXXX (boşluksuz)
  /\+\s*90\s*5[0-9]{9}\b/gi, // +90 5XXXXXXXXX
  /\+\s*90\s*5\s*[0-9]{2}\s*[0-9]{3}\s*[0-9]{2}\s*[0-9]{2}\b/gi, // +90 5XX XXX XX XX
  
  // Email adresleri
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi, // standart email
]

export interface ModerationResult {
  isApproved: boolean
  result: 'approved' | 'warning' | 'blocked' | 'policy_violation'
  reason?: string
  containsPersonalInfo: boolean
  detectedPatterns?: string[]
  warningMessage?: string
  violationType?: 'external_contact'
}

// Sadece telefon ve email için uyarı mesajı
export const POLICY_WARNING_MESSAGES = {
  external_contact: {
    tr: '📵 Telefon numarası veya email adresi paylaşamazsınız.\n\n🔒 Güvenliğiniz için bu bilgiler engellenmiştir.\n\n✅ Mesajlaşmaya devam edebilirsiniz!',
    en: '📵 You cannot share phone numbers or email addresses.\n\n🔒 This information is blocked for your safety.\n\n✅ You can continue messaging!',
    es: '📵 No puede compartir números de teléfono o direcciones de email.\n\n🔒 Esta información está bloqueada por seguridad.\n\n✅ ¡Puede continuar mensajeando!',
    ca: '📵 No podeu compartir números de telèfon o adreces de correu.\n\n🔒 Aquesta informació està bloquejada per seguretat.\n\n✅ Podeu continuar enviant missatges!'
  }
}

// Sadece dış iletişim bilgisi kontrolü - esnek moderasyon
export function quickModeration(content: string, lang: string = 'tr'): ModerationResult {
  const language = lang as keyof typeof POLICY_WARNING_MESSAGES.external_contact
  
  // SADECE dış iletişim bilgisi kontrolü (telefon, email, sosyal medya)
  for (const pattern of EXTERNAL_CONTACT_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(content)) {
      return {
        isApproved: false,
        result: 'policy_violation',
        reason: 'Platform dışı iletişim bilgisi tespit edildi',
        containsPersonalInfo: true,
        detectedPatterns: ['external_contact'],
        warningMessage: POLICY_WARNING_MESSAGES.external_contact[language] || POLICY_WARNING_MESSAGES.external_contact.tr,
        violationType: 'external_contact'
      }
    }
  }
  
  // Diğer tüm mesajlar onaylanır - ahlaki açıdan sorun yoksa geçer
  return {
    isApproved: true,
    result: 'approved',
    containsPersonalInfo: false,
    detectedPatterns: []
  }
}

// AI tabanlı derin moderasyon
export async function aiModeration(content: string): Promise<ModerationResult> {
  try {
    const response = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `Sen bir mesaj moderasyon asistanısın. Kullanıcı mesajlarını aşağıdaki kriterlere göre değerlendir:

1. KİŞİSEL BİLGİ KONTROLÜ:
   - Telefon numarası (05XX, +90, vb.)
   - Email adresi
   - Ev/iş adresi
   - Sosyal medya hesapları (Instagram, WhatsApp, Telegram kullanıcı adı)
   
2. UYGUNSUZ İÇERİK KONTROLÜ:
   - Küfür, hakaret
   - Cinsel içerik, pornografik ifadeler
   - Taciz, tehdit
   - Irkçılık, nefret söylemi
   - Spam, dolandırıcılık girişimi

3. ETİK KONTROL:
   - Platformu yanlış kullanma (para isteme, satış yapma)
   - Diğer kullanıcıları platforma dışına yönlendirme

YANİT FORMATİ (sadece JSON):
{
  "result": "approved" | "warning" | "blocked",
  "reason": "varsa açıklama",
  "containsPersonalInfo": true | false,
  "severity": "low" | "medium" | "high"
}

Eğer mesaj tamamen uygunsa: {"result": "approved", "reason": null, "containsPersonalInfo": false, "severity": "low"}
Eğer kişisel bilgi varsa ama diğer içerik uygunsa: result="warning"
Eğer uygunsuz içerik varsa: result="blocked"`
          },
          {
            role: 'user',
            content: `Mesajı değerlendir:\n"${content}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      })
    })
    
    if (!response.ok) {
      console.error('AI moderation API error:', response.status)
      // API hatasında quick moderation kullan
      return quickModeration(content)
    }
    
    const data = await response.json()
    const aiResponse = data.choices?.[0]?.message?.content || ''
    
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          isApproved: parsed.result === 'approved',
          result: parsed.result,
          reason: parsed.reason,
          containsPersonalInfo: parsed.containsPersonalInfo || false,
          detectedPatterns: parsed.severity ? [parsed.severity] : []
        }
      }
    } catch (parseError) {
      console.error('AI response parse error:', parseError)
    }
    
    // Parse edilemezse quick moderation kullan
    return quickModeration(content)
    
  } catch (error) {
    console.error('AI moderation error:', error)
    return quickModeration(content)
  }
}

// Kullanıcı uyarı ve ceza sistemi
export async function processWarning(userId: string, messageId: string, type: string, severity: string): Promise<{
  warningGiven: boolean
  suspensionApplied: boolean
  suspensionDuration?: string
  valorReturned?: number
}> {
  // Uyarı kaydet
  await prisma.userWarning.create({
    data: {
      userId,
      messageId,
      type,
      severity,
      description: `Uygunsuz mesaj içeriği tespit edildi: ${type}`
    }
  })
  
  // Kullanıcıyı güncelle
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      totalWarnings: { increment: 1 },
      lastWarningAt: new Date()
    }
  })
  
  const totalWarnings = user.totalWarnings
  
  // Ciddi ihlallerde (high severity) veya tekrarlayan ihlallerde askıya al
  const shouldSuspend = severity === 'high' || totalWarnings >= 3
  
  if (shouldSuspend) {
    const suspensionCount = user.suspensionCount + 1
    let suspendedUntil: Date | null = null
    let suspensionDuration = ''
    
    if (suspensionCount === 1) {
      // İlk askıya alma: 1 ay
      suspendedUntil = new Date()
      suspendedUntil.setMonth(suspendedUntil.getMonth() + 1)
      suspensionDuration = '1 ay'
    } else if (suspensionCount === 2) {
      // İkinci askıya alma: 3 ay
      suspendedUntil = new Date()
      suspendedUntil.setMonth(suspendedUntil.getMonth() + 3)
      suspensionDuration = '3 ay'
    } else {
      // Üçüncü ve sonrası: Kalıcı (2099 yılı)
      suspendedUntil = new Date('2099-12-31')
      suspensionDuration = 'kalıcı'
    }
    
    // Valor'u sisteme geri aktar
    let valorReturned = 0
    if (user.valorBalance > 0) {
      valorReturned = user.valorBalance
      
      // Sistem config'i güncelle - Valor'u community pool'a ekle
      await prisma.systemConfig.upsert({
        where: { id: 'main' },
        create: {
          communityPoolValor: BigInt(valorReturned)
        },
        update: {
          communityPoolValor: { increment: BigInt(valorReturned) }
        }
      })
      
      // Valor transaction kaydet
      await prisma.valorTransaction.create({
        data: {
          fromUserId: userId,
          toUserId: null, // sisteme
          amount: valorReturned,
          fee: 0,
          netAmount: valorReturned,
          type: 'suspension_return',
          description: `Hesap askıya alındı - Valor sisteme iade edildi (${suspensionDuration})`
        }
      })
    }
    
    // Kullanıcıyı askıya al
    await prisma.user.update({
      where: { id: userId },
      data: {
        suspendedUntil,
        suspensionCount,
        valorBalance: 0,
        totalWarnings: 0 // Reset warnings after suspension
      }
    })
    
    return {
      warningGiven: true,
      suspensionApplied: true,
      suspensionDuration,
      valorReturned
    }
  }
  
  return {
    warningGiven: true,
    suspensionApplied: false
  }
}

// Kullanıcının askıda olup olmadığını kontrol et
export async function checkUserSuspension(userId: string): Promise<{
  isSuspended: boolean
  suspendedUntil?: Date
  reason?: string
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { suspendedUntil: true, suspensionCount: true }
  })
  
  if (!user?.suspendedUntil) {
    return { isSuspended: false }
  }
  
  const now = new Date()
  if (user.suspendedUntil > now) {
    const isPermanent = user.suspendedUntil.getFullYear() >= 2099
    return {
      isSuspended: true,
      suspendedUntil: user.suspendedUntil,
      reason: isPermanent 
        ? 'Hesabınız kalıcı olarak askıya alınmıştır.' 
        : `Hesabınız ${user.suspendedUntil.toLocaleDateString('tr-TR')} tarihine kadar askıda.`
    }
  }
  
  // Askıya alma süresi dolmuş, temizle
  await prisma.user.update({
    where: { id: userId },
    data: { suspendedUntil: null }
  })
  
  return { isSuspended: false }
}

// Nazik uyarı mesajları
export const WARNING_MESSAGES = {
  personal_info: `⚠️ Güvenliğiniz için kişisel bilgilerinizi (telefon, email, adres, sosyal medya) platform içinde paylaşmamanızı öneriyoruz. Tüm iletişim TAKAS-A üzerinden yapılmalıdır.`,
  
  inappropriate_mild: `🙏 Lütfen saygılı bir dil kullanalım. TAKAS-A topluluğu herkesin rahat hissettiği bir yer olmalı.`,
  
  inappropriate_severe: `⛔ Mesajınız topluluk kurallarımıza aykırı içerik barındırıyor. Bu tür davranışlar hesabınızın askıya alınmasına neden olabilir.`,
  
  first_warning: `💡 Bu ilk uyarınız. Lütfen topluluk kurallarımıza uygun hareket edin.`,
  
  second_warning: `⚠️ Bu ikinci uyarınız. Bir sonraki ihlalde hesabınız geçici olarak askıya alınabilir.`,
  
  suspension_1month: `🚫 Hesabınız 1 ay süreyle askıya alınmıştır. Valorlarınız topluluk havuzuna iade edilmiştir.`,
  
  suspension_3months: `🚫 Hesabınız 3 ay süreyle askıya alınmıştır. Valorlarınız topluluk havuzuna iade edilmiştir.`,
  
  suspension_permanent: `🚫 Hesabınız kalıcı olarak askıya alınmıştır. Tüm Valorlarınız topluluk havuzuna iade edilmiştir.`
}