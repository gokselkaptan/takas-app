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
  
  // Otomobil / Araç
  'otomobil': [
    { id: 'vehicleType', question: 'Araç türü?', type: 'select', 
      options: ['Sedan', 'Hatchback', 'SUV/Crossover', 'Station Wagon', 'Coupe', 'Cabrio', 'Minivan', 'Pick-up'] },
    { id: 'brand', question: 'Marka?', type: 'select',
      options: ['BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Toyota', 'Honda', 'Renault', 'Fiat', 'Hyundai', 'Ford', 'Opel', 'Peugeot', 'Volvo', 'Skoda', 'Kia', 'Nissan', 'Mazda', 'Seat', 'Citroen', 'Tesla', 'Diğer'] },
    { id: 'modelDetail', question: 'Model adı (ör: 520d, C200, Golf)?', type: 'select',
      options: ['Belirtmek istiyorum (açıklamaya yazın)', 'Bilinmiyor'] },
    { id: 'modelYear', question: 'Model yılı?', type: 'select',
      options: ['2024-2025', '2022-2023', '2020-2021', '2018-2019', '2015-2017', '2012-2014', '2010-2011', '2010 öncesi'] },
    { id: 'fuelType', question: 'Yakıt türü?', type: 'select',
      options: ['Benzin', 'Dizel', 'Hybrid', 'Elektrik', 'LPG'] },
    { id: 'transmission', question: 'Vites türü?', type: 'select',
      options: ['Otomatik', 'Manuel', 'Yarı Otomatik'] },
    { id: 'mileage', question: 'Kilometre?', type: 'select',
      options: ['0-50.000 km', '50.000-100.000 km', '100.000-150.000 km', '150.000-200.000 km', '200.000+ km'] },
    { id: 'hasAccidentRecord', question: 'Kaza kaydı var mı?', type: 'boolean' },
    { id: 'hasMaintenance', question: 'Yetkili servis bakım geçmişi var mı?', type: 'boolean' },
    { id: 'paintCondition', question: 'Boya durumu?', type: 'select',
      options: ['Orijinal', '1-2 panel boyalı', '3+ panel boyalı', 'Tam boya'] },
  ],

  // Oto Yedek Parça
  'oto-yedek-parca': [
    { id: 'isNew', question: 'Parça sıfır mı?', type: 'boolean' },
    { id: 'isOriginal', question: 'Orijinal parça mı?', type: 'boolean' },
    { id: 'compatibleBrand', question: 'Hangi marka araçlara uyumlu?', type: 'select',
      options: ['BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Toyota', 'Honda', 'Renault', 'Fiat', 'Evrensel', 'Diğer'] },
    { id: 'partType', question: 'Parça tipi?', type: 'select',
      options: ['Motor', 'Fren', 'Süspansiyon', 'Elektrik', 'Kaporta', 'İç aksesuar', 'Dış aksesuar', 'Diğer'] },
    { id: 'hasDamage', question: 'Hasar var mı?', type: 'boolean' },
    { id: 'hasWarranty', question: 'Garanti var mı?', type: 'boolean' },
  ],

  // Gayrimenkul / Ev / Daire
  'gayrimenkul': [
    { id: 'propertyType', question: 'Gayrimenkul türü?', type: 'select',
      options: ['Daire', 'Müstakil Ev', 'Villa', 'Arsa', 'Dükkan/İşyeri', 'Residence'] },
    { id: 'roomCount', question: 'Oda sayısı?', type: 'select',
      options: ['1+0', '1+1', '2+1', '3+1', '4+1', '5+1', '5+ üzeri'] },
    { id: 'squareMeters', question: 'Metrekare (m²)?', type: 'select',
      options: ['50 m² altı', '50-80 m²', '80-120 m²', '120-160 m²', '160-200 m²', '200+ m²'] },
    { id: 'floor', question: 'Bulunduğu kat?', type: 'select',
      options: ['Zemin/Bahçe', '1-3. kat', '4-7. kat', '8-15. kat', '15+ (Yüksek kat)', 'Müstakil'] },
    { id: 'buildingAge', question: 'Bina yaşı?', type: 'select',
      options: ['0-5 yıl (Yeni)', '5-10 yıl', '10-20 yıl', '20-30 yıl', '30+ yıl'] },
    { id: 'hasElevator', question: 'Asansör var mı?', type: 'boolean' },
    { id: 'hasParking', question: 'Otopark var mı?', type: 'boolean' },
    { id: 'heatingType', question: 'Isınma tipi?', type: 'select',
      options: ['Doğalgaz (Kombi)', 'Merkezi', 'Soba', 'Klima', 'Yerden ısıtma'] },
    { id: 'hasBalcony', question: 'Balkon/Teras var mı?', type: 'boolean' },
    { id: 'neighborhood', question: 'Konum/Semt (açıklamaya yazın)?', type: 'select',
      options: ['Merkezi konum', 'Şehir dışı', 'Denize yakın', 'Kampüs yakını'] },
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
  'otomobil': 'otomobil',
  'oto-yedek-parca': 'oto-yedek-parca',
  'gayrimenkul': 'gayrimenkul',
  'emlak': 'gayrimenkul',
}

export function getChecklistForCategory(categorySlug: string) {
  return categoryChecklists[categorySlugMap[categorySlug]] || categoryChecklists['default']
}
