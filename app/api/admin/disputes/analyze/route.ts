import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GÖREV 48: Dispute türü etiketleri
const disputeTypeLabels: Record<string, string> = {
  product_mismatch: 'Ürün açıklamayla uyuşmuyor',
  product_damaged: 'Ürün hasarlı/kusurlu geldi',
  product_not_delivered: 'Ürün teslim edilmedi',
  wrong_product: 'Yanlış ürün gönderildi',
  valor_dispute: 'VALOR değeri anlaşmazlığı',
  communication_issue: 'İletişim sorunu',
  fraud_suspicion: 'Dolandırıcılık şüphesi',
  defect: 'Ürün kusurlu',
  not_as_described: 'Açıklamayla uyuşmuyor',
  missing_parts: 'Eksik parça',
  damaged: 'Hasar var',
  wrong_item: 'Yanlış ürün gönderilmiş',
  no_show: 'Karşı taraf gelmedi',
  other: 'Diğer'
}

const expectedResolutionLabels: Record<string, string> = {
  refund_valor: 'VALOR iadesi',
  product_return: 'Ürün iadesi',
  replacement: 'Değişim',
  partial_refund: 'Kısmi VALOR iadesi',
  apology: 'Özür / uyarı yeterli',
  other: 'Diğer'
}

interface AIAnalysisResult {
  legitimacyScore: number
  likelyRightParty: 'reporter' | 'respondent' | 'unclear'
  suggestedResolution: string
  fraudRisk: 'low' | 'medium' | 'high'
  reasoning: string
  recommendations: string[]
}

// POST: AI Analizi Yap — GÖREV 48
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }
    
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, email: true },
    })
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
    }

    // Admin kontrolü
    if (currentUser.role !== 'admin' && currentUser.email !== 'join@takas-a.com') {
      return NextResponse.json({ error: 'Admin yetkisi gerekli' }, { status: 403 })
    }

    const { disputeId } = await request.json()

    if (!disputeId) {
      return NextResponse.json({ error: 'Dispute ID gerekli' }, { status: 400 })
    }

    // Dispute bilgilerini detaylı çek
    const dispute = await prisma.disputeReport.findUnique({
      where: { id: disputeId },
      include: {
        swapRequest: {
          include: {
            product: { select: { id: true, title: true, description: true, images: true, valorPrice: true } },
            offeredProduct: { select: { id: true, title: true, description: true, images: true, valorPrice: true } },
            owner: { select: { id: true, name: true, trustScore: true } },
            requester: { select: { id: true, name: true, trustScore: true } },
          },
        },
      },
    })

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute bulunamadı' }, { status: 404 })
    }

    // Takas geçmişi
    const [reporterSwaps, ownerSwaps, reporterDisputes, ownerDisputes] = await Promise.all([
      prisma.swapRequest.count({
        where: {
          OR: [{ requesterId: dispute.reporterId }, { ownerId: dispute.reporterId }],
          status: 'completed'
        }
      }),
      prisma.swapRequest.count({
        where: {
          OR: [{ requesterId: dispute.reportedUserId }, { ownerId: dispute.reportedUserId }],
          status: 'completed'
        }
      }),
      prisma.disputeReport.count({
        where: { reporterId: dispute.reporterId, status: { not: 'resolved' } }
      }),
      prisma.disputeReport.count({
        where: { reportedUserId: dispute.reportedUserId }
      })
    ])

    // Abacus AI API'sine gönderilecek prompt
    const analysisPrompt = `
Sen bir takas platformu anlaşmazlık hakemisin. Aşağıdaki bilgileri inceleyerek adil bir analiz yap.

ANLAŞMAZLIK BİLGİLERİ:
- ID: ${dispute.id}
- Tür: ${disputeTypeLabels[dispute.disputeType || dispute.type] || dispute.type}
- Bildiren: ${dispute.swapRequest.requester.name || 'Anonim'} (Güven: ${dispute.swapRequest.requester.trustScore || 100}/100, ${reporterSwaps} takas tamamlanmış)
- Karşı Taraf: ${dispute.swapRequest.owner.name || 'Anonim'} (Güven: ${dispute.swapRequest.owner.trustScore || 100}/100, ${ownerSwaps} takas tamamlanmış)
- Açıklama: ${dispute.description}
- Beklenen Çözüm: ${expectedResolutionLabels[dispute.expectedResolution || ''] || dispute.expectedResolution || 'Belirtilmemiş'}

TAKAS EDİLEN ÜRÜNLER:
1. Talep Edilen: ${dispute.swapRequest.product.title}
   - Açıklama: ${dispute.swapRequest.product.description?.substring(0, 200) || 'Yok'}
   - VALOR: ${dispute.swapRequest.product.valorPrice || 0}
   
2. Teklif Edilen: ${dispute.swapRequest.offeredProduct?.title || 'Bilgi yok'}
   - Açıklama: ${dispute.swapRequest.offeredProduct?.description?.substring(0, 200) || 'Yok'}
   - VALOR: ${dispute.swapRequest.offeredProduct?.valorPrice || 'Yok'}

EK BİLGİLER:
- Bildirici önceki anlaşmazlık sayısı: ${reporterDisputes}
- Karşı taraf şikayet edilme sayısı: ${ownerDisputes}
- Kanıt fotoğrafları: ${dispute.evidencePhotos?.length || dispute.evidence?.length || 0} adet

Lütfen şunları analiz et:
1. Anlaşmazlığın meşruiyeti (1-10 puan)
2. Hangi tarafın haklı olma olasılığı daha yüksek?
3. Önerilen çözüm
4. Risk değerlendirmesi (dolandırıcılık riski var mı?)
5. Gerekçe
6. Öneriler

Yanıtını şu JSON formatında ver:
{
  "legitimacyScore": 8,
  "likelyRightParty": "reporter|respondent|unclear",
  "suggestedResolution": "...",
  "fraudRisk": "low|medium|high",
  "reasoning": "...",
  "recommendations": ["...", "..."]
}
`

    let analysis: AIAnalysisResult

    // Abacus AI API çağrısı dene
    try {
      const abacusApiKey = process.env.ABACUSAI_API_KEY
      
      if (abacusApiKey) {
        // Abacus AI API çağrısı
        const aiResponse = await fetch('https://api.abacus.ai/api/v0/predict', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${abacusApiKey}`
          },
          body: JSON.stringify({
            deploymentToken: abacusApiKey,
            deploymentId: process.env.ABACUSAI_DEPLOYMENT_ID || 'takas-dispute-analyzer',
            queryData: { query: analysisPrompt }
          })
        })

        if (aiResponse.ok) {
          const aiData = await aiResponse.json()
          // AI yanıtını parse et
          if (aiData.result) {
            try {
              analysis = typeof aiData.result === 'string' ? JSON.parse(aiData.result) : aiData.result
            } catch {
              analysis = generateHeuristicAnalysis(dispute, reporterSwaps, ownerSwaps, reporterDisputes, ownerDisputes)
            }
          } else {
            analysis = generateHeuristicAnalysis(dispute, reporterSwaps, ownerSwaps, reporterDisputes, ownerDisputes)
          }
        } else {
          console.log('Abacus AI API failed, using heuristic analysis')
          analysis = generateHeuristicAnalysis(dispute, reporterSwaps, ownerSwaps, reporterDisputes, ownerDisputes)
        }
      } else {
        // API key yoksa heuristic analiz kullan
        console.log('No Abacus AI API key, using heuristic analysis')
        analysis = generateHeuristicAnalysis(dispute, reporterSwaps, ownerSwaps, reporterDisputes, ownerDisputes)
      }
    } catch (aiError) {
      console.error('AI API error:', aiError)
      // Fallback: Basit heuristic analiz
      analysis = generateHeuristicAnalysis(dispute, reporterSwaps, ownerSwaps, reporterDisputes, ownerDisputes)
    }

    // AI analizini DB'ye kaydet
    await prisma.disputeReport.update({
      where: { id: disputeId },
      data: { aiAnalysis: JSON.stringify(analysis) }
    })

    return NextResponse.json({ 
      success: true, 
      analysis,
      message: 'AI analizi tamamlandı'
    })
  } catch (error) {
    console.error('AI analysis error:', error)
    return NextResponse.json({ error: 'AI analizi yapılamadı' }, { status: 500 })
  }
}

// GÖREV 48: Heuristic analiz fonksiyonu (AI yoksa fallback)
function generateHeuristicAnalysis(
  dispute: any,
  reporterSwaps: number,
  ownerSwaps: number,
  reporterDisputes: number,
  ownerDisputes: number
): AIAnalysisResult {
  const reporterTrust = dispute.swapRequest.requester.trustScore || 100
  const ownerTrust = dispute.swapRequest.owner.trustScore || 100
  
  // Meşruiyet puanı hesapla
  let legitimacyScore = 5 // Başlangıç değeri
  
  // Bildirici güvenilirliği
  if (reporterTrust >= 80) legitimacyScore += 2
  else if (reporterTrust >= 60) legitimacyScore += 1
  else if (reporterTrust < 40) legitimacyScore -= 1
  
  // Takas geçmişi
  if (reporterSwaps >= 10) legitimacyScore += 1
  if (ownerSwaps >= 10 && ownerTrust >= 80) legitimacyScore -= 0.5
  
  // Önceki anlaşmazlıklar
  if (reporterDisputes > 2) legitimacyScore -= 1
  if (ownerDisputes > 3) legitimacyScore += 1
  
  // Kanıt var mı?
  const evidenceCount = dispute.evidencePhotos?.length || dispute.evidence?.length || 0
  if (evidenceCount >= 3) legitimacyScore += 1
  else if (evidenceCount === 0) legitimacyScore -= 1
  
  legitimacyScore = Math.max(1, Math.min(10, Math.round(legitimacyScore)))
  
  // Haklı taraf belirleme
  let likelyRightParty: 'reporter' | 'respondent' | 'unclear' = 'unclear'
  if (reporterTrust > ownerTrust + 20 && evidenceCount >= 2) {
    likelyRightParty = 'reporter'
  } else if (ownerTrust > reporterTrust + 20 && reporterDisputes > ownerDisputes) {
    likelyRightParty = 'respondent'
  } else if (legitimacyScore >= 7) {
    likelyRightParty = 'reporter'
  } else if (legitimacyScore <= 3) {
    likelyRightParty = 'respondent'
  }
  
  // Dolandırıcılık riski
  let fraudRisk: 'low' | 'medium' | 'high' = 'low'
  if (dispute.disputeType === 'fraud_suspicion' || dispute.type === 'fraud_suspicion') {
    fraudRisk = 'high'
  } else if (ownerTrust < 30 || reporterDisputes > 3) {
    fraudRisk = 'medium'
  } else if (ownerDisputes > 5) {
    fraudRisk = 'high'
  }
  
  // Önerilen çözüm
  let suggestedResolution = ''
  if (likelyRightParty === 'reporter' && legitimacyScore >= 7) {
    suggestedResolution = 'Bildirici lehine karar: VALOR iadesi ve karşı tarafa uyarı önerilir.'
  } else if (likelyRightParty === 'respondent') {
    suggestedResolution = 'Karşı taraf lehine karar: Şikayetin reddedilmesi önerilir.'
  } else {
    suggestedResolution = 'Karşılıklı uzlaşma: Her iki tarafın da kısmi haklılığı değerlendirilebilir.'
  }
  
  // Gerekçe
  const reasoning = `Bildirici güven puanı: ${reporterTrust}/100, ${reporterSwaps} takas tamamlanmış. ` +
    `Karşı taraf güven puanı: ${ownerTrust}/100, ${ownerSwaps} takas tamamlanmış. ` +
    `Anlaşmazlık türü: ${disputeTypeLabels[dispute.disputeType || dispute.type] || dispute.type}. ` +
    `Kanıt sayısı: ${evidenceCount}. ` +
    `Bildirici önceki anlaşmazlık: ${reporterDisputes}, Karşı taraf şikayet edilme: ${ownerDisputes}.`
  
  // Öneriler
  const recommendations: string[] = [
    'Her iki tarafla iletişime geçin',
    evidenceCount > 0 ? 'Kanıt fotoğraflarını detaylı inceleyin' : 'Daha fazla kanıt talep edin',
    'Takas geçmişini kontrol edin'
  ]
  
  if (fraudRisk !== 'low') {
    recommendations.push('Dolandırıcılık riski nedeniyle dikkatli olun')
  }
  
  if (legitimacyScore >= 7) {
    recommendations.push('Bildirici şikayetinin haklı olma ihtimali yüksek')
  }
  
  return {
    legitimacyScore,
    likelyRightParty,
    suggestedResolution,
    fraudRisk,
    reasoning,
    recommendations
  }
}
