import { MetadataRoute } from 'next'

const baseUrl = process.env.NEXTAUTH_URL || 'https://takas-a.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/admin/',
          '/profil',
          '/profil/',
          '/mesajlar',
          '/mesajlar/',
          '/takas-firsatlari',
          '/takas-firsatlari/',
          '/takaslarim',
          '/takaslarim/',
          '/teklifler',
          '/teklifler/',
          '/favoriler',
          '/favoriler/',
          '/oneriler',
          '/oneriler/',
          '/davet',
          '/davet/',
          '/giris',
          '/giris/',
          '/kayit',
          '/kayit/',
          '/sifremi-unuttum',
          '/sifremi-unuttum/',
          '/urun-ekle',
          '/urun-ekle/',
        ],
      },
      // Googlebot için özel kurallar
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/profil/',
          '/mesajlar/',
          '/takas-firsatlari/',
          '/takaslarim/',
          '/teklifler/',
          '/favoriler/',
          '/oneriler/',
          '/davet/',
          '/giris/',
          '/kayit/',
          '/sifremi-unuttum/',
          '/urun-ekle/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
