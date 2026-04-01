# 🔧 Toplu Değerleme (Bulk Revalue) Düzeltme Raporu

**Tarih:** 1 Nisan 2026  
**Commit:** `641a9f1`  
**Etkilenen Dosyalar:** 3 dosya, +698 satır, -280 satır

---

## 📋 Tespit Edilen Sorunlar

### 1. Timeout Sorunu (Ana Sorun)
- **Durum:** 200 ürün için API timeout veriyordu
- **Sebep:** `maxDuration: 60s` ama 200 ürün × 500ms delay = 100s minimum + Brave/AI API çağrıları
- **Etki:** 50 ürüne kadar çalışıyor, 200+ ürün için hata

### 2. Kategori Eşleşme Sorunu
- **Durum:** Kategori bazlı değerleme çalışmıyordu
- **Sebep:** Veritabanında `Beyaz Esya` (ş harfi yok), CATEGORY_EXPERTS'ta `Beyaz Eşya` (ş harfi var)
- **Etkilenen kategoriler:** `Beyaz Esya` ↔ `Beyaz Eşya`, `Ev & Yasam` ↔ `Ev & Yaşam`, `Bahce` ↔ `Bahçe`
- **Sonuç:** Bu kategorilerdeki ürünler hep "Genel" uzman ile değerleniyordu

### 3. Frontend'de Batch Yönetimi Yoktu
- **Durum:** API `nextOffset` döndürüyor ama frontend tek seferde tüm ürünleri işlemeye çalışıyordu
- **Sonuç:** İlk 20 ürün sonrası devam edemiyordu

---

## ✅ Uygulanan Çözümler

### API Değişiklikleri (`app/api/admin/revalue-products/route.ts`)

| Parametre | Eski | Yeni |
|-----------|------|------|
| Batch size | 20 | 10 (daha güvenli) |
| Delay | 500ms | 200ms (2.5x hızlı) |
| maxDuration | 60s | 300s (5x uzun) |
| Kategori filtre | Yok | `categoryFilter` parametresi |
| Kategori normalize | Yok | `normalizeCategoryName()` fonksiyonu |
| Fiyat kaynağı | Döndürülmüyor | `priceSource` her sonuçta |

**Yeni Özellikler:**
- `revalueOneProduct()` — modüler, tek ürün değerleme fonksiyonu
- `normalizeCategoryName()` — `Beyaz Esya` → `Beyaz Eşya` otomatik çevirisi
- `getCategoryVariants()` — kategori filtresinde her iki varyantı da arar
- GET endpoint'e `categories` dizisi eklendi (kategori bazlı ürün dağılımı)

### Frontend Değişiklikleri (`app/admin/products/page.tsx`)

**Yeni Toplu Değerleme Paneli:**
- 📊 İstatistik kartları (toplam ürün, ort/min/max Valor)
- 🎯 Kategori filtreli değerleme (dropdown ile seçim)
- 🧪 Test modu (dryRun — kaydetmeden test)
- 📈 Animasyonlu progress bar (gerçek zamanlı)
- 📋 Sonuç tablosu (ürün, kategori, eski/yeni Valor, değişim %, TL tahmini, kaynak)
- ⏹️ Durdur butonu (istediğiniz zaman durdurabilirsiniz)
- 🔄 Client-side batch orchestration (10'ar ürün gönderip progress takip)

### vercel.json Değişiklikleri

```json
{
  "functions": {
    "app/api/admin/revalue-products/route.ts": { "maxDuration": 300 },
    "app/api/admin/revalue/route.ts": { "maxDuration": 300 }
  }
}
```

---

## 🧮 Performans Analizi

### Eski Sistem (200 ürün):
- 200 × 500ms delay = 100s
- + Brave API çağrıları (~1-2s × N)
- + AI çağrıları (~1-2s × N)
- **Toplam:** 200-400s → ❌ 60s timeout ile imkansız

### Yeni Sistem (200 ürün):
- Client-side 20 batch × 10 ürün/batch
- Her batch: 10 × 200ms delay = 2s + API çağrıları ≈ 15-30s
- Her batch 300s limit içinde rahat kalır
- **Toplam:** ~5-10 dakika, progress bar ile takip edilir → ✅

---

## 🏷️ Kategori Düzeltme Detayı

| DB'deki İsim | CATEGORY_EXPERTS'teki İsim | Durum |
|--------------|---------------------------|-------|
| Beyaz Esya | Beyaz Eşya | ✅ Düzeltildi |
| Ev & Yasam | Ev & Yaşam | ✅ Düzeltildi |
| Bahce | Bahçe | ✅ Düzeltildi |
| Oto & Moto | Oto & Moto | ✅ Zaten eşleşiyor |
| Elektronik | Elektronik | ✅ Zaten eşleşiyor |
| Gayrimenkul | Gayrimenkul | ✅ Zaten eşleşiyor |

---

## 🔍 Fiyat Kaynak Hiyerarşisi

1. **admin** — Admin manuel fiyat (adminEstimatedPrice)
2. **user+brave+ai** — Kullanıcı aralığı + Brave doğrulama + AI
3. **user-midpoint** — Kullanıcı aralığının ortası (Brave başarısızsa)
4. **brave+ai** — Brave arama + AI yorum (Oto & Moto)
5. **brave-search** — Sadece Brave arama (Elektronik, Beyaz Eşya)
6. **rule-based** — Kural tabanlı (Oto & Moto fallback)
7. **ai-only** — Sadece AI tahmini
8. **valor-fallback** — Mevcut Valor × 5

---

## 📁 Değiştirilen Dosyalar

1. `app/api/admin/revalue-products/route.ts` — API (tamamen yeniden yazıldı)
2. `app/admin/products/page.tsx` — Frontend (Toplu Değerleme paneli eklendi)
3. `vercel.json` — maxDuration 60→300s

---

## ⚠️ Notlar

- **Vercel Pro** gerekli: `maxDuration: 300` sadece Pro plan ile çalışır. Free plan max 60s'dir.
- **Brave API Rate Limit:** 200ms delay ile her batch'te 10 çağrı yapılır. Brave Free plan 1req/s limitine uygun.
- **Test Modu:** İlk kullanımda "Test Modu" ile denemeniz önerilir — DB'ye yazmaz, sadece hesaplar.
