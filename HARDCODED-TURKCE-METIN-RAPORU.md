# TAKAS-A — HARDCODED TÜRKÇE METİN TARAMASI RAPORU

**Tarih:** 6 Nisan 2026  
**Durum:** Sadece araştırma — hiçbir kod değişikliği yapılmamıştır.

---

## 1. MEVCUT ÇEVİRİ SİSTEMİ

### Çeviri Dosyaları:
| Dosya | Açıklama |
|-------|----------|
| `lib/translations.ts` | Ana çeviri sözlüğü (1636 satır), TR/EN/ES/CA dilleri |
| `lib/language-context.tsx` | React Context + `useLanguage()` hook, `t()` fonksiyonu |
| `lib/product-translations.ts` | Ürün başlık/açıklama çevirisi için yardımcı fonksiyonlar |

### Çeviri Kullanımı:
```typescript
const { t, language } = useLanguage()
const text = t('key.name')  // TranslationKey tipinde
```

### Desteklenen Diller:
- **TR** (Türkçe) — Varsayılan
- **EN** (English)
- **ES** (Español)
- **CA** (Català)

### useLanguage() Kullanan Dosya Sayısı: **38 dosya**

---

## 2. TARAMA SONUÇLARI — GENEL ÖZET

| Dizin | Hardcoded Türkçe Satır Sayısı |
|-------|-------------------------------|
| `app/` | **4.735** |
| `components/` | **847** |
| `lib/` | **984** |
| **TOPLAM** | **6.566 satır** |

### Kategori Bazında:
| Kategori | Satır Sayısı |
|----------|-------------|
| Kullanıcıya Görünen Sayfalar (`page.tsx`) | 2.790 |
| API Route'lar (`route.ts`) | 1.763 |
| Layout'lar (`layout.tsx`) | 173 |
| Components | 847 |
| Lib Utilities | 984 |

---

## 3. EN ÇOK HARDCODED METİN İÇEREN 15 DOSYA

| # | Dosya | Satır | Öncelik | t() Kullanıyor mu? |
|---|-------|-------|---------|---------------------|
| 1 | `app/admin/page.tsx` | 572 | 🟡 Düşük (Admin) | ❌ |
| 2 | `app/takas-firsatlari/page.tsx` | 422 | 🔴 Yüksek | ✅ (kısmen) |
| 3 | `app/profil/page.tsx` | 358 | 🔴 Yüksek | ✅ (kısmen) |
| 4 | `app/urun/[id]/page.tsx` | 281 | 🔴 Yüksek | ✅ (kısmen) |
| 5 | `components/swap-management.tsx` | 262 | 🔴 Yüksek | ❌ |
| 6 | `lib/valor-system.ts` | 178 | 🟡 Orta (Backend) | ❌ |
| 7 | `app/urun-ekle/page.tsx` | 138 | 🔴 Yüksek | ✅ (kısmen) |
| 8 | `lib/seo-config.ts` | 120 | 🟡 Orta (SEO) | ❌ |
| 9 | `app/kurumsal/page.tsx` | 108 | 🔴 Yüksek | ❌ |
| 10 | `app/api/swap-requests/route.ts` | 107 | 🟡 Orta (API) | ❌ |
| 11 | `app/api/swap-requests/scan/route.ts` | 99 | 🟡 Orta (API) | ❌ |
| 12 | `app/api/disputes/route.ts` | 89 | 🟡 Orta (API) | ❌ |
| 13 | `app/api/valor/calculate/route.ts` | 86 | 🟡 Orta (API) | ❌ |
| 14 | `app/hizmet-takasi/page.tsx` | 81 | 🔴 Yüksek | ✅ (kısmen) |
| 15 | `app/istek-panosu/page.tsx` | 73 | 🔴 Yüksek | ❌ |

---

## 4. useLanguage() KULLANAN AMA HALA HARDCODED TÜRKÇE İÇEREN DOSYALAR

Bu dosyalar çeviri sistemine **kısmen** entegre edilmiş ama hala hardcoded metinler içeriyor:

| Dosya | Kalan Hardcoded Satır |
|-------|----------------------|
| `app/takas-firsatlari/page.tsx` | 537 |
| `app/profil/page.tsx` | 451 |
| `app/urun/[id]/page.tsx` | 342 |
| `app/urun-ekle/page.tsx` | 155 |
| `app/hizmet-takasi/page.tsx` | 87 |
| `components/mobile-navigation.tsx` | 63 |
| `app/mesajlar/page.tsx` | 55 |
| `app/sss/page.tsx` | 46 |
| `app/global/page.tsx` | 46 |
| `app/ambassador/page.tsx` | 45 |
| `app/urunler/page.tsx` | 37 |
| `components/home/products-showcase.tsx` | 36 |
| `app/topluluklar/[slug]/page.tsx` | 33 |
| `components/takas-merkezi/SwapChat.tsx` | 31 |
| `components/header.tsx` | 31 |

---

## 5. ÖNCELİK SIRASI

### 🔴 YÜKSEK ÖNCELİK — Kullanıcıya Doğrudan Görünen Ana Sayfalar

| Dosya | Satır | Açıklama |
|-------|-------|----------|
| `app/takas-firsatlari/page.tsx` | 422 | Takas Merkezi — en aktif sayfa |
| `app/profil/page.tsx` | 358 | Kullanıcı profili |
| `app/urun/[id]/page.tsx` | 281 | Ürün detay sayfası |
| `components/swap-management.tsx` | 262 | Takas yönetim paneli |
| `app/urun-ekle/page.tsx` | 138 | Ürün ekleme formu |
| `app/kurumsal/page.tsx` | 108 | Kurumsal/fiyatlandırma sayfası |
| `app/hizmet-takasi/page.tsx` | 81 | Hizmet takası sayfası |
| `app/istek-panosu/page.tsx` | 73 | İstek panosu |
| `app/oneriler/page.tsx` | 49 | Öneriler sayfası |
| `app/mesajlar/page.tsx` | 24 | Mesajlar sayfası |

**Toplam:** ~1.796 satır

### 🟠 ORTA ÖNCELİK — Destek/Bilgi Sayfaları ve API Mesajları

| Dosya | Satır | Açıklama |
|-------|-------|----------|
| `app/sss/page.tsx` | 46 | SSS sayfası |
| `app/gizlilik/page.tsx` | 46 | Gizlilik politikası |
| `app/kullanim-kosullari/page.tsx` | 44 | Kullanım koşulları |
| `app/nasil-calisir/page.tsx` | 31 | Nasıl çalışır sayfası |
| `app/kayit/page.tsx` | 30 | Kayıt sayfası |
| `app/giris/page.tsx` | 30 | Giriş sayfası |
| `app/sifremi-unuttum/page.tsx` | 26 | Şifremi unuttum |
| `app/api/swap-requests/route.ts` | 107 | API hata/başarı mesajları |
| `app/api/swap-requests/scan/route.ts` | 99 | QR tarama API mesajları |
| `app/api/disputes/route.ts` | 89 | Dispute API mesajları |
| `app/api/valor/calculate/route.ts` | 86 | Valor hesaplama |
| `lib/valor-system.ts` | 178 | Valor sistemi (seviye isimleri, mesajlar) |
| `lib/seo-config.ts` | 120 | SEO metadataları |

**Toplam:** ~932 satır

### 🟡 DÜŞÜK ÖNCELİK — Admin ve Backend

| Dosya | Satır | Açıklama |
|-------|-------|----------|
| `app/admin/page.tsx` | 572 | Admin dashboard |
| `app/admin/reports/[id]/page.tsx` | 37 | Admin rapor detay |
| `app/admin/products/page.tsx` | 34 | Admin ürün yönetimi |
| `app/admin/reports/page.tsx` | 27 | Admin raporlar listesi |
| `app/admin/guvenlik-uyarilari/page.tsx` | 29 | Admin güvenlik |
| Çeşitli `app/api/admin/*` dosyaları | ~200+ | Admin API'lar |

**Toplam:** ~900+ satır

---

## 6. ÖRNEK HARDCODED METİNLER

### app/admin/page.tsx (Admin — 572 satır):
```
'Ürün Kusurlu'
'Açıklamayla Uyuşmuyor'
'Eksik Parça'
'Ürün Açıklamayla Uyuşmuyor'
'Ürün Hasarlı/Kusurlu Geldi'
'Ürün Teslim Edilmedi'
```

### app/profil/page.tsx (Profil — 358 satır):
```
'Elektronik', 'Giyim', 'Kitap', 'Spor', 'Ev & Yaşam', 'Oyuncak'
'Ne sıklıkla takas yapmayı planlıyorsunuz?'
'Haftada birkaç kez', 'Haftada bir', 'Ayda birkaç kez'
```

### app/urun/[id]/page.tsx (Ürün Detay — 281 satır):
```
'Ürününüzü Takas-A ile edinmek istemekteyim.'
'Pazarlık şansı var mı?'
'Ürününüzü bedelsiz vermeyi düşünür müsünüz?'
```

### app/urun-ekle/page.tsx (Ürün Ekleme — 138 satır):
```
'Baskı yılı?', 'Yayınevi?', 'Okunmuş mu?'
'Üzerinde not/alt çizgi var mı?'
'Garanti süresi?', 'Kutusu var mı?'
'Aksesuarlar dahil mi?', 'Kaç yıl kullanıldı?'
```

### components/swap-management.tsx (262 satır):
```
// Tüm takas yönetim UI metinleri — pazarlık, QR tarama, teslimat
```

### lib/valor-system.ts (178 satır):
```
'Yeni Üye', 'Başlangıç', 'Güvenilir'
// Seviye isimleri ve ekonomi sistemi mesajları
```

### lib/seo-config.ts (120 satır):
```
'Dünyadaki tüm şehirlerde ücretsiz takas platformu!'
'takas', 'takas platformu', 'eşya takası', 'ücretsiz takas'
'İstanbul takas', 'Ankara takas', 'İzmir takas'
```

---

## 7. t() KULLANMAYAN DOSYALARIN TAM LİSTESİ

### Kullanıcıya Görünen Sayfalar (useLanguage yok):
| Dosya | Satır |
|-------|-------|
| `app/admin/page.tsx` | 572 |
| `app/kurumsal/page.tsx` | 108 |
| `app/istek-panosu/page.tsx` | 73 |
| `app/oneriler/page.tsx` | 49 |
| `app/gizlilik/page.tsx` | 46 |
| `app/kullanim-kosullari/page.tsx` | 44 |
| `app/nasil-calisir/page.tsx` | 31 |
| `app/kayit/page.tsx` | 30 |
| `app/giris/page.tsx` | 30 |
| `app/premium/page.tsx` | 29 |
| `app/sifremi-unuttum/page.tsx` | 26 |
| `app/teslim-noktalari/page.tsx` | 22 |
| `app/hakkimizda/page.tsx` | 19 |
| `app/iletisim/page.tsx` | 16 |
| `app/davet/page.tsx` | 16 |

### Components (useLanguage yok):
| Dosya | Satır |
|-------|-------|
| `components/swap-management.tsx` | 262 |
| `components/educational-popups.tsx` | 34 |
| `components/social-share-widget.tsx` | 33 |
| `components/MultiSwapOnboarding.tsx` | 30 |
| `components/block-report-actions.tsx` | 27 |
| `components/admin/EditPriceModal.tsx` | 17 |
| `components/onboarding/FeaturesStep.tsx` | 17 |
| `components/onboarding/TutorialStep.tsx` | 16 |
| `components/update-manager.tsx` | 14 |
| `components/onboarding/FirstProductStep.tsx` | 12 |
| `components/onboarding/ProfileStep.tsx` | 10 |

### Lib (çeviri sistemi entegrasyonu yok):
| Dosya | Satır |
|-------|-------|
| `lib/valor-system.ts` | 178 |
| `lib/seo-config.ts` | 120 |
| `lib/types.ts` | 72 |
| `lib/state-machine.ts` | 58 |
| `lib/push-notifications.ts` | 58 |
| `lib/notifications.ts` | 40 |
| `lib/badge-system.ts` | 38 |
| `lib/valor-economics.ts` | 37 |
| `lib/seo-helpers.ts` | 35 |
| `lib/trust-system.ts` | 34 |
| `lib/message-moderation.ts` | 34 |
| `lib/valor-pricing.ts` | 33 |
| `lib/swap-config.ts` | 30 |
| `lib/validations.ts` | 26 |

---

## 8. ÖNERİLER

### Yaklaşım:
1. **İlk Adım (Sprint 1):** En çok kullanıcı etkileşimi olan sayfaları çevir
   - `components/swap-management.tsx` (262 satır — takas yönetimi)
   - `app/takas-firsatlari/page.tsx` (kalan ~537 satır)
   - `app/profil/page.tsx` (kalan ~451 satır)
   - `app/urun/[id]/page.tsx` (kalan ~342 satır)

2. **İkinci Adım (Sprint 2):** Kayıt/giriş ve form sayfaları
   - `app/urun-ekle/page.tsx` (155 satır)
   - `app/kayit/page.tsx`, `app/giris/page.tsx`
   - `app/mesajlar/page.tsx`
   - `app/kurumsal/page.tsx`

3. **Üçüncü Adım (Sprint 3):** Bilgi sayfaları ve SEO
   - `app/sss/page.tsx`, `app/gizlilik/page.tsx`, `app/kullanim-kosullari/page.tsx`
   - `lib/seo-config.ts`
   - Component'ler (onboarding, educational-popups, vb.)

4. **Son Adım (Sprint 4):** Backend/API mesajları ve admin
   - API route'lardaki hata/başarı mesajları
   - `lib/valor-system.ts`, `lib/notifications.ts`
   - `app/admin/page.tsx` (düşük öncelik — sadece admin görür)

### Teknik Not:
- `translations.ts` dosyasına yeni key'ler eklenmeli
- `useLanguage()` hook'u import edilip `t()` fonksiyonu kullanılmalı
- API route'lar için sunucu tarafında çeviri mekanizması düşünülmeli (kullanıcı dil tercihi DB'den okunabilir)
- SEO metadataları için dil bazlı `generateMetadata()` kullanılabilir

---

## 9. ÖZET

| Metrik | Değer |
|--------|-------|
| Toplam hardcoded Türkçe satır | **6.566** |
| Etkilenen dosya sayısı (app/) | **~120** |
| Etkilenen dosya sayısı (components/) | **~50** |
| Etkilenen dosya sayısı (lib/) | **~35** |
| useLanguage() kullanan dosya | **38** |
| useLanguage() kullanıp hala hardcoded içeren | **30** |
| Hiç çeviri entegrasyonu olmayan dosya | **~100+** |

**ÖNEMLİ:** Bu rapor sadece araştırma amaçlıdır. Hiçbir kod değişikliği yapılmamıştır.
