// ============= TAKAS-A ROZET SİSTEMİ =============
import prisma from '@/lib/db'

// Rozet tanımları - Progresif ödül sistemi
// İlke: Kolay rozetler az, zor rozetler çok ödül verir
// Her seviye öncekinden 2-3x daha değerli hissettirmeli (3→8→20→50)
export const BADGE_DEFINITIONS = [
  // ========== TAKAS ROZETLERİ (kademeli artış) ==========
  {
    slug: 'ilk_takas',
    name: 'İlk Takas',
    nameEn: 'First Swap',
    description: 'İlk takasını başarıyla tamamladın!',
    descriptionEn: 'You completed your first swap!',
    icon: '🎉',
    category: 'swap',
    tier: 'bronze',
    valorReward: 3, // İlk adım, sembolik
    requirement: JSON.stringify({ type: 'swap_count', value: 1 }),
    sortOrder: 1
  },
  {
    slug: 'takas_ustasi_5',
    name: 'Takas Ustası',
    nameEn: 'Swap Master',
    description: '5 takası başarıyla tamamladın!',
    descriptionEn: 'You completed 5 swaps!',
    icon: '⭐',
    category: 'swap',
    tier: 'silver',
    valorReward: 8, // Seviyeleme
    requirement: JSON.stringify({ type: 'swap_count', value: 5 }),
    sortOrder: 2
  },
  {
    slug: 'takas_gurusu_20',
    name: 'Takas Gurusu',
    nameEn: 'Swap Guru',
    description: '20 takası başarıyla tamamladın! Gerçek bir takas uzmanısın.',
    descriptionEn: 'You completed 20 swaps! You are a true swap expert.',
    icon: '🏆',
    category: 'swap',
    tier: 'gold',
    valorReward: 20, // Ciddi milestone
    requirement: JSON.stringify({ type: 'swap_count', value: 20 }),
    sortOrder: 3
  },
  {
    slug: 'takas_efsanesi_50',
    name: 'Takas Efsanesi',
    nameEn: 'Swap Legend',
    description: '50 takas! Topluluğun en aktif üyelerinden birisin.',
    descriptionEn: '50 swaps! You are one of the most active members.',
    icon: '👑',
    category: 'swap',
    tier: 'platinum',
    valorReward: 50, // Büyük ödül
    requirement: JSON.stringify({ type: 'swap_count', value: 50 }),
    sortOrder: 4
  },
  
  // ========== GÜVEN ROZETLERİ ==========
  {
    slug: 'guvenilir_uye',
    name: 'Güvenilir Üye',
    nameEn: 'Trusted Member',
    description: 'Güven puanın 90\'ın üzerinde!',
    descriptionEn: 'Your trust score is above 90!',
    icon: '✅',
    category: 'trust',
    tier: 'silver',
    valorReward: 10,
    requirement: JSON.stringify({ type: 'trust_score', value: 90 }),
    sortOrder: 5
  },
  {
    slug: 'kimlik_dogrulandi',
    name: 'Kimlik Doğrulandı',
    nameEn: 'Identity Verified',
    description: 'Kimliğini doğruladın. Hesabın daha güvenli!',
    descriptionEn: 'You verified your identity. Your account is more secure!',
    icon: '🛡️',
    category: 'trust',
    tier: 'silver',
    valorReward: 15,
    requirement: JSON.stringify({ type: 'identity_verified', value: true }),
    sortOrder: 6
  },
  {
    slug: 'kusursuz_satici',
    name: 'Kusursuz Satıcı',
    nameEn: 'Perfect Seller',
    description: '10+ takas ve ortalama 4.8+ puan aldın!',
    descriptionEn: '10+ swaps with 4.8+ average rating!',
    icon: '💎',
    category: 'trust',
    tier: 'gold',
    valorReward: 30,
    requirement: JSON.stringify({ type: 'perfect_rating', minSwaps: 10, minRating: 4.8 }),
    sortOrder: 7
  },
  
  // ========== TOPLULUK / BAŞLANGIÇ ROZETLERİ ==========
  {
    slug: 'hosgeldin',
    name: 'Hoşgeldin',
    nameEn: 'Welcome',
    description: 'TAKAS-A topluluğuna hoş geldin!',
    descriptionEn: 'Welcome to the TAKAS-A community!',
    icon: '👋',
    category: 'community',
    tier: 'bronze',
    valorReward: 2, // Sembolik karşılama
    requirement: JSON.stringify({ type: 'account_created', value: true }),
    sortOrder: 8
  },
  {
    slug: 'ilk_urun',
    name: 'İlk Ürün',
    nameEn: 'First Product',
    description: 'İlk ürününü listelidin!',
    descriptionEn: 'You listed your first product!',
    icon: '📦',
    category: 'community',
    tier: 'bronze',
    valorReward: 3,
    requirement: JSON.stringify({ type: 'product_count', value: 1 }),
    sortOrder: 9
  },
  {
    slug: 'urun_koleksiyoneri_10',
    name: 'Ürün Koleksiyoncusu',
    nameEn: 'Product Collector',
    description: '10 ürün listelidin! Harika bir koleksiyon.',
    descriptionEn: 'You listed 10 products! Great collection.',
    icon: '🗃️',
    category: 'community',
    tier: 'silver',
    valorReward: 12,
    requirement: JSON.stringify({ type: 'product_count', value: 10 }),
    sortOrder: 10
  },
  {
    slug: 'arkadasini_getir',
    name: 'Arkadaşını Getir',
    nameEn: 'Bring a Friend',
    description: 'İlk referansını yaptın!',
    descriptionEn: 'You made your first referral!',
    icon: '🤝',
    category: 'community',
    tier: 'bronze',
    valorReward: 5,
    requirement: JSON.stringify({ type: 'referral_count', value: 1 }),
    sortOrder: 11
  },
  {
    slug: 'sosyal_kelebek',
    name: 'Sosyal Kelebek',
    nameEn: 'Social Butterfly',
    description: '10 kişiyi takip ettin!',
    descriptionEn: 'You followed 10 people!',
    icon: '🦋',
    category: 'community',
    tier: 'bronze',
    valorReward: 5,
    requirement: JSON.stringify({ type: 'following_count', value: 10 }),
    sortOrder: 12
  },
  {
    slug: 'populer_profil',
    name: 'Popüler Profil',
    nameEn: 'Popular Profile',
    description: '25 takipçiye ulaştın!',
    descriptionEn: 'You reached 25 followers!',
    icon: '🌟',
    category: 'community',
    tier: 'silver',
    valorReward: 10,
    requirement: JSON.stringify({ type: 'follower_count', value: 25 }),
    sortOrder: 13
  },
  {
    slug: 'topluluk_lideri',
    name: 'Topluluk Lideri',
    nameEn: 'Community Leader',
    description: '100 takipçiye ulaştın! Gerçek bir influencer\'sın.',
    descriptionEn: 'You reached 100 followers! You are a true influencer.',
    icon: '🎯',
    category: 'community',
    tier: 'gold',
    valorReward: 30,
    requirement: JSON.stringify({ type: 'follower_count', value: 100 }),
    sortOrder: 14
  },
  
  // ========== BAŞARI ROZETLERİ ==========
  {
    slug: 'degerlendirme_ustasi',
    name: 'Değerlendirme Ustası',
    nameEn: 'Review Master',
    description: '10 değerlendirme yaptın!',
    descriptionEn: 'You wrote 10 reviews!',
    icon: '📝',
    category: 'achievement',
    tier: 'silver',
    valorReward: 8,
    requirement: JSON.stringify({ type: 'review_count', value: 10 }),
    sortOrder: 15
  },
  {
    slug: 'erken_kus',
    name: 'Erken Kuş',
    nameEn: 'Early Bird',
    description: 'Platformun ilk 1000 üyesinden birisin!',
    descriptionEn: 'You are one of the first 1000 members!',
    icon: '🐦',
    category: 'achievement',
    tier: 'gold',
    valorReward: 15,
    requirement: JSON.stringify({ type: 'early_adopter', value: 1000 }),
    isSecret: true,
    sortOrder: 16
  },
  {
    slug: 'hafta_sonu_savaşçısı',
    name: 'Hafta Sonu Savaşçısı',
    nameEn: 'Weekend Warrior',
    description: 'Hafta sonunda 3 takas tamamladın!',
    descriptionEn: 'You completed 3 swaps on a weekend!',
    icon: '⚔️',
    category: 'achievement',
    tier: 'bronze',
    valorReward: 5,
    requirement: JSON.stringify({ type: 'weekend_swaps', value: 3 }),
    isSecret: true,
    sortOrder: 17
  },
  {
    slug: 'cok_kategorili',
    name: 'Çok Kategorili',
    nameEn: 'Multi-Category',
    description: '5 farklı kategoride ürün listelidin!',
    descriptionEn: 'You listed products in 5 different categories!',
    icon: '🎨',
    category: 'achievement',
    tier: 'silver',
    valorReward: 10,
    requirement: JSON.stringify({ type: 'category_diversity', value: 5 }),
    sortOrder: 18
  },
  {
    slug: 'hizli_yanit',
    name: 'Hızlı Yanıt',
    nameEn: 'Quick Response',
    description: 'Mesajlara ortalama 1 saat içinde yanıt veriyorsun!',
    descriptionEn: 'You respond to messages within 1 hour on average!',
    icon: '⚡',
    category: 'achievement',
    tier: 'silver',
    valorReward: 8,
    requirement: JSON.stringify({ type: 'response_time', value: 60 }), // dakika
    sortOrder: 19
  },
  {
    slug: 'valor_zengini',
    name: 'Valor Zengini',
    nameEn: 'Valor Rich',
    description: '1000+ Valor topladın!',
    descriptionEn: 'You collected 1000+ Valor!',
    icon: '💰',
    category: 'achievement',
    tier: 'gold',
    valorReward: 20,
    requirement: JSON.stringify({ type: 'total_valor_earned', value: 1000 }),
    sortOrder: 20
  }
]

// Rozet kazanma kontrolü
export async function checkAndAwardBadges(userId: string): Promise<{ awarded: string[], progress: Record<string, number> }> {
  const awarded: string[] = []
  const progress: Record<string, number> = {}
  
  try {
    // Kullanıcı verilerini al
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        products: { where: { status: 'active' } },
        swapRequestsSent: { where: { status: 'completed' } },
        swapRequestsReceived: { where: { status: 'completed' } },
        reviewsGiven: true,
        referrals: true,
        badges: { include: { badge: true } },
        followers: true,
        following: true
      }
    })
    
    if (!user) return { awarded, progress }
    
    // Mevcut rozetleri al
    const existingBadgeSlugs = user.badges.map(ub => ub.badge.slug)
    
    // Tüm rozetleri kontrol et
    const allBadges = await prisma.badge.findMany({ where: { isActive: true } })
    
    for (const badge of allBadges) {
      if (existingBadgeSlugs.includes(badge.slug)) continue
      
      const requirement = JSON.parse(badge.requirement)
      let met = false
      let currentProgress = 0
      
      switch (requirement.type) {
        case 'swap_count':
          const totalSwaps = user.swapRequestsSent.length + user.swapRequestsReceived.length
          currentProgress = Math.min(100, (totalSwaps / requirement.value) * 100)
          met = totalSwaps >= requirement.value
          break
          
        case 'trust_score':
          currentProgress = Math.min(100, (user.trustScore / requirement.value) * 100)
          met = user.trustScore >= requirement.value
          break
          
        case 'identity_verified':
          currentProgress = user.isIdentityVerified ? 100 : 0
          met = user.isIdentityVerified
          break
          
        case 'account_created':
          currentProgress = 100
          met = true // Hesap oluşturulmuşsa her zaman true
          break
          
        case 'product_count':
          currentProgress = Math.min(100, (user.products.length / requirement.value) * 100)
          met = user.products.length >= requirement.value
          break
          
        case 'referral_count':
          currentProgress = Math.min(100, (user.totalReferrals / requirement.value) * 100)
          met = user.totalReferrals >= requirement.value
          break
          
        case 'following_count':
          currentProgress = Math.min(100, (user.following.length / requirement.value) * 100)
          met = user.following.length >= requirement.value
          break
          
        case 'follower_count':
          currentProgress = Math.min(100, (user.followers.length / requirement.value) * 100)
          met = user.followers.length >= requirement.value
          break
          
        case 'review_count':
          currentProgress = Math.min(100, (user.reviewsGiven.length / requirement.value) * 100)
          met = user.reviewsGiven.length >= requirement.value
          break
          
        case 'total_valor_earned':
          currentProgress = Math.min(100, (user.totalValorEarned / requirement.value) * 100)
          met = user.totalValorEarned >= requirement.value
          break
          
        case 'perfect_rating':
          const swapCountForRating = user.swapRequestsSent.length + user.swapRequestsReceived.length
          if (swapCountForRating >= requirement.minSwaps) {
            // Ortalama puanı hesapla
            const reviews = await prisma.review.findMany({
              where: { targetUserId: userId }
            })
            if (reviews.length > 0) {
              const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
              currentProgress = Math.min(100, (avgRating / 5) * 100)
              met = avgRating >= requirement.minRating
            }
          }
          break
          
        case 'early_adopter':
          const userCount = await prisma.user.count({
            where: { createdAt: { lt: user.createdAt } }
          })
          met = userCount < requirement.value
          currentProgress = met ? 100 : 0
          break
          
        case 'category_diversity':
          const categories = new Set(user.products.map(p => p.categoryId))
          currentProgress = Math.min(100, (categories.size / requirement.value) * 100)
          met = categories.size >= requirement.value
          break
      }
      
      progress[badge.slug] = Math.round(currentProgress)
      
      if (met) {
        // Rozeti ver
        await prisma.userBadge.create({
          data: {
            userId,
            badgeId: badge.id,
            progress: 100
          }
        })
        
        // Valor ödülü ver
        if (badge.valorReward > 0) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              valorBalance: { increment: badge.valorReward },
              totalValorEarned: { increment: badge.valorReward }
            }
          })
        }
        
        // Aktivite akışına ekle
        await prisma.activityFeed.create({
          data: {
            type: 'badge_earned',
            userId,
            userName: user.name || user.nickname || user.email.split('@')[0],
            metadata: JSON.stringify({
              badgeSlug: badge.slug,
              badgeName: badge.name,
              badgeIcon: badge.icon,
              badgeTier: badge.tier,
              valorReward: badge.valorReward
            }),
            visibility: 'public'
          }
        })
        
        awarded.push(badge.slug)
      }
    }
    
    return { awarded, progress }
  } catch (error) {
    console.error('Badge check error:', error)
    return { awarded, progress }
  }
}

// Rozet seed fonksiyonu
export async function seedBadges() {
  for (const badge of BADGE_DEFINITIONS) {
    await prisma.badge.upsert({
      where: { slug: badge.slug },
      update: badge,
      create: badge
    })
  }
  console.log('Badges seeded successfully')
}

// Kullanıcının rozetlerini getir
export async function getUserBadges(userId: string) {
  const userBadges = await prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
    orderBy: { earnedAt: 'desc' }
  })
  
  return userBadges.map(ub => ({
    ...ub.badge,
    earnedAt: ub.earnedAt,
    isDisplayed: ub.isDisplayed
  }))
}

// Tüm rozetleri getir (ilerleme ile)
export async function getAllBadgesWithProgress(userId: string) {
  const [allBadges, userBadges] = await Promise.all([
    prisma.badge.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }]
    }),
    prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true }
    })
  ])
  
  const earnedSlugs = new Set(userBadges.map(ub => ub.badge.slug))
  
  return allBadges.map(badge => ({
    ...badge,
    earned: earnedSlugs.has(badge.slug),
    earnedAt: userBadges.find(ub => ub.badge.slug === badge.slug)?.earnedAt,
    isDisplayed: userBadges.find(ub => ub.badge.slug === badge.slug)?.isDisplayed || false
  }))
}

// Tier renkleri
export const TIER_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  bronze: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  silver: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
  gold: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400' },
  platinum: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  diamond: { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' }
}

// Kategori çevirileri
export const CATEGORY_NAMES: Record<string, { tr: string, en: string }> = {
  swap: { tr: 'Takas', en: 'Swap' },
  trust: { tr: 'Güven', en: 'Trust' },
  community: { tr: 'Topluluk', en: 'Community' },
  achievement: { tr: 'Başarı', en: 'Achievement' }
}
