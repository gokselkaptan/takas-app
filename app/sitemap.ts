import { MetadataRoute } from 'next'
import prisma from '@/lib/db'
import { izmirDistricts } from '@/lib/seo-config'

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

  // İlçe bazlı sayfalar - Yerel SEO için
  const districtPages: MetadataRoute.Sitemap = izmirDistricts
    .filter(d => d.popular)
    .map(district => ({
      url: `${baseUrl}/urunler?district=${district.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.75,
    }))

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

  // Dinamik kategori sayfaları
  let categoryPages: MetadataRoute.Sitemap = []
  try {
    const categories = await prisma.category.findMany({
      select: { slug: true, name: true },
    })

    categoryPages = categories.map((category) => ({
      url: `${baseUrl}/urunler?category=${category.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.85,
    }))
  } catch (error) {
    console.error('Error fetching categories for sitemap:', error)
  }

  // Teslim noktaları
  let deliveryPointPages: MetadataRoute.Sitemap = []
  try {
    const deliveryPoints = await prisma.deliveryPoint.findMany({
      where: { isActive: true },
      select: { id: true, district: true },
    })

    // İlçe bazlı teslim noktası sayfaları
    const districts = [...new Set(deliveryPoints.map(dp => dp.district))] as string[]
    deliveryPointPages = districts.map((district) => ({
      url: `${baseUrl}/teslim-noktalari?district=${encodeURIComponent(district)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  } catch (error) {
    console.error('Error fetching delivery points for sitemap:', error)
  }

  // Tüm sayfaları birleştir
  return [
    ...staticPages, 
    ...categoryPages, 
    ...districtPages,
    ...deliveryPointPages,
    ...productPages
  ]
}
