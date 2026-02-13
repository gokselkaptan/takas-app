// Checklist definitions for each category
export const categoryChecklists: Record<string, { id: string; question: string; type: 'boolean' | 'select'; options?: string[] }[]> = {
  // Electronics
  'elektronik': [
    { id: 'isNew', question: 'Ürün sıfır mı?', type: 'boolean' },
    { id: 'hasWarranty', question: 'Garanti belgesi mevcut mu?', type: 'boolean' },
    { id: 'warrantyDuration', question: 'Garanti süresi ne kadar kaldı?', type: 'select', options: ['Yok', '0-3 ay', '3-6 ay', '6-12 ay', '12+ ay'] },
    { id: 'hasBox', question: 'Orijinal kutusu var mı?', type: 'boolean' },
    { id: 'hasAccessories', question: 'Aksesuarları (kablo, adaptör vb.) var mı?', type: 'boolean' },
    { id: 'screenCondition', question: 'Ekranın durumu nedir?', type: 'select', options: ['Kusursuz', 'Küçük çizikler', 'Çatlak/kırık'] },
    { id: 'batteryHealth', question: 'Batarya sağlığı ne durumda?', type: 'select', options: ['Mükemmel (%90+)', 'İyi (%70-90)', 'Orta (%50-70)', 'Zayıf (<%50)'] },
    { id: 'isWorking', question: 'Tüm fonksiyonlar çalışıyor mu?', type: 'boolean' },
  ],
  
  // Clothing
  'giyim': [
    { id: 'isNew', question: 'Ürün sıfır/hiç giyilmemiş mi?', type: 'boolean' },
    { id: 'hasTag', question: 'Etiketi üzerinde mi?', type: 'boolean' },
    { id: 'hasTear', question: 'Yırtık veya hasar var mı?', type: 'boolean' },
    { id: 'hasStain', question: 'Leke var mı?', type: 'boolean' },
    { id: 'fabricCondition', question: 'Kumaşın durumu nedir?', type: 'select', options: ['Yeni gibi', 'Hafif yıpranma', 'Belirgin yıpranma'] },
    { id: 'colorFading', question: 'Renk solması var mı?', type: 'boolean' },
    { id: 'washCount', question: 'Yaklaşık kaç kez yıkandı?', type: 'select', options: ['Hiç/az (0-5)', 'Orta (5-20)', 'Çok (20+)'] },
  ],
  
  // Books
  'kitaplar': [
    { id: 'isNew', question: 'Kitap okunmamış/sıfır mı?', type: 'boolean' },
    { id: 'hasWriting', question: 'Kitabın içinde yazı/çizim var mı?', type: 'boolean' },
    { id: 'coverCondition', question: 'Kapak durumu nedir?', type: 'select', options: ['Kusursuz', 'Küçük yıpranmalar', 'Belirgin hasar'] },
    { id: 'pageCondition', question: 'Sayfaların durumu nedir?', type: 'select', options: ['Temiz ve düzgün', 'Sararma var', 'Kıvrık/yırtık sayfalar'] },
    { id: 'isComplete', question: 'Set ise tüm kitaplar mevcut mu?', type: 'boolean' },
  ],
  
  // Toys
  'oyuncaklar': [
    { id: 'isNew', question: 'Ürün sıfır mı?', type: 'boolean' },
    { id: 'hasBox', question: 'Orijinal kutusu var mı?', type: 'boolean' },
    { id: 'isComplete', question: 'Tüm parçalar tam mı?', type: 'boolean' },
    { id: 'hasDamage', question: 'Kırık/hasar var mı?', type: 'boolean' },
    { id: 'batteryNeeded', question: 'Pil gerekiyorsa piller dahil mi?', type: 'boolean' },
    { id: 'ageAppropriate', question: 'Yaş grubu nedir?', type: 'select', options: ['0-2 yaş', '3-5 yaş', '6-10 yaş', '10+ yaş'] },
  ],
  
  // Home & Living
  'ev-yasam': [
    { id: 'isNew', question: 'Ürün sıfır/hiç kullanılmamış mı?', type: 'boolean' },
    { id: 'hasWarranty', question: 'Garanti mevcut mu?', type: 'boolean' },
    { id: 'hasDamage', question: 'Çizik, kırık veya hasar var mı?', type: 'boolean' },
    { id: 'isWorking', question: 'Elektrikli ise çalışıyor mu?', type: 'boolean' },
    { id: 'usageFrequency', question: 'Ne sıklıkta kullanıldı?', type: 'select', options: ['Hiç', 'Nadiren', 'Orta', 'Sık'] },
  ],
  
  // Sports & Outdoor
  'spor-outdoor': [
    { id: 'isNew', question: 'Ürün sıfır mı?', type: 'boolean' },
    { id: 'hasDamage', question: 'Fiziksel hasar var mı?', type: 'boolean' },
    { id: 'isComplete', question: 'Tüm aksesuarlar dahil mi?', type: 'boolean' },
    { id: 'usageLevel', question: 'Kullanım durumu nedir?', type: 'select', options: ['Hiç kullanılmadı', 'Hafif kullanım', 'Orta kullanım', 'Yoğun kullanım'] },
    { id: 'safetyCheck', question: 'Güvenlik kontrolü yapıldı mı?', type: 'boolean' },
  ],
  
  // Default for other categories
  'default': [
    { id: 'isNew', question: 'Ürün sıfır mı?', type: 'boolean' },
    { id: 'hasDamage', question: 'Herhangi bir hasar var mı?', type: 'boolean' },
    { id: 'isWorking', question: 'Ürün tam çalışır durumda mı?', type: 'boolean' },
    { id: 'hasAccessories', question: 'Aksesuarlar dahil mi?', type: 'boolean' },
  ],
}

// Map category slugs to checklist keys
export const categorySlugMap: Record<string, string> = {
  'elektronik': 'elektronik',
  'giyim': 'giyim',
  'kitaplar': 'kitaplar',
  'oyuncaklar': 'oyuncaklar',
  'ev-yasam': 'ev-yasam',
  'spor-outdoor': 'spor-outdoor',
}

export function getChecklistForCategory(categorySlug: string) {
  return categoryChecklists[categorySlugMap[categorySlug]] || categoryChecklists['default']
}
