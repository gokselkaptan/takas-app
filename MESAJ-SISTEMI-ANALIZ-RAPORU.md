# 📨 TAKAS-A Mesaj Sistemi Analiz Raporu

**Tarih:** 5 Nisan 2026  
**Durum:** ⛔ Sadece analiz — değişiklik yapılmadı

---

## 1. Mesaj Sistemi Mimarisi

### Genel Yapı
TAKAS-A'da **ayrı bir `Conversation` modeli yoktur.** Mesajlar doğrudan `Message` tablosunda `senderId` + `receiverId` + `productId` kombinasyonuyla gruplandırılır. Konuşma listesi, **API tarafında runtime'da** son 200 mesajdan `Map` ile hesaplanır.

İki ayrı mesaj sistemi vardır:

| Sistem | Model | Kullanım |
|--------|-------|----------|
| **1:1 Mesajlaşma** | `Message` | Normal mesajlar + takas talebi mesajları |
| **Grup Mesajlaşma** | `GroupConversation` + `GroupConversationMember` + `GroupMessage` | Multi-swap grup sohbetleri |

---

## 2. Veri Modeli (Prisma Schema)

### 2.1 `Message` Modeli (1:1 Mesajlaşma)

```prisma
model Message {
  id                   String       @id @default(cuid())
  content              String
  senderId             String       // Gönderen kullanıcı
  receiverId           String       // Alıcı kullanıcı
  productId            String?      // İlişkili ürün (opsiyonel)
  swapRequestId        String?      // İlişkili takas talebi (opsiyonel)
  isRead               Boolean      @default(false)
  readAt               DateTime?
  createdAt            DateTime     @default(now())
  containsPersonalInfo Boolean      @default(false)
  isModerated          Boolean      @default(false)
  moderationReason     String?
  moderationResult     String?
  metadata             String?      // JSON: konum, swap_request tipi vb.
  reminderSentAt       DateTime?    // 6 saatlik hatırlatma email

  // İlişkiler
  product              Product?     @relation(...)
  receiver             User         @relation("MessageReceiver", ...)
  sender               User         @relation("MessageSender", ...)
  swapRequest          SwapRequest? @relation(...)

  // İndeksler
  @@index([senderId, createdAt])
  @@index([receiverId, createdAt])
  @@index([senderId, receiverId])
  @@index([productId])
  @@index([swapRequestId])
  @@index([isRead])
}
```

**Önemli notlar:**
- `Conversation` tablosu **yok** — konuşmalar `senderId + receiverId + productId` üzerinden runtime'da gruplandırılıyor
- `swapRequestId` ile takas talepleriyle ilişki kurulabiliyor
- `metadata` JSON alanında konum ve swap_request tipi bilgileri saklanıyor

### 2.2 `GroupConversation` + `GroupMessage` Modelleri (Grup Mesajlaşma)

```prisma
model GroupConversation {
  id          String     @id @default(cuid())
  name        String?
  type        String     @default("multi_swap")  // multi_swap | general
  multiSwapId String?    @unique
  creatorId   String
  isActive    Boolean    @default(true)
  members     GroupConversationMember[]
  messages    GroupMessage[]
}

model GroupConversationMember {
  id                  String   @id @default(cuid())
  groupConversationId String
  userId              String
  role                String   @default("member")  // admin | member
  joinedAt            DateTime @default(now())
  lastReadAt          DateTime?
  isActive            Boolean  @default(true)
  @@unique([groupConversationId, userId])
}

model GroupMessage {
  id                  String   @id @default(cuid())
  groupConversationId String
  senderId            String
  content             String
  createdAt           DateTime @default(now())
  isModerated         Boolean  @default(false)
  metadata            String?
  isRead              Boolean  @default(false)
  isSystem            Boolean  @default(false)  // Sistem mesajları
}
```

---

## 3. API Endpoints

### 3.1 Ana Mesaj Endpointleri

| Endpoint | Metod | Açıklama |
|----------|-------|----------|
| `/api/messages` | `GET` | Konuşma listesi veya belirli kullanıcıyla mesajlar |
| `/api/messages` | `POST` | Yeni mesaj gönder (moderasyon + push + email) |
| `/api/messages` | `DELETE` | Admin mesaj/konuşma silme |
| `/api/messages/read` | `PUT` | Mesajları okundu olarak işaretle |
| `/api/messages/unread-count` | `GET` | Okunmamış mesaj sayısı (hafif sorgu) |
| `/api/messages/search-users` | `GET` | Kullanıcı arama (isim/nickname) |
| `/api/messages/groups` | `GET` | Grup konuşmalarını listele |
| `/api/messages/groups` | `POST` | Yeni grup konuşması oluştur |
| `/api/messages/groups/[id]` | `GET` | Grup mesajlarını getir |
| `/api/messages/groups/[id]` | `POST` | Gruba mesaj gönder |
| `/api/messages/groups/[id]` | `PATCH` | Üye ekleme/çıkarma/ayrılma |
| `/api/admin/messages` | `GET` | Admin mesaj yönetimi |
| `/api/moderate-message` | `POST` | Mesaj moderasyon kontrolü |

### 3.2 `GET /api/messages` Detaylı Akış

**Parametre:** `userId` verilmemişse → konuşma listesi döner

```
1. Son 200 mesajı al (senderId veya receiverId = currentUser)
2. Map ile grupla: key = `${otherUser.id}-${productId || 'general'}`
3. Her grup için: otherUser, product, lastMessage, unreadCount hesapla
4. Response: { conversations: [...], stats: { totalMessages, readMessages, unreadMessages } }
```

**Parametre:** `userId` verilmişse → o kullanıcıyla mesajlar

```
1. OR koşulu: [sender=me, receiver=userId] | [sender=userId, receiver=me]
2. swapRequestId varsa → sadece o takas mesajları (Takas Merkezi)
3. productId varsa → ürün bazlı filtreleme
4. Mesajları okundu olarak işaretle (fire-and-forget)
```

### 3.3 `POST /api/messages` Akışı

```
1. Auth kontrol
2. Rate limiting (20 mesaj/dakika)
3. Askıya alma (suspension) kontrolü
4. Konum mesajı mı? → metadata'ya lat/lng kaydet
5. quickModeration (regex) → politika ihlali varsa 422 döndür
6. XSS sanitize → sanitizeText()
7. prisma.message.create (moderasyon sonuçlarıyla)
8. Push bildirim gönder (fire-and-forget)
9. Email bildirim gönder (fire-and-forget, 4 dil: TR/EN/ES/CA)
```

---

## 4. Frontend — Mesajlar Sayfası (`/app/mesajlar/page.tsx`)

### 4.1 Temel Yapı

- **Tek sayfa mimarisi:** Konuşma listesi ve sohbet aynı sayfada, `selectedConversation` state'i ile toggle
- **Polling mekanizması:**
  - Konuşma listesi: her **10 saniye** (sadece listedeyken)
  - Aktif sohbet: her **3 saniye**
- **Optimistik mesaj gönderme:** Mesaj ANINDA gösterilir, API cevabı gelince temp mesaj gerçekle değiştirilir
- **URL parametreleri:** `?userId=...&productId=...&productTitle=...` ile direkt konuşma açılabilir

### 4.2 Okundu Tiki (Read Receipt)

```
- Gönderiliyor: Loader2 (spinning)
- İletildi: ✓ (tek tik, beyaz)  
- Okundu: ✓✓ (çift tik, mavi)
```

### 4.3 Konuşma Listesi Gösterimi

Her konuşma kartında:
- Karşı kullanıcının avatarı + ismi
- Ürün bilgisi (varsa: `📦 Ürün Adı`)
- Son mesaj (okunmamışsa kalın)
- Okunmamış sayı badge'i (kırmızı)
- Son mesaj zamanı

### 4.4 Sohbet Görünümü

- Mesaj balonları (mor gradient = gönderilen, gri = gelen)
- Takas bilgisi badge'i: `🔗 Ürün takası` (mesajda `swapRequestId` varsa)
- Admin silme butonları (hover'da görünür)

---

## 5. SwapChat Komponenti (`/components/takas-merkezi/SwapChat.tsx`)

**Kullanım:** Takas Merkezi sayfasında, aktif bir takas isteği için özel sohbet.

**Fark:** Normal mesajlar sayfasından farklı olarak **`swapRequestId` ile filtreleme** yapar.

```typescript
// Mesaj çekme
fetch(`/api/messages?userId=${otherUserId}&swapRequestId=${swapRequestId}`)

// Mesaj gönderme
POST /api/messages { receiverId, content, swapRequestId }
```

- Polling: **5 saniye** (daha hızlı, takas süreci aktif olduğu için)
- Resim yükleme desteği var
- Okundu tikleri mevcut

---

## 6. Takas Talebi → Mesaj Akışı

### 6.1 Takas talebi oluşturulduğunda:

```
POST /api/swap-requests
  ↓
1. prisma.swapRequest.create()
  ↓
2. prisma.message.create({
     content: "💜 Takas Talebi: {mesaj}",
     productId: product.id,
     metadata: JSON.stringify({
       type: 'swap_request',
       swapRequestId: swapRequest.id
     })
   })
  ↓
3. Push bildirim → ürün sahibi
4. Email bildirim → admin
```

**ÖNEMLİ:** Takas talebi mesajında `swapRequestId`, doğrudan `Message.swapRequestId` alanına **değil**, `metadata` JSON alanına yazılıyor. Mesaj tablosundaki `swapRequestId` ise takas talebi kabul edildikten sonraki sohbet mesajlarında kullanılıyor.

### 6.2 Takas sürecinde otomatik mesajlar:

`/api/swap-requests/route.ts` dosyasında çok sayıda `prisma.message.create()` çağrısı var (**20+ adet**). Bunlar:
- Takas kabul/red
- Fiyat teklifi değişiklikleri
- Teslimat anlaşmaları
- QR kod tarama
- Takas tamamlama

İlgili diğer endpointler de mesaj üretiyor:
- `/api/swap-requests/delivery/` — teslimat mesajları
- `/api/swap-requests/status/` — durum değişikliği mesajları
- `/api/swap-requests/delivery-agreement/` — teslimat anlaşma mesajları
- `/api/swap-requests/scan/` — QR tarama mesajları
- `/api/swap-requests/delivery-date/` — tarih mesajları

---

## 7. Bildirim Mekanizmaları

| Kanal | Tetiklenme | Dosya |
|-------|-----------|-------|
| **Push** | Yeni mesaj, takas talebi | `lib/push-notifications.ts` |
| **Email** | Yeni mesaj (4 dil desteği) | `app/api/messages/route.ts` → `sendMessageEmailNotification()` |
| **Ses** | Yeni okunmamış mesaj (polling'de) | `lib/notification-sounds.ts` → `playMessageSound()` |

---

## 8. Güvenlik ve Moderasyon

| Katman | Mekanizma |
|--------|-----------|
| **Rate Limiting** | In-memory Map, 20 mesaj/dakika |
| **Moderation** | `quickModeration()` — regex tabanlı hızlı kontrol |
| **Policy Violation** | Kişisel bilgi, uygunsuz içerik → 422 hata, mesaj engellenir |
| **XSS Protection** | `sanitizeText()` — HTML/script temizleme |
| **Suspension** | `checkUserSuspension()` — askıya alınmış kullanıcılar mesaj gönderemez |
| **Admin Silme** | Sadece admin email'i mesaj/konuşma silebilir |

---

## 9. Önemli Bulgular ve İyileştirme Önerileri

### ✅ İyi Çalışan Yönler
1. **Optimistik UI** — mesaj gönderiminde kullanıcı deneyimi iyi
2. **Okundu tikleri** — WhatsApp benzeri UX
3. **Polling mekanizması** — WebSocket olmadan gerçek zamanlı hissi
4. **Moderasyon** — regex + politika ihlali kontrolü mevcut
5. **Çoklu bildirim** — Push + Email + Ses
6. **Grup mesajlaşma** — Multi-swap için tam destek

### ⚠️ Potansiyel Sorunlar

| # | Sorun | Detay |
|---|-------|-------|
| 1 | **Conversation modeli yok** | Konuşmalar runtime'da hesaplanıyor. 200 mesaj limiti nedeniyle eski konuşmalar kaybolabilir. |
| 2 | **Takas talebi mesajında `swapRequestId` tutarsızlığı** | İlk takas mesajı `metadata`'da swapRequestId saklar ama `Message.swapRequestId` NULL kalır. SwapChat bu mesajı bulamayabilir. |
| 3 | **Polling yükü** | Her 3-5 saniyede API çağrısı, çok kullanıcıda DB yükü yaratabilir. WebSocket daha verimli olurdu. |
| 4 | **Rate limiter in-memory** | Vercel'de serverless ortamda her instance ayrı Map tutar, bypass edilebilir. |
| 5 | **GroupMessage.isRead** | Tek boolean — çok üyeli grupta kimin okuduğu takip edilemiyor. |
| 6 | **200 mesaj limiti** | Aktif kullanıcılar için eski konuşmalar konuşma listesinden düşebilir. |

### 💡 İyileştirme Önerileri

1. **Conversation tablosu eklemek** — Konuşmaların kalıcı ve verimli takibi için
2. **WebSocket/SSE** — Polling yerine gerçek zamanlı mesajlaşma
3. **Redis rate limiter** — Distributed rate limiting
4. **Sayfalama (pagination)** — 200 mesaj limiti yerine cursor-based pagination
5. **İlk takas mesajında `swapRequestId`** — `metadata` yerine doğrudan `Message.swapRequestId` alanına yazılması

---

## 10. Dosya Haritası

```
app/
├── mesajlar/
│   └── page.tsx                      # Ana mesajlar sayfası (frontend)
├── api/
│   ├── messages/
│   │   ├── route.ts                  # GET/POST/DELETE — ana mesaj API
│   │   ├── read/route.ts             # PUT — okundu işaretleme
│   │   ├── unread-count/route.ts     # GET — okunmamış sayısı
│   │   ├── search-users/route.ts     # GET — kullanıcı arama
│   │   └── groups/
│   │       ├── route.ts              # GET/POST — grup CRUD
│   │       └── [id]/route.ts         # GET/POST/PATCH — grup mesajları
│   ├── admin/messages/route.ts       # Admin mesaj yönetimi
│   ├── moderate-message/route.ts     # Moderasyon kontrolü
│   └── swap-requests/
│       ├── route.ts                  # Takas talebi (20+ mesaj üretiyor)
│       ├── delivery/route.ts         # Teslimat mesajları
│       ├── status/route.ts           # Durum mesajları
│       ├── delivery-agreement/route.ts # Anlaşma mesajları
│       ├── scan/route.ts             # QR tarama mesajları
│       └── delivery-date/route.ts    # Tarih mesajları

components/
├── takas-merkezi/
│   ├── SwapChat.tsx                  # Takas sohbeti (swapRequestId filtreli)
│   └── MultiSwapChat.tsx             # Multi-swap tabbed chat

lib/
├── message-moderation.ts             # Moderasyon fonksiyonları
├── push-notifications.ts             # Push bildirim yardımcıları
├── notification-sounds.ts            # Ses bildirimleri
├── safe-fetch.ts                     # safeGet/safePost
├── sanitize.ts                       # XSS temizleme
├── validations.ts                    # Input validasyon
└── display-name.ts                   # Kullanıcı adı gösterimi

prisma/
└── schema.prisma                     # Message, GroupConversation, GroupMessage modelleri
```

---

*Bu rapor sadece analiz amaçlıdır. Herhangi bir kod değişikliği yapılmamıştır.*
