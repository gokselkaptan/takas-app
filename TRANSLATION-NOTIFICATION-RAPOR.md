# 📋 lib/translations.ts — Notification/Push Translation Analiz Raporu

**Tarih:** 6 Nisan 2026  
**Dosya:** `lib/translations.ts`  
**Toplam Satır:** 1504

---

## 📊 Genel Yapı

| Dil | Satır Aralığı | Key Sayısı |
|-----|---------------|------------|
| **TR** (Türkçe) | 2–376 | 314 |
| **EN** (İngilizce) | 377–751 | 314 |
| **ES** (İspanyolca) | 752–1126 | 314 |
| **CA** (Katalanca) | 1127–1504 | 314 |

✅ Tüm diller eşit key sayısına sahip — tutarlılık sağlanmış.

---

## 🔔 Notification/Push Translation'ları

### Mevcut Key'ler (4 adet)

| Key | TR | EN | ES | CA |
|-----|----|----|----|----|
| `notificationsAfterInstall` | Yükledikten sonra bildirimler de aktif olacak! | Notifications will also be active after installation! | ¡Las notificaciones también estarán activas después de la instalación! | Les notificacions també estaran actives després de la instal·lació! |
| `enableNotifications` | Bildirimleri Aç | Enable Notifications | Activar Notificaciones | Activar Notificacions |
| `notificationsDesc` | Yeni mesajlar, takas teklifleri ve fırsatlardan anında haberdar ol! | Get instant updates about new messages, swap offers and opportunities! | ¡Recibe actualizaciones instantáneas sobre nuevos mensajes, ofertas de intercambio y oportunidades! | Rep actualitzacions instantànies sobre nous missatges, ofertes d'intercanvi i oportunitats! |
| `enablingNotifications` | Açılıyor... | Enabling... | Activando... | Activant... |

### Satır Konumları

| Key | TR (satır) | EN (satır) | ES (satır) | CA (satır) |
|-----|-----------|-----------|-----------|-----------|
| `notificationsAfterInstall` | 318 | 693 | 1068 | 1443 |
| `enableNotifications` | 319 | 694 | 1069 | 1444 |
| `notificationsDesc` | 320 | 695 | 1070 | 1445 |
| `enablingNotifications` | 321 | 696 | 1071 | 1446 |

---

## ⚠️ Eksik Notification/Push Translation'ları

`lib/push-notifications.ts` dosyasında tanımlanan bildirim türlerine ait translation key'leri **translations.ts'te MEVCUT DEĞİL:**

| Push Notification Type | Açıklama | translations.ts'te var mı? |
|----------------------|----------|--------------------------|
| `NEW_SWAP_REQUEST` | Yeni takas teklifi | ❌ |
| `SWAP_ACCEPTED` | Takas kabul edildi | ❌ |
| `SWAP_REJECTED` | Takas reddedildi | ❌ |
| `SWAP_CANCELLED` | Takas iptal edildi | ❌ |
| `COUNTER_OFFER` | Karşı teklif | ❌ |
| `OFFER_ACCEPTED` | Teklif kabul edildi | ❌ |
| `OFFER_REJECTED` | Teklif reddedildi | ❌ |
| `NEW_MESSAGE` | Yeni mesaj | ❌ |
| `DELIVERY_CONFIRMED` | Teslimat onaylandı | ❌ |
| `MULTI_SWAP_FOUND` | Çoklu takas bulundu | ❌ |

> **Not:** Push notification title/body metinleri şu anda `lib/push-notifications.ts` içinde sabit kodlanmış (hardcoded) olarak sadece **Türkçe** bulunuyor. Çoklu dil desteği için bu metinlerin `translations.ts`'e taşınması veya kullanıcının `language` alanına göre dinamik template seçimi yapılması gerekiyor.

---

## 🔍 Mevcut Translation'ların Kullanım Yeri

Bu 4 key, `components/pwa-provider.tsx` tarafından PWA kurulum banner'ı ve bildirim izni dialojunda kullanılıyor. Push notification **içerik metinleri** için değil, **UI elemanları** (butonlar, açıklamalar) içindir.

---

## 📌 Özet

| Metrik | Değer |
|--------|-------|
| Toplam notification key | **4** |
| Tüm dillerde mevcut | ✅ Evet |
| Push notification içerik metinleri | ❌ translations.ts'te yok |
| Push metinleri nerede? | `lib/push-notifications.ts` (hardcoded TR) |
| Çoklu dil push desteği | ❌ Henüz yok |
