import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

// VAPID ayarları
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidSubject = process.env.NEXTAUTH_URL || 'https://takas-a.com'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

// Engagement bildirim şablonları - ilgi çekici hikayeler
const engagementTemplates = [
  // Kullanıcı hikayeleri
  {
    title: 'Ayşe Teyze evini taşıyor! 🏠',
    body: 'Fazla eşyalarını takas yoluyla yeni sahiplerine ulaştırmak istiyor. Belki aradığın şey onda vardır!',
    url: '/urunler'
  },
  {
    title: 'Fernando İzmir\'e yeni taşındı! 🌟',
    body: 'Yatak odası takımı arıyor. Senin kullanmadığın mobilya onun hayalini gerçekleştirebilir!',
    url: '/urunler?category=mobilya'
  },
  {
    title: 'Mehmet Bey garajını boşaltıyor! 🚗',
    body: 'Yıllardır biriktirdiği spor ekipmanlarını takas etmek istiyor. Spor tutkunları için kaçırılmayacak fırsat!',
    url: '/urunler?category=spor'
  },
  {
    title: 'Zeynep bebek odası hazırlıyor! 👶',
    body: 'Çocuk kıyafetleri ve oyuncaklar arıyor. Çocuklarının eskidiği eşyalar yeni bir aileye umut olabilir!',
    url: '/urunler?category=bebek-cocuk'
  },
  {
    title: 'Can evden çalışmaya başladı! 💻',
    body: 'Home office için masa ve sandalye arıyor. Ofis eşyaların için harika bir takas fırsatı!',
    url: '/urunler?category=mobilya'
  },
  {
    title: 'Elif kitaplığını yeniliyor! 📚',
    body: 'Okuduğu kitapları paylaşmak, yenilerini keşfetmek istiyor. Kitap severler için mükemmel fırsat!',
    url: '/urunler?category=kitap'
  },
  // Platform aktiviteleri
  {
    title: 'Bu hafta 47 takas tamamlandı! 🎉',
    body: 'TAKAS-A topluluğu büyümeye devam ediyor. Sen de bu harekete katıl!',
    url: '/'
  },
  {
    title: 'Yeni ürünler eklendi! ✨',
    body: 'Son 24 saatte 23 yeni ürün listelendi. Belki aradığın şey yeni eklenenler arasındadır!',
    url: '/urunler?sort=newest'
  },
  {
    title: 'Valor puanlarını kullan! 💎',
    body: 'Hesabındaki Valor puanlarıyla takas işlemlerinde avantaj sağla. Kontrol etmeyi unutma!',
    url: '/profil'
  },
  {
    title: 'Takas zincirleri oluşuyor! 🔗',
    body: 'Çoklu takas fırsatları seni bekliyor. 3-5 kişilik zincirlerde herkes kazanıyor!',
    url: '/takas-firsatlari'
  },
  // Motivasyon
  {
    title: 'Kullanmadığın eşyalar değer kazansın! 🌱',
    body: 'Evindeki kullanılmayan eşyalar başkası için hazine olabilir. Hemen bir ürün ekle!',
    url: '/urun-ekle'
  },
  {
    title: 'Sürdürülebilir yaşam için bir adım! 🌍',
    body: 'Her takas, daha az israf demek. Bugün sen de fark yarat!',
    url: '/'
  }
]

// Rastgele şablon seç
function getRandomTemplate() {
  const index = Math.floor(Math.random() * engagementTemplates.length)
  return engagementTemplates[index]
}

// Tüm aktif abonelere bildirim gönder
async function sendToAllSubscribers(payload: { title: string; body: string; url: string }) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { isActive: true }
  })

  const results = {
    sent: 0,
    failed: 0,
    deactivated: 0
  }

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-96x96.png',
          url: payload.url,
          tag: `engagement-${Date.now()}`
        })
      )
      results.sent++
    } catch (error: any) {
      results.failed++
      
      // Geçersiz abonelikleri deaktif et
      if (error.statusCode === 404 || error.statusCode === 410) {
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { isActive: false }
        })
        results.deactivated++
      }
    }
  }

  return results
}

// POST: Engagement bildirimi gönder (scheduled task tarafından çağrılır)
export async function POST(request: Request) {
  try {
    // API key kontrolü (güvenlik için)
    const authHeader = request.headers.get('authorization')
    const apiKey = process.env.ENGAGEMENT_NOTIFICATION_KEY || 'takas-a-engagement-2024'
    
    if (authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Özel şablon veya rastgele seç
    const body = await request.json().catch(() => ({}))
    const template = body.template || getRandomTemplate()

    // Bildirimleri gönder
    const results = await sendToAllSubscribers(template)

    // Log kaydet
    console.log(`Engagement notifications sent:`, results)

    return NextResponse.json({
      success: true,
      template: template.title,
      results
    })
  } catch (error) {
    console.error('Engagement notification error:', error)
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 })
  }
}

// GET: Mevcut şablonları listele (test için)
export async function GET() {
  return NextResponse.json({
    templates: engagementTemplates,
    count: engagementTemplates.length
  })
}
