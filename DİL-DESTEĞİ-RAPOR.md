# 🌍 TAKAS-A — Dil Desteği Kontrol Raporu
## Push Notification ve Toast Mesajları

**Tarih:** 6 Nisan 2026  
**Proje:** TAKAS-A (Next.js)  
**Kontrol Eden:** DeepAgent

---

## A. PUSH NOTIFICATION DİL DESTEĞİ

### Durum

| Kriter | Durum | Açıklama |
|--------|-------|----------|
| Dil desteği var mı? | ❌ YOK | Tüm mesajlar sabit Türkçe |
| useTranslation / t() kullanılıyor mu? | ❌ HAYIR | Hiçbir translation mekanizması yok |
| Hardcoded Türkçe mesajlar var mı? | ❌ EVET (~40+ şablon) | Tamamı Türkçe hardcoded |
| Kullanıcı dil tercihine göre gönderim var mı? | ❌ HAYIR | Dil parametresi alınmıyor |

### Hardcoded Mesaj Örnekleri (lib/push-notifications.ts)

```typescript
// ❌ MEVCUT DURUM — Tüm mesajlar hardcoded Türkçe

// 40+ bildirim şablonunun TAMAMI böyle:
[NotificationTypes.NEW_MESSAGE]: (data) => ({
  title: 'Yeni Mesaj 💬',                                        // ❌ Hardcoded TR
  body: `${data.senderName}: ${data.preview}`,
})

[NotificationTypes.SWAP_REQUEST]: (data) => ({
  title: 'Yeni Takas Teklifi 🔄',                                // ❌ Hardcoded TR
  body: `${data.requesterName} "${data.productTitle}" için takas teklifi gönderdi`, // ❌
})

[NotificationTypes.SWAP_ACCEPTED]: (data) => ({
  title: 'Takas Kabul Edildi ✅',                                 // ❌ Hardcoded TR
  body: `"${data.productTitle}" için takas teklifiniz kabul edildi!`,              // ❌
})

[NotificationTypes.COUNTER_OFFER]: (data) => ({
  title: '💰 Yeni Karşı Teklif',                                 // ❌ Hardcoded TR
  body: `${data.userName} size ${data.proposedPrice} V karşı teklif gönderdi`,    // ❌
})

[NotificationTypes.SWAP_REMINDER_24H]: (data) => ({
  title: '⏰ Takas Hatırlatması - 24 Saat Kaldı',                // ❌ Hardcoded TR
  body: `"${data.productTitle}" için takas teklifinize ${data.hoursLeft} saat içinde yanıt verin!`,
})

// ... toplam 40+ şablon, HEPSİ Türkçe
```

### Olması Gereken

```typescript
// ✅ ÖNERİLEN YAPI

// 1. Kullanıcının dil tercihini al
export async function sendPushToUser(userId: string, type: string, data: Record<string, any>) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcmToken: true, language: true }  // ← language alanı eklenmeli
  })
  
  const lang = user?.language || 'tr'
  const template = notificationTemplates[lang]?.[type] || notificationTemplates['tr'][type]
  // ...
}

// 2. Çok dilli şablon yapısı
const notificationTemplates = {
  tr: {
    [NotificationTypes.NEW_MESSAGE]: (data) => ({
      title: 'Yeni Mesaj 💬',
      body: `${data.senderName}: ${data.preview}`,
    }),
  },
  en: {
    [NotificationTypes.NEW_MESSAGE]: (data) => ({
      title: 'New Message 💬',
      body: `${data.senderName}: ${data.preview}`,
    }),
  },
  es: { ... },
  ca: { ... },
}
```

### Etkilenen Bildirim Türleri (Toplam: 40+)

| # | Tür | Türkçe Title |
|---|-----|-------------|
| 1 | NEW_MESSAGE | Yeni Mesaj 💬 |
| 2 | SWAP_REQUEST | Yeni Takas Teklifi 🔄 |
| 3 | SWAP_ACCEPTED | Takas Kabul Edildi ✅ |
| 4 | SWAP_REJECTED | Takas Teklifi Reddedildi ❌ |
| 5 | SWAP_DELIVERY_SETUP | Teslimat Ayarlandı 📦 |
| 6 | SWAP_QR_SCANNED | QR Kod Tarandı 📱 |
| 7 | SWAP_CONFIRMED | Teslimat Onaylandı ✅ |
| 8 | SWAP_COMPLETED | Takas Tamamlandı 🎉 |
| 9 | SWAP_DISPUTE | Sorun Bildirildi ⚠️ |
| 10 | SWAP_REFUNDED | Teminat İade Edildi 💰 |
| 11 | SWAP_CANCELLED | Takas İptal Edildi ❌ |
| 12 | MULTI_SWAP | Çoklu Takas Fırsatı! 🔥 |
| 13 | MULTI_SWAP_INVITE | 🔄 Çoklu Takas Daveti! |
| 14 | MULTI_SWAP_CONFIRMED | ✅ Çoklu Takas Onaylandı! |
| 15 | MULTI_SWAP_PROGRESS | 👍 Takas Onayı Alındı |
| 16 | MULTI_SWAP_REJECTED | ❌ Çoklu Takas İptal Edildi |
| 17 | VALOR_RECEIVED | Valor Kazandınız! 💎 |
| 18 | PRODUCT_INTEREST | Ürününüz İlgi Görüyor! 👀 |
| 19 | SYSTEM | TAKAS-A |
| 20 | SWAP_REMINDER_24H | ⏰ Takas Hatırlatması - 24 Saat Kaldı |
| 21 | SWAP_REMINDER_8H | ⚠️ Acil: Sadece 8 Saat Kaldı! |
| 22 | SWAP_REMINDER_2H | 🚨 Son 2 Saat! Kararınızı Verin |
| 23-25 | MULTI_SWAP_REMINDER_* | Çoklu Takas Hatırlatmaları |
| 26-28 | DELIVERY_REMINDER_* | Teslimat Hatırlatmaları |
| 29-33 | DISPUTE_* | Sorun/Uzlaşma Bildirimleri |
| 34 | COUNTER_OFFER | 💰 Yeni Karşı Teklif |
| 35 | OFFER_ACCEPTED | ✅ Teklif Kabul Edildi |
| 36 | OFFER_REJECTED | ❌ Teklif Reddedildi |

---

## B. TOAST / POP-UP MESAJLARI DİL DESTEĞİ

### Durum

| Kriter | Durum | Açıklama |
|--------|-------|----------|
| Dil desteği var mı? | ❌ BÜYÜK ÇOĞUNLUKTA YOK | Çoğu sayfada hardcoded Türkçe |
| useLanguage / t() kullanılıyor mu? | ⚠️ KISMEN | Bazı sayfalar (global, ambassador) çok dilli |
| Hardcoded Türkçe toast mesajlar var mı? | ❌ EVET (çok sayıda) | Özellikle kritik sayfalarda |
| Tutarlılık var mı? | ❌ HAYIR | Karma: sonner + custom showNotification |

### Toast Kütüphaneleri (Tutarsızlık!)

| Kütüphane | Kullanıldığı Yer |
|-----------|-----------------|
| `sonner` (toast) | topluluk, global, ambassador, istek-panosu, hizmet-takasi, topluluklar |
| Custom `showNotification` | **takas-firsatlari** (en kritik sayfa!) |
| `@/lib/toast-context` (useToast) | urun/[id] |
| `@radix-ui/react-toast` | components/ui |

### Hardcoded Toast Örnekleri

#### takas-firsatlari/page.tsx (EN KRİTİK SAYFA — 30+ hardcoded mesaj)
```typescript
// ❌ MEVCUT DURUM
showNotification('success', '✅ Mesaj karşı tarafa iletildi!')
showNotification('error', 'Mesaj gönderilemedi')
showNotification('success', 'Veriler güncellendi!')
showNotification('success', '✅ Teslimat noktası onaylandı! QR kod oluşturuldu.')
showNotification('error', '6 haneli kodu girin')
showNotification('success', '🎉 Takas güvenle tamamlandı!')
showNotification('success', '✅ QR kod tarandı! Şimdi ürünü kontrol edebilirsiniz.')
showNotification('success', '📦 Ürün bırakıldı! Alıcıya bildirim gönderildi.')
showNotification('error', '6 haneli teslim kodunu girin')
showNotification('success', '✅ Ürünü aldınız! Şimdi kontrol edin.')
// ... 20+ daha
```

#### istek-panosu/page.tsx
```typescript
// ❌ MEVCUT DURUM
toast.error('Lütfen giriş yapın')
toast.error('Lütfen başlık ve kategori girin')
toast.success('İsteğiniz oluşturuldu! Eşleşmeler aranıyor...')
toast.success('İstek iptal edildi')
```

#### hizmet-takasi/page.tsx
```typescript
// ❌ MEVCUT DURUM
toast.error('Başlık, kategori ve değer zorunludur')
toast.success('Hizmetiniz listelendi!')
toast.success('Durum güncellendi')
toast.error('Kendi hizmetinize mesaj gönderemezsiniz')
```

### Dil Destekli Toast Örnekleri (AZ SAYIDA)

```typescript
// ✅ global/page.tsx — Doğru kullanım
toast.success(t.interested)     // Translation key kullanıyor
toast.success(t.subscribed)

// ✅ ambassador/page.tsx — Doğru kullanım
toast.error(t.required)
toast.success(t.success)

// ⚠️ AMA aynı dosyada:
toast.error('Bir hata oluştu')  // ❌ Fallback hardcoded Türkçe
```

---

## C. KULLANICI DİL TERCİHİ SAKLAMA

### Durum

| Kriter | Durum | Açıklama |
|--------|-------|----------|
| Veritabanında saklanıyor mu? | ❌ HAYIR | User modelinde `language` alanı YOK |
| Session'da saklanıyor mu? | ❌ HAYIR | Session'da dil bilgisi taşınmıyor |
| localStorage'da saklanıyor mu? | ✅ EVET | `localStorage.getItem('language')` |
| Middleware'de kontrol ediliyor mu? | ❌ HAYIR | Server-side dil kontrolü yok |
| Tarayıcı dili tespit ediliyor mu? | ✅ EVET | `detectBrowserLanguage()` fonksiyonu var |

### Mevcut Altyapı

```
✅ lib/language-context.tsx     — Client-side dil context (TR/EN/ES/CA)
✅ lib/translations.ts          — 4 dilde çeviri dosyası (~1500 key)
✅ useLanguage hook              — 79 dosyada kullanılıyor
✅ Tarayıcı dili tespiti         — detectBrowserLanguage()
✅ Dil seçim prompt              — showLanguagePrompt mekanizması

❌ prisma/schema.prisma          — User modelinde language alanı YOK
❌ Server-side dil bilgisi       — Push notification'lar dil bilmeden gönderiliyor
❌ API route'larda dil desteği   — Server tarafı tamamen Türkçe
```

### Prisma Schema — Eksik Alan

```prisma
model User {
  id                      String   @id @default(cuid())
  name                    String?
  email                   String   @unique
  password                String
  // ... 40+ alan var

  // ❌ EKSIK:
  // language              String   @default("tr")   ← BU YOK!
}
```

### Dil Akışı (Mevcut)

```
Kullanıcı → Tarayıcı dili tespit → localStorage kayıt → Client UI çevirisi ✅
                                                          ↓
                                            Push Notification → ❌ Dil bilgisi YOK
                                            Server API'ler   → ❌ Dil bilgisi YOK
                                            Toast mesajları   → ❌ Hardcoded TR (çoğunluk)
```

---

## D. GENEL DEĞERLENDİRME

### Özet Skor Tablosu

| Alan | Puan | Durum |
|------|------|-------|
| Client UI Çevirileri | ⭐⭐⭐⭐ (4/5) | 79 dosyada useLanguage, 4 dil desteği |
| Push Notification Dil Desteği | ⭐ (1/5) | Tamamı hardcoded Türkçe |
| Toast Mesajları Dil Desteği | ⭐⭐ (2/5) | Büyük çoğunluk hardcoded, az kısmı çevrilmiş |
| Dil Tercihi Persistance | ⭐⭐ (2/5) | Sadece localStorage, DB'de yok |
| Server-Side Dil Desteği | ⭐ (1/5) | Hiç yok |

### Tespit Edilen Sorunlar

1. **🔴 KRİTİK: Push bildirimler 4 dili desteklemiyor**  
   → EN/ES/CA kullanıcılar Türkçe bildirim alıyor  
   → 40+ bildirim şablonunun HEPSİ hardcoded Türkçe

2. **🔴 KRİTİK: User modelinde `language` alanı yok**  
   → Server tarafı kullanıcının dilini bilemiyor  
   → Push notification dil desteği eklemek imkansız (önce bu gerekli)

3. **🟡 ORTA: Toast mesajlarında tutarsızlık**  
   → 3 farklı toast sistemi (sonner, custom, radix)  
   → Kritik sayfa (takas-firsatlari) tamamen hardcoded  
   → Bazı sayfalar çevrilmiş, bazıları değil

4. **🟡 ORTA: Server-side API yanıtlarında dil desteği yok**  
   → API hata mesajları Türkçe  
   → Server-rendered mesajlar tek dilde

5. **🟢 DÜŞÜK: localStorage dil tercihi cihaz değişikliğinde kaybolur**  
   → Kullanıcı farklı cihazda yeniden seçim yapmak zorunda

---

## E. ÇÖZÜM ÖNERİLERİ (Öncelik Sırasına Göre)

### 1️⃣ HEMEN: User Modeline `language` Alanı Ekle
```prisma
model User {
  // ... mevcut alanlar
  language String @default("tr")  // tr, en, es, ca
}
```
```bash
npx prisma migrate dev --name add-user-language
```

### 2️⃣ KISA VADEDE: Push Notification Şablonlarını Çok Dilli Yap
```typescript
// lib/push-notification-translations.ts
export const pushTranslations = {
  tr: {
    new_message: { title: 'Yeni Mesaj 💬', body: '{senderName}: {preview}' },
    swap_request: { title: 'Yeni Takas Teklifi 🔄', body: '...' },
    // ...
  },
  en: {
    new_message: { title: 'New Message 💬', body: '{senderName}: {preview}' },
    swap_request: { title: 'New Swap Offer 🔄', body: '...' },
    // ...
  },
  es: { ... },
  ca: { ... },
}
```

### 3️⃣ ORTA VADEDE: Toast Mesajlarını Standartlaştır
- Tek bir toast kütüphanesi seç (sonner önerilir)
- Tüm hardcoded mesajları `t()` fonksiyonuna geçir
- `lib/translations.ts`'e eksik toast key'lerini ekle

### 4️⃣ UZUN VADEDE: Dil Tercihini Senkronize Et
```typescript
// Kullanıcı dil değiştirdiğinde DB'ye kaydet
const setLanguage = async (lang: Language) => {
  localStorage.setItem('language', lang)
  await fetch('/api/users/language', { 
    method: 'PATCH', 
    body: JSON.stringify({ language: lang }) 
  })
}

// Login'de DB'den oku
const session = await getServerSession()
const userLang = session?.user?.language || 'tr'
```

---

## F. ETKİ ANALİZİ

| Kullanıcı Tipi | Mevcut Durum | Etki |
|---------------|-------------|------|
| 🇹🇷 Türkçe kullanıcılar | ✅ Sorun yok | Tüm mesajlar Türkçe |
| 🇬🇧 İngilizce kullanıcılar | ⚠️ UI çevrilmiş, bildirimler Türkçe | Karışık deneyim |
| 🇪🇸 İspanyolca kullanıcılar | ⚠️ UI çevrilmiş, bildirimler Türkçe | Karışık deneyim |
| 🏴 Katalanca kullanıcılar | ⚠️ UI çevrilmiş, bildirimler Türkçe | Karışık deneyim |

**Barcelona kullanıcı tabanı düşünüldüğünde, ES/CA/EN push bildirim desteği öncelikli olmalıdır.**

---

*Rapor sonu. Sorularınız için iletişime geçin.*
