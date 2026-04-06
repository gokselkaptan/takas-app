# TAKAS-A — ADMIN REPORT MODERATION PANEL ANALİZ RAPORU

**Tarih:** 6 Nisan 2026  
**Durum:** Sadece analiz — kod değişikliği yapılmadı

---

## 1. UserReport Modeli (prisma/schema.prisma)

### Model Tanımı:
```prisma
model UserReport {
  id          String   @id @default(cuid())
  reporterId  String
  reportedId  String
  reason      String
  description String?
  status      String   @default("PENDING")
  createdAt   DateTime @default(now())

  reporter User @relation("Reporter", fields: [reporterId], references: [id], onDelete: Cascade)
  reported User @relation("Reported", fields: [reportedId], references: [id], onDelete: Cascade)

  @@index([reporterId])
  @@index([reportedId])
  @@index([status])
}
```

### Alanlar:

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `id` | String | ✅ | CUID otomatik üretilir |
| `reporterId` | String | ✅ | Şikayet eden kullanıcı ID |
| `reportedId` | String | ✅ | Şikayet edilen kullanıcı ID |
| `reason` | String | ✅ | Şikayet nedeni (serbest string, enum yok) |
| `description` | String? | ❌ | Opsiyonel açıklama (max 500 karakter, API'de kırpılır) |
| `status` | String | ✅ | Varsayılan "PENDING" (enum yok, serbest string) |
| `createdAt` | DateTime | ✅ | Otomatik oluşturulma zamanı |

### ⚠️ Önemli Tespitler:
- **`updatedAt` alanı YOK** — Status değişikliği loglanamaz
- **`ReportStatus` enum'u YOK** — Status serbest string olarak tanımlı, sadece varsayılan "PENDING" var
- **`ReportReason` enum'u YOK** — Reason da serbest string, validation sadece API tarafında
- **`resolvedBy` alanı YOK** — Hangi admin'in çözdüğü takip edilemez
- **`resolvedAt` alanı YOK** — Ne zaman çözüldüğü takip edilemez
- **`adminNote` alanı YOK** — Admin notu eklenemez

### İlişkiler:
- `reporter` → User (`Reporter` relation) — Şikayet eden
- `reported` → User (`Reported` relation) — Şikayet edilen
- Her iki ilişki de `onDelete: Cascade` — Kullanıcı silinirse şikayetler de silinir

### Index'ler:
- `@@index([reporterId])` — Şikayet edenin raporlarını hızlı sorgulama
- `@@index([reportedId])` — Şikayet edilenin raporlarını hızlı sorgulama
- `@@index([status])` — Status bazlı filtreleme (admin paneli için kritik)

---

## 2. Mevcut Report Endpoint'leri

### `app/api/users/[id]/report/route.ts`

#### HTTP Method'ları:
- **POST** ✅ — Yeni şikayet oluşturma
- **GET** ❌ — Mevcut değil (şikayetleri listeleme yok)
- **PATCH/PUT** ❌ — Mevcut değil (status güncelleme yok)
- **DELETE** ❌ — Mevcut değil (şikayet silme yok)

#### Valid Reasons (API tarafında tanımlı):
```typescript
const VALID_REASONS = [
  'spam',
  'harassment',
  'fake_product',
  'fraud',
  'inappropriate_content',
  'other',
]
```

#### POST Request Body:
```typescript
{
  reason: string,       // Zorunlu — VALID_REASONS listesinden biri olmalı
  description?: string  // Opsiyonel — max 500 karakter (API'de slice edilir)
}
```

#### 24 Saat Cooldown Mekanizması:
```typescript
const recentReport = await prisma.userReport.findFirst({
  where: {
    reporterId: user.id,
    reportedId: params.id,
    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
})
```
- **Süre:** 24 saat (24 * 60 * 60 * 1000 ms)
- **Kapsam:** Aynı reporter → aynı reported arasında
- **Kontrol:** `createdAt >= (şimdi - 24 saat)` şartı ile
- **Response:** HTTP 429 `"Bu kullanıcıyı yakın zamanda zaten şikayet ettiniz"`

#### Chairman Koruması:
- **Direkt koruma YOK** — Bu endpoint'te chairman/admin kontrolü yok
- Chairman koruması sadece `/api/users/[id]/block` endpoint'inde mevcut (403 döner)
- Yani admin şikayet edilebilir, ama engellenemez

#### Session Kontrolü:
- `getServerSession(authOptions)` ile kimlik doğrulama
- `session.user.email` üzerinden kullanıcı bulma
- Kendini şikayet etme engeli: `params.id === user.id` kontrolü
- Hedef kullanıcının varlığı doğrulanıyor

#### Validation:
1. Session kontrolü (401)
2. Kullanıcı varlığı kontrolü (404)
3. Kendini şikayet etme engeli (400)
4. Hedef kullanıcı varlığı kontrolü (404)
5. Reason validation — `VALID_REASONS` listesinde olmalı (400)
6. 24 saat cooldown kontrolü (429)
7. Description 500 karaktere kırpılma

#### Response Format:
- **Success:** `{ success: true }` (HTTP 200)
- **Error:** `{ error: "Mesaj" }` (HTTP 400/401/404/429/500)

---

## 3. Admin Paneli Mevcut Durumu

### `app/admin/` Dizin Yapısı:
```
app/admin/
├── layout.tsx                     → Basit layout (metadata + children)
├── page.tsx                       → Ana admin paneli (çok büyük, 3900+ satır)
├── guvenlik-uyarilari/
│   └── page.tsx                   → Güvenlik uyarıları sayfası (AlertTriangle)
└── products/
    └── page.tsx                   → Ürün yönetimi sayfası
```

### Mevcut Admin Paneli Tab'ları (`page.tsx`):
```typescript
activeTab: 'interests' | 'messages' | 'demand' | 'valor' | 'errors' | 
           'disputes' | 'security' | 'inflation' | 'config' | 'backup' | 
           'test' | 'users' | 'newsletter' | 'ses-testi' | 'bildirimler'
```

### Mevcut Admin Özellikler:
| Özellik | Durum | Açıklama |
|---------|-------|----------|
| İstatistikler (interests) | ✅ | Kullanıcı/ürün istatistikleri |
| Mesajlar (messages) | ✅ | Mesaj yönetimi |
| Talep Analizi (demand) | ✅ | Talep analizi |
| VALOR Yönetimi (valor) | ✅ | Ekonomi yönetimi |
| Hata Logları (errors) | ✅ | Hata takibi |
| Uyuşmazlık (disputes) | ✅ | Dispute yönetimi (detaylı) |
| Güvenlik (security) | ✅ | Güvenlik logları |
| Enflasyon (inflation) | ✅ | Enflasyon kontrolü |
| Konfigürasyon (config) | ✅ | Sistem ayarları |
| Yedekleme (backup) | ✅ | Veri yedekleme |
| Test (test) | ✅ | Test araçları |
| Kullanıcılar (users) | ✅ | Kullanıcı yönetimi |
| Bülten (newsletter) | ✅ | Newsletter gönderimi |
| Ses Testi (ses-testi) | ✅ | Ses testi |
| Bildirimler (bildirimler) | ✅ | Push notification yönetimi |
| **Şikayet Yönetimi** | ❌ | **MEVCUT DEĞİL** |

### Report Moderation Linki:
- **app/admin/page.tsx'de "Şikayet Yönetimi" veya "Report Moderation" linki YOK**
- Admin panelinde UserReport modeline erişim **hiçbir yerden** sağlanmıyor
- Tek dolaylı erişim: `guvenlik-uyarilari/page.tsx` → Kullanıcı geçmişinde (`reports` array)

### Admin API'de Report Endpoint'leri:
- `app/api/admin/` altında **report ile ilgili hiçbir endpoint YOK**
- Report listeleme, filtreleme, status güncelleme API'leri mevcut değil

### Güvenlik Uyarıları Sayfasında Report Görünümü:
- `guvenlik-uyarilari/page.tsx` içinde kullanıcı geçmişi yüklendiğinde `reports` array gösteriliyor
- Bu, `app/api/admin/users/[id]/history/route.ts` endpoint'inden geliyor
- Sadece belirli bir kullanıcının aldığı şikayetleri gösteriyor (global liste yok)

---

## 4. Mevcut Şikayet Nedenleri

### `components/block-report-actions.tsx`

#### Reason Listesi:
| # | Value | Label (Türkçe) |
|---|-------|----------------|
| 1 | `spam` | Spam |
| 2 | `harassment` | Taciz |
| 3 | `fake_product` | Sahte Ürün |
| 4 | `fraud` | Dolandırıcılık |
| 5 | `inappropriate_content` | Uygunsuz İçerik |
| 6 | `other` | Diğer |

#### Form Yapısı:
- **Reason:** `<select>` dropdown — Zorunlu (`required` + `!reportReason` kontrolü)
- **Description:** `<textarea>` — Opsiyonel, max 500 karakter, karakter sayacı mevcut
- **Submit:** "Şikayet Gönder" butonu — Loading state ile (Loader2 spinner)
- **Cancel:** "İptal" butonu

#### Form Validation:
- Reason seçilmeden submit edilemez (`!reportReason` → `showError('Lütfen bir neden seçin')`)
- Description opsiyonel, max 500 karakter (client tarafında `slice(0, 500)`)
- API'ye gönderilmeden önce reason seçimi kontrol edilir

#### API Call:
```typescript
fetch(`/api/users/${targetUserId}/report`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reason: reportReason,
    description: reportDescription || undefined
  })
})
```

#### Success/Error Handling:
- **Success:** `showSuccess('Şikayetiniz alındı')` + modal kapatılır + form temizlenir
- **Error:** `showError(error.message || 'Bir hata oluştu')` — API hata mesajı gösterilir
- **Cooldown:** API 429 dönerse → `"Bu kullanıcıyı yakın zamanda zaten şikayet ettiniz"` gösterilir

#### Component Kullanıldığı Yerler:
- `app/mesajlar/page.tsx` — Mesaj sayfasında sohbet başlığında
- `app/urun/[id]/page.tsx` — Ürün detay sayfasında

---

## 5. İlgili Dosyalar ve Ek Analiz

### Validations:
- `lib/validations.ts` içinde **report ile ilgili validation yok**
- Tüm validation API route'unda inline yapılıyor

### Types:
- `types/` dizininde **report type tanımı yok**
- TypeScript interface'leri sadece component içinde tanımlı

### Admin User History Endpoint:
```typescript
// app/api/admin/users/[id]/history/route.ts
prisma.userReport.findMany({
  where: { reportedId: params.id },
  // reporter bilgileri include ediliyor
  reporter: { select: { name, email } }
})
```
- Sadece belirli bir kullanıcının **aldığı** şikayetleri listeliyor
- Global şikayet listesi yok

### AdminAlert Modeli (karşılaştırma):
```prisma
model AdminAlert {
  id             String   @id @default(cuid())
  type           String
  triggeredById  String
  targetUserId   String?
  metadata       String?
  isRead         Boolean  @default(false)
  createdAt      DateTime @default(now())
  // ...indexes
}
```
- AdminAlert modelinde `isRead` alanı var → UserReport'ta yok
- AdminAlert için tam CRUD endpoint'leri var → UserReport için sadece POST var

---

## 6. Genel Değerlendirme

### ✅ Mevcut Durum:
| Özellik | Durum |
|---------|-------|
| UserReport modeli tanımlı | ✅ |
| Report POST endpoint'i çalışıyor | ✅ |
| 24 saat cooldown aktif | ✅ |
| Şikayet formu UI (modal) | ✅ |
| 6 adet şikayet nedeni tanımlı | ✅ |
| Reason validation (API tarafı) | ✅ |
| Description 500 karakter limit | ✅ |
| Index'ler tanımlı (reporterId, reportedId, status) | ✅ |
| Kullanıcı geçmişinde şikayetler görünüyor | ✅ |

### ❌ Eksikler:
| Eksik Özellik | Önem |
|---------------|------|
| **Admin report moderation paneli/tab'ı** | 🔴 KRİTİK |
| **Report listeleme API'si** (tüm şikayetler) | 🔴 KRİTİK |
| **Report status güncelleme API'si** | 🔴 KRİTİK |
| **Report filtreleme** (status, reason, tarih) | 🟡 YÜKSEK |
| **ReportStatus enum'u** (PENDING, REVIEWED, RESOLVED, DISMISSED) | 🟡 YÜKSEK |
| **updatedAt alanı** (schema'da) | 🟡 YÜKSEK |
| **resolvedBy alanı** (hangi admin çözdü) | 🟡 YÜKSEK |
| **resolvedAt alanı** (ne zaman çözüldü) | 🟡 YÜKSEK |
| **adminNote alanı** (admin notu) | 🟡 YÜKSEK |
| Report arama (reporter/reported isim/email) | 🟢 ORTA |
| Report istatistikleri (dashboard) | 🟢 ORTA |
| Toplu aksiyon (bulk actions) | 🟢 ORTA |
| Chairman koruması (report endpoint'inde) | 🟢 ORTA |
| Çoklu dil desteği (reason label'ları) | 🟢 DÜŞÜK |

---

## 7. Önerilen İmplementasyon Planı

### Aşama 1 — Schema Güncelleme:
1. `UserReport` modeline `updatedAt`, `resolvedBy`, `resolvedAt`, `adminNote` alanları ekle
2. `ReportStatus` enum oluştur: `PENDING`, `REVIEWING`, `RESOLVED`, `DISMISSED`
3. `status` alanını String'den ReportStatus enum'a çevir

### Aşama 2 — Admin API Endpoint'leri:
1. `GET /api/admin/reports` — Tüm şikayetleri listele (pagination, filtreleme, arama)
2. `PATCH /api/admin/reports/[id]` — Status güncelleme + admin notu
3. `GET /api/admin/reports/stats` — Şikayet istatistikleri

### Aşama 3 — Admin Panel UI:
1. `app/admin/page.tsx`'e yeni "reports" tab'ı ekle VEYA
2. `app/admin/reports/page.tsx` olarak ayrı sayfa oluştur
3. Şikayet listesi tablosu (filtreleme, sıralama, sayfalama)
4. Şikayet detay modal/drawer (reporter bilgisi, reported bilgisi, admin notu)
5. Status güncelleme butonları
6. Dashboard'da şikayet istatistikleri kartı

### Aşama 4 — Ek Özellikler:
1. Report üzerine otomatik kullanıcı ban mekanizması (N şikayet sonrası)
2. Email bildirim (admin'e yeni şikayet geldiğinde)
3. Report geçmişi timeline
4. Toplu aksiyon (birden fazla şikayeti aynı anda çöz/reddet)

---

*Bu rapor sadece analiz amaçlıdır. Hiçbir kod değişikliği yapılmamıştır.*
