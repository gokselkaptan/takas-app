# 🔒 TAKAS-A Güvenlik Analiz Raporu
### Rate Limiting, Spam Kontrolü ve Mesaj Limiti

**Tarih:** 6 Nisan 2026  
**Analiz Kapsamı:** `/lib/`, `/app/api/`, `/prisma/schema.prisma`

---

## 📊 ÖZET SKOR TABLOSU

| Güvenlik Alanı | Durum | Seviye |
|---|---|---|
| Rate Limiting | ✅ Mevcut (çift katmanlı) | 🟢 İyi |
| Mesaj Rate Limiting | ✅ Mevcut (20 msg/dk) | 🟢 İyi |
| Mesaj İçerik Moderasyonu | ✅ Mevcut (Quick + AI) | 🟢 İyi |
| Spam Detection (Fraud) | ✅ Mevcut (5 kontrol) | 🟢 İyi |
| Input Validation (Zod) | ✅ Mevcut | 🟢 İyi |
| XSS Sanitization | ✅ Mevcut | 🟢 İyi |
| Auth Kontrolü | ✅ Mevcut (NextAuth) | 🟢 İyi |
| User Block/Report Sistemi | ⚠️ Kısmen (sadece DisputeReport) | 🟡 Orta |
| Middleware Rate Limit | ❌ Yok (middleware.ts yok) | 🔴 Eksik |
| Redis/Upstash Rate Limit | ❌ Yok (In-memory) | 🟡 Bilgi |

---

## 1️⃣ RATE LIMITING

### ✅ Durum: Çift Katmanlı Rate Limiting Mevcut

TAKAS-A projesi **iki ayrı rate limiting sistemi** kullanıyor:

#### A) `lib/rate-limit.ts` — DB Tabanlı (Prisma `RateLimit` modeli)
- **Mekanizma:** PostgreSQL veritabanına kayıt yazarak rate limit kontrolü
- **Admin Bypass:** Admin kullanıcılar rate limit'ten muaf
- **Response Headers:** `X-RateLimit-Remaining`, `X-RateLimit-Reset`

**Endpoint Limitleri:**

| Endpoint | Limit | Pencere |
|---|---|---|
| `api/products` | 100 req | 1 dakika |
| `api/favorites` | 60 req | 1 dakika |
| `api/messages` | 30 req | 1 dakika |
| `api/signup` | 5 req | 1 saat |
| `api/swap-requests` | 20 req | 1 dakika |
| `api/services` | 30 req | 1 dakika |
| `api/wishboard` | 20 req | 1 dakika |
| `api/profile/photo` | 10 req | 5 dakika |
| `api/admin/backup` | 3 req | 1 saat |
| `api/auth/two-factor` | 5 req | 5 dakika |
| `api/valor/calculate` | 5 req | 1 dakika |
| `api/ai-visualize` | 5 req | 1 dakika |
| `api/visual-search` | 5 req | 1 dakika |
| `api/ai-moderation` | 10 req | 1 dakika |
| `api/ai-translate` | 10 req | 1 dakika |

**Kullanan API'ler:** `signup`, `forgot-password`, `contact`, `services`, `wishboard`, `profile/photo`, `favorites`

#### B) `lib/rate-limiter.ts` — In-Memory Rate Limiter
- **Mekanizma:** `Map<string, RateLimitEntry>` ile bellek içi
- **Temizlik:** 60 sn aralıklarla süresi dolmuş kayıtlar siliniyor
- **Uyarı:** Sunucu yeniden başlatıldığında sıfırlanır (Serverless ortamda kısıtlı etkinlik)

**Endpoint Limitleri:**

| Endpoint | Limit | Pencere |
|---|---|---|
| `auth/login` | 5 req | 15 dakika |
| `auth/forgot-password` | 3 req | 1 saat |
| `signup` | 3 req | 1 saat |
| `messages` | 60 req | 1 dakika |
| `swap-requests` | 20 req | 1 dakika |
| `products` | 10 req | 1 dakika |
| `reviews` | 10 req | 1 dakika |
| `push/subscribe` | 5 req | 1 dakika |
| `contact` | 3 req | 1 saat |

### ⚠️ Eksik: Middleware-Level Rate Limiting
- `middleware.ts` dosyası **mevcut değil**
- Tüm rate limiting, endpoint seviyesinde uygulanıyor
- Upstash Redis veya edge-level rate limiting kullanılmıyor

---

## 2️⃣ MESAJ LİMİTİ KONTROLÜ

### ✅ Durum: 3 Katmanlı Mesaj Güvenliği

#### A) Mesaj Rate Limiting (`app/api/messages/route.ts`)
- **Limit:** Dakikada max **20 mesaj** per user
- **Mekanizma:** In-memory `Map` (user ID bazlı)
- **Map Temizliği:** 10.000 kayıt aşıldığında otomatik temizleme
- **Pencere:** 60 saniye (1 dakika)

```
const MSG_LIMIT = 20
const MSG_WINDOW = 60 * 1000 // 1 dakika
```

#### B) Mesaj İçerik Moderasyonu (`lib/message-moderation.ts`)

**İki aşamalı moderasyon:**

1. **Quick Moderation (Anlık):**
   - Dış iletişim bilgisi tespiti (telefon, email, sosyal medya)
   - `policy_violation` → mesaj engellenir
   - Regex pattern matching ile hızlı kontrol

2. **AI Moderation (Derin):**
   - Abacus AI LLM API üzerinden içerik analizi
   - Quick moderation'dan geçen mesajlar için ek güvenlik katmanı
   - API hatası durumunda quick moderation'a fallback

#### C) Kullanıcı Uyarı/Cezalandırma Sistemi
- **`processWarning()`:** Uyarı kaydı oluşturur (Prisma `UserWarning` modeli)
- **`checkUserSuspension()`:** Kullanıcının askıya alınıp alınmadığını kontrol eder
- Askıya alınmış kullanıcılar mesaj **gönderemez**

---

## 3️⃣ SPAM KONTROLÜ VE FRAUD DETECTION

### ✅ Durum: Kapsamlı Fraud Detection Sistemi

#### `lib/fraud-detection.ts` — 5 Farklı Kontrol

| Fonksiyon | Açıklama | Eşik |
|---|---|---|
| `checkValorManipulation()` | VALOR manipülasyonu tespiti | - |
| `checkMultipleAccounts()` | Aynı IP'den çoklu hesap | - |
| `checkSpamSwaps()` | Spam takas teklifi | 1 saatte >20 teklif |
| `checkSpamMessages()` | Spam mesaj gönderimi | 1 saatte >100 mesaj |
| `checkRapidProductCreation()` | Hızlı ürün oluşturma | - |

- **`runAllUserChecks()`:** Tüm kontrolleri paralel çalıştırır
- **`logSuspiciousActivity()`:** Şüpheli aktiviteyi kaydeder

#### Prisma Modelleri
- ✅ `UserWarning` — Kullanıcı uyarı kayıtları
- ✅ `SecurityLog` — Güvenlik olay kayıtları
- ✅ `RateLimit` — DB-tabanlı rate limit kayıtları
- ✅ `DisputeReport` — Anlaşmazlık raporları
- ⚠️ `BlockedUser` modeli **yok** — Doğrudan kullanıcı engelleme sistemi eksik

---

## 4️⃣ INPUT VALIDATION

### ✅ Durum: Zod Tabanlı Kapsamlı Validation

#### `lib/validations.ts` — Zod Şemaları

| Şema | Kısıtlamalar |
|---|---|
| `createMessageSchema` | `content`: 1-5000 karakter, trim, `receiverId` zorunlu |
| `createProductSchema` | `title`: 3-200 char, `description`: 10-5000 char, `valorPrice`: 1-100000 |
| `createSwapSchema` | `message`: max 1000 char, `productId` zorunlu |
| `updateProfileSchema` | `name`: 2-100 char, `phone`: regex kontrolü |
| `createServiceSchema` | `title`: 3-200 char, `description`: 10-5000 char |

#### `lib/sanitize.ts` — XSS Koruması

- ✅ HTML entity encoding (`&`, `<`, `>`, `"`, `'`, `/`)
- ✅ Script tag temizleme
- ✅ Event handler temizleme (`onclick`, `onload` vb.)
- ✅ `javascript:` ve `data:text/html` engelleme
- ✅ `<iframe>`, `<object>`, `<embed>`, `<form>` engelleme
- ✅ URL sanitization (sadece `http:` ve `https:` izinli)

---

## 5️⃣ AUTH & GÜVENLİK

### ✅ Durum: Kapsamlı Güvenlik Altyapısı

#### `lib/security.ts` — Güvenlik Fonksiyonları

| Fonksiyon | Açıklama |
|---|---|
| `checkAdminIPWhitelist()` | Admin IP whitelist kontrolü |
| `checkIPBlacklist()` | IP kara liste kontrolü |
| `addToBlacklist()` | IP kara listeye ekleme |
| `checkHoneypot()` | Honeypot tuzak kontrolü |
| `sendAccountLockoutNotification()` | Hesap kilitleme bildirimi |
| `logSecurityEvent()` | Güvenlik olayı kaydetme |
| `checkLoginAttempts()` | Giriş denemesi kontrolü |
| `recordFailedLogin()` | Başarısız giriş kaydı |
| `verifyCaptcha()` | CAPTCHA doğrulama |
| `getClientIP()` | İstemci IP adresi alma |
| `analyzeRequest()` | İstek analizi |
| `getSecurityStats()` | Güvenlik istatistikleri |

#### Mesaj API Auth Kontrolü
- ✅ `getServerSession()` ile oturum doğrulama (GET, POST, PATCH)
- ✅ 401 Unauthorized response for unauthenticated requests
- ✅ User existence check after session validation

---

## 6️⃣ ÖNERİLER VE EKSİKLER

### 🔴 Kritik Eksikler

1. **Middleware-Level Rate Limiting Yok**
   - Edge-level koruma eksik, her API kendi rate limit'ini yönetiyor
   - **Öneri:** `middleware.ts` ile global rate limiting ekle (Upstash Redis ideal)

2. **User Block Sistemi Eksik**
   - Kullanıcılar arası doğrudan engelleme mekanizması yok
   - Sadece `DisputeReport` modeli mevcut (uyuşmazlık raporlama)
   - **Öneri:** `BlockedUser` modeli ve engelleme API'si ekle

### 🟡 İyileştirme Önerileri

3. **In-Memory Rate Limiting Riski**
   - Vercel Serverless ortamda her instance ayrı memory kullanır
   - **Öneri:** Upstash Redis'e geçiş (mevcut Neon DB tabanlı rate-limit.ts daha güvenilir)

4. **Fraud Detection Entegrasyonu**
   - `runAllUserChecks()` fonksiyonu mevcut ama hangi endpoint'lerde çağrıldığı belirsiz
   - **Öneri:** Kritik endpoint'lerde (swap-request, product create) otomatik fraud check

5. **Rate Limit Tutarsızlıkları**
   - `rate-limit.ts`: messages = 30 req/dk
   - `rate-limiter.ts`: messages = 60 req/dk  
   - `messages/route.ts`: MSG_LIMIT = 20 msg/dk (sadece POST)
   - **Öneri:** Tek bir kaynaktan yönetim

### 🟢 İyi Uygulamalar
- ✅ Çift katmanlı moderasyon (Quick + AI)
- ✅ Kullanıcı uyarı/cezalandırma sistemi
- ✅ Zod tabanlı input validation
- ✅ XSS koruması (sanitize)
- ✅ IP-bazlı güvenlik kontrolleri
- ✅ CAPTCHA entegrasyonu
- ✅ Login attempt limiting
- ✅ Admin IP whitelisting
- ✅ AI endpoint'ler için düşük rate limit (5 req/dk)

---

## 📁 İlgili Dosyalar

| Dosya | Rol |
|---|---|
| `lib/rate-limit.ts` | DB-tabanlı rate limiting (Prisma) |
| `lib/rate-limiter.ts` | In-memory rate limiting |
| `lib/message-moderation.ts` | Mesaj içerik moderasyonu (Quick + AI) |
| `lib/fraud-detection.ts` | Fraud/spam detection sistemi |
| `lib/validations.ts` | Zod input validation şemaları |
| `lib/sanitize.ts` | XSS sanitization |
| `lib/security.ts` | Genel güvenlik fonksiyonları |
| `app/api/messages/route.ts` | Mesaj API (rate limit + moderation) |
| `prisma/schema.prisma` | DB modelleri (RateLimit, UserWarning, SecurityLog) |

---

*Bu rapor otomatik kod analizi ile oluşturulmuştur. Detaylı penetration testing için ek araçlar kullanılmalıdır.*
