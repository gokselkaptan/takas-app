# 🌐 TAKAS-A Çeviri Sistemi Analiz Raporu

**Tarih:** 3 Nisan 2026  
**Durum:** Sadece analiz — dosya değişikliği yapılmadı

---

## 1. Çeviri Sistemi Mimarisi

### Genel Yapı
Proje, **custom React Context** tabanlı bir çeviri sistemi kullanıyor (i18next veya next-intl gibi harici kütüphane **YOK**).

### Temel Dosyalar

| Dosya | Rol |
|-------|-----|
| `lib/translations.ts` | Tüm çeviri key-value çiftleri (1356 satır) |
| `lib/language-context.tsx` | LanguageProvider, useLanguage hook, t() fonksiyonu |
| `components/language-prompt.tsx` | İlk ziyarette dil seçimi modal'ı |
| `components/providers.tsx` | LanguageProvider'ın app'e sarıldığı yer |

### Nasıl Çalışıyor?

1. **`LanguageProvider`** → `components/providers.tsx` içinde tüm uygulamayı sarıyor
2. **`useLanguage()`** hook'u → `{ language, setLanguage, t }` döndürür
3. **`t('key')`** fonksiyonu → `translations[language][key]` döndürür, fallback: `translations.tr[key]`
4. **Dil tespiti:** Tarayıcı dilinden otomatik tespit, Türkçe değilse kullanıcıya modal gösterir
5. **Tercih kaydı:** `localStorage` ile saklanır (`language` ve `language-prompted` key'leri)

### Kullanım Örnekleri (kodda)

```tsx
// Standart kullanım (merkezi çeviriler)
const { t, language } = useLanguage()
<h1>{t('heroTitle')}</h1>

// Inline dil kontrolü
{language === 'tr' ? 'Türkçe metin' : 'English text'}

// Lokal çeviri objesi (app/profil/page.tsx'deki NEMOS paneli gibi)
const nemosT = { tr: {...}, en: {...}, es: {...}, ca: {...} }
const nt = (key) => nemosT[language]?.[key] || nemosT['tr'][key]
```

---

## 2. Desteklenen Diller

| Kod | Dil | Bayrak (emoji) | Bayrak (SVG) | Çeviri Key Sayısı |
|-----|-----|----------------|--------------|-------------------|
| `tr` | Türkçe | 🇹🇷 | `/images/flags/tr.svg` ✅ Mevcut | ~279 key |
| `en` | English | 🇬🇧 | `/images/flags/gb.svg` ✅ Mevcut | ~279 key |
| `es` | Español | 🇪🇸 | `/images/flags/es.svg` ❌ **EKSİK** | ~279 key |
| `ca` | Català | 🏴 | `/images/flags/ca.svg` ❌ **EKSİK** | ~278 key (1 eksik) |

### ⚠️ Eksikler
- **`public/images/flags/es.svg`** dosyası yok → İspanyolca bayrak görünmez
- **`public/images/flags/ca.svg`** dosyası yok → Katalanca bayrak görünmez
- **Katalanca** 1 çeviri key'i eksik (278 vs 279)

---

## 3. Dil Seçici (Language Switcher)

### 3 farklı yerde dil seçici var:

#### a) Header (Desktop) — `components/header.tsx`
- SVG bayrak görselleri kullanıyor (`/images/flags/{code}.svg`)
- Dropdown menü ile 4 dil seçeneği
- `languageFlags` Record objesi ile bayrak mapping'i

#### b) Mobile Navigation — `components/mobile-navigation.tsx`
- Aynı SVG bayrak sistemi
- Alt navigasyon barında bayrak ikonu
- Dokunarak açılan dil seçici panel

#### c) Language Prompt (Modal) — `components/language-prompt.tsx`
- İlk ziyarette otomatik açılır (tarayıcı dili TR değilse)
- Emoji bayraklar kullanıyor (🇹🇷 🇬🇧 🇪🇸 🏴)
- Globe ikonu ile başlık
- "Sonra seçerim / Decide later" seçeneği

---

## 4. Bayrak Gösterimi

### İki farklı bayrak sistemi var:

| Sistem | Kullanıldığı Yer | Format |
|--------|-------------------|--------|
| **SVG dosyaları** | Header, Mobile Navigation | `/images/flags/tr.svg`, `gb.svg` |
| **Emoji** | Language Prompt, Footer, Testimonials, Hero | 🇹🇷 🇬🇧 🇪🇸 🏴 |

### SVG Bayrak Dosyaları Durumu:
```
public/images/flags/
├── tr.svg  ✅
├── gb.svg  ✅
├── es.svg  ❌ EKSIK
└── ca.svg  ❌ EKSIK
```

---

## 5. Çeviri Kullanım Yaygınlığı

- **76 dosyada** `useLanguage` hook'u import edilmiş
- Ana kullanım alanları:
  - Header, Footer, Mobile Navigation
  - Home page bileşenleri (hero, stats, testimonials, live-activity-feed)
  - Profil sayfası
  - User rating, review modal
  - Follow button
  - Products showcase

### Çeviri Yöntemleri (kodda 3 farklı pattern):

1. **`t('key')`** — Merkezi çeviri sistemi (en yaygın)
2. **`language === 'tr' ? ... : ...`** — Inline ternary (profil sayfası vb.)
3. **Lokal çeviri objesi** — Component-seviyesi çeviriler (NEMOS paneli gibi)

---

## 6. Özet ve Öneriler

### ✅ İyi Çalışan
- Context tabanlı çeviri sistemi temiz ve iyi yapılandırılmış
- 4 dil desteği (TR, EN, ES, CA) çeviri dosyasında tanımlı
- Tarayıcı dili otomatik tespiti
- localStorage ile tercih kaydı
- Fallback mekanizması (bulunamayan key → TR)

### ⚠️ Sorunlar
1. **Eksik SVG bayraklar:** `es.svg` ve `ca.svg` dosyaları public/images/flags/ klasöründe yok
2. **Katalanca 1 key eksik:** CA'da 278 key var, diğerlerinde 279
3. **Tutarsız çeviri patternleri:** Bazı yerlerde `t()`, bazı yerlerde inline ternary
4. **Lokal çeviriler:** Bazı component'lerde merkezi sistem yerine lokal çeviri objeleri var
5. **İkili bayrak sistemi:** Hem SVG hem emoji kullanımı tutarsızlık yaratıyor
