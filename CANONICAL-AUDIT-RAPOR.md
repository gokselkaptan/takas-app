# 🔍 TAKAS-A CANONICAL AUDIT RAPORU

**Tarih:** 6 Nisan 2026  
**Site:** https://takas-a.com  
**Sorun:** Google Search Console — "Kopya, Google kullanıcıdan farklı bir standart sayfa seçti"

---

## A. KÖK NEDEN İHTİMALLERİ

### 🔴 Yüksek İhtimal (Kesin Tespit)

1. **Canonical olmayan sayfalar, root layout'tan `canonical: https://takas-a.com` miras alıyor**
   - `/hakkimizda`, `/barcelona`, `/global`, `/harita`, `/iletisim`, `/teslim-noktalari` gibi sayfaların canonical'ı **ana sayfayı** gösteriyor
   - Google bu sayfaları ziyaret ediyor → canonical ana sayfaya işaret ediyor → Google "farklı canonical seçti" hatası veriyor

2. **Sitemap'te query param URL'ler var ama canonical'ları farklı**
   - Sitemap'te: `/urunler?category=elektronik`, `/urunler?district=bornova`, `/teslim-noktalari?district=Bornova`
   - Bu URL'lerin canonical'ı: `/urunler` veya `https://takas-a.com` (ana sayfa)
   - Google sitemap'ten bu URL'leri keşfediyor → canonical farklı → **"Kopya, farklı canonical"** hatası

### 🟡 Orta İhtimal

3. **www → non-www redirect 307 (Temporary)**
   - `https://www.takas-a.com` → `https://takas-a.com` yönlendirmesi **307** (geçici)
   - Olması gereken: **301** (kalıcı)
   - Google 307'yi kalıcı olarak görmeyebilir

### 🟢 Düşük İhtimal

4. **Trailing slash 308 redirect**
   - `/urunler/` → `/urunler` yönlendirmesi 308 ile yapılıyor (bu Next.js default davranışı, normal)

---

## B. KESİN TESPİT EDİLEN SORUNLAR

### Sorun 1: 20+ Sayfa Yanlış Canonical'a Sahip (KRİTİK)

**Etkilenen Sayfalar (live test ile doğrulanmış):**

| Sayfa | Gerçek Canonical | Olması Gereken |
|-------|-----------------|----------------|
| `/hakkimizda` | `https://takas-a.com` ❌ | `https://takas-a.com/hakkimizda` |
| `/iletisim` | `https://takas-a.com` ❌ | `https://takas-a.com/iletisim` |
| `/teslim-noktalari` | `https://takas-a.com` ❌ | `https://takas-a.com/teslim-noktalari` |
| `/harita` | `https://takas-a.com` ❌ | `https://takas-a.com/harita` |
| `/barcelona` | `https://takas-a.com` ❌ | `https://takas-a.com/barcelona` |
| `/global` | `https://takas-a.com` ❌ | `https://takas-a.com/global` |
| `/gizlilik` | `https://takas-a.com` ❌ | `https://takas-a.com/gizlilik` |
| `/kullanim-kosullari` | `https://takas-a.com` ❌ | `https://takas-a.com/kullanim-kosullari` |
| `/premium` | `https://takas-a.com` ❌ | `https://takas-a.com/premium` |
| `/hizmet-takasi` | `https://takas-a.com` ❌ | `https://takas-a.com/hizmet-takasi` |
| `/istek-panosu` | `https://takas-a.com` ❌ | `https://takas-a.com/istek-panosu` |
| `/topluluk` | `https://takas-a.com` ❌ | `https://takas-a.com/topluluk` |
| `/topluluklar` | `https://takas-a.com` ❌ | `https://takas-a.com/topluluklar` |
| `/ambassador` | `https://takas-a.com` ❌ | `https://takas-a.com/ambassador` |

**Sebep:**
- `app/layout.tsx` satır 125-126'da root-level canonical tanımlanmış: `canonical: 'https://takas-a.com'`
- Bu layout'ları override etmeyen tüm alt sayfalar, root canonical'ı miras alıyor
- Next.js'te `alternates.canonical` parent layout'tan child'a miras kalır

**Google'a Etkisi:**
- Google bu sayfaları ziyaret ediyor → canonical ana sayfaya işaret ediyor
- Google "bu sayfalar ana sayfanın kopyası" diye algılıyor
- Search Console'da "Kopya, Google kullanıcıdan farklı bir standart sayfa seçti" hatası oluşuyor

---

### Sorun 2: Sitemap'te Query Param URL'ler ↔ Canonical Çakışması (KRİTİK)

**Dosya:** `app/sitemap.ts`

**Çakışan URL Grupları:**

| Sitemap URL | Canonical (canlıda) | Sorun |
|------------|---------------------|-------|
| `/urunler?category=elektronik` | `/urunler` | Sitemap farklı URL gösteriyor, canonical farklı |
| `/urunler?category=giyim` | `/urunler` | Aynı sorun |
| `/urunler?district=bornova` | `/urunler` | Aynı sorun |
| `/teslim-noktalari?district=Bornova` | `https://takas-a.com` | Canonical ana sayfaya işaret ediyor! |

**Sebep:**
- `app/urunler/layout.tsx` satır 13: `canonical: '/urunler'` → tüm `/urunler?...` sayfaları aynı canonical'ı alıyor
- `app/teslim-noktalari/layout.tsx`: canonical tanımlı değil → root canonical (`https://takas-a.com`) miras alınıyor
- Sitemap'te bu URL'ler ayrı ayrı listeleniyor ama canonical'ları hepsini tek sayfaya yönlendiriyor

**Google'a Etkisi:**
- Google sitemap'ten onlarca query param URL keşfediyor
- Her birinin canonical'ı farklı bir sayfayı gösteriyor
- Bu, Search Console'daki hatanın **en büyük kaynağı**

---

### Sorun 3: www → non-www 307 Redirect (ORTA)

**Test Sonucu:**
```
https://www.takas-a.com → HTTP/2 307 → https://takas-a.com
```

**Olması Gereken:**
```
https://www.takas-a.com → HTTP/2 301 → https://takas-a.com
```

**Sebep:** Vercel platform davranışı. Vercel projesi www domain'i redirect ederken 307 kullanıyor.

**Google'a Etkisi:**
- 307 geçici redirect → Google her iki versiyonu da index'e alabilir
- www ve non-www arasında canonical belirsizliği olabilir

---

## C. RİSKLİ AMA HENÜZ DOĞRULANMAMIŞ ALANLAR

### Risk 1: OpenGraph URL Eksikliği
- `/urunler`, `/kurumsal`, `/sss`, `/nasil-calisir` layout'larında `openGraph` tanımı var ama `url` alanı yok
- Google OG url'i canonical sinyali olarak kullanmaz ama tutarsızlık riski var
- **Kontrol:** Her layout'ta openGraph.url'in canonical ile aynı olduğunu doğrula

### Risk 2: Dinamik Ürün Sayfaları (2000 adet)
- `app/urun/[id]/layout.tsx` satır 87: `canonical: https://takas-a.com/urun/${product.id}` ✅ Doğru
- Ama ürün silindiğinde veya pasif olduğunda, sitemap'ten çıkıyor mu?
- **Kontrol:** Silinen ürün sayfalarının 404 döndüğünü ve sitemap'ten çıktığını doğrula

### Risk 3: hreflang/canonical Çakışması
- Root layout'ta hreflang: `es-ES → /barcelona`, `en-US → /global`
- Ama `/barcelona` ve `/global` sayfalarının canonical'ı `https://takas-a.com` (ana sayfa)
- Google: "hreflang /barcelona diyor ama canonical ana sayfa diyor" → çelişki
- **Kontrol:** Bu hreflang/canonical çelişkisi Google'ın canonical kararını bozuyor olabilir

---

## D. HIZLI DÜZELTİLECEK MADDELER

### Düzeltme 1: Eksik Canonical'ları Ekle (ACİL)

Aşağıdaki layout dosyalarına `alternates.canonical` ekle:

| Dosya | Eklenecek Canonical |
|-------|-------------------|
| `app/hakkimizda/layout.tsx` | `canonical: '/hakkimizda'` |
| `app/iletisim/layout.tsx` | `canonical: '/iletisim'` |
| `app/teslim-noktalari/layout.tsx` | `canonical: '/teslim-noktalari'` |
| `app/harita/layout.tsx` | `canonical: '/harita'` |
| `app/barcelona/layout.tsx` | `canonical: '/barcelona'` |
| `app/global/layout.tsx` | `canonical: '/global'` |
| `app/gizlilik/layout.tsx` | `canonical: '/gizlilik'` |
| `app/kullanim-kosullari/layout.tsx` | `canonical: '/kullanim-kosullari'` |
| `app/premium/layout.tsx` | `canonical: '/premium'` |
| `app/hizmet-takasi/layout.tsx` | `canonical: '/hizmet-takasi'` |
| `app/istek-panosu/layout.tsx` | `canonical: '/istek-panosu'` |
| `app/topluluk/layout.tsx` | `canonical: '/topluluk'` |
| `app/topluluklar/layout.tsx` | `canonical: '/topluluklar'` |
| `app/ambassador/layout.tsx` | `canonical: '/ambassador'` |

**Süre:** ~30 dakika  
**Etki:** Search Console hatalarının büyük çoğunluğunu çözer

---

### Düzeltme 2: Sitemap'ten Query Param URL'leri Kaldır veya Canonical Stratejisini Değiştir (ACİL)

**Seçenek A (Önerilen): Sitemap'ten query param URL'leri kaldır**
- `app/sitemap.ts`'den `districtPages`, `categoryPages`, `deliveryPointPages` bölümlerini kaldır
- Bu URL'ler zaten `/urunler` canonical'ına yönleniyor, ayrıca listelemek çelişki yaratıyor

**Seçenek B: Her query param URL'e özel self-canonical ver**
- `/urunler?category=elektronik` → `canonical: /urunler?category=elektronik`
- Bu daha karmaşık, her param kombinasyonuna `generateMetadata` ile dinamik canonical gerektirir

**Süre:** Seçenek A: ~15 dakika, Seçenek B: ~2 saat  
**Etki:** Sitemap ↔ canonical çakışmasını tamamen çözer

---

### Düzeltme 3: www Redirect'i 301 Yap (ORTA)

- Vercel dashboard'dan www → non-www redirect'in 301 olarak yapılandırıldığını doğrula
- Vercel'de domain ayarlarında www domain'in "redirect" modunda olduğundan emin ol
- Alternatif: `next.config.js`'te middleware ile 301 redirect ekle

**Süre:** ~15 dakika

---

## E. DAHA SONRA İYİLEŞTİRİLECEK MADDELER

### İyileştirme 1: Noindex Sayfaları Sitemap'ten Çıkar
- robots.ts'te disallow edilen sayfalar (profil, mesajlar, takas-firsatlari vb.) sitemap'te zaten yok ✅
- **Öncelik:** Düşük (zaten doğru yapılmış)

### İyileştirme 2: OpenGraph URL Tutarlılığı
- Her layout'taki openGraph objesine `url` alanı ekle
- Canonical ile aynı URL olmalı
- **Öncelik:** Düşük

### İyileştirme 3: Kategori Sayfaları İçin generateMetadata
- `/urunler?category=X` gibi sayfalar uzun vadede kendi canonical'larına sahip olmalı
- `app/urunler/page.tsx`'te `generateMetadata` ile dinamik canonical üretmek ideal çözüm
- **Öncelik:** Orta

### İyileştirme 4: İlçe/Teslim Noktası Sayfaları Stratejisi
- `/teslim-noktalari?district=Bornova` yerine `/teslim-noktalari/bornova` gibi statik route'lar oluştur
- Query param'lar yerine path-based URL'ler SEO için çok daha güçlü
- **Öncelik:** Orta-Yüksek

---

## F. SEARCH CONSOLE'DAKİ HATANIN EN OLASI GERÇEK SEBEBİ

### Teşhis: Miras Alınan Root Canonical + Sitemap/Canonical Çakışması

**Kök Neden:**
`app/layout.tsx` satır 125-126'da tanımlanan `canonical: 'https://takas-a.com'` değeri, explicit canonical tanımlamayan **tüm alt sayfalara** miras kalıyor. Bu da:

1. `/hakkimizda`, `/barcelona`, `/global`, `/teslim-noktalari` gibi sayfaların canonical'ını **yanlışlıkla ana sayfa** yapıyor
2. Google bu sayfaları ziyaret ediyor, canonical ana sayfaya işaret ediyor ama içerik farklı → **"farklı canonical seçti"** hatası
3. Sitemap'te listelenen `/urunler?category=...` ve `/teslim-noktalari?district=...` URL'leri de aynı sorunu yaşıyor

**Kanıtlar:**
1. `curl https://takas-a.com/hakkimizda` → `<link rel="canonical" href="https://takas-a.com"/>` ❌
2. `curl https://takas-a.com/barcelona` → `<link rel="canonical" href="https://takas-a.com"/>` ❌
3. `curl https://takas-a.com/teslim-noktalari` → `<link rel="canonical" href="https://takas-a.com"/>` ❌
4. `curl https://takas-a.com/global` → `<link rel="canonical" href="https://takas-a.com"/>` ❌
5. `curl "https://takas-a.com/urunler?category=elektronik"` → canonical `/urunler` ama sitemap'te ayrı URL olarak listeleniyor
6. Sitemap'te 2000+ ürün + onlarca kategori/ilçe URL'si listeleniyor → hepsinin canonical durumu kontrol dışı

**Çözüm (3 Adım):**

1. **Tüm public sayfa layout'larına self-canonical ekle** (Düzeltme 1)
2. **Sitemap'ten query param URL'leri kaldır** (Düzeltme 2, Seçenek A)
3. **www redirect'i 301 yap** (Düzeltme 3)

Bu 3 düzeltme sonrası Search Console'daki "farklı canonical" hataları 2-4 hafta içinde temizlenmeye başlayacaktır.

---

## AKSIYON LİSTESİ

### 🔴 Acil (Bu Hafta)
1. **14 layout dosyasına self-canonical ekle** — `alternates: { canonical: '/sayfa-yolu' }`
2. **Sitemap'ten `categoryPages`, `districtPages`, `deliveryPointPages` bölümlerini kaldır**
3. **Vercel'de www redirect'in 301 olduğunu doğrula**
4. **Deploy et ve Search Console'da URL Denetimi ile test et**

### 🟡 Kısa Vadeli (Bu Ay)
5. **Search Console'da "Sayfalar" → "İndekslenmemiş" raporunu izle**
6. **Kategori sayfaları için `generateMetadata` ile dinamik canonical uygula**
7. **Her layout'taki openGraph objesine URL ekle**

### 🟢 Uzun Vadeli (Gelecek)
8. **`/teslim-noktalari?district=X` → `/teslim-noktalari/X` path-based routing'e geç**
9. **`/urunler?category=X` → `/urunler/kategori/X` path-based routing'e geç**
10. **Canonical monitoring script'i yaz — her deploy'da canonical doğrulaması yapılsın**

---

*Rapor Sonu — Hazırlayan: DeepAgent Canonical Audit*
