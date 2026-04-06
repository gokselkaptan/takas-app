import { MetadataRoute } from 'next'
import prisma from '@/lib/db'

// Build sırasında değil, runtime'da çalıştır
export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1 saat cache

const baseUrl = process.env.NEXTAUTH_URL || 'https://takas-a.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  
  // Ana sayfalar - yüksek öncelikli
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/urunler`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/kurumsal`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/teslim-noktalari`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/harita`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/nasil-calisir`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/hakkimizda`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/iletisim`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/sss`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // Uluslararası sayfalar
    {
      url: `${baseUrl}/barcelona`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/global`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  // Dinamik ürün sayfaları
  let productPages: MetadataRoute.Sitemap = []
  try {
    const products = await prisma.product.findMany({
      where: { status: 'active' },
      select: { 
        id: true, 
        updatedAt: true,
        views: true,
        valorPrice: true
      },
      orderBy: [
        { views: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 2000, // 2000 ürüne kadar
    })

    productPages = products.map((product) => ({
      url: `${baseUrl}/urun/${product.id}`,
      lastModified: product.updatedAt,
      changeFrequency: 'weekly' as const,
      // Popüler ürünlere daha yüksek öncelik
      priority: product.views > 50 ? 0.8 : product.views > 20 ? 0.7 : 0.6,
    }))
  } catch (error) {
    console.error('Error fetching products for sitemap:', error)
  }

  // Tüm sayfaları birleştir (query param URL'ler SEO fix için kaldırıldı)
  return [
    ...staticPages, 
    ...productPages
  ]
}
