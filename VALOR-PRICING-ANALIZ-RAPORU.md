# 🔍 valor-pricing.ts Detaylı Analiz Raporu

**Dosya:** `lib/valor-pricing.ts` (201 satır)  
**Sorun:** Araç fiyatları çok düşük çıkıyor (4.000V ≈ 29.000₺)  
**Tarih:** 31 Mart 2026

---

## 🚨 TEMEL SORUN: AI'ın TL Tahmini Çok Düşük

### Sorunun Matematiksel İspatı

Formül zincirini tersine çözelim:

```
4.000V sonucu → estimatedTL ne olmalı?

valorKuru = 0.10 × 1.20 × (1 + 0.45 × 0.20) × 1.05
         = 0.10 × 1.20 × 1.09 × 1.05
         = 0.13734

4.000V = estimatedTL × 0.13734 × conditionMult × demandMult × regionMult

En iyi senaryoda (new=1.0, demand=1.10, region=1.0):
4.000 = estimatedTL × 0.13734 × 1.0 × 1.10 × 1.0
4.000 = estimatedTL × 0.15107
estimatedTL = 4.000 / 0.15107 ≈ 26.480₺  ← AI BU FİYATI TAHMİN ETMİŞ!
```

**Yani AI modeli bir arabaya ~26.000-29.000₺ değer biçiyor.** Bu, 2026 Türkiye'sinde tamamen saçma bir rakam.

---

## 📋 Dosya Yapısı Özeti

| Satır | Bölüm | İçerik |
|-------|-------|--------|
| 1-49 | Kategori Uzman Personaları | Her kategori için AI rolü ve referans notu |
| 51-59 | Endeks Sepeti Ağırlıkları | Altın, enflasyon, sektör, kripto, PPP |
| 61-74 | Sektör Endeks Çarpanları | Kategori bazlı çarpanlar |
| 76-85 | Bölgesel Çarpanlar | TR, EU, US, UK, ASIA, LATAM |
| 87-96 | Durum Çarpanları | new, likeNew, good, fair, poor |
| 98-111 | Talep Çarpanları | Kategori bazlı talep çarpanları |
| 113-123 | **BASE_CONFIG** | ⚠️ **SORUNUN KÖK NEDENİ** |
| 125-135 | Bölge Tespiti | Şehir → Bölge eşleştirme |
| 137-192 | **Ana Hesaplama** | calculateValorPrice fonksiyonu |

---

## 🔴 KRİTİK BULGULAR

### 1. "Oto & Moto" İçin Fiyat Referans Aralığı YOK ❌

**Satır 9-12:**
```typescript
'Oto & Moto': {
    role: 'Oto Ekspertiz ve Değerleme Uzmanı',
    referenceNote: 'Sahibinden araç ilanları, km, yıl, hasar kaydı, tramer, 
                    yakıt tipi, vites, marka/model bazlı ikinci el fiyat referans al.'
}
```

**Eksik olan:** Somut fiyat aralıkları! AI modeline şunlar söylenmiyor:
- ❌ Ekonomik araç segment aralığı (ör: 400.000-800.000₺)
- ❌ Orta segment aralığı (ör: 800.000-1.500.000₺)
- ❌ Üst segment aralığı (ör: 1.500.000-3.000.000₺+)
- ❌ Premium/lüks aralığı (ör: 3.000.000₺+)
- ❌ Motosiklet segment aralıkları
- ❌ Yıl bazlı değer kayıp oranları

AI, "Sahibinden referans al" diyor ama **internete erişimi yoksa** ya da **prompt'ta somut rakam yoksa**, kendi bilgi tabanındaki eski/düşük fiyatları kullanıyor.

### 2. `baseValorRate` Çok Düşük ❌

**Satır 119:**
```typescript
baseValorRate: 0.10,     // 1V ≈ 10TL baz
```

Bu 0.10 çarpanı, tüm fiyatları **10'a bölerek** başlıyor. Yani 500.000₺'lik bir araç:
```
500.000 × 0.10 = 50.000 (baz)
× 1.20 (sektör) × 1.09 (enflasyon) × 1.05 (kripto) = ~68.670V
```

Bu rakam **mantıklı görünüyor** AMA sadece `estimatedTL` doğru gelirse! Sorun `estimatedTL`'in AI tarafından çok düşük tahmin edilmesi.

### 3. `displayRate` ve `baseValorRate` Çelişkisi ⚠️

**Satır 119-120:**
```typescript
baseValorRate: 0.10,     // 1V ≈ 10TL baz
displayRate: 10,         // Gösterim: 1V = 10TL
```

- `baseValorRate = 0.10` → TL'yi Valor'a çevirirken 10'a bölüyor
- `displayRate = 10` → Valor'u TL'ye gösterirken 10'la çarpıyor
- Bu ikisi birbirini **götürmeli** ama sektör/enflasyon/kripto çarpanları devreye girince denge bozuluyor.

### 4. Hiçbir Kategoride Somut Fiyat Referansı Yok ❌

Tüm `referenceNote`'lar sadece **genel kaynak isimleri** veriyor:
- Gayrimenkul: "m² fiyatları" → ama rakam yok
- Oto & Moto: "Sahibinden araç ilanları" → ama aralık yok
- Elektronik: "Hepsiburada, Trendyol" → ama fiyat yok

---

## 📊 SENARYO SİMÜLASYONU

### Mevcut Durum (AI 29.000₺ tahmin ederse)

```
Araç: 2020 VW Golf 1.5 TSI - 60.000km
AI Tahmini: 29.000₺ (YANLIŞ!)

valorKuru = 0.10 × 1.20 × 1.09 × 1.05 = 0.13734
baseValor = 29.000 × 0.13734 = 3.983
× conditionMult (good=0.70) = 2.788
× demandMult (1.10) = 3.067
× regionMult (1.0) = 3.067

Sonuç: 3.070V ≈ 30.700₺  ← SORUNLU
Gerçek piyasa: ~1.200.000₺
```

### Olması Gereken (AI 1.200.000₺ tahmin ederse)

```
Araç: 2020 VW Golf 1.5 TSI - 60.000km
AI Tahmini: 1.200.000₺ (DOĞRU)

valorKuru = 0.13734
baseValor = 1.200.000 × 0.13734 = 164.808
× conditionMult (good=0.70) = 115.366
× demandMult (1.10) = 126.902
× regionMult (1.0) = 126.902

Sonuç: 126.900V ≈ 1.269.000₺  ← MANTIKLI
```

---

## ✅ ÖNERİLEN DÜZELTMELER

### Düzeltme 1: Oto & Moto referenceNote'a Fiyat Aralıkları Ekle

```typescript
'Oto & Moto': {
    role: 'Oto Ekspertiz ve Değerleme Uzmanı',
    referenceNote: `Sahibinden araç ilanları, km, yıl, hasar kaydı, tramer, yakıt tipi, vites, 
      marka/model bazlı ikinci el fiyat referans al. 
      
      2026 TÜRKİYE ARAÇ FİYAT REHBERİ (İKİNCİ EL):
      - Ekonomik segment (Clio, i20, Egea): 500.000₺ - 900.000₺
      - Orta segment (Golf, Corolla, Civic): 800.000₺ - 1.500.000₺  
      - Üst segment (Passat, Camry, 3 Serisi): 1.200.000₺ - 2.500.000₺
      - Premium (Mercedes C/E, BMW 5, Audi A6): 2.000.000₺ - 5.000.000₺
      - Lüks/Spor (Porsche, AMG, M serisi): 4.000.000₺ - 15.000.000₺+
      - SUV Ekonomik (Duster, ASX): 700.000₺ - 1.200.000₺
      - SUV Orta (Tucson, RAV4, Tiguan): 1.200.000₺ - 2.200.000₺
      - SUV Premium (X5, GLE, Q7): 3.000.000₺ - 8.000.000₺
      - Motosiklet (125-250cc): 80.000₺ - 250.000₺
      - Motosiklet (300-600cc): 200.000₺ - 500.000₺
      - Motosiklet (600cc+): 400.000₺ - 2.000.000₺
      
      YIL BAZLI DEĞER KAYBI: 
      Her yıl için %8-12 değer kaybı uygula. 0-1 yaş: %15-20, 1-3 yaş: %10-15/yıl, 3-5 yaş: %8-12/yıl
      
      KRİTİK: Türkiye 2026 fiyatları ile değerle. Asla 100.000₺ altında araç fiyatı verme (hurda hariç).`
  }
```

### Düzeltme 2: Tüm Kategorilere Fiyat Aralıkları Ekle

Benzer şekilde diğer kategorilere de somut TL referansları eklenmeli:
- **Gayrimenkul**: İstanbul m²=50.000-150.000₺, Ankara=25.000-80.000₺ vb.
- **Elektronik**: iPhone=50.000-90.000₺, Laptop=20.000-100.000₺ vb.
- **Beyaz Eşya**: Buzdolabı=15.000-60.000₺, Çamaşır=12.000-45.000₺ vb.

### Düzeltme 3: AI Prompt'una Minimum Fiyat Guardrail'i Ekle

`estimatedTL` değerini kontrol eden bir validation:
```typescript
// Kategori bazlı minimum TL değerleri
const CATEGORY_MIN_TL: Record<string, number> = {
  'Oto & Moto': 50000,       // Araç en az 50.000₺
  'Gayrimenkul': 500000,     // Gayrimenkul en az 500.000₺
  'Tekne & Denizcilik': 100000,
  'Elektronik': 500,
  'Beyaz Esya': 1000,
  'default': 100
}
```

---

## 🎯 ÖZET

| Kontrol | Durum | Açıklama |
|---------|-------|----------|
| AI prompt'unda araç fiyat referans aralıkları | ❌ YOK | Sadece "Sahibinden referans al" yazıyor |
| "Ekonomik araç: 200.000-500.000₺" tanımı | ❌ YOK | Hiçbir fiyat aralığı yok |
| Oto & Moto için özel fiyat rehberi | ❌ YOK | Genel referans notu var, rakam yok |
| Minimum TL guardrail kontrolü | ❌ YOK | AI istediği kadar düşük fiyat verebilir |
| baseValorRate mantığı | ⚠️ KISMEN | Formül doğru ama AI girdisi yanlış olunca çöküyor |
| Hesaplama formülü | ✅ DOĞRU | Matematiksel olarak formül sağlam |

**Kök Neden:** `valor-pricing.ts` dosyası AI'a somut fiyat referansları vermiyor. AI modeli güncel Türkiye piyasasını bilmediği için çok düşük TL tahminleri yapıyor ve tüm çarpan sistemi bu düşük baz üzerinden çalışıyor.
