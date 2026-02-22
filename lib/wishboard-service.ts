// =============================================================================
// TAKAS-A Wish Board Service
// Takas İstek Panosu: ilan oluştur, akıllı eşleştirme, döngü tespiti
// =============================================================================

import prisma from './db';

// ── Types ───────────────────────────────────────────────────────────────

export type WishStatus = 'active' | 'matched' | 'fulfilled' | 'expired' | 'cancelled';
export type MatchType = 'direct' | 'cycle' | 'partial';

export interface CreateWishInput {
  userId: string;
  wantTitle: string;
  wantDescription?: string;
  wantCategory: string;
  wantMinValue?: number;
  wantMaxValue?: number;
  wantImages?: string[];
  offerType: 'specific_product' | 'category' | 'any';
  offerProductId?: string;
  offerCategory?: string;
  offerDescription?: string;
  preferredCity?: string;
  preferredDistrict?: string;
  maxDistance?: number;
  isUrgent?: boolean;
  expiresInDays?: number;
}

export interface WishMatchResult {
  wishItemId: string;
  matches: Array<{
    type: MatchType;
    score: number;
    matchedUserId?: string;
    matchedProductId?: string;
    productTitle?: string;
    productImage?: string;
    userName?: string;
    userCity?: string;
    cycleData?: any;
    description: string;
  }>;
}

// ── Wish Board Service ──────────────────────────────────────────────────

// ── CRUD ──────────────────────────────────────────────────────────────

export async function createWish(input: CreateWishInput) {
  // Kullanıcı aktif wish limiti
  const activeCount = await prisma.wishItem.count({
    where: { userId: input.userId, status: 'active' },
  });
  if (activeCount >= 10) {
    throw new Error('Maksimum 10 aktif istek oluşturabilirsiniz');
  }

  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 86400000)
    : new Date(Date.now() + 30 * 86400000); // Default 30 gün

  const wish = await prisma.wishItem.create({
    data: {
      userId: input.userId,
      wantTitle: input.wantTitle,
      wantDescription: input.wantDescription,
      wantCategory: input.wantCategory,
      wantMinValue: input.wantMinValue,
      wantMaxValue: input.wantMaxValue,
      wantImages: input.wantImages ? JSON.stringify(input.wantImages) : null,
      offerType: input.offerType,
      offerProductId: input.offerProductId,
      offerCategory: input.offerCategory,
      offerDescription: input.offerDescription,
      preferredCity: input.preferredCity,
      preferredDistrict: input.preferredDistrict,
      maxDistance: input.maxDistance,
      isUrgent: input.isUrgent || false,
      expiresAt,
    },
    include: {
      user: { select: { id: true, name: true, image: true, location: true } },
    },
  });

  // Otomatik eşleştirme çalıştır
  await findMatches(wish.id);

  return wish;
}

export async function updateWish(wishId: string, userId: string, updates: Partial<CreateWishInput>) {
  const wish = await prisma.wishItem.findUnique({ where: { id: wishId } });
  if (!wish || wish.userId !== userId) throw new Error('Yetki yok');
  if (wish.status !== 'active') throw new Error('Sadece aktif istekler güncellenebilir');

  const updated = await prisma.wishItem.update({
    where: { id: wishId },
    data: {
      ...(updates.wantTitle && { wantTitle: updates.wantTitle }),
      ...(updates.wantDescription !== undefined && { wantDescription: updates.wantDescription }),
      ...(updates.wantCategory && { wantCategory: updates.wantCategory }),
      ...(updates.wantMinValue !== undefined && { wantMinValue: updates.wantMinValue }),
      ...(updates.wantMaxValue !== undefined && { wantMaxValue: updates.wantMaxValue }),
      ...(updates.preferredCity !== undefined && { preferredCity: updates.preferredCity }),
      ...(updates.isUrgent !== undefined && { isUrgent: updates.isUrgent }),
      ...(updates.offerDescription !== undefined && { offerDescription: updates.offerDescription }),
    },
  });

  // Yeniden eşleştir
  await findMatches(wishId);
  return updated;
}

export async function cancelWish(wishId: string, userId: string): Promise<void> {
  const wish = await prisma.wishItem.findUnique({ where: { id: wishId } });
  if (!wish || wish.userId !== userId) throw new Error('Yetki yok');

  await prisma.wishItem.update({
    where: { id: wishId },
    data: { status: 'cancelled' },
  });
}

export async function fulfillWish(wishId: string, userId: string): Promise<void> {
  const wish = await prisma.wishItem.findUnique({ where: { id: wishId } });
  if (!wish || wish.userId !== userId) throw new Error('Yetki yok');

  await prisma.wishItem.update({
    where: { id: wishId },
    data: { status: 'fulfilled' },
  });
}

// ── Akıllı Eşleştirme ──────────────────────────────────────────────────

/**
 * Bir wish için eşleşmeler bul
 */
export async function findMatches(wishItemId: string): Promise<WishMatchResult> {
  const wish = await prisma.wishItem.findUnique({
    where: { id: wishItemId },
    include: { user: { select: { id: true, location: true } } },
  });

  if (!wish || wish.status !== 'active') {
    return { wishItemId, matches: [] };
  }

  const matches: WishMatchResult['matches'] = [];

  // 1. Direkt eşleşmeler: Birinin ürünü bu wish'e uyuyor
  const directMatches = await findDirectMatches(wish);
  matches.push(...directMatches);

  // 2. Karşılıklı eşleşmeler: A isteğini B'nin ürünü karşılıyor VE B'nin isteğini A'nın ürünü karşılıyor
  const reciprocalMatches = await findReciprocalMatches(wish);
  matches.push(...reciprocalMatches);

  // Sırala ve kaydet
  matches.sort((a, b) => b.score - a.score);
  const topMatches = matches.slice(0, 10);

  // Mevcut eşleşmeleri temizle ve yenilerini kaydet
  await prisma.wishMatch.deleteMany({ where: { wishItemId } });

  for (const match of topMatches) {
    await prisma.wishMatch.create({
      data: {
        wishItemId,
        matchType: match.type,
        matchedUserId: match.matchedUserId,
        matchedProductId: match.matchedProductId,
        cycleData: match.cycleData ? JSON.stringify(match.cycleData) : null,
        score: match.score,
      },
    });
  }

  // Eşleşme sayısını güncelle
  await prisma.wishItem.update({
    where: { id: wishItemId },
    data: { matchCount: topMatches.length },
  });

  return { wishItemId, matches: topMatches };
}

/**
 * Direkt eşleşme: Mevcut ürünler arasında wish'e uyanlar
 */
async function findDirectMatches(wish: any): Promise<WishMatchResult['matches']> {
  // Kategori slug'larını bul
  const category = await prisma.category.findFirst({
    where: {
      OR: [
        { slug: wish.wantCategory },
        { name: wish.wantCategory },
      ],
    },
  });

  const where: any = {
    status: 'active',
    userId: { not: wish.userId },
  };

  if (category) {
    where.categoryId = category.id;
  }

  if (wish.wantMinValue) {
    where.valorpiyadegeri = { ...where.valorpiyadegeri, gte: wish.wantMinValue };
  }
  if (wish.wantMaxValue) {
    where.valorpiyadegeri = { ...where.valorpiyadegeri, lte: wish.wantMaxValue };
  }

  const products = await prisma.product.findMany({
    where,
    include: { 
      user: { select: { id: true, name: true, image: true, location: true } },
      category: { select: { name: true, slug: true } },
    },
    take: 20,
  });

  return products.map((product: any) => {
    let score = 50; // Baz skor

    // Kategori eşleşmesi
    if (product.category?.slug === wish.wantCategory || product.category?.name === wish.wantCategory) {
      score += 20;
    }

    // Değer aralığı uyumu
    if (wish.wantMinValue && wish.wantMaxValue) {
      const mid = (wish.wantMinValue + wish.wantMaxValue) / 2;
      const diff = Math.abs((product.valorpiyadegeri || 0) - mid) / mid;
      score += Math.max(0, 15 - diff * 30);
    }

    // Konum yakınlığı
    const productCity = product.city || product.user?.location?.split(',')[0]?.trim();
    if (wish.preferredCity && productCity) {
      if (productCity.toLowerCase().includes(wish.preferredCity.toLowerCase())) {
        score += 10;
      }
    }

    // Başlık benzerliği (basit kelime eşleştirme)
    const wantWords = wish.wantTitle.toLowerCase().split(/\s+/);
    const productWords = product.title.toLowerCase().split(/\s+/);
    const commonWords = wantWords.filter((w: string) => productWords.includes(w) && w.length > 2);
    score += Math.min(10, commonWords.length * 3);

    // Ürün görselleri
    let images: string[] = [];
    try {
      images = product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : [];
    } catch {
      images = [];
    }

    return {
      type: 'direct' as MatchType,
      score: Math.min(100, Math.round(score)),
      matchedUserId: product.userId,
      matchedProductId: product.id,
      productTitle: product.title,
      productImage: images[0] || undefined,
      userName: product.user?.name || undefined,
      userCity: productCity || undefined,
      description: `${product.title} - ${product.valorpiyadegeri || 0}V`,
    };
  });
}

/**
 * Karşılıklı eşleşme: İki wish birbirini karşılıyor
 */
async function findReciprocalMatches(wish: any): Promise<WishMatchResult['matches']> {
  if (!wish.offerCategory) return [];

  // Başka kullanıcıların wish'leri arasında karşılıklı eşleşme ara
  const otherWishes = await prisma.wishItem.findMany({
    where: {
      status: 'active',
      userId: { not: wish.userId },
      wantCategory: wish.offerCategory,
    },
    include: { user: { select: { id: true, name: true, image: true, location: true } } },
    take: 50,
  });

  const matches: WishMatchResult['matches'] = [];

  for (const otherWish of otherWishes) {
    // Karşı tarafın istediği = benim teklif ettiğim
    const theyWantWhatIOffer = otherWish.wantCategory === wish.offerCategory;

    // Benim istediğim = karşı tarafın teklif ettiği
    const iWantWhatTheyOffer = otherWish.offerCategory
      ? wish.wantCategory === otherWish.offerCategory
      : false;

    if (theyWantWhatIOffer && iWantWhatTheyOffer) {
      let score = 60; // Karşılıklı eşleşme bonus

      // Konum eşleşmesi
      if (wish.preferredCity && otherWish.user?.location?.includes(wish.preferredCity)) {
        score += 15;
      }

      matches.push({
        type: 'direct' as MatchType,
        score: Math.min(100, score),
        matchedUserId: otherWish.userId,
        userName: otherWish.user?.name || undefined,
        userCity: otherWish.user?.location || undefined,
        description: `Karşılıklı eşleşme: ${otherWish.wantTitle} ↔ ${wish.wantTitle}`,
      });
    }
  }

  return matches;
}

// ── Sorgulama ─────────────────────────────────────────────────────────

/**
 * Wish Board listesi (filtreleme + sayfalama)
 */
export async function listWishes(filters: {
  category?: string;
  city?: string;
  district?: string;
  isUrgent?: boolean;
  minValue?: number;
  maxValue?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ wishes: any[]; total: number }> {
  const where: any = { status: 'active', expiresAt: { gt: new Date() } };

  if (filters.category) where.wantCategory = filters.category;
  if (filters.city) where.preferredCity = filters.city;
  if (filters.district) where.preferredDistrict = filters.district;
  if (filters.isUrgent) where.isUrgent = true;
  if (filters.minValue) where.wantMinValue = { gte: filters.minValue };
  if (filters.maxValue) where.wantMaxValue = { lte: filters.maxValue };
  if (filters.search) {
    where.OR = [
      { wantTitle: { contains: filters.search, mode: 'insensitive' } },
      { wantDescription: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [wishes, total] = await Promise.all([
    prisma.wishItem.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, image: true, location: true } },
        matches: {
          where: { score: { gte: 50 } },
          orderBy: { score: 'desc' },
          take: 3,
        },
      },
      orderBy: [{ isUrgent: 'desc' }, { createdAt: 'desc' }],
      take: filters.limit || 20,
      skip: filters.offset || 0,
    }),
    prisma.wishItem.count({ where }),
  ]);

  return { wishes, total };
}

/**
 * Kullanıcının wish'leri
 */
export async function getUserWishes(userId: string): Promise<any[]> {
  return prisma.wishItem.findMany({
    where: { userId },
    include: {
      matches: { orderBy: { score: 'desc' }, take: 5 },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Tek bir wish detayı
 */
export async function getWishById(wishId: string): Promise<any> {
  const wish = await prisma.wishItem.findUnique({
    where: { id: wishId },
    include: {
      user: { select: { id: true, name: true, image: true, location: true, trustScore: true } },
      matches: {
        orderBy: { score: 'desc' },
        take: 10,
      },
    },
  });

  if (wish) {
    // View count artır
    await prisma.wishItem.update({
      where: { id: wishId },
      data: { viewCount: { increment: 1 } },
    });
  }

  return wish;
}

/**
 * Süresi dolan wish'leri temizle (cron job)
 */
export async function expireOldWishes(): Promise<number> {
  const result = await prisma.wishItem.updateMany({
    where: { status: 'active', expiresAt: { lte: new Date() } },
    data: { status: 'expired' },
  });
  return result.count;
}

/**
 * Tüm aktif wish'ler için eşleştirme çalıştır (cron job)
 */
export async function runGlobalMatching(): Promise<{ processed: number; totalMatches: number }> {
  const activeWishes = await prisma.wishItem.findMany({
    where: { status: 'active', expiresAt: { gt: new Date() } },
    select: { id: true },
  });

  let totalMatches = 0;
  for (const wish of activeWishes) {
    const result = await findMatches(wish.id);
    totalMatches += result.matches.length;
  }

  return { processed: activeWishes.length, totalMatches };
}

/**
 * Eşleşme durumunu güncelle
 */
export async function updateMatchStatus(
  matchId: string, 
  userId: string, 
  status: 'viewed' | 'contacted' | 'accepted' | 'rejected'
): Promise<void> {
  const match = await prisma.wishMatch.findUnique({
    where: { id: matchId },
    include: { wishItem: { select: { userId: true } } },
  });

  if (!match || match.wishItem.userId !== userId) {
    throw new Error('Yetki yok');
  }

  await prisma.wishMatch.update({
    where: { id: matchId },
    data: { 
      status, 
      respondedAt: ['accepted', 'rejected'].includes(status) ? new Date() : undefined,
    },
  });
}

/**
 * Kategorilere göre wish istatistikleri
 */
export async function getWishStats(): Promise<any> {
  const stats = await prisma.wishItem.groupBy({
    by: ['wantCategory'],
    where: { status: 'active' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  const totalActive = await prisma.wishItem.count({ where: { status: 'active' } });
  const totalMatches = await prisma.wishMatch.count({ where: { score: { gte: 50 } } });

  return {
    topCategories: stats,
    totalActive,
    totalMatches,
  };
}
