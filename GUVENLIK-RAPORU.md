# 🛡️ TAKAS-A Güvenlik Tarama Raporu

**Tarih:** 3 Nisan 2026  
**Proje:** TAKAS-A (Next.js Takas Uygulaması)  
**Tarama Türü:** Kapsamlı Güvenlik Analizi (Sadece Okuma — Hiçbir Dosya Değiştirilmedi)

---

## 📊 Genel Özet

| Kategori | Durum | Seviye |
|---|---|---|
| Session Kontrolü | 🟡 ORTA | Bazı endpoint'ler korumasız |
| Rate Limiting | 🟡 ORTA | Kısmi uygulama |
| Admin Panel Koruması | 🟢 İYİ | Güçlü koruma |
| Environment Variables | 🟡 ORTA | 1 hardcoded fallback |
| Input Validation | 🟢 İYİ | Zod + sanitize mevcut |
| CORS Ayarları | 🟢 İYİ | Next.js varsayılan koruma |
| S3 Bucket | 🟢 İYİ | ACL yok, signed URL kullanılıyor |
| Hardcoded Credentials | 🔴 KRİTİK | 1 hardcoded API key tespit edildi |
| SQL Injection | 🟢 İYİ | Tagged template literal kullanılıyor |
| XSS Koruması | 🟡 ORTA | Admin panelde `dangerouslySetInnerHTML` |

---

## 1️⃣ Session Kontrolü Olmayan API Endpoint'leri

### Durum: 🟡 ORTA

**Session koruması OLMAYAN endpoint'ler:**

| Dosya | Risk | Açıklama |
|---|---|---|
| `app/api/ai/analyze-photo/route.ts` | 🔴 Yüksek | OpenAI API key ile fotoğraf analizi — session yok, herkes kullanabilir |
| `app/api/push/engagement/route.ts` | 🔴 Yüksek | Push bildirim gönderimi — hardcoded API key ile korunuyor |
| `app/api/activity/route.ts` | 🟡 Orta | Genel aktivite feed — public veri ama abuse riski |
| `app/api/valor/price-breakdown/route.ts` | 🟡 Orta | Fiyat hesaplama — bilgi sızıntısı riski |
| `app/api/contact/route.ts` | 🟢 Düşük | İletişim formu — rate limit var |
| `app/api/stats/route.ts` | 🟢 Düşük | Public istatistik — hassas veri yok |
| `app/api/stats/live/route.ts` | 🟢 Düşük | Canlı istatistik — hassas veri yok |
| `app/api/products/filters/route.ts` | 🟢 Düşük | Filtre seçenekleri — public veri |
| `app/api/categories/route.ts` | 🟢 Düşük | Kategori listesi — public veri |
| `app/api/delivery-points/route.ts` | 🟢 Düşük | Teslimat noktaları — public veri |
| `app/api/health/route.ts` | 🟢 Düşük | Sağlık kontrolü — beklenen davranış |
| `app/api/keep-alive/route.ts` | 🟢 Düşük | DB bağlantısı canlı tutma |

**Doğal olarak session gerektirmeyen (Auth):**
- `app/api/auth/login/route.ts` ✅
- `app/api/auth/forgot-password/route.ts` ✅
- `app/api/auth/reset-password/route.ts` ✅
- `app/api/signup/route.ts` ✅
- `app/api/verify-email/route.ts` ✅

**Cron endpoint'leri (farklı koruma mekanizması):**
- `app/api/cron/*` → CRON_SECRET ile korunuyor ✅
- `app/api/swap-requests/auto-cancel/route.ts` → ⚠️ CRON_SECRET opsiyonel (`cronSecret && authHeader` kontrolü — secret yoksa herkes çağırabilir)

### Öneriler:
1. **`ai/analyze-photo`**: Session kontrolü ekle — OpenAI maliyeti abuse'a açık
2. **`push/engagement`**: Hardcoded key yerine environment variable kullan
3. **`auto-cancel`**: CRON_SECRET kontrolünü zorunlu yap (opsiyonel olmamalı)

---

## 2️⃣ Rate Limiting Kontrolü

### Durum: 🟡 ORTA

**Rate limiting OLAN endpoint'ler:**
- ✅ `app/api/valor/route.ts` — in-memory rate limit (dakikada limit)
- ✅ `app/api/services/route.ts` — `checkRateLimit` lib kullanıyor
- ✅ `app/api/contact/route.ts` — `checkRateLimit` lib kullanıyor
- ✅ `app/api/auth/forgot-password/route.ts` — `checkRateLimit` lib kullanıyor
- ✅ `app/api/signup/route.ts` — `checkRateLimit` lib kullanıyor
- ✅ `app/api/profile/photo/route.ts` — `checkRateLimit` lib kullanıyor
- ✅ `app/api/wishboard/route.ts` — `checkRateLimit` lib kullanıyor
- ✅ `app/api/favorites/route.ts` — `checkRateLimit` lib kullanıyor

**Rate limiting OLMAYAN kritik endpoint'ler:**
- ❌ `app/api/messages/route.ts` — Mesaj gönderiminde rate limit yok
- ❌ `app/api/swap-requests/route.ts` — Takas teklifi oluşturmada rate limit yok
- ❌ `app/api/products/route.ts` — Ürün oluşturmada rate limit yok (günlük limit var ama brute force koruması yok)
- ❌ `app/api/auth/login/route.ts` — Giriş denemesinde rate limit yok (brute force riski)
- ❌ `app/api/ai/analyze-photo/route.ts` — AI analiz endpoint'inde rate limit yok (maliyet riski)
- ❌ `app/api/push/send/route.ts` — Push gönderiminde rate limit yok

### Öneriler:
1. **`auth/login`**: Brute force koruması için rate limiting ekle — En kritik eksik
2. **`messages`**: Spam önlemek için rate limiting ekle
3. **`ai/analyze-photo`**: OpenAI API maliyeti nedeniyle rate limiting şart
4. **Genel**: `lib/rate-limiter.ts` mevcut ama in-memory — Vercel serverless'ta her instance sıfırdan başlar, Redis tabanlı çözüm düşünülmeli

---

## 3️⃣ Admin Panel Koruması

### Durum: 🟢 İYİ

**Client-side koruma:**
- ✅ `app/admin/page.tsx` — Session kontrolü var, `role === 'admin'` kontrolü yapılıyor
- ✅ Yetkisiz erişimde "Bu sayfaya erişim yetkiniz yok" hatası gösteriliyor

**Server-side (API) koruma:**
- ✅ 20/21 admin API endpoint'inde `role === 'admin'` kontrolü var
- ⚠️ `app/api/admin/fix-photos/route.ts` — Admin role kontrolü yok AMA email bazlı kontrol var (`session.user.email !== ADMIN_EMAIL`)

### Öneriler:
1. `fix-photos` endpoint'inde email kontrolü yerine role kontrolü tercih edilmeli (tutarlılık)
2. Admin panele erişim loglanmalı (audit trail)

---

## 4️⃣ Environment Variables Güvenliği

### Durum: 🟡 ORTA

**Doğru kullanım (process.env):**
- ✅ `OPENAI_API_KEY` — process.env ile alınıyor
- ✅ `ABACUSAI_API_KEY` — process.env ile alınıyor
- ✅ `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — process.env ile alınıyor
- ✅ `VAPID_PRIVATE_KEY` — process.env ile alınıyor
- ✅ `CRON_SECRET` — process.env ile alınıyor
- ✅ `RECAPTCHA_SECRET_KEY` — process.env ile alınıyor

**Sorunlar:**
- 🔴 `app/api/push/engagement/route.ts:143` — **Hardcoded fallback API key:**
  ```typescript
  const apiKey = process.env.ENGAGEMENT_NOTIFICATION_KEY || 'takas-a-engagement-2024'
  ```
  Bu, env variable tanımlı değilse tahmin edilebilir bir key kullanılıyor.

**Debug logları:**
- ⚠️ `app/api/profile/photo/route.ts` — AWS key varlığını console.log ile logluyor (production'da kaldırılmalı):
  ```typescript
  console.log('[ProfilePhoto PUT] AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'VAR' : 'YOK')
  ```

### Öneriler:
1. **Engagement key'deki hardcoded fallback'i kaldır** — Env variable zorunlu olmalı
2. Debug loglarını production'da devre dışı bırak

---

## 5️⃣ Input Validation

### Durum: 🟢 İYİ

**Mevcut koruma:**
- ✅ **Zod validation** — `lib/validations.ts` dosyasında schema tanımları
  - `createProductSchema` — Ürün oluşturma validasyonu
  - `createSwapSchema` — Takas teklifi validasyonu
  - `createMessageSchema` — Mesaj validasyonu
  - `createServiceSchema` — Hizmet validasyonu
- ✅ **Sanitize** — `lib/sanitize.ts` dosyasında XSS temizleme
  - `sanitizeHtml()` — HTML entity encoding
  - `stripDangerousTags()` — Script, iframe, object, embed kaldırma
  - `sanitizeText()` — Genel metin temizleme
- ✅ API'lerde kullanım:
  - `products/route.ts` — validate + sanitizeText
  - `messages/route.ts` — validate + sanitizeText
  - `services/route.ts` — validate + sanitizeText

### Öneriler:
1. Tüm POST/PUT endpoint'lerinde tutarlı validation uygulanmalı
2. File upload endpoint'lerinde dosya tipi ve boyut kontrolü doğrulanmalı

---

## 6️⃣ CORS Ayarları

### Durum: 🟢 İYİ

- ✅ **Middleware yok** — Next.js varsayılan same-origin policy uygulanıyor
- ✅ Hiçbir API endpoint'inde `Access-Control-Allow-Origin: *` header'ı yok
- ✅ Explicit CORS konfigürasyonu yok — Next.js API route'ları varsayılan olarak same-origin

### Öneriler:
- Mevcut durum güvenli. Eğer gelecekte cross-origin erişim gerekirse, whitelisted origin listesi kullanılmalı.

---

## 7️⃣ S3 Bucket Kontrolü

### Durum: 🟢 İYİ

- ✅ **ACL kullanılmıyor** — `public-read` ACL yok
- ✅ **Signed URL** kullanılıyor — `getSignedUrl()` ile geçici erişim (1 saat TTL)
- ✅ AWS credential'ları environment variable'dan alınıyor
- ✅ Bucket adı environment variable'dan alınıyor (`AWS_BUCKET_NAME`)

### Öneriler:
- S3 bucket policy'sinin AWS konsolundan da kapalı olduğunu doğrulayın
- Signed URL süresi (3600 saniye) ihtiyaca göre kısaltılabilir

---

## 8️⃣ Hardcoded Credentials Kontrolü

### Durum: 🔴 KRİTİK

**Tespit edilen sorun:**

```typescript
// app/api/push/engagement/route.ts:143
const apiKey = process.env.ENGAGEMENT_NOTIFICATION_KEY || 'takas-a-engagement-2024'
```

Bu hardcoded fallback, environment variable tanımlı olmadığında herkesin bildirim göndermesine izin verir.

**Diğer kontroller:**
- ✅ `lib/api-helpers.ts` — `x-cron-secret` header'dan alınıyor (hardcoded değil)
- ✅ Diğer tüm credential'lar `process.env` üzerinden

### Öneriler:
1. **Acil:** `'takas-a-engagement-2024'` fallback'ini kaldır, env variable zorunlu yap
2. Tüm API key'leri `.env` dosyasında tanımlı olduğundan emin ol
3. Git history'de sızmış credential olup olmadığını kontrol et (`git log --all -p | grep -i "secret\|password\|api_key"`)

---

## 9️⃣ SQL Injection Riski

### Durum: 🟢 İYİ

**Tespit edilen raw query kullanımları:**

| Dosya | Kullanım | Risk |
|---|---|---|
| `app/api/health/route.ts` | `` prisma.$queryRaw`SELECT 1 as health` `` | ✅ Güvenli — parametre yok |
| `app/api/admin/security/route.ts` | `` prisma.$queryRaw`...` `` | ✅ Güvenli — tagged template |
| `app/api/admin/send-newsletter/route.ts` | `` prisma.$executeRaw`...` `` | ✅ Güvenli — tagged template |
| `app/api/keep-alive/route.ts` | `` prisma.$queryRaw`SELECT 1` `` | ✅ Güvenli — parametre yok |
| `lib/security.ts` | `` prisma.$queryRaw`...` `` | ✅ Güvenli — tagged template |

**Açıklama:** Tüm raw query'ler Prisma'nın **tagged template literal** syntax'ını kullanıyor. Bu, parametrelerin otomatik olarak escape edilmesini sağlar. String interpolation (`$queryRaw(string)`) kullanılmamış.

### Öneriler:
- Mevcut durum güvenli. Yeni raw query eklenirken daima tagged template kullanılmalı.

---

## 🔟 XSS Koruması

### Durum: 🟡 ORTA

**`dangerouslySetInnerHTML` kullanımları:**

| Dosya | Kullanım | Risk |
|---|---|---|
| `app/layout.tsx` | JSON-LD structured data | ✅ Güvenli — `JSON.stringify` |
| `app/urun/[id]/layout.tsx` | JSON-LD structured data | ✅ Güvenli — `JSON.stringify` |
| `app/sss/layout.tsx` | JSON-LD structured data | ✅ Güvenli — `JSON.stringify` |
| `app/nasil-calisir/layout.tsx` | JSON-LD structured data | ✅ Güvenli — `JSON.stringify` |
| **`app/admin/page.tsx:3809`** | **Newsletter HTML önizleme** | **🟡 Orta Risk** |

**Newsletter XSS detayı:**
```tsx
// Admin panelde newsletter içeriği HTML olarak render ediliyor
dangerouslySetInnerHTML={{ __html: newsletterContent }}
```
Bu, admin'in yazdığı HTML'i direkt render ediyor. Admin sayfası zaten korunuyor ama:
- Admin hesabı ele geçirilirse XSS saldırısı mümkün
- Newsletter içeriği veritabanından geliyorsa, stored XSS riski var

**Sanitize kütüphanesi:**
- ✅ `lib/sanitize.ts` mevcut ve aktif kullanımda
- ✅ Script, iframe, object, embed, event handler'ları temizliyor
- ⚠️ Ama newsletter önizlemesinde kullanılmıyor

### Öneriler:
1. Newsletter önizlemesinde `stripDangerousTags()` uygula
2. DOMPurify gibi daha güçlü bir HTML sanitizer düşünülebilir

---

## 🏁 Sonuç ve Öncelik Sıralaması

### 🔴 KRİTİK — Hemen Düzeltilmeli
1. **Hardcoded API Key** — `push/engagement` endpoint'inde `'takas-a-engagement-2024'` fallback kaldırılmalı
2. **`ai/analyze-photo` Session + Rate Limit** — OpenAI API maliyeti abuse'a açık, hem session hem rate limit ekle
3. **`auth/login` Rate Limiting** — Brute force saldırısına karşı koruma yok

### 🟡 ORTA — Yakında Düzeltilmeli
4. **`auto-cancel` CRON_SECRET** — Opsiyonel değil zorunlu olmalı
5. **Newsletter XSS** — `dangerouslySetInnerHTML` için sanitize uygulanmalı
6. **Rate limiting genişletme** — messages, swap-requests, push/send endpoint'lerine ekle
7. **Debug logları** — Production'da AWS key varlık loglarını kaldır
8. **In-memory rate limiter** — Serverless ortamda etkisiz olabilir, Redis düşünülmeli

### 🟢 İYİ — Sorun Yok
9. Admin panel koruması — Güçlü (21/21 endpoint korunuyor)
10. SQL Injection — Tagged template literal ile güvenli
11. CORS — Next.js varsayılan same-origin
12. S3 Bucket — Signed URL, ACL yok
13. Input Validation — Zod + custom sanitize
14. Genel session kontrolü — Büyük çoğunluk korumalı

---

## 📈 Güvenlik Skoru

| Alan | Puan (10 üzerinden) |
|---|---|
| Authentication | 7/10 |
| Authorization | 9/10 |
| Input Validation | 8/10 |
| Rate Limiting | 5/10 |
| Data Protection | 8/10 |
| XSS Prevention | 7/10 |
| SQL Injection Prevention | 10/10 |
| Secrets Management | 6/10 |
| **GENEL** | **7.5/10** |

---

*Bu rapor sadece statik kod analizi sonuçlarını içerir. Penetration test veya dinamik analiz yapılmamıştır. Hiçbir dosya değiştirilmemiştir.*
