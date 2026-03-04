import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const client = new OpenAI({
  apiKey: process.env.ABACUSAI_API_KEY,
  baseURL: 'https://routellm.abacus.ai/v1',
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const formData = await request.formData();
    const image = formData.get('image') as File;
    
    if (!image) {
      return NextResponse.json({ error: 'Görsel gerekli' }, { status: 400 });
    }

    // Convert image to base64
    const bytes = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = image.type || 'image/jpeg';

    // Use AI to analyze the image and extract key features
    const analysisResponse = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `Sen bir ürün tanımlama uzmanısın. Verilen görseldeki ürünü analiz et ve şu bilgileri JSON formatında döndür:
{
  "category": "ürün kategorisi (elektronik, giyim, ev-esya, kitap-hobi, spor, diger)",
  "keywords": ["anahtar", "kelimeler", "listesi"],
  "description": "ürünün kısa açıklaması",
  "color": "renk",
  "brand": "varsa marka",
  "type": "ürün tipi"
}
Sadece JSON döndür, başka bir şey yazma.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`
              }
            },
            {
              type: 'text',
              text: 'Bu görseldeki ürünü analiz et.'
            }
          ]
        }
      ],
      max_tokens: 500,
    });

    const analysisText = analysisResponse.choices[0]?.message?.content || '{}';
    let analysis;
    try {
      // Clean the response in case it has markdown code blocks
      const cleanedText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanedText);
    } catch {
      analysis = { keywords: [], category: 'diger', description: '' };
    }

    // Build search query based on AI analysis
    const keywords = (analysis.keywords || []).filter((k: string) => k && k.length > 2);
    const category = (analysis.category || '').toLowerCase();
    const color = analysis.color || '';
    const brand = analysis.brand || '';
    const productType = analysis.type || '';

    // Map AI category to database category slugs
    const categoryMapping: Record<string, string[]> = {
      'elektronik': ['elektronik'],
      'giyim': ['giyim'],
      'ev-esya': ['ev-yasam', 'ev-esya'],
      'ev': ['ev-yasam', 'ev-esya'],
      'mobilya': ['ev-yasam', 'ev-esya'],
      'kitap': ['kitap-hobi'],
      'kitap-hobi': ['kitap-hobi'],
      'hobi': ['kitap-hobi'],
      'spor': ['spor-outdoor', 'spor'],
      'outdoor': ['spor-outdoor'],
      'bebek': ['bebek-cocuk'],
      'cocuk': ['bebek-cocuk'],
      'diger': []
    };

    const matchingSlugs = categoryMapping[category] || [];
    
    // Build OR conditions for keywords
    const keywordConditions = keywords.flatMap((kw: string) => [
      { title: { contains: kw, mode: 'insensitive' as const } },
      { description: { contains: kw, mode: 'insensitive' as const } }
    ]);

    // Add brand/color/type if available
    if (brand) keywordConditions.push({ title: { contains: brand, mode: 'insensitive' as const } });
    if (color) keywordConditions.push({ title: { contains: color, mode: 'insensitive' as const } });
    if (productType) keywordConditions.push({ title: { contains: productType, mode: 'insensitive' as const } });

    let products: any[] = [];

    // Strategy 1: Search by keywords first
    if (keywordConditions.length > 0) {
      products = await prisma.product.findMany({
        where: {
          status: 'active',
          OR: keywordConditions
        },
        include: {
          category: true,
          user: { select: { id: true, name: true } }
        },
        take: 12,
        orderBy: [{ isPopular: 'desc' }, { views: 'desc' }]
      });
    }

    // Strategy 2: If few results, search by category
    if (products.length < 6 && matchingSlugs.length > 0) {
      const categoryProducts = await prisma.product.findMany({
        where: {
          status: 'active',
          category: { slug: { in: matchingSlugs } }
        },
        include: {
          category: true,
          user: { select: { id: true, name: true } }
        },
        take: 12,
        orderBy: [{ isPopular: 'desc' }, { views: 'desc' }]
      });
      
      const existingIds = new Set(products.map((p: { id: string }) => p.id));
      const additionalProducts = categoryProducts.filter((p: { id: string }) => !existingIds.has(p.id));
      products = [...products, ...additionalProducts].slice(0, 12);
    }

    // Strategy 3: If still no results, get popular products
    if (products.length < 3) {
      const popularProducts = await prisma.product.findMany({
        where: { status: 'active' },
        include: {
          category: true,
          user: { select: { id: true, name: true } }
        },
        take: 12,
        orderBy: [{ isPopular: 'desc' }, { views: 'desc' }]
      });
      
      const existingIds = new Set(products.map((p: { id: string }) => p.id));
      const additionalProducts = popularProducts.filter((p: { id: string }) => !existingIds.has(p.id));
      products = [...products, ...additionalProducts].slice(0, 12);
    }

    const finalProducts = products;

    return NextResponse.json({
      success: true,
      analysis: {
        category: analysis.category,
        description: analysis.description,
        keywords: keywords.slice(0, 5)
      },
      products: finalProducts,
      count: finalProducts.length
    });

  } catch (error) {
    console.error('Visual search error:', error);
    return NextResponse.json(
      { error: 'Görsel arama sırasında hata oluştu' },
      { status: 500 }
    );
  }
}
