# 🔍 Negotiate/Counter Offer Endpoint Kontrol Raporu

**Tarih:** 5 Nisan 2026  
**Proje:** TAKAS-A (Next.js)

---

## 📊 Özet Durum

| Alan | Durum |
|------|-------|
| **Negotiate Endpoint** | ✅ VAR — `app/api/swap-requests/negotiate/route.ts` |
| **State Machine (lib)** | ✅ VAR — `lib/state-machine.ts` (processNegotiation, getNegotiationHistory) |
| **Eski Fiyat Sistemi (route.ts)** | ✅ VAR — `action: 'propose_price'` bloğu |
| **MobileSwapActionBar** | ✅ VAR — Butonlar tanımlı (accept, counter, reject) |
| **Frontend Bağlantı** | ⚠️ **EKSİK** — `handleMobileSwapAction` → `case 'counter'` sadece TODO placeholder |

### **Genel Değerlendirme: ⚠️ Kısmi İmplementasyon**

Backend tamamen hazır. Frontend'te `counter` aksiyonu negotiate endpoint'ine bağlanmamış.

---

## 1. Negotiate/Counter Offer Endpoint

### ✅ Dosya: `app/api/swap-requests/negotiate/route.ts`

**GET** — Pazarlık geçmişini getirir:
- `swapId` parametresi ile çağrılır
- `negotiationStatus`, `counterOfferCount`, `remainingCounterOffers`, deadline döner
- `getNegotiationHistory(swapId)` ile geçmiş logları döner

**POST** — Pazarlık aksiyonu:
- `swapId`, `action`, `proposedPrice`, `message` kabul eder
- Geçerli aksiyonlar: `propose`, `counter`, `accept`, `reject`
- `processNegotiation()` (state-machine) üzerinden çalışır
- Fiyat doğrulaması: propose/counter için `proposedPrice > 0` zorunlu

### Kullanım Örneği:
```typescript
// GET
fetch('/api/swap-requests/negotiate?swapId=xxx')

// POST
fetch('/api/swap-requests/negotiate', {
  method: 'POST',
  body: JSON.stringify({
    swapId: 'xxx',
    action: 'counter',    // 'propose' | 'counter' | 'accept' | 'reject'
    proposedPrice: 150,
    message: 'Bu fiyatı öneriyorum'
  })
})
```

---

## 2. Eski Fiyat Teklifi Sistemi (route.ts içinde)

### ✅ `app/api/swap-requests/route.ts` → `action: 'propose_price'`

Bağımsız bir fiyat eşleştirme sistemi:
- Her iki taraf ayrı ayrı fiyat girer (`agreedPriceRequester`, `agreedPriceOwner`)
- İki fiyat eşleşirse → `price_agreed` ✅
- Eşleşmezse → mesaj gönderir, karşı tarafın onayını bekler
- Push notification gönderir

**Bu, negotiate endpoint'inden FARKLI bir sistemdir.** İkisi birlikte çalışabilir.

---

## 3. API Endpoint Dosyaları (15 adet)

| Dosya | Açıklama |
|-------|----------|
| `route.ts` | Ana CRUD + eski fiyat sistemi |
| `negotiate/route.ts` | ✅ **Pazarlık/Counter Offer** |
| `cancel/route.ts` | İptal |
| `confirm/route.ts` | Onay |
| `delivery/route.ts` | Teslimat |
| `delivery-agreement/route.ts` | Teslimat anlaşması |
| `delivery-date/route.ts` | Teslimat tarihi |
| `dispute/route.ts` | İtiraz |
| `feedback/route.ts` | Geri bildirim |
| `photos/route.ts` | Fotoğraflar |
| `scan/route.ts` | QR tarama |
| `status/route.ts` | Durum |
| `daily-limit/route.ts` | Günlük limit |
| `auto-cancel/route.ts` | Otomatik iptal |
| `auto-complete/route.ts` | Otomatik tamamlama |

---

## 4. Swap Request Status'leri

### Negotiation Status'leri (`lib/swap-config.ts`):
| Status | Açıklama |
|--------|----------|
| `chatting` | Mesajlaşma aşamasında |
| `price_proposed` | Fiyat önerildi |
| `price_agreed` | Fiyat üzerinde anlaşıldı |
| `cancelled` | İptal edildi |

### Ana Swap Status'leri:
`pending` → `accepted` → `delivery_proposed` → `qr_generated` → `in_transit` → `completed`  
Alt dallar: `rejected`, `cancelled`, `auto_cancelled`, `expired`, `negotiating`

---

## 5. MobileSwapActionBar Handler

### ✅ Component: `components/takas-merkezi/MobileSwapActionBar.tsx`
- `pending` + `isReceiverSide`: **Kabul Et**, **Karşı Teklif**, **Reddet**
- `negotiating`: **Kabul Et**, **Yeni Teklif**, **İptal Et**
- Butonlar doğru şekilde tanımlı

### ⚠️ Handler: `app/takas-firsatlari/page.tsx` → `handleMobileSwapAction`

```typescript
case 'counter':
  // TODO: handleCounterOffer — karşı teklif akışı henüz mevcut değil
  showNotification('success', 'Karşı teklif özelliği yakında aktif olacak')
  break
```

**SORUN:** `counter` aksiyonu negotiate endpoint'ine API çağrısı yapmıyor!  
Sadece bir placeholder mesaj gösteriyor.

---

## 6. Eksik İmplementasyonlar

### 🔴 Kritik Eksik: Frontend → Backend Bağlantısı

`handleMobileSwapAction` → `case 'counter'` bloğu şunları yapmalı:

1. Kullanıcıdan fiyat girmesini iste (modal/input)
2. `/api/swap-requests/negotiate` endpoint'ine POST at
3. Sonuca göre UI güncelle
4. Pazarlık geçmişini göster (GET ile)

### Önerilen Akış:
```
[Karşı Teklif Butonu] → [Fiyat Giriş Modal] → [POST /api/swap-requests/negotiate]
                                                   ↓
                                            {action: 'counter', proposedPrice: X}
                                                   ↓
                                            [Sonuç göster + mesaj gönder]
```

---

## 7. Sonuç

| Katman | Durum | Notlar |
|--------|-------|--------|
| **Database (Prisma)** | ✅ Tam | `negotiationStatus`, `counterOfferCount`, `agreedPrice*` alanları var |
| **Backend API** | ✅ Tam | `negotiate/route.ts` + `state-machine.ts` tam çalışır |
| **State Machine** | ✅ Tam | `processNegotiation()`, `getNegotiationHistory()` hazır |
| **Component (Butonlar)** | ✅ Tam | `MobileSwapActionBar` butonları doğru |
| **Frontend Handler** | ❌ Eksik | `case 'counter'` → TODO placeholder |
| **Fiyat Giriş UI** | ❌ Yok | Modal/dialog gerekli |

**Yapılması gereken:** Frontend'te `counter` case'ini negotiate endpoint'ine bağlayan bir fiyat giriş modal'ı + API çağrısı oluşturmak.
