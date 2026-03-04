/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://takas-a.com',
  generateRobotsTxt: false, // Zaten manuel robots.txt var
  generateIndexSitemap: false,
  exclude: [
    '/api/*',
    '/admin/*',
    '/profil',
    '/mesajlar',
    '/takaslarim',
    '/favoriler',
    '/teklifler',
    '/urun-ekle',
    '/davet',
    '/giris',
    '/kayit',
    '/sifremi-unuttum',
    '/ayarlar/*',
  ],
  changefreq: 'daily',
  priority: 0.7,
  transform: async (config, path) => {
    // Özel öncelik kuralları
    let priority = config.priority
    let changefreq = config.changefreq

    if (path === '/') {
      priority = 1.0
      changefreq = 'daily'
    } else if (path === '/urunler') {
      priority = 0.9
      changefreq = 'hourly'
    } else if (path.startsWith('/urun/')) {
      priority = 0.8
      changefreq = 'weekly'
    } else if (path === '/topluluklar') {
      priority = 0.8
      changefreq = 'daily'
    } else if (['/nasil-calisir', '/hakkimizda', '/sss'].includes(path)) {
      priority = 0.6
      changefreq = 'monthly'
    } else if (['/iletisim', '/teslim-noktalari', '/kurumsal'].includes(path)) {
      priority = 0.5
      changefreq = 'monthly'
    }

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: new Date().toISOString(),
      alternateRefs: [
        { href: `https://takas-a.com${path}`, hreflang: 'tr' },
        { href: `https://takas-a.com/en${path}`, hreflang: 'en' },
        { href: `https://takas-a.com/es${path}`, hreflang: 'es' },
        { href: `https://takas-a.com/ca${path}`, hreflang: 'ca' },
      ],
    }
  },
  additionalPaths: async (config) => {
    const paths = []
    // Ana sayfalar
    const staticPages = [
      '/',
      '/urunler',
      '/nasil-calisir',
      '/hakkimizda',
      '/iletisim',
      '/sss',
      '/teslim-noktalari',
      '/topluluklar',
      '/kurumsal',
      '/harita',
      '/barcelona',
      '/global',
    ]
    
    for (const page of staticPages) {
      paths.push(await config.transform(config, page))
    }
    
    return paths
  },
}
