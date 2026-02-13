// Ürün başlık ve açıklama çevirileri için yardımcı fonksiyonlar

// Yaygın ürün terimlerinin çevirileri
const termTranslations: Record<string, Record<string, string>> = {
  // Türkçe -> İngilizce
  'en': {
    // Durumlar
    'yillik kullanilmis': 'years used',
    'yil kullanilmis': 'year used',
    'inc ekran': 'inch screen',
    'beden': 'size',
    'numara': 'size',
    'adet': 'pieces',
    'parca': 'pieces',
    'renk': 'color',
    'siyah': 'black',
    'beyaz': 'white',
    'mavi': 'blue',
    'kirmizi': 'red',
    'yesil': 'green',
    'kahverengi': 'brown',
    'gri': 'gray',
    'bej': 'beige',
    'lacivert': 'navy blue',
    'pembe': 'pink',
    // Durumlar
    'Sifir': 'Brand New',
    'Sıfır': 'Brand New',
    'Sifir Gibi': 'Like New',
    'Sıfır Gibi': 'Like New',
    'İyi': 'Good',
    'Iyi': 'Good',
    'Orta': 'Fair',
    // Kategoriler
    'Elektronik': 'Electronics',
    'Giyim': 'Clothing',
    'Ev & Yasam': 'Home & Living',
    'Ev & Yaşam': 'Home & Living',
    'Spor & Outdoor': 'Sports & Outdoor',
    'Kitap & Hobi': 'Books & Hobbies',
    'Cocuk & Bebek': 'Kids & Baby',
    'Çocuk & Bebek': 'Kids & Baby',
    'Oyuncak': 'Toys',
    'Mutfak': 'Kitchen',
    'Bahce': 'Garden',
    'Bahçe': 'Garden',
    'Taki & Aksesuar': 'Jewelry & Accessories',
    'Takı & Aksesuar': 'Jewelry & Accessories',
    'Beyaz Esya': 'White Goods',
    'Beyaz Eşya': 'White Goods',
    'Diger': 'Other',
    'Diğer': 'Other',
    // Ürün tipleri
    'Bebek Arabasi': 'Baby Stroller',
    'Bebek Arabasý': 'Baby Stroller',
    'Puset': 'Stroller',
    'Karyola': 'Crib',
    'Yatak': 'Mattress',
    'Mama Sandalyesi': 'High Chair',
    'Kiyafet Seti': 'Clothing Set',
    'Banyo Seti': 'Bath Set',
    'Oyun Hali': 'Play Mat',
    'Besik': 'Cradle',
    'Yorgan': 'Blanket',
    'Tasima Kanguru': 'Baby Carrier',
    'Oto Koltugu': 'Car Seat',
    'Aktivite Jimnastik': 'Activity Gym',
    'Emzirme Minderi': 'Nursing Pillow',
    'Bez Cantasi': 'Diaper Bag',
    'Biberon Seti': 'Bottle Set',
    'Park Yatagi': 'Travel Crib',
    'Kulaklik': 'Headphones',
    'Telefon': 'Phone',
    'Tablet': 'Tablet',
    'Bilgisayar': 'Computer',
    'Laptop': 'Laptop',
    'Monitör': 'Monitor',
    'Monitor': 'Monitor',
    'Televizyon': 'Television',
    'TV': 'TV',
    'Ceket': 'Jacket',
    'Elbise': 'Dress',
    'Pantolon': 'Pants',
    'Gomlek': 'Shirt',
    'Gömlek': 'Shirt',
    'Ayakkabi': 'Shoes',
    'Ayakkabý': 'Shoes',
    'Canta': 'Bag',
    'Çanta': 'Bag',
    'Saat': 'Watch',
    'Kolye': 'Necklace',
    'Yuzuk': 'Ring',
    'Yüzük': 'Ring',
    'Kupe': 'Earrings',
    'Küpe': 'Earrings',
    'Bileklik': 'Bracelet',
    'Kitap': 'Book',
    'Roman': 'Novel',
    'Oyun': 'Game',
    'Bisiklet': 'Bicycle',
    'Spor Aleti': 'Sports Equipment',
    'Yoga Mati': 'Yoga Mat',
    'Dambil': 'Dumbbell',
    'Cadir': 'Tent',
    'Çadır': 'Tent',
    'Uyku Tulumu': 'Sleeping Bag',
    'Koltuk': 'Sofa',
    'Masa': 'Table',
    'Sandalye': 'Chair',
    'Dolap': 'Cabinet',
    'Raf': 'Shelf',
    'Lamba': 'Lamp',
    'Hali': 'Carpet',
    'Halý': 'Carpet',
    'Perde': 'Curtain',
    'Ayna': 'Mirror',
    'Buzdolabi': 'Refrigerator',
    'Camasir Makinesi': 'Washing Machine',
    'Bulasik Makinesi': 'Dishwasher',
    'Mikrodalga': 'Microwave',
    'Firin': 'Oven',
    'Fýrýn': 'Oven',
    'Tost Makinesi': 'Toaster',
    'Kahve Makinesi': 'Coffee Maker',
    'Su Isitici': 'Electric Kettle',
    'Blender': 'Blender',
    'Lego': 'Lego',
    'Oyuncak Araba': 'Toy Car',
    'Bebek': 'Baby Doll',
    'Puzzle': 'Puzzle',
    'Kadin': 'Women\'s',
    'Kadýn': 'Women\'s',
    'Erkek': 'Men\'s',
    'Cocuk': 'Children\'s',
    'Çocuk': 'Children\'s',
    'Unisex': 'Unisex',
    'Travel sistem': 'Travel system',
    'Hafif': 'Lightweight',
    'katlanir': 'foldable',
    'sallanir': 'rocking',
    'yukseklik ayarli': 'height adjustable',
    'yikaniir kilif': 'washable cover',
    'cok gozlu': 'multi-pocket',
    'Aktif gurultu engelleyici': 'Active noise cancelling',
    'gercek deri': 'genuine leather',
    'pamuklu': 'cotton',
    'organik': 'organic',
    'muzikli': 'with music',
    // Yaş/Ay
    'ay': 'months',
    'yas': 'years',
    'yaş': 'years',
  },
  // Türkçe -> İspanyolca
  'es': {
    'yillik kullanilmis': 'años de uso',
    'inc ekran': 'pulgadas de pantalla',
    'beden': 'talla',
    'numara': 'número',
    'adet': 'piezas',
    'parca': 'piezas',
    'renk': 'color',
    'siyah': 'negro',
    'beyaz': 'blanco',
    'mavi': 'azul',
    'kirmizi': 'rojo',
    'Sifir': 'Nuevo',
    'Sifir Gibi': 'Como Nuevo',
    'İyi': 'Bueno',
    'Orta': 'Regular',
    // Kategoriler
    'Elektronik': 'Electrónica',
    'Giyim': 'Ropa',
    'Ev & Yasam': 'Hogar y Vida',
    'Ev & Yaşam': 'Hogar y Vida',
    'Spor & Outdoor': 'Deportes y Exterior',
    'Kitap & Hobi': 'Libros y Hobbies',
    'Cocuk & Bebek': 'Niños y Bebés',
    'Çocuk & Bebek': 'Niños y Bebés',
    'Oyuncak': 'Juguetes',
    'Mutfak': 'Cocina',
    'Bahce': 'Jardín',
    'Bahçe': 'Jardín',
    'Taki & Aksesuar': 'Joyas y Accesorios',
    'Takı & Aksesuar': 'Joyas y Accesorios',
    'Beyaz Esya': 'Electrodomésticos',
    'Beyaz Eşya': 'Electrodomésticos',
    'Diger': 'Otros',
    'Diğer': 'Otros',
    // Ürünler
    'Bebek Arabasi': 'Cochecito de Bebé',
    'Puset': 'Carrito',
    'Karyola': 'Cuna',
    'Yatak': 'Colchón',
    'Mama Sandalyesi': 'Trona',
    'Kiyafet Seti': 'Conjunto de Ropa',
    'Kulaklik': 'Auriculares',
    'Telefon': 'Teléfono',
    'Ceket': 'Chaqueta',
    'Elbise': 'Vestido',
    'Kadin': 'Mujer',
    'Erkek': 'Hombre',
    'Cocuk': 'Niños',
    'ay': 'meses',
    'yas': 'años',
  },
  // Türkçe -> Katalanca
  'ca': {
    'yillik kullanilmis': 'anys d\'ús',
    'inc ekran': 'polzades de pantalla',
    'beden': 'talla',
    'numara': 'número',
    'adet': 'peces',
    'parca': 'peces',
    'renk': 'color',
    'siyah': 'negre',
    'beyaz': 'blanc',
    'mavi': 'blau',
    'kirmizi': 'vermell',
    'Sifir': 'Nou',
    'Sifir Gibi': 'Com Nou',
    'İyi': 'Bo',
    'Orta': 'Regular',
    // Kategoriler
    'Elektronik': 'Electrònica',
    'Giyim': 'Roba',
    'Ev & Yasam': 'Llar i Vida',
    'Ev & Yaşam': 'Llar i Vida',
    'Spor & Outdoor': 'Esports i Exterior',
    'Kitap & Hobi': 'Llibres i Hobbies',
    'Cocuk & Bebek': 'Nens i Nadons',
    'Çocuk & Bebek': 'Nens i Nadons',
    'Oyuncak': 'Joguines',
    'Mutfak': 'Cuina',
    'Bahce': 'Jardí',
    'Bahçe': 'Jardí',
    'Taki & Aksesuar': 'Joies i Accessoris',
    'Takı & Aksesuar': 'Joies i Accessoris',
    'Beyaz Esya': 'Electrodomèstics',
    'Beyaz Eşya': 'Electrodomèstics',
    'Diger': 'Altres',
    'Diğer': 'Altres',
    // Ürünler
    'Bebek Arabasi': 'Cotxet de Nadó',
    'Puset': 'Cotxet',
    'Karyola': 'Bressol',
    'Yatak': 'Matalàs',
    'Mama Sandalyesi': 'Trona',
    'Kiyafet Seti': 'Conjunt de Roba',
    'Kulaklik': 'Auriculars',
    'Telefon': 'Telèfon',
    'Ceket': 'Jaqueta',
    'Elbise': 'Vestit',
    'Kadin': 'Dona',
    'Erkek': 'Home',
    'Cocuk': 'Nens',
    'ay': 'mesos',
    'yas': 'anys',
  }
}

// Durum çevirileri
export const conditionTranslations: Record<string, Record<string, string>> = {
  'new': { tr: 'Sıfır', en: 'Brand New', es: 'Nuevo', ca: 'Nou' },
  'likeNew': { tr: 'Sıfır Gibi', en: 'Like New', es: 'Como Nuevo', ca: 'Com Nou' },
  'good': { tr: 'İyi', en: 'Good', es: 'Bueno', ca: 'Bo' },
  'fair': { tr: 'Orta', en: 'Fair', es: 'Regular', ca: 'Regular' },
}

// Metni hedef dile çevir
export function translateText(text: string, targetLang: string): string {
  if (!text || targetLang === 'tr') return text
  
  const translations = termTranslations[targetLang]
  if (!translations) return text
  
  let result = text
  
  // Çevirileri uygula (uzun terimlerden başla)
  const sortedTerms = Object.keys(translations).sort((a, b) => b.length - a.length)
  
  for (const term of sortedTerms) {
    const regex = new RegExp(term, 'gi')
    result = result.replace(regex, translations[term])
  }
  
  return result
}

// Ürün nesnesini hedef dile çevir
export function translateProduct(product: {
  title: string
  titleEn?: string | null
  titleEs?: string | null
  titleCa?: string | null
  description: string
  descriptionEn?: string | null
  descriptionEs?: string | null
  descriptionCa?: string | null
  condition?: string
  category?: {
    name: string
    nameEn?: string | null
    nameEs?: string | null
    nameCa?: string | null
  }
  [key: string]: unknown
}, lang: string): typeof product & { translatedTitle: string; translatedDescription: string; translatedCondition: string; translatedCategory?: string } {
  let translatedTitle = product.title
  let translatedDescription = product.description
  
  // Önce veritabanındaki çevirileri kontrol et
  if (lang === 'en' && product.titleEn) {
    translatedTitle = product.titleEn
  } else if (lang === 'es' && product.titleEs) {
    translatedTitle = product.titleEs
  } else if (lang === 'ca' && product.titleCa) {
    translatedTitle = product.titleCa
  } else if (lang !== 'tr') {
    // Veritabanında çeviri yoksa otomatik çevir
    translatedTitle = translateText(product.title, lang)
  }
  
  if (lang === 'en' && product.descriptionEn) {
    translatedDescription = product.descriptionEn
  } else if (lang === 'es' && product.descriptionEs) {
    translatedDescription = product.descriptionEs
  } else if (lang === 'ca' && product.descriptionCa) {
    translatedDescription = product.descriptionCa
  } else if (lang !== 'tr') {
    translatedDescription = translateText(product.description, lang)
  }
  
  // Durum çevirisi
  const translatedCondition = product.condition 
    ? (conditionTranslations[product.condition]?.[lang] || product.condition)
    : ''
  
  // Kategori çevirisi
  let translatedCategory = product.category?.name
  if (product.category) {
    if (lang === 'en' && product.category.nameEn) {
      translatedCategory = product.category.nameEn
    } else if (lang === 'es' && product.category.nameEs) {
      translatedCategory = product.category.nameEs
    } else if (lang === 'ca' && product.category.nameCa) {
      translatedCategory = product.category.nameCa
    }
  }
  
  return {
    ...product,
    translatedTitle,
    translatedDescription,
    translatedCondition,
    translatedCategory
  }
}

// Birden fazla ürünü çevir
export function translateProducts<T extends Parameters<typeof translateProduct>[0]>(
  products: T[],
  lang: string
): (T & ReturnType<typeof translateProduct>)[] {
  return products.map(p => translateProduct(p, lang) as T & ReturnType<typeof translateProduct>)
}

// Kategori çevirisi
export function translateCategory(category: {
  name: string
  nameEn?: string | null
  nameEs?: string | null
  nameCa?: string | null
}, lang: string): string {
  // First check database fields
  if (lang === 'en' && category.nameEn) return category.nameEn
  if (lang === 'es' && category.nameEs) return category.nameEs
  if (lang === 'ca' && category.nameCa) return category.nameCa
  
  // Fallback to term translations if no database translation
  if (lang !== 'tr' && termTranslations[lang]) {
    const translations = termTranslations[lang]
    // Try exact match first
    if (translations[category.name]) return translations[category.name]
    // Try normalized match (remove accents for comparison)
    const normalizedName = category.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (translations[normalizedName]) return translations[normalizedName]
  }
  
  return category.name
}

// Teslimat noktası çevirisi
export function translateDeliveryPoint(point: {
  name: string
  nameEn?: string | null
  nameEs?: string | null
  nameCa?: string | null
  address: string
  addressEn?: string | null
  addressEs?: string | null
  addressCa?: string | null
}, lang: string): { translatedName: string; translatedAddress: string } {
  let translatedName = point.name
  let translatedAddress = point.address
  
  if (lang === 'en') {
    translatedName = point.nameEn || point.name
    translatedAddress = point.addressEn || point.address
  } else if (lang === 'es') {
    translatedName = point.nameEs || point.name
    translatedAddress = point.addressEs || point.address
  } else if (lang === 'ca') {
    translatedName = point.nameCa || point.name
    translatedAddress = point.addressCa || point.address
  }
  
  return { translatedName, translatedAddress }
}
