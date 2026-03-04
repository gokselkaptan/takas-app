import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// Simüle isim listesi
const SIMULATED_NAMES = [
  'Ayşe K.', 'Mehmet Y.', 'Zeynep A.', 'Ali R.', 'Fatma S.',
  'Emre B.', 'Deniz T.', 'Selin M.', 'Burak Ö.', 'Elif D.',
  'Can K.', 'Merve H.', 'Oğuz C.', 'Beren Y.', 'Cem A.',
  'Esra N.', 'Kaan T.', 'Yasemin B.', 'Onur K.', 'Pınar S.'
]

// Admin isimleri (Admin, TAKAS-A Admin, Test Kullanıcı vb. için simüle isim)
const ADMIN_SIMULATED_NAMES = [
  'Murat K.', 'Ceren Y.', 'Kemal A.', 'Sibel T.', 'Tolga M.',
  'Aylin D.', 'Serkan B.', 'Gülay Ö.', 'Volkan R.', 'Neslihan S.'
]

// İsmi baş harflere çevir (örn: "Salih Goksel GUZEL" -> "S.G.")
function nameToInitials(name: string): string {
  if (!name || name.trim() === '') return ''
  
  const parts = name.trim().split(/\s+/).filter(p => p.length > 0)
  if (parts.length === 0) return ''
  
  if (parts.length === 1) {
    // Tek kelime: İlk harf + nokta (örn: "Salih" -> "S.")
    return parts[0].charAt(0).toUpperCase() + '.'
  }
  
  // Birden fazla kelime: İlk harfler (örn: "Salih Goksel" -> "S.G.")
  const initials = parts.map(p => p.charAt(0).toUpperCase()).join('.')
  return initials + '.'
}

// Gizlilik için isim dönüştürme: nickname > initials > simüle
function getDisplayName(userName: string | null, nickname: string | null = null, index: number = 0): string {
  // Nickname varsa onu kullan
  if (nickname && nickname.trim() !== '') {
    return nickname.trim()
  }
  
  // İsim yoksa simüle isim döndür
  if (!userName || userName.trim() === '') {
    return SIMULATED_NAMES[index % SIMULATED_NAMES.length]
  }
  
  // Admin veya sistem isimleri kontrolü
  const adminKeywords = ['admin', 'takas-a', 'test', 'kullanıcı', 'user', 'system', 'sistem']
  const lowerName = userName.toLowerCase()
  
  if (adminKeywords.some(keyword => lowerName.includes(keyword))) {
    // Admin için farklı simüle isim kullan
    return ADMIN_SIMULATED_NAMES[index % ADMIN_SIMULATED_NAMES.length]
  }
  
  // Gerçek isimse baş harflere çevir
  return nameToInitials(userName)
}

// Aktivite feed'i getir
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    
    // Son aktiviteleri getir
    const activities = await prisma.activityFeed.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit * 2, // Silinmiş ürünler için fazladan getir
      select: {
        id: true,
        type: true,
        userId: true,
        userName: true,
        productId: true,
        productTitle: true,
        targetUserId: true,
        targetUserName: true,
        targetProductTitle: true,
        city: true,
        metadata: true,
        createdAt: true
      }
    })
    
    // productId'leri toplayıp mevcut ürünleri kontrol et
    const productIds = activities
      .map(a => a.productId)
      .filter((id): id is string => id !== null)
    
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, status: 'active' },
      select: { id: true }
    })
    
    const activeProductIds = new Set(existingProducts.map(p => p.id))
    
    // Silinmiş veya inaktif ürünlerin productId'sini null yap
    const validActivities = activities.map(activity => ({
      ...activity,
      productId: activity.productId && activeProductIds.has(activity.productId) 
        ? activity.productId 
        : null
    })).slice(0, limit)
    
    // Kullanıcı ID'lerini topla ve nickname'leri getir
    const userIds = [...new Set(
      validActivities.flatMap(a => [a.userId, a.targetUserId].filter(Boolean) as string[])
    )]
    
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nickname: true }
    })
    
    const userNicknameMap = new Map<string, string | null>(users.map(u => [u.id, u.nickname]))
    
    // İsimleri gizlilik için dönüştür (nickname > initials > simüle)
    const processedActivities = validActivities.map((activity, index) => ({
      ...activity,
      userName: getDisplayName(
        activity.userName, 
        activity.userId ? (userNicknameMap.get(activity.userId) ?? null) : null,
        index
      ),
      targetUserName: activity.targetUserName 
        ? getDisplayName(
            activity.targetUserName, 
            activity.targetUserId ? (userNicknameMap.get(activity.targetUserId) ?? null) : null,
            index + 10
          ) 
        : activity.targetUserName
    }))
    
    // Eğer yeterli aktivite yoksa, simüle edilmiş veriler ekle
    if (processedActivities.length < 5) {
      const simulatedActivities = await generateSimulatedActivities(5 - processedActivities.length)
      return NextResponse.json({
        activities: [...processedActivities, ...simulatedActivities]
      })
    }
    
    return NextResponse.json({ activities: processedActivities })
  } catch (error) {
    console.error('Activity feed error:', error)
    // Hata durumunda simüle edilmiş veri dön
    const simulatedActivities = await generateSimulatedActivities(10)
    return NextResponse.json({
      activities: simulatedActivities
    })
  }
}

// Simüle edilmiş aktiviteler (gerçek veriler olana kadar)
async function generateSimulatedActivities(count: number) {
  const names = [
    'Ayşe K.', 'Mehmet Y.', 'Zeynep A.', 'Ali R.', 'Fatma S.',
    'Emre B.', 'Deniz T.', 'Selin M.', 'Burak Ö.', 'Elif D.',
    'Can K.', 'Merve H.', 'Oğuz C.', 'Beren Y.', 'Cem A.'
  ]
  
  const cities = ['İzmir', 'Bornova', 'Karşıyaka', 'Buca', 'Konak', 'Alsancak']
  
  // Gerçek ürünleri getir (productId için)
  let realProducts: { id: string; title: string }[] = []
  try {
    realProducts = await prisma.product.findMany({
      select: { id: true, title: true },
      take: 20,
      orderBy: { createdAt: 'desc' }
    })
  } catch (e) {
    console.error('Could not fetch products for simulation:', e)
  }
  
  // Fallback ürün isimleri (gerçek ürün yoksa)
  const fallbackProducts = [
    'iPhone 13', 'MacBook Air', 'Vintage Ceket', 'Kitaplık', 'Oyun Konsolu',
    'Bisiklet', 'Kamera', 'Akıllı Saat', 'Tablet', 'Bluetooth Kulaklık',
    'Elektrik Süpürgesi', 'Kahve Makinesi', 'Yoga Matı', 'Gitar', 'Bebek Arabası'
  ]
  
  interface SimulatedActivity {
    type: string
    userName: string
    city: string
    productId: string | null
    productTitle: string
    createdAt: Date
    metadata?: string
    targetUserName?: string
    targetProductTitle?: string
  }
  
  const activities: SimulatedActivity[] = []
  const now = Date.now()
  
  for (let i = 0; i < count; i++) {
    const typeRoll = Math.random() * 10
    let activityType = 'product_added'
    
    if (typeRoll < 4) activityType = 'swap_completed'
    else if (typeRoll < 5) activityType = 'multi_swap'
    
    const userName = names[Math.floor(Math.random() * names.length)]
    const city = cities[Math.floor(Math.random() * cities.length)]
    
    // Gerçek ürünlerden rastgele seç veya fallback kullan
    let productId: string | null = null
    let productTitle: string
    
    if (realProducts.length > 0) {
      const randomProduct = realProducts[Math.floor(Math.random() * realProducts.length)]
      productId = randomProduct.id
      productTitle = randomProduct.title
    } else {
      productTitle = fallbackProducts[Math.floor(Math.random() * fallbackProducts.length)]
    }
    
    // Rastgele zaman (son 2 saat içinde)
    const timeAgo = Math.floor(Math.random() * 7200000) // 0-2 saat
    const createdAt = new Date(now - timeAgo - (i * 300000)) // Her biri 5 dk arayla
    
    const activity: any = {
      id: `sim_${i}_${Date.now()}`,
      type: activityType,
      userName,
      productId,
      productTitle,
      city,
      createdAt
    }
    
    if (activityType === 'swap_completed' || activityType === 'multi_swap') {
      activity.targetUserName = names[Math.floor(Math.random() * names.length)]
      
      // Hedef ürün için de gerçek ürün kullan
      if (realProducts.length > 0) {
        const randomTargetProduct = realProducts[Math.floor(Math.random() * realProducts.length)]
        activity.targetProductTitle = randomTargetProduct.title
      } else {
        activity.targetProductTitle = fallbackProducts[Math.floor(Math.random() * fallbackProducts.length)]
      }
      
      // Aynı isim olmasın
      while (activity.targetUserName === userName) {
        activity.targetUserName = names[Math.floor(Math.random() * names.length)]
      }
    }
    
    if (activityType === 'multi_swap') {
      activity.metadata = JSON.stringify({ participantCount: Math.floor(Math.random() * 3) + 3 })
    }
    
    activities.push(activity)
  }
  
  return activities.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}
