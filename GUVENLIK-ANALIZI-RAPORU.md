# 🔒 TAKAS-A GÜVENLİK ANALİZİ RAPORU

**Tarih:** 6 Nisan 2026  
**Durum:** Sadece Araştırma — Kod Değişikliği Yapılmadı  
**Önceki Adım:** Chairman Kimlik Koruması (4 Katman) ✅ Tamamlandı

---

## SORU 1: `lib/auth.ts` — NextAuth `authorize()` Fonksiyonu

### 1a. `emailVerified` / `isEmailVerified` Kontrolü

**Mevcut Durum:** ❌ `authorize()` fonksiyonunda `emailVerified` kontrolü **YOK**

```typescript
// lib/auth.ts satır 26-111
async authorize(credentials, req) {
  // ... IP kontrolü, brute-force kontrolü ...
  
  const user = await prisma.user.findUnique({
    where: { email: credentials.email },
  })
  
  // Şifre kontrolü yapılıyor ✅
  const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
  
  // ❌ emailVerified KONTROLÜ YOK!
  // Doğrulanmamış kullanıcı doğrudan giriş yapabilir
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    image: user.image,
    // ❌ emailVerified session'a eklenmiyor
  }
}
```

**Güvenlik Riski:** 🔴 **KRİTİK**
- Email doğrulaması yapmamış kullanıcılar NextAuth üzerinden **doğrudan giriş yapabilir**.
- `authorize()` sadece şifre kontrolü yapıyor, `emailVerified` alanını hiç kontrol etmiyor.

### 1b. JWT Callback

**Mevcut Durum:** ⚠️ JWT callback'inde `emailVerified` bilgisi **taşınmıyor**

```typescript
// lib/auth.ts satır 123-141
async jwt({ token, user, trigger }) {
  if (user) {
    token.id = (user as any).id
    token.role = (user as any).role
    token.image = (user as any).image
    // ❌ token.emailVerified = ... YOK
  }
  // DB'den sadece image ve language çekiliyor
  // emailVerified çekilmiyor
}
```

**Güvenlik Riski:** 🟡 **ORTA**
- Session/token içinde `emailVerified` bilgisi olmadığı için, API endpoint'leri bu bilgiye session üzerinden erişemiyor.
- Her endpoint'in ayrı ayrı DB'den `emailVerified` kontrolü yapması gerekiyor (ve çoğu yapmıyor).

### 1c. Session Callback

**Mevcut Durum:** ⚠️ Session callback'inde `emailVerified` bilgisi **yok**

```typescript
// lib/auth.ts satır 142-150
async session({ session, token }) {
  if (session?.user) {
    (session.user as any).id = token?.id as string
    (session.user as any).role = token?.role as string
    (session.user as any).image = token?.image as string | null
    (session.user as any).language = (token?.language as string) || 'tr'
    // ❌ session.user.emailVerified = ... YOK
  }
  return session
}
```

### 1d. Öneriler (Kod değişikliği yapmadan)
1. `authorize()` içine `emailVerified` kontrolü eklenmeli — doğrulanmamış kullanıcılar giriş yapamamalı
2. Alternatif: `emailVerified` bilgisi JWT token'a ve session'a eklenmeli, böylece her API endpoint session üzerinden kontrol edebilsin
3. `return` edilen user objesine `emailVerified` dahil edilmeli

---

## SORU 2: İki Login Endpoint İlişkisi

### 2a. Custom Login Endpoint: `app/api/auth/login/route.ts`

**Mevcut Durum:** Bu endpoint **bağımsız bir login API'si** — ancak **kullanılmıyor!**

| Özellik | Custom Login (`/api/auth/login`) | NextAuth (`authorize()`) |
|---------|----------------------------------|--------------------------|
| reCAPTCHA kontrolü | ✅ VAR (sunucu tarafı doğrulama) | ❌ YOK |
| emailVerified kontrolü | ✅ VAR (satır 80) | ❌ YOK |
| Brute-force koruması | ✅ VAR | ✅ VAR |
| IP spoofing koruması | ✅ `getClientIP()` | ✅ x-real-ip/x-forwarded-for |
| Kalan deneme sayısı | ✅ Döndürüyor | ❌ Döndürmüyor |
| **Aktif olarak kullanılıyor mu?** | ❌ **HAYIR** | ✅ **EVET** |

**Kritik Bulgu:**

```typescript
// app/api/auth/login/route.ts satır 78-84
// 5. Email doğrulanmış mı?
if (!user.emailVerified) {
  return NextResponse.json({
    error: 'Lütfen önce email adresinizi doğrulayın',
    requiresVerification: true
  }, { status: 403 })
}
```

**Ama `app/giris/page.tsx` bu endpoint'i KULLANMIYOR:**

```typescript
// app/giris/page.tsx satır 82-85
const result = await signIn('credentials', {
  email: formData.email,
  password: formData.password,
  redirect: false,
})
```

Giriş sayfası doğrudan `signIn('credentials', ...)` kullanıyor — bu da NextAuth'un `authorize()` fonksiyonuna gider.  
Custom `/api/auth/login` endpoint'i **hiçbir yerde çağrılmıyor**.

### 2b. reCAPTCHA Durumu

Giriş sayfasında reCAPTCHA **client-side** yükleniyor ve token alınıyor ama:
- Token `signIn()` çağrısına **gönderilmiyor** (sadece `email` ve `password` gönderiliyor)
- NextAuth `authorize()` fonksiyonunda reCAPTCHA doğrulaması **yapılmıyor**
- reCAPTCHA token'ı alınıp **hiçbir yere gönderilmiyor**

```typescript
// app/giris/page.tsx satır 77-85
let captchaToken: string | null = null
if (failedAttempts >= 2 && RECAPTCHA_SITE_KEY) {
  captchaToken = await getCaptchaToken()  // Token alınıyor...
}

const result = await signIn('credentials', {
  email: formData.email,
  password: formData.password,
  redirect: false,
  // ❌ captchaToken GÖNDERİLMİYOR!
})
```

### 2c. Güvenlik Riski: 🔴 **KRİTİK**
1. **Ölü Kod Problemi:** Custom login endpoint güvenli ama kullanılmıyor
2. **reCAPTCHA İllüzyonu:** Client-side token alınıyor ama sunucuya iletilmiyor — sahte güvenlik hissi
3. **emailVerified Bypass:** Gerçek login akışı (NextAuth) emailVerified kontrolü yapmıyor

### 2d. Öneriler
1. **Seçenek A:** `authorize()` fonksiyonuna emailVerified kontrolü ve reCAPTCHA doğrulaması ekle
2. **Seçenek B:** Giriş sayfasını custom `/api/auth/login` endpoint'ini kullanacak şekilde değiştir, ardından başarılı doğrulama sonrası NextAuth session başlat
3. Kullanılmayan custom endpoint ya entegre edilmeli ya da kaldırılmalı

---

## SORU 3: `firstSwapBonusPending` Kullanımı

### 3a. Kullanım Yerleri

**Tek kullanım noktası:**

```typescript
// app/api/verify-email/route.ts satır 77
await prisma.user.update({
  where: { id: user.id },
  data: {
    emailVerified: new Date(),
    verificationCode: null,
    verificationCodeExpiry: null,
    firstSwapBonusPending: true, // İlk takas bonusu bekliyor
  }
})
```

### 3b. Prisma Schema Durumu

**Mevcut Durum:** ❌ `firstSwapBonusPending` Prisma schema'da **TANIMLI DEĞİL**

User modelinin tüm alanları incelendi (schema satır 11-122) — `firstSwapBonusPending` alanı **mevcut değil**.

### 3c. Güvenlik Riski: 🟠 **YÜKSEK** (Fonksiyonel Hata)

Bu bir güvenlik açığı değil, bir **çalışma zamanı hatası**:
- `verify-email` endpoint'i çağrıldığında Prisma `firstSwapBonusPending` alanını bulamayacak
- Bu, email doğrulama işleminin **başarısız olmasına** yol açabilir
- Kullanıcılar email'lerini doğrulayamayabilir

**Etki:**
- `emailVerified` güncellenmesi `firstSwapBonusPending` ile aynı `update` çağrısında olduğu için, bu hata **email doğrulamasını tamamen bozabilir**
- Prisma bilinmeyen alan gönderildiğinde hata fırlatır

### 3d. Öneriler
1. Prisma schema'ya `firstSwapBonusPending Boolean @default(false)` alanı eklenmeli
2. Veya `verify-email/route.ts`'den bu alan kaldırılmalı
3. İlk takas bonusu mantığı kullanılacaksa, bunu kontrol eden bir mekanizma da eklenmeli (swap tamamlandığında bonus ver)

---

## SORU 4: Doğrulanmamış Kullanıcı Ne Yapabilir?

### 4a. Ürün Ekleme (`app/api/products/route.ts`)

**Mevcut Durum:** ❌ `emailVerified` kontrolü **YOK**

```typescript
// app/api/products/route.ts
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    // Sadece oturum kontrolü — emailVerified kontrolü YOK
    return NextResponse.json({ error: '...' }, { status: 401 })
  }
  // ... ürün oluşturma devam ediyor
}
```

**Risk:** 🔴 Doğrulanmamış email'e sahip kullanıcılar **ürün ekleyebilir**.

### 4b. Takas Teklifi (`app/api/swap-requests/route.ts`)

**Mevcut Durum:** ❌ `emailVerified` kontrolü **YOK**

```typescript
// app/api/swap-requests/route.ts
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    // Sadece oturum kontrolü — emailVerified kontrolü YOK
  }
  // ... takas teklifi oluşturma devam ediyor
}
```

**Risk:** 🔴 Doğrulanmamış kullanıcılar **takas teklifi gönderebilir**.

### 4c. VALOR İşlemleri

VALOR kazanma/harcama endpoint'lerinde de `emailVerified` kontrolü bulunmuyor. Bu, doğrulanmamış kullanıcıların VALOR sistemiyle etkileşime girebileceği anlamına gelir.

### 4d. `emailVerified` Kontrolü Olan Endpoint'ler

| Endpoint | emailVerified Kontrolü |
|----------|----------------------|
| `app/api/auth/login/route.ts` | ✅ VAR (ama kullanılmıyor) |
| `app/api/verify-email/route.ts` | ✅ VAR (doğrulama akışı) |
| `app/api/signup/route.ts` | ✅ VAR (mevcut kullanıcı kontrolü) |
| `app/api/admin/send-newsletter/route.ts` | ✅ VAR (sadece doğrulanmış kullanıcılara gönderim) |
| `app/api/products/route.ts` | ❌ **YOK** |
| `app/api/swap-requests/route.ts` | ❌ **YOK** |
| `app/api/messages/route.ts` | ❌ **YOK** (muhtemel) |
| `app/api/multi-swap/route.ts` | ❌ **YOK** (muhtemel) |

### 4e. Özet: Doğrulanmamış Kullanıcı Şunları Yapabilir

| İşlem | Mümkün mü? | Risk |
|-------|-----------|------|
| Giriş yapma | ✅ EVET (NextAuth üzerinden) | 🔴 Kritik |
| Ürün ekleme | ✅ EVET | 🔴 Kritik |
| Takas teklifi gönderme | ✅ EVET | 🔴 Kritik |
| Mesaj gönderme | ✅ Muhtemelen EVET | 🟠 Yüksek |
| VALOR kazanma/harcama | ✅ Muhtemelen EVET | 🟠 Yüksek |
| Admin işlemleri | ❌ HAYIR (role kontrolü var) | ✅ Güvenli |

---

## 📊 GENEL GÜVENLİK SKORU

| Kategori | Skor | Detay |
|----------|------|-------|
| Kimlik Doğrulama (Auth) | 🟡 6/10 | Brute-force koruması iyi, ama emailVerified bypass var |
| Email Doğrulama Zorunluluğu | 🔴 2/10 | Neredeyse hiçbir yerde zorunlu değil |
| reCAPTCHA Entegrasyonu | 🔴 1/10 | Client-side token alınıyor ama sunucuya gönderilmiyor |
| Session Güvenliği | 🟡 7/10 | JWT + httpOnly cookie iyi, ama emailVerified bilgisi eksik |
| API Endpoint Koruması | 🔴 3/10 | Sadece session kontrolü var, emailVerified kontrolü yok |
| Chairman Koruması | 🟢 9/10 | 4 Katman tamamlandı ✅ |

---

## 🎯 ÖNCELİKLİ EYLEM PLANI (Kod değişikliği yapmadan öneriler)

### P0 — Acil (Kritik Güvenlik Açıkları)
1. **`authorize()` fonksiyonuna `emailVerified` kontrolü ekle** — doğrulanmamış kullanıcıların girişini engelle
2. **Prisma schema'ya `firstSwapBonusPending` alanı ekle** — email doğrulama akışı bozuk olabilir
3. **reCAPTCHA token'ını `signIn()` çağrısına dahil et** veya custom login endpoint'ini kullan

### P1 — Yüksek Öncelik
4. **JWT token ve session'a `emailVerified` bilgisini ekle** — API endpoint'leri DB sorgusu yapmadan kontrol edebilsin
5. **Ürün ekleme ve takas teklifi endpoint'lerine `emailVerified` kontrolü ekle**

### P2 — Orta Öncelik
6. **Tüm kullanıcı-mutasyon API endpoint'lerini tara** ve `emailVerified` kontrolü ekle
7. **Ölü kodu temizle** — custom login endpoint'i ya entegre et ya kaldır

---

*Bu rapor sadece analiz amaçlıdır. Hiçbir kod değişikliği yapılmamıştır.*
