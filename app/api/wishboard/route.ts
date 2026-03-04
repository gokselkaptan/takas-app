// =============================================================================
// TAKAS-A Wish Board API
// /app/api/wishboard/route.ts
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  createWish,
  updateWish,
  cancelWish,
  fulfillWish,
  findMatches,
  listWishes,
  getUserWishes,
  getWishById,
  updateMatchStatus,
  getWishStats,
} from '@/lib/wishboard-service';
import { validate, createWishSchema } from '@/lib/validations';
import { sanitizeText } from '@/lib/sanitize';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 });
  }
  
  // Rate limit kontrolü (create action için)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = await checkRateLimit(ip, 'api/wishboard')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Çok fazla istek. Lütfen biraz bekleyin.' }, { status: 429 })
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        // Input validation
        const { success, error: validationError } = validate(createWishSchema, body);
        if (!success) {
          return NextResponse.json({ error: validationError }, { status: 400 });
        }
        
        // XSS temizleme
        const cleanTitle = sanitizeText(body.wantTitle)
        const cleanDescription = body.wantDescription ? sanitizeText(body.wantDescription) : undefined
        
        const wish = await createWish({
          userId,
          wantTitle: cleanTitle,
          wantDescription: cleanDescription,
          wantCategory: body.wantCategory,
          wantMinValue: body.wantMinValue,
          wantMaxValue: body.wantMaxValue,
          wantImages: body.wantImages,
          offerType: body.offerType,
          offerProductId: body.offerProductId,
          offerCategory: body.offerCategory,
          offerDescription: body.offerDescription,
          preferredCity: body.preferredCity,
          preferredDistrict: body.preferredDistrict,
          maxDistance: body.maxDistance,
          isUrgent: body.isUrgent,
          expiresInDays: body.expiresInDays,
        });
        return NextResponse.json({ success: true, wish });
      }

      case 'update': {
        const updated = await updateWish(body.wishId, userId, body.updates);
        return NextResponse.json({ success: true, wish: updated });
      }

      case 'cancel': {
        await cancelWish(body.wishId, userId);
        return NextResponse.json({ success: true });
      }

      case 'fulfill': {
        await fulfillWish(body.wishId, userId);
        return NextResponse.json({ success: true });
      }

      case 'find_matches': {
        const matches = await findMatches(body.wishId);
        return NextResponse.json({ success: true, ...matches });
      }

      case 'update_match_status': {
        await updateMatchStatus(body.matchId, userId, body.status);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Wishboard API error:', error);
    return NextResponse.json({ error: error.message || 'Bir hata oluştu' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    // Tek bir wish detayı
    const wishId = searchParams.get('id');
    if (wishId) {
      const wish = await getWishById(wishId);
      if (!wish) {
        return NextResponse.json({ error: 'İstek bulunamadı' }, { status: 404 });
      }
      return NextResponse.json({ wish });
    }

    // Kullanıcının kendi wish'leri
    const myWishes = searchParams.get('my') === 'true';
    if (myWishes) {
      const session = await getServerSession(authOptions);
      const userId = (session?.user as any)?.id;
      if (!userId) {
        return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 });
      }
      const wishes = await getUserWishes(userId);
      return NextResponse.json({ wishes });
    }

    // İstatistikler
    const stats = searchParams.get('stats') === 'true';
    if (stats) {
      const wishStats = await getWishStats();
      return NextResponse.json(wishStats);
    }

    // Genel liste (filtreleme)
    const result = await listWishes({
      category: searchParams.get('category') || undefined,
      city: searchParams.get('city') || undefined,
      district: searchParams.get('district') || undefined,
      isUrgent: searchParams.get('urgent') === 'true',
      search: searchParams.get('q') || undefined,
      minValue: searchParams.get('minValue') ? parseInt(searchParams.get('minValue')!) : undefined,
      maxValue: searchParams.get('maxValue') ? parseInt(searchParams.get('maxValue')!) : undefined,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Wishboard GET error:', error);
    return NextResponse.json({ error: error.message || 'Bir hata oluştu' }, { status: 400 });
  }
}
