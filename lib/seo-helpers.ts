// SEO Helper Functions
import { siteConfig } from './seo-config'
import type { Metadata } from 'next'

// Sayfa metadata'ları
const PAGE_META: Record<string, { title: string; description: string; keywords: string[] }> = {
  home: {
    title: 'TAKAS-A | Ücretsiz Takas Platformu',
    description: 'Para ödemeden eşyalarını takas et! Türkiye\'nin en güvenli takas platformunda binlerce ürün seni bekliyor.',
    keywords: ['takas', 'ücretsiz takas', 'eşya takası', 'ikinci el']
  },
  products: {
    title: 'Ürünler | TAKAS-A',
    description: 'Binlerce ürün arasında arama yap, kategorilere göz at, yakınındaki takas fırsatlarını keşfet.',
    keywords: ['takas ürünleri', 'ikinci el eşya', 'takas ilanları']
  },
  howItWorks: {
    title: 'Nasıl Çalışır | TAKAS-A',
    description: 'TAKAS-A ile takas yapmak çok kolay! 5 basit adımda eşyalarını değerlendir.',
    keywords: ['takas nasıl yapılır', 'takas rehberi', 'takas adımları']
  },
  faq: {
    title: 'Sıkça Sorulan Sorular | TAKAS-A',
    description: 'TAKAS-A hakkında merak ettiğiniz tüm soruların cevapları. Güvenlik, Valor sistemi, teslimat ve daha fazlası.',
    keywords: ['takas sss', 'takas soruları', 'valor nedir']
  },
  contact: {
    title: 'İletişim | TAKAS-A',
    description: 'TAKAS-A ekibiyle iletişime geçin. Sorularınız, önerileriniz ve geri bildirimleriniz için bize ulaşın.',
    keywords: ['takas iletişim', 'takas destek']
  },
  about: {
    title: 'Hakkımızda | TAKAS-A',
    description: 'TAKAS-A\'nın hikayesi, misyonu ve vizyonu. Sürdürülebilir ekonomi için birlikte takas yapalım.',
    keywords: ['takas-a hakkında', 'takas platformu', 'sürdürülebilir ekonomi']
  },
  deliveryPoints: {
    title: 'Teslim Noktaları | TAKAS-A',
    description: 'Güvenli takas için İzmir ve Barcelona\'daki teslim noktalarımızı keşfedin.',
    keywords: ['takas teslim noktaları', 'güvenli takas yerleri']
  },
  communities: {
    title: 'Topluluklar | TAKAS-A',
    description: 'İlgi alanlarına göre topluluklara katıl, benzer zevklere sahip kişilerle takas yap.',
    keywords: ['takas toplulukları', 'takas grupları']
  }
}

// Sayfa metadata'sı oluştur
export function generatePageMetadata(pageKey: string): Metadata {
  const meta = PAGE_META[pageKey] || PAGE_META.home
  
  return {
    title: meta.title,
    description: meta.description,
    keywords: [...meta.keywords, ...siteConfig.keywords.slice(0, 10)],
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: siteConfig.url,
      siteName: siteConfig.name,
      images: [{ url: `${siteConfig.url}${siteConfig.ogImage}`, width: 1200, height: 630 }],
      locale: 'tr_TR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: [`${siteConfig.url}${siteConfig.ogImage}`],
    },
    alternates: {
      canonical: siteConfig.url,
      languages: {
        'tr-TR': siteConfig.url,
        'en-US': `${siteConfig.url}/en`,
        'es-ES': `${siteConfig.url}/es`,
        'ca-ES': `${siteConfig.url}/ca`,
      },
    },
  }
}

// Ürün metadata'sı oluştur
export function generateProductMetadata(product: {
  id: string
  title: string
  description?: string
  images?: string[]
  valorPrice?: number
  category?: string
  city?: string
}): Metadata {
  const title = `${product.title} | TAKAS-A`
  const description = product.description?.slice(0, 160) || 
    `${product.title} - ${product.valorPrice || 0} Valor değerinde takas için uygun.`
  const image = product.images?.[0] || `${siteConfig.url}${siteConfig.ogImage}`

  return {
    title,
    description,
    keywords: [
      product.title,
      product.category || 'takas',
      product.city || 'İzmir',
      'takas',
      'ikinci el'
    ],
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/urun/${product.id}`,
      images: [{ url: image, width: 800, height: 600 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

// Kategori metadata'sı oluştur
export function generateCategoryMetadata(categorySlug: string, categoryName: string): Metadata {
  const title = `${categoryName} Takas İlanları | TAKAS-A`
  const description = `${categoryName} kategorisinde takas ilanlarını keşfedin. Ücretsiz takas fırsatları sizi bekliyor.`

  return {
    title,
    description,
    keywords: [categoryName, 'takas', `${categoryName} takas`, 'ikinci el'],
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/urunler?category=${categorySlug}`,
    },
  }
}

// JSON-LD script içeriği oluştur
export function generateJsonLd(schema: object): string {
  return JSON.stringify(schema)
}

// Breadcrumb öğeleri oluştur
export function generateBreadcrumbs(path: string): Array<{ name: string; url: string }> {
  const segments = path.split('/').filter(Boolean)
  const breadcrumbs = [{ name: 'Ana Sayfa', url: siteConfig.url }]

  const nameMap: Record<string, string> = {
    'urunler': 'Ürünler',
    'urun': 'Ürün Detay',
    'nasil-calisir': 'Nasıl Çalışır',
    'hakkimizda': 'Hakkımızda',
    'iletisim': 'İletişim',
    'sss': 'SSS',
    'teslim-noktalari': 'Teslim Noktaları',
    'topluluklar': 'Topluluklar',
    'profil': 'Profil',
    'mesajlar': 'Mesajlar',
    'takaslarim': 'Takaslarım',
    'favoriler': 'Favoriler',
  }

  let currentPath = ''
  segments.forEach((segment) => {
    currentPath += `/${segment}`
    breadcrumbs.push({
      name: nameMap[segment] || segment,
      url: `${siteConfig.url}${currentPath}`,
    })
  })

  return breadcrumbs
}

// Canonical URL oluştur
export function getCanonicalUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${siteConfig.url}${cleanPath}`
}

// Hreflang etiketleri oluştur
export function getHreflangTags(path: string): Array<{ hreflang: string; href: string }> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return [
    { hreflang: 'tr', href: `${siteConfig.url}${cleanPath}` },
    { hreflang: 'en', href: `${siteConfig.url}/en${cleanPath}` },
    { hreflang: 'es', href: `${siteConfig.url}/es${cleanPath}` },
    { hreflang: 'ca', href: `${siteConfig.url}/ca${cleanPath}` },
    { hreflang: 'x-default', href: `${siteConfig.url}${cleanPath}` },
  ]
}

// Resim alt text doğrulama
export function validateImageAlt(altText: string): boolean {
  if (!altText || altText.length < 3) return false
  const genericAlts = ['image', 'picture', 'photo', 'resim', 'fotoğraf', 'görsel']
  return !genericAlts.some(generic => altText.toLowerCase() === generic)
}

// Sosyal paylaşım URL'leri
export function getSocialShareUrls(url: string, title: string, description?: string) {
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)
  const encodedDesc = encodeURIComponent(description || title)

  return {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}&summary=${encodedDesc}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
  }
}
