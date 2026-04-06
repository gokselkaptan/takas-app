# TAKAS-A — KAYIT/GİRİŞ SİSTEMİ ANALİZ RAPORU

**Tarih:** 6 Nisan 2026  
**Durum:** Sadece analiz — kod değişikliği yapılmadı

---

## 1. NEXTAUTH KONFİGÜRASYONU (`lib/auth.ts`)

### Provider'lar
| Provider | Durum | Açıklama |
|----------|-------|----------|
| **CredentialsProvider** | ✅ Aktif | Email + Şifre ile giriş |
| Google OAuth | ❌ Yok | Tanımlı değil |
| Magic Link (Email) | ❌ Yok | Tanımlı değil |

> **Tek provider:** Yalnızca `CredentialsProvider` kullanılıyor. Sosyal giriş (Google, GitHub vs.) mevcut değil.

### Session Stratejisi
- **Strateji:** JWT (veritabanı session değil)
- **Session süresi:** 30 gün (`maxAge`)
- **Yenileme aralığı:** 24 saatte bir (`updateAge`)
- **Cookie:** Production'da `__Secure-next-auth.session-token`, `httpOnly`, `sameSite: lax`

### Callbacks
- **JWT Callback:** `id`, `role`, `image`, `language` bilgilerini token'a ekliyor. Trigger `update` veya ilk login'de DB'den güncel `image` ve `language` çekiyor.
- **Session Callback:** Token'dan `id`, `role`, `image`, `language` bilgilerini session'a aktarıyor.

### Giriş Sırasında Yapılan İşlemler
1. **Brute-force koruması** — `checkLoginAttempts()` ile IP + email bazlı kontrol
2. **Hesap kilitleme bildirimi** — 5 başarısız denemede `sendAccountLockoutNotification()`
3. **Şifre doğrulama** — `bcrypt.compare()` ile
4. **Başarılı giriş logu** — `recordSuccessfulLogin()`
5. **`lastLoginAt` güncelleme** — Her girişte güncellenir
6. **IP'den şehir tespiti** — `ip-api.com` ile coğrafi konum, `location` alanına yazılır

### Özel Sayfalar
- **signIn sayfası:** `/giris`

---

## 2. AUTH API ENDPOINT'LERİ

| Endpoint | Method | İşlev |
|----------|--------|-------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth ana handler |
| `/api/auth/login` | POST | Alternatif login endpoint (reCAPTCHA destekli) |
| `/api/auth/forgot-password` | POST | Şifre sıfırlama kodu gönderimi |
| `/api/auth/reset-password` | POST | Yeni şifre ile sıfırlama |
| `/api/signup` | POST | Yeni kullanıcı kaydı |
| `/api/verify-email` | POST | Email doğrulama kodu kontrolü |

### `/api/auth/login` (Alternatif Login)
- NextAuth `CredentialsProvider`'a ek olarak ayrı bir login endpoint'i mevcut
- **reCAPTCHA v3** desteği var (`captchaToken` parametresi)
- Brute-force koruması, IP blacklist kontrolü
- Email doğrulanmamışsa `requiresVerification: true` döner
- IP'den şehir tespiti yapar

### `/api/signup` (Kayıt)
- **Kabul ettiği alanlar:** `email`, `password`, `name`, `nickname`
- **Güvenlik katmanları:**
  - Rate limiting (IP bazlı)
  - IP blacklist kontrolü
  - Honeypot alanlar (`website`, `company`, `faxNumber`) — bot tespiti
  - Zod validation (`signupSchema`)
- **Kayıt akışı:**
  1. Validasyon → Mevcut kullanıcı kontrolü
  2. Şifre `bcrypt` (12 round) ile hashlenir
  3. 6 haneli doğrulama kodu oluşturulur (10 dk geçerli)
  4. DB'ye kayıt, email doğrulama kodu gönderimi
  5. Admin'e push bildirim + email gönderilir (fire & forget)
- **Eğer kullanıcı zaten var ama doğrulanmamışsa:** Yeni kod gönderilir, şifre/isim güncellenir
- **Hata mesajları:** Türkçe

### `/api/verify-email`
- Email + 6 haneli kod ile doğrulama
- Başarılıysa `emailVerified` alanı set edilir
- Doğrulama kodu ve süresi temizlenir
- Welcome bonus artık direkt verilmiyor, ilk takas sonrası veriliyor

---

## 3. PROFİL GÜNCELLEME ENDPOINT'LERİ

| Endpoint | Method | İşlev |
|----------|--------|-------|
| `/api/profile` | GET | Profil bilgilerini getir |
| `/api/profile` | PUT | Name, nickname, bio, phone, location güncelle |
| `/api/profile/password` | PUT | Şifre değiştir (mevcut şifre + yeni şifre) |
| `/api/profile/photo` | — | Profil fotoğrafı |
| `/api/profile/survey` | — | Anket verisi |
| `/api/profile/valor-history` | — | VALOR geçmişi |

### PUT `/api/profile` — Güncellenebilen Alanlar
- `name` — İsim
- `nickname` — Takma ad (nullable)
- `bio` — Biyografi (nullable)
- `phone` — Telefon (nullable)
- `location` — Konum (nullable)

> **Not:** Şifre değişikliği ayrı endpoint'te (`/api/profile/password`) yapılıyor. Güçlü şifre kuralları: min 8 karakter, büyük harf + küçük harf + rakam zorunlu.

---

## 4. PRISMA USER MODEL — TEMEL ALANLAR

### Kimlik & Auth
| Alan | Tip | Varsayılan | Açıklama |
|------|-----|-----------|----------|
| `id` | String | `cuid()` | Primary key |
| `email` | String | — | Unique, zorunlu |
| `password` | String | — | bcrypt hash |
| `name` | String? | — | Tam isim |
| `nickname` | String? | — | Takma ad |
| `emailVerified` | DateTime? | — | Email doğrulama tarihi |
| `image` | String? | — | Profil fotoğrafı (S3 path veya URL) |
| `role` | String | `"user"` | Rol (user/admin) |
| `language` | String | `"tr"` | Dil tercihi |

### Güvenlik & Doğrulama
| Alan | Tip | Açıklama |
|------|-----|----------|
| `verificationCode` | String? | Email doğrulama kodu (6 haneli) |
| `verificationCodeExpiry` | DateTime? | Kod geçerlilik süresi |
| `lastLoginAt` | DateTime? | Son giriş tarihi |
| `loginStreak` | Int (0) | Ardışık giriş günü |
| `lastStreakDate` | DateTime? | Son streak tarihi |
| `isBanned` | Boolean (false) | Yasaklı mı |
| `bannedAt` | DateTime? | Yasaklanma tarihi |
| `suspendedUntil` | DateTime? | Geçici askıya alma |
| `suspensionCount` | Int (0) | Toplam askıya alma sayısı |
| `totalWarnings` | Int (0) | Toplam uyarı |

### Profil
| Alan | Tip | Açıklama |
|------|-----|----------|
| `bio` | String? | Biyografi |
| `phone` | String? | Telefon |
| `location` | String? | Konum (IP'den otomatik set) |
| `coverImage` | String? | Kapak görseli |
| `interests` | String? | İlgi alanları |
| `website` | String? | Web sitesi |
| `socialLinks` | String? | Sosyal medya linkleri |
| `isPhoneVerified` | Boolean (false) | Telefon doğrulanmış mı |
| `isIdentityVerified` | Boolean (false) | Kimlik doğrulanmış mı |
| `showEmail` | Boolean (false) | Email görünür mü |
| `showPhone` | Boolean (false) | Telefon görünür mü |

### Ekonomi (VALOR)
| Alan | Tip | Açıklama |
|------|-----|----------|
| `valorBalance` | Int (0) | VALOR bakiyesi |
| `lockedValor` | Int (0) | Kilitli VALOR |
| `totalValorEarned` | Int (0) | Toplam kazanılan |
| `trustScore` | Int (100) | Güven puanı |
| `isPremium` | Boolean (false) | Premium üye mi |

---

## 5. KAYIT/GİRİŞ SAYFALARI

| Sayfa | Yol | İşlev |
|-------|-----|-------|
| **Giriş** | `/giris` (`app/giris/page.tsx`) | Email + şifre ile giriş, reCAPTCHA v3 |
| **Kayıt** | `/kayit` (`app/kayit/page.tsx`) | 2 adımlı: Kayıt → Email doğrulama |
| **Şifremi Unuttum** | `/sifremi-unuttum` (`app/sifremi-unuttum/page.tsx`) | Şifre sıfırlama akışı |

### Giriş Sayfası (`/giris`)
- Email + şifre form'u
- reCAPTCHA v3 — 3+ başarısız denemeden sonra devreye giriyor
- Hesap kilitleme durumunda süre gösterimi
- NextAuth `signIn('credentials', ...)` kullanıyor

### Kayıt Sayfası (`/kayit`)
- **Adım 1:** İsim, takma ad (opsiyonel), email, şifre, şifre tekrar
- **Adım 2:** 6 haneli email doğrulama kodu girişi (OTP tarzı, her kutu tek karakter)
- Kod yeniden gönderme özelliği mevcut
- Başarılı doğrulama sonrası otomatik giriş (`signIn`)

---

## 6. GENEL AKIŞ DİYAGRAMI

```
KAYIT AKIŞI:
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│ /kayit   │───▶│ POST /api/   │───▶│ Email        │───▶│ POST     │
│ (Form)   │    │ signup       │    │ doğrulama    │    │ /api/    │
│          │    │              │    │ kodu         │    │ verify-  │
│ name     │    │ • Rate limit │    │ gönderilir   │    │ email    │
│ nickname │    │ • Honeypot   │    │              │    │          │
│ email    │    │ • Validation │    │ 6-haneli OTP │    │ ✅ Email │
│ password │    │ • bcrypt(12) │    │ girişi       │    │ verified │
└──────────┘    └──────────────┘    └──────────────┘    └──────────┘

GİRİŞ AKIŞI:
┌──────────┐    ┌──────────────┐    ┌──────────────┐
│ /giris   │───▶│ NextAuth     │───▶│ JWT Token    │
│ (Form)   │    │ signIn()     │    │ oluşturulur  │
│          │    │              │    │              │
│ email    │    │ • Brute-force│    │ • 30 gün     │
│ password │    │ • bcrypt     │    │ • id, role,  │
│          │    │ • Geo lookup │    │   image, lang│
└──────────┘    └──────────────┘    └──────────────┘

ŞİFRE SIFIRLAMA:
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ /sifremi-    │───▶│ POST /api/   │───▶│ POST /api/   │
│ unuttum      │    │ auth/forgot- │    │ auth/reset-  │
│              │    │ password     │    │ password     │
│ Email gir    │    │              │    │              │
│              │    │ 6-haneli kod │    │ Yeni şifre   │
│              │    │ gönderilir   │    │ set edilir   │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## 7. GÜVENLİK ÖZETİ

| Güvenlik Katmanı | Durum | Detay |
|------------------|-------|-------|
| Şifre hash | ✅ | bcrypt, 12 round |
| Brute-force koruması | ✅ | IP + email bazlı, 5 deneme sonrası kilitleme |
| Rate limiting | ✅ | IP bazlı, signup ve forgot-password'da |
| reCAPTCHA v3 | ✅ | Login'de 3+ başarısız denemeden sonra |
| IP Blacklist | ✅ | Kayıt ve giriş'te kontrol |
| Honeypot (Bot tespiti) | ✅ | Kayıt'ta gizli alanlar |
| Email doğrulama | ✅ | 6 haneli OTP, 10 dk geçerli |
| HTTPS cookie | ✅ | Production'da `__Secure-` prefix |
| Security headers | ✅ | `nosniff`, `DENY`, `XSS-Protection`, `HSTS` |
| Hesap kilitleme bildirimi | ✅ | Email ile bildirim |
| Security logging | ✅ | `SecurityLog` modeli ile |
| JWT session | ✅ | 30 gün geçerli |

---

## 8. ÖNERİLER VE EKSİKLER

### ⚠️ Dikkat Edilmesi Gerekenler

1. **Google OAuth yok** — Sadece email/şifre mevcut. Sosyal giriş kullanıcı deneyimini artırabilir, ancak projenin mevcut yapısı buna uygun şekilde genişletilebilir.

2. **İki ayrı login endpoint** — Hem NextAuth `authorize()` hem de `/api/auth/login` mevcut. Bu iki endpoint arasında davranış farklılıkları olabilir (örn: `/api/auth/login` email doğrulama kontrolü yapıyor ama NextAuth `authorize()` yapmıyor).

3. **Email doğrulama kontrolü tutarsızlığı:**
   - `/api/auth/login` → Email doğrulanmamışsa `403 requiresVerification` döner ✅
   - NextAuth `authorize()` → Email doğrulama kontrolü **yok** ⚠️
   - Bu, NextAuth ile doğrudan giriş yapılırsa doğrulanmamış kullanıcıların da sisteme girebileceği anlamına gelir.

4. **`firstSwapBonusPending` alanı** — `verify-email` route'unda set ediliyor ama Prisma schema'da bu alan **tanımlı değil**. Bu bir potansiyel hata olabilir.

5. **Şifre kuralı tutarsızlığı:**
   - Kayıt sayfasında (`/kayit`): min 6 karakter (client-side)
   - Şifre değiştirme (`/api/profile/password`): min 8 karakter + büyük/küçük harf + rakam
   - Signup validation (`signupSchema`): Zod `passwordSchema` ile kontrol

6. **IP Geo lookup** — Her girişte `ip-api.com`'a istek atılıyor. Bu ücretsiz servisin rate limit'i var (150 istek/dk). Yoğun trafikte sorun çıkabilir.

### ✅ İyi Tasarlanmış Noktalar

- Güvenlik katmanları (brute-force, rate limit, honeypot, reCAPTCHA) kapsamlı
- Email doğrulama akışı düzgün çalışıyor
- Şifre hashleme (bcrypt 12 round) güçlü
- Admin bildirim sistemi (yeni kayıt → push + email) mevcut
- Session yönetimi JWT ile yapılıyor, cookie güvenliği iyi
- Doğrulanmamış kullanıcılara yeniden kod gönderme özelliği var

---

*Bu rapor sadece analiz amaçlıdır. Kod değişikliği yapılmamıştır.*
