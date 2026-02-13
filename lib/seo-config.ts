// SEO Configuration for TAKAS-A

export const siteConfig = {
  name: 'TAKAS-A',
  description: 'İzmir\'in ilk ve tek çoklu takas platformu. Para ödemeden eşyalarını takas et, sürdürülebilir ekonomiye katkıda bulun.',
  url: 'https://takas-a.com',
  ogImage: '/og-image.png',
  links: {
    instagram: 'https://instagram.com/takasaizmir',
  },
  creator: 'TAKAS-A',
  foundingYear: 2024,
  email: 'info@takas-a.com',
  phone: '+90 232 XXX XX XX',
  address: {
    city: 'İzmir',
    country: 'Türkiye',
    region: 'Ege',
  },
  keywords: [
    // Ana anahtar kelimeler
    'takas', 'takas platformu', 'eşya takası', 'ücretsiz takas',
    'ikinci el', 'paylaşım ekonomisi', 'sürdürülebilir', 'çoklu takas',
    'barter', 'swap', 'değiş tokuş', 'takas sitesi',
    // İzmir lokasyon bazlı
    'İzmir takas', 'İzmir ikinci el', 'İzmir eşya takası',
    // İlçe bazlı anahtar kelimeler
    'Bornova takas', 'Konak takas', 'Karşıyaka takas',
    'Buca takas', 'Çiğli takas', 'Bayraklı takas',
    'Balçova takas', 'Narlıdere takas', 'Gaziemir takas',
    'Alsancak takas', 'Mavişehir takas', 'Göztepe takas',
    // Kategori bazlı
    'elektronik takas İzmir', 'kitap takas İzmir', 'giyim takas İzmir',
    'mobilya takas İzmir', 'bebek eşyası takas', 'spor malzemesi takas',
    // Uzun kuyruk
    'İzmir de ikinci el eşya nereden alınır', 'takas yaparak para kazanma',
    'kullanmadığım eşyaları değerlendirme', 'parasız alışveriş İzmir'
  ],
}

// İzmir ilçeleri - Yerel SEO için
export const izmirDistricts = [
  { name: 'Konak', slug: 'konak', popular: true },
  { name: 'Karşıyaka', slug: 'karsiyaka', popular: true },
  { name: 'Bornova', slug: 'bornova', popular: true },
  { name: 'Buca', slug: 'buca', popular: true },
  { name: 'Çiğli', slug: 'cigli', popular: true },
  { name: 'Bayraklı', slug: 'bayrakli', popular: true },
  { name: 'Balçova', slug: 'balcova', popular: false },
  { name: 'Narlıdere', slug: 'narlidere', popular: false },
  { name: 'Gaziemir', slug: 'gaziemir', popular: false },
  { name: 'Menemen', slug: 'menemen', popular: false },
  { name: 'Torbalı', slug: 'torbali', popular: false },
  { name: 'Karabağlar', slug: 'karabaglar', popular: true },
  { name: 'Güzelbahçe', slug: 'guzelbahce', popular: false },
  { name: 'Urla', slug: 'urla', popular: false },
  { name: 'Seferihisar', slug: 'seferihisar', popular: false },
]

// Kategori SEO bilgileri
export const categorySEO: Record<string, { title: string; description: string; keywords: string[] }> = {
  elektronik: {
    title: 'Elektronik Takas | Telefon, Bilgisayar, Tablet Takası - İzmir',
    description: 'İzmir\'de elektronik eşya takası yapın. iPhone, Samsung, laptop, tablet ve daha fazlası. Güvenli takas ile elektronik ürünlerinizi değerlendirin.',
    keywords: ['elektronik takas', 'telefon takas', 'laptop takas', 'tablet takas İzmir', 'ikinci el elektronik İzmir']
  },
  giyim: {
    title: 'Giyim Takas | Kıyafet, Ayakkabı Takası - İzmir',
    description: 'İzmir\'de giyim takası. Kadın, erkek, çocuk giyim, ayakkabı ve aksesuar takası yapın. Modanızı sürdürülebilir hale getirin.',
    keywords: ['giyim takas', 'kıyafet takas', 'ayakkabı takas', 'ikinci el giyim İzmir', 'moda takas']
  },
  kitap: {
    title: 'Kitap Takas | Roman, Ders Kitabı Takası - İzmir',
    description: 'İzmir\'de kitap takası. Roman, öykü, ders kitapları ve daha fazlası. Okuduğunuz kitapları yeni hikayelerle değiştirin.',
    keywords: ['kitap takas', 'roman takas', 'ders kitabı takas İzmir', 'ikinci el kitap']
  },
  'ev-esyalari': {
    title: 'Ev Eşyası Takas | Mobilya, Dekorasyon Takası - İzmir',
    description: 'İzmir\'de ev eşyası ve mobilya takası. Koltuk, masa, dekorasyon ürünleri. Evinizi yenilemek için takas yapın.',
    keywords: ['ev eşyası takas', 'mobilya takas', 'dekorasyon takas İzmir', 'ikinci el mobilya']
  },
  spor: {
    title: 'Spor Malzemesi Takas | Fitness, Bisiklet Takası - İzmir',
    description: 'İzmir\'de spor malzemesi takası. Bisiklet, fitness ekipmanı, kamp malzemeleri. Aktif yaşamınızı destekleyin.',
    keywords: ['spor malzemesi takas', 'bisiklet takas', 'fitness takas İzmir', 'outdoor takas']
  },
  bebek: {
    title: 'Bebek Ürünleri Takas | Bebek Arabası, Oyuncak - İzmir',
    description: 'İzmir\'de bebek ve çocuk ürünleri takası. Bebek arabası, puset, oyuncak ve giyim. Çocuğunuz büyüdükçe takas yapın.',
    keywords: ['bebek ürünü takas', 'bebek arabası takas', 'oyuncak takas İzmir', 'çocuk eşyası takas']
  },
  'oto-moto': {
    title: 'Oto & Moto Parça Takas | Yedek Parça, Aksesuar - İzmir',
    description: 'İzmir\'de oto ve motosiklet parça takası. Jant, lastik, aksesuar ve yedek parça. Araç ihtiyaçlarınızı takas ile karşılayın.',
    keywords: ['oto yedek parça takas', 'jant takas', 'motosiklet parça takas İzmir', 'araç aksesuar takas']
  },
  muzik: {
    title: 'Müzik Aleti Takas | Gitar, Piyano Takası - İzmir',
    description: 'İzmir\'de müzik aleti takası. Gitar, piyano, davul ve aksesuarlar. Müzik yolculuğunuzda yeni enstrümanlar keşfedin.',
    keywords: ['müzik aleti takas', 'gitar takas', 'piyano takas İzmir', 'enstrüman takas']
  },
  oyun: {
    title: 'Oyun & Konsol Takas | PlayStation, Xbox Takası - İzmir',
    description: 'İzmir\'de video oyunu ve konsol takası. PS5, Xbox, Nintendo oyunları. Oyun koleksiyonunuzu takas ile genişletin.',
    keywords: ['oyun takas', 'konsol takas', 'PS5 oyun takas İzmir', 'video oyunu takas']
  },
  koleksiyon: {
    title: 'Koleksiyon Takas | Antika, Retro Ürün Takası - İzmir',
    description: 'İzmir\'de koleksiyon eşyası takası. Antikalar, vintage ürünler, retro eşyalar. Benzersiz parçalarla koleksiyonunuzu zenginleştirin.',
    keywords: ['koleksiyon takas', 'antika takas', 'vintage takas İzmir', 'retro ürün takas']
  }
}

export const pagesSEO: Record<string, { title: string; description: string; keywords?: string[] }> = {
  home: {
    title: 'TAKAS-A | İzmir\'in Ücretsiz Takas Platformu',
    description: 'İzmir\'de eşyalarını para ödemeden takas et. Güvenli teslim noktaları, canlı aktivite akışı ve topluluk odaklı paylaşım ekonomisi. Hemen üye ol!',
    keywords: ['takas', 'İzmir takas', 'ücretsiz takas', 'eşya takası', 'paylaşım ekonomisi']
  },
  products: {
    title: 'Ürünler | TAKAS-A - Binlerce Takas Fırsatı',
    description: 'Elektronik, giyim, kitap, ev eşyaları ve daha fazlası! İzmir\'de takas için yüzlerce ürün seni bekliyor. Filtrele, bul, takas et.',
    keywords: ['takas ürünleri', 'İzmir ikinci el', 'eşya takası', 'kitap takası', 'elektronik takas']
  },
  corporate: {
    title: 'Kurumsal | TAKAS-A - İşletmeler İçin Takas',
    description: 'İşletmeniz için stok fazlası ürünlerinizi değerlendirin. Kurumsal takas çözümleri ile atık azaltın, değer kazanın.',
    keywords: ['kurumsal takas', 'B2B takas', 'stok fazlası', 'işletme takası']
  },
  deliveryPoints: {
    title: 'Teslim Noktaları | TAKAS-A - Güvenli Buluşma',
    description: 'İzmir genelinde güvenli teslim noktalarımız. Bornova, Konak, Karşıyaka ve daha fazlasında güvenle takas yap.',
    keywords: ['teslim noktası', 'güvenli takas', 'İzmir buluşma noktası', 'takas teslim']
  },
  map: {
    title: 'Harita | TAKAS-A - Yakınındaki Takaslar',
    description: 'İzmir haritasında takas fırsatlarını gör. Yakınındaki ürünleri bul, teslim noktalarını keşfet.',
    keywords: ['İzmir harita', 'yakınımdaki takas', 'takas haritası']
  },
  howItWorks: {
    title: 'Nasıl Çalışır? | TAKAS-A - 3 Kolay Adım',
    description: 'TAKAS-A ile takas yapmak çok kolay! 1) Ürününü ekle 2) Takas teklifleri al 3) Güvenle takas et. İşte bu kadar basit!',
    keywords: ['takas nasıl yapılır', 'takas rehberi', 'takas adımları']
  },
  about: {
    title: 'Hakkımızda | TAKAS-A - Paylaşımın Geleceği',
    description: 'TAKAS-A, İzmir\'de sürdürülebilir paylaşım ekonomisini destekleyen yerel bir girişimdir. Misyonumuz ve vizyonumuz hakkında.',
    keywords: ['takas-a hakkında', 'paylaşım ekonomisi', 'sürdürülebilir yaşam']
  },
  contact: {
    title: 'İletişim | TAKAS-A - Bize Ulaşın',
    description: 'İzmir - TAKAS-A ekibiyle iletişime geçin. Sorularınız, önerileriniz ve iş birliği teklifleriniz için buradayız.',
    keywords: ['takas-a iletişim', 'destek', 'yardım']
  },
  faq: {
    title: 'Sıkça Sorulan Sorular | TAKAS-A',
    description: 'TAKAS-A hakkında merak ettiğiniz her şey! Nasıl takas yapılır? Güvenli mi? Valor nedir? Tüm soruların cevapları burada.',
    keywords: ['takas SSS', 'takas soruları', 'takas yardım']
  },
  login: {
    title: 'Giriş Yap | TAKAS-A',
    description: 'TAKAS-A hesabına giriş yap ve takas yapmaya başla. İzmir\'in en büyük takas topluluğuna katıl!',
    keywords: ['takas giriş', 'takas-a giriş']
  },
  register: {
    title: 'Ücretsiz Üye Ol | TAKAS-A',
    description: 'TAKAS-A\'ya ücretsiz üye ol ve hemen takas yapmaya başla! Kayıt ol, 50 Valor kazan, ilk takasını gerçekleştir.',
    keywords: ['takas üye ol', 'takas-a kayıt', 'ücretsiz üyelik']
  },
  addProduct: {
    title: 'Ürün Ekle | TAKAS-A',
    description: 'Kullanmadığın eşyalarını TAKAS-A\'ya ekle ve takas fırsatı yakala. AI destekli fiyatlandırma ile adil değerleme.',
    keywords: ['ürün ekle', 'takas ilanı', 'eşya sat']
  },
  barcelona: {
    title: 'Barcelona | TAKAS-A - Uluslararası Takas',
    description: 'TAKAS-A Barcelona pilot programı. İspanya ve Katalonya\'da takas ekonomisinin geleceği.',
    keywords: ['Barcelona takas', 'swap Barcelona', 'intercambio']
  },
  swapOpportunities: {
    title: 'Takas Fırsatları | TAKAS-A',
    description: 'Sana özel takas fırsatlarını keşfet! AI algoritması ile eşleştirilen çoklu takas zincirleri.',
    keywords: ['takas fırsatları', 'çoklu takas', 'takas önerileri']
  },
  profile: {
    title: 'Profilim | TAKAS-A',
    description: 'TAKAS-A profilini yönet. Takasların, mesajların ve Valor bakiyen tek yerde.',
    keywords: ['takas profil', 'hesabım']
  },
  invite: {
    title: 'Arkadaşını Davet Et | TAKAS-A',
    description: 'Arkadaşlarını TAKAS-A\'ya davet et, her ikimiz de 50 Valor kazanalım! Referans kodunu paylaş.',
    keywords: ['takas davet', 'referans kodu', 'arkadaşını getir']
  },
  ambassador: {
    title: 'Elçi Programı | TAKAS-A',
    description: 'TAKAS-A elçisi ol ve özel avantajlar kazan! Topluluğumuzu büyüt, paylaşım ekonomisini destekle.',
    keywords: ['takas elçi', 'ambassador program', 'influencer']
  }
}

// Organization Schema for Google
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'TAKAS-A',
  description: 'İzmir\'in ilk ve tek çoklu takas platformu',
  url: 'https://takas-a.com',
  logo: 'https://takas-a.com/images/takas-a-logo.jpg',
  foundingDate: '2024',
  foundingLocation: 'İzmir, Türkiye',
  sameAs: [
    'https://instagram.com/takasaizmir'
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    email: 'info@takas-a.com',
    availableLanguage: ['Turkish', 'English', 'Spanish', 'Catalan']
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'İzmir',
    addressCountry: 'TR'
  }
}

// WebSite Schema
export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'TAKAS-A',
  description: 'İzmir\'de ücretsiz eşya takas platformu',
  url: 'https://takas-a.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://takas-a.com/urunler?search={search_term_string}'
    },
    'query-input': 'required name=search_term_string'
  }
}

// FAQ Schema Generator
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  }
}

// Product Schema Generator
export function generateProductSchema(product: {
  id: string;
  title: string;
  description: string;
  images: string[];
  valorPrice: number;
  category: string;
  condition: string;
  user: { name: string };
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: product.images[0],
    offers: {
      '@type': 'Offer',
      price: product.valorPrice,
      priceCurrency: 'VALOR',
      availability: 'https://schema.org/InStock',
      itemCondition: product.condition === 'new' 
        ? 'https://schema.org/NewCondition' 
        : 'https://schema.org/UsedCondition'
    },
    category: product.category,
    seller: {
      '@type': 'Person',
      name: product.user.name
    }
  }
}

// Local Business Schema for Delivery Points
export function generateLocalBusinessSchema(point: {
  name: string;
  address: string;
  lat: number;
  lng: number;
  description?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `TAKAS-A Teslim Noktası - ${point.name}`,
    description: point.description || 'TAKAS-A güvenli takas teslim noktası',
    address: {
      '@type': 'PostalAddress',
      streetAddress: point.address,
      addressLocality: 'İzmir',
      addressCountry: 'TR'
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: point.lat,
      longitude: point.lng
    }
  }
}

// Breadcrumb Schema Generator
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  }
}

// HowTo Schema - Nasıl Çalışır sayfası için
export const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'TAKAS-A\'da Nasıl Takas Yapılır?',
  description: 'İzmir\'in ücretsiz takas platformu TAKAS-A\'da eşya takası yapmanın 5 kolay adımı',
  image: 'https://takas-a.com/og-image.png',
  totalTime: 'PT10M',
  estimatedCost: {
    '@type': 'MonetaryAmount',
    currency: 'TRY',
    value: '0'
  },
  supply: [
    {
      '@type': 'HowToSupply',
      name: 'Takas etmek istediğiniz eşya'
    }
  ],
  tool: [
    {
      '@type': 'HowToTool',
      name: 'Akıllı telefon veya bilgisayar'
    },
    {
      '@type': 'HowToTool',
      name: 'İnternet bağlantısı'
    }
  ],
  step: [
    {
      '@type': 'HowToStep',
      name: 'Üye Ol',
      text: 'TAKAS-A\'ya ücretsiz üye olun. E-posta adresinizle kayıt olun ve 50 Valor hoş geldin bonusu kazanın.',
      url: 'https://takas-a.com/kayit',
      image: 'https://takas-a.com/og-image.png'
    },
    {
      '@type': 'HowToStep',
      name: 'Ürününüzü Ekleyin',
      text: 'Takas etmek istediğiniz ürünün fotoğraflarını çekin ve ilan oluşturun. AI destekli sistem adil bir değer belirleyecek.',
      url: 'https://takas-a.com/urun-ekle'
    },
    {
      '@type': 'HowToStep',
      name: 'Takas Tekliflerini İnceleyin',
      text: 'Diğer kullanıcılardan gelen takas tekliflerini inceleyin veya beğendiğiniz ürünlere teklif gönderin.'
    },
    {
      '@type': 'HowToStep',
      name: 'Teslim Noktası Seçin',
      text: 'İzmir genelindeki güvenli teslim noktalarından size uygun olanı seçin.',
      url: 'https://takas-a.com/teslim-noktalari'
    },
    {
      '@type': 'HowToStep',
      name: 'Takası Tamamlayın',
      text: 'Teslim noktasında buluşun, ürünleri kontrol edin ve takası onaylayın. Valor puanlarınız hesabınıza yansır!'
    }
  ]
}

// Service Schema - Platform hizmeti için
export const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'Barter Platform',
  name: 'TAKAS-A Takas Hizmeti',
  description: 'İzmir\'de ücretsiz eşya takas platformu. Elektronik, giyim, kitap, mobilya ve daha fazlası için güvenli takas.',
  provider: {
    '@type': 'Organization',
    name: 'TAKAS-A',
    url: 'https://takas-a.com'
  },
  areaServed: {
    '@type': 'City',
    name: 'İzmir',
    '@id': 'https://www.wikidata.org/wiki/Q35997'
  },
  availableChannel: {
    '@type': 'ServiceChannel',
    serviceUrl: 'https://takas-a.com',
    servicePlatform: 'Web',
    availableLanguage: ['Turkish', 'English', 'Spanish', 'Catalan']
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'TRY',
    description: 'Ücretsiz üyelik ve takas'
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Takas Kategorileri',
    itemListElement: [
      { '@type': 'OfferCatalog', name: 'Elektronik' },
      { '@type': 'OfferCatalog', name: 'Giyim' },
      { '@type': 'OfferCatalog', name: 'Kitap' },
      { '@type': 'OfferCatalog', name: 'Ev Eşyaları' },
      { '@type': 'OfferCatalog', name: 'Spor' },
      { '@type': 'OfferCatalog', name: 'Bebek' }
    ]
  }
}

// Software Application Schema - PWA için
export const softwareAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'TAKAS-A',
  operatingSystem: 'Web, Android, iOS (PWA)',
  applicationCategory: 'LifestyleApplication',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'TRY'
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '250',
    bestRating: '5',
    worstRating: '1'
  },
  featureList: [
    'Ücretsiz takas',
    'Çoklu takas zincirleri',
    'AI destekli değerleme',
    'Güvenli teslim noktaları',
    'Görsel arama',
    'Anlık mesajlaşma'
  ]
}

// Review Schema Generator - Kullanıcı yorumları için
export function generateReviewSchema(review: {
  author: string;
  rating: number;
  reviewBody: string;
  datePublished: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    author: {
      '@type': 'Person',
      name: review.author
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating,
      bestRating: '5',
      worstRating: '1'
    },
    reviewBody: review.reviewBody,
    datePublished: review.datePublished,
    itemReviewed: {
      '@type': 'Service',
      name: 'TAKAS-A Takas Platformu'
    }
  }
}

// Aggregate Rating Schema
export const aggregateRatingSchema = {
  '@context': 'https://schema.org',
  '@type': 'AggregateRating',
  itemReviewed: {
    '@type': 'Organization',
    name: 'TAKAS-A'
  },
  ratingValue: '4.8',
  bestRating: '5',
  worstRating: '1',
  ratingCount: '478',
  reviewCount: '312'
}

// Event Schema Generator - Takas buluşmaları için
export function generateEventSchema(event: {
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  location: string;
  address: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate || event.startDate,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: event.location,
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.address,
        addressLocality: 'İzmir',
        addressCountry: 'TR'
      }
    },
    organizer: {
      '@type': 'Organization',
      name: 'TAKAS-A',
      url: 'https://takas-a.com'
    },
    isAccessibleForFree: true
  }
}

// ItemList Schema Generator - Ürün listesi için
export function generateItemListSchema(products: Array<{
  id: string;
  title: string;
  image: string;
  valorPrice: number;
}>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.slice(0, 10).map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.title,
        image: product.image,
        url: `https://takas-a.com/urun/${product.id}`,
        offers: {
          '@type': 'Offer',
          price: product.valorPrice,
          priceCurrency: 'VALOR',
          availability: 'https://schema.org/InStock'
        }
      }
    }))
  }
}

// VideoObject Schema Generator
export function generateVideoSchema(video: {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string;
  contentUrl: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.name,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    uploadDate: video.uploadDate,
    duration: video.duration || 'PT1M',
    contentUrl: video.contentUrl,
    embedUrl: video.contentUrl,
    publisher: {
      '@type': 'Organization',
      name: 'TAKAS-A',
      logo: {
        '@type': 'ImageObject',
        url: 'https://takas-a.com/images/takas-a-logo.jpg'
      }
    }
  }
}

// Speakable Schema - Sesli asistanlar için
export const speakableSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  speakable: {
    '@type': 'SpeakableSpecification',
    cssSelector: ['h1', '.description', '.hero-text']
  },
  url: 'https://takas-a.com'
}

// Meta tag helpers
export function generateCanonicalUrl(path: string): string {
  const baseUrl = 'https://takas-a.com'
  return `${baseUrl}${path}`
}

export function generateAlternateLanguages(path: string) {
  return {
    'tr-TR': `https://takas-a.com${path}`,
    'en-US': `https://takas-a.com/global${path}`,
    'es-ES': `https://takas-a.com/barcelona${path}`,
    'ca-ES': `https://takas-a.com/barcelona${path}`,
    'x-default': `https://takas-a.com${path}`
  }
}

// Structured data for search engines
export const searchBoxSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  url: 'https://takas-a.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://takas-a.com/urunler?search={search_term_string}'
    },
    'query-input': 'required name=search_term_string'
  }
}
