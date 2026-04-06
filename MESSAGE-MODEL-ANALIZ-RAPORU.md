# 📋 Message Modeli ve Mesaj Insert Kontrol Raporu

**Tarih:** 5 Nisan 2026  
**Proje:** TAKAS-A

---

## 1. Message Modeli Yapısı

```prisma
model Message {
  id                   String       @id @default(cuid())
  content              String
  senderId             String
  receiverId           String
  productId            String?
  swapRequestId        String?
  isRead               Boolean      @default(false)
  readAt               DateTime?
  createdAt            DateTime     @default(now())
  containsPersonalInfo Boolean      @default(false)
  isModerated          Boolean      @default(false)
  moderationReason     String?
  moderationResult     String?
  metadata             String?          // ← JSON string olarak kullanılıyor
  reminderSentAt       DateTime?
  
  product              Product?     @relation(...)
  receiver             User         @relation("MessageReceiver", ...)
  sender               User         @relation("MessageSender", ...)
  swapRequest          SwapRequest? @relation(...)
}
```

### Durum:
| Alan | Durum | Açıklama |
|------|-------|----------|
| `senderType` | ❌ **YOK** | Model'de `senderType` alanı bulunmuyor |
| `messageType` | ❌ **YOK** | Model'de `messageType` alanı bulunmuyor |
| `metadata` | ✅ **VAR** | JSON string olarak sistem mesajı tipi taşınıyor |

> **Önemli:** Sistem mesajı ayrımı `metadata` alanındaki JSON ile yapılıyor (`type` key'i). Ayrı bir `senderType` veya `messageType` enum/string alanı yok.

---

## 2. Negotiate Endpoint'te Mesaj Insert

**Dosya:** `app/api/swap-requests/negotiate/route.ts`

### Durum: ❌ **HİÇBİR `message.create` YOK**

Negotiate endpoint'te:
- ✅ `processNegotiation()` ile pazarlık işlemi yapılıyor (state-machine)
- ✅ Push notification gönderiliyor (`COUNTER_OFFER`, `OFFER_ACCEPTED`, `OFFER_REJECTED`)
- ❌ **Hiçbir `prisma.message.create()` çağrısı yok**
- ❌ Chat'e otomatik sistem mesajı yazılmıyor

Bu demek oluyor ki kullanıcı karşı teklif gönderdiğinde, kabul/red ettiğinde **SwapChat'te hiçbir iz kalmıyor**.

---

## 3. SwapChat Mesaj Endpoint'i

**Dosya:** `components/takas-merkezi/SwapChat.tsx`

- **Fetch:** `GET /api/messages?userId=${otherUserId}&swapRequestId=${swapRequestId}`
- **Send:** `POST /api/messages` → `{ receiverId, content, swapRequestId }`
- **Polling:** 5 saniyede bir `fetchMessages(true)` ile silent poll

### SwapChat `swapRequestId` ile filtreliyor:
```typescript
const res = await fetch(`/api/messages?userId=${otherUserId}&swapRequestId=${swapRequestId}`)
```

GET handler'da `swapRequestId` varsa sadece o takasın mesajları dönüyor.

---

## 4. Messages API

**Dosya:** `app/api/messages/route.ts`

| Handler | Durum | Açıklama |
|---------|-------|----------|
| GET | ✅ VAR | `userId`, `productId`, `swapRequestId`, `unreadOnly` parametreleri |
| POST | ✅ VAR | Mesaj oluşturma, moderasyon, rate limiting, push notification |

### POST handler yapısı:
- `senderId`, `receiverId`, `content`, `productId`, `swapRequestId` alıyor
- `metadata` alanı kullanılıyor (konum, swap_request tipi vb.)
- Moderasyon sistemi (quickModeration + aiModeration)
- Rate limiting (20 mesaj/dakika)
- Push notification gönderimi

---

## 5. Sistem Mesajı Desteği

### Mevcut Sistem Mesajı Örnekleri:

| Endpoint | Metadata Type | Açıklama |
|----------|--------------|----------|
| `delivery-date/route.ts` | `delivery_date_proposal` | Teslim tarihi önerisi |
| `delivery-date/route.ts` | `delivery_date_accepted` | Teslim tarihi kabul |
| `auto-cancel/route.ts` | `auto_cancel_48h` | 48 saat otomatik iptal |
| `scan/route.ts` | - | Doğrulama kodu mesajı |

### Sistem mesajı oluşturma pattern'i:
```typescript
await prisma.message.create({
  data: {
    senderId: user.id,        // İşlemi yapan kullanıcı
    receiverId: otherUserId,   // Karşı taraf
    content: `📅 Mesaj içeriği...`,
    productId: swap.productId,
    isModerated: true,         // Moderasyonu atla
    moderationResult: 'approved',
    metadata: JSON.stringify({ 
      type: 'delivery_date_proposal',  // ← Mesaj tipi burada
      swapRequestId: swapId,
      // ek veri...
    })
  }
})
```

---

## 6. Genel Durum Özeti

| Konu | Durum | Detay |
|------|-------|-------|
| Message modeli | ⚠️ Kısmi | `senderType`/`messageType` yok, `metadata` ile çözülüyor |
| Negotiate mesaj insert | ❌ **EKSİK** | Hiçbir sistem mesajı yazılmıyor |
| SwapChat endpoint | ✅ Tam | GET/POST çalışıyor, swapRequestId filtresi var |
| Messages API | ✅ Tam | GET, POST, moderasyon, rate limiting |
| Sistem mesajı desteği | ✅ Var | Diğer endpoint'lerde kullanılıyor (delivery-date, auto-cancel) |

---

## 7. Önerilen Düzeltme: Negotiate'e Sistem Mesajı Eklenmesi

**Ne yapılmalı:** `app/api/swap-requests/negotiate/route.ts` POST handler'ına, push notification'dan sonra `prisma.message.create()` eklenmeli.

### Eklenecek mesajlar:

| Action | Mesaj | Metadata Type |
|--------|-------|---------------|
| `propose` | `💰 {userName} {proposedPrice} V fiyat teklifi gönderdi` | `negotiation_propose` |
| `counter` | `💰 {userName} {proposedPrice} V karşı teklif gönderdi` | `negotiation_counter` |
| `accept` | `✅ {userName} teklifi kabul etti ({agreedPrice} V)` | `negotiation_accept` |
| `reject` | `❌ {userName} teklifi reddetti` | `negotiation_reject` |

### Pattern (mevcut sisteme uygun):
```typescript
// Push notification sonrasına eklenecek:
await prisma.message.create({
  data: {
    senderId: user.id,
    receiverId: otherUserId,
    content: `💰 ${user.name || 'Kullanıcı'} ${proposedPrice} V karşı teklif gönderdi`,
    productId: swapForPush.product?.id,
    swapRequestId: swapId,
    isModerated: true,
    moderationResult: 'approved',
    metadata: JSON.stringify({
      type: 'negotiation_counter',
      swapRequestId: swapId,
      proposedPrice: proposedPrice
    })
  }
})
```

---

**Rapor Sonu**
