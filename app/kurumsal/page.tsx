'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Utensils, GraduationCap, Shirt, ArrowRight, ArrowLeftRight, Check, Sparkles, Users, TrendingUp, HandshakeIcon, Zap, Crown, Star, Gem, ChevronRight, BadgeCheck, Shield, Gift, Calculator, Hotel, Car, Hammer, Monitor } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

// Kurumsal Paketler - Abonelik + Takas Komisyonu Modeli
const corporatePackages = [
  {
    id: 'starter',
    name: 'Başlangıç',
    icon: Star,
    color: 'from-blue-500 to-cyan-500',
    monthlyFee: 299,
    valorBonus: 25,
    transactionFee: 5, // %5 Valor kesintisi (takas değeri üzerinden)
    features: [
      'Aylık 25 Valor bonus',
      '10 ürün/hizmet listeleme',
      'Temel istatistikler',
      'E-posta desteği',
      'Standart eşleştirme'
    ],
    recommended: false
  },
  {
    id: 'professional',
    name: 'Profesyonel',
    icon: Crown,
    color: 'from-purple-500 to-pink-500',
    monthlyFee: 599,
    valorBonus: 50,
    transactionFee: 3, // %3 Valor kesintisi
    features: [
      'Aylık 50 Valor bonus',
      '50 ürün/hizmet listeleme',
      'Detaylı analitik dashboard',
      'Öncelikli destek',
      'Akıllı eşleştirme algoritması',
      'Kurumsal profil rozeti'
    ],
    recommended: true
  },
  {
    id: 'enterprise',
    name: 'Kurumsal',
    icon: Gem,
    color: 'from-amber-500 to-orange-500',
    monthlyFee: 1299,
    valorBonus: 75,
    transactionFee: 1.5, // %1.5 Valor kesintisi (en düşük oran)
    features: [
      'Aylık 75 Valor bonus',
      'Sınırsız listeleme',
      'Özel hesap yöneticisi',
      'VIP eşleştirme önceliği',
      'API entegrasyonu',
      'Özel kampanya araçları',
      'Çoklu şube yönetimi'
    ],
    recommended: false
  }
]

const benefits = [
  {
    icon: TrendingUp,
    title: 'Nakit Akışını Koruyun',
    description: 'Para harcamadan ihtiyaçlarınızı karşılayın, nakitinizi stratejik yatırımlara ayırın.'
  },
  {
    icon: Users,
    title: 'Yerel Ağınızı Genişletin',
    description: 'Çevrenizdeki işletmelerle tanışın, karşılıklı fayda sağlayan ortaklıklar kurun.'
  },
  {
    icon: HandshakeIcon,
    title: 'Güven Temelli İlişkiler',
    description: 'TAKAS-A\'nın güvenlik sistemi ile her takas güvence altında.'
  },
  {
    icon: Zap,
    title: 'Atıl Kapasite Değerlendirin',
    description: 'Kullanılmayan stok, boş randevular veya fazla üretimi değere dönüştürün.'
  }
]

// Valor Hesaplayıcı - Komisyon dahil
function ValorCalculator() {
  const [monthlyTrades, setMonthlyTrades] = useState(5)
  const [avgTradeValue, setAvgTradeValue] = useState(500)
  const [selectedPackage, setSelectedPackage] = useState(1) // Profesyonel varsayılan
  
  const pkg = corporatePackages[selectedPackage]
  const grossMonthlyValor = monthlyTrades * avgTradeValue
  const monthlyCommission = (grossMonthlyValor * pkg.transactionFee) / 100
  const netMonthlyValor = grossMonthlyValor - monthlyCommission + pkg.valorBonus
  const effectiveRate = 0.85
  const annualNetSavings = netMonthlyValor * 12 * effectiveRate
  const annualSubscription = pkg.monthlyFee * 12
  const netAnnualBenefit = annualNetSavings - annualSubscription
  
  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
      <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Calculator className="w-5 h-5 text-purple-500" />
        Maliyet &amp; Kazanç Hesaplayıcı
      </h4>
      
      <div className="space-y-4">
        {/* Paket Seçimi */}
        <div>
          <label className="text-sm text-gray-600 mb-2 block">Paket Seçin:</label>
          <div className="grid grid-cols-3 gap-2">
            {corporatePackages.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => setSelectedPackage(idx)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  selectedPackage === idx
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Aylık Takas Sayısı: {monthlyTrades}</label>
          <input
            type="range"
            min="1"
            max="30"
            value={monthlyTrades}
            onChange={(e) => setMonthlyTrades(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>
        
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Ortalama Takas Değeri: {avgTradeValue} Valor</label>
          <input
            type="range"
            min="100"
            max="3000"
            step="100"
            value={avgTradeValue}
            onChange={(e) => setAvgTradeValue(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>
        
        {/* Detaylı Hesaplama */}
        <div className="pt-4 border-t border-gray-100 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Brüt Aylık Valor:</span>
            <span className="font-medium">{grossMonthlyValor.toLocaleString()} V</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Komisyon (%{pkg.transactionFee}):</span>
            <span className="font-medium text-amber-600">-{Math.round(monthlyCommission).toLocaleString()} V</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Aylık Valor Bonus:</span>
            <span className="font-medium text-green-600">+{pkg.valorBonus.toLocaleString()} V</span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t pt-2">
            <span className="text-gray-800">Net Aylık Valor:</span>
            <span className="text-purple-600">{Math.round(netMonthlyValor).toLocaleString()} V</span>
          </div>
        </div>
        
        {/* Sonuç */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-purple-600">₺{Math.round(annualNetSavings).toLocaleString()}</p>
            <p className="text-xs text-gray-600">Yıllık Takas Değeri</p>
          </div>
          <div className={`rounded-xl p-3 text-center ${netAnnualBenefit > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-xl font-bold ${netAnnualBenefit > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {netAnnualBenefit > 0 ? '+' : ''}₺{Math.round(netAnnualBenefit).toLocaleString()}
            </p>
            <p className="text-xs text-gray-600">Net Yıllık Fayda</p>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 text-center pt-2">
          * Yıllık abonelik (₺{annualSubscription.toLocaleString()}) düşüldükten sonra
        </p>
      </div>
    </div>
  )
}

export default function KurumsalPage() {
  const [activeScenario, setActiveScenario] = useState(0)
  
  const scenarios = [
    {
      id: 'klima-yemek',
      title: '🏢 Klima ↔ Yemek',
      leftBusiness: {
        name: 'Samsung Klima Bayii',
        owner: 'Mehmet Bey',
        location: 'Bornova',
        icon: Building2,
        bgColor: 'bg-blue-50',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        product: '2 Adet Klima',
        productDetail: 'Samsung AR12 Inverter',
        valor: 1600,
        image: 'https://i.ytimg.com/vi/pCGmF-K6yZk/maxresdefault.jpg',
        benefit: 'Çalışanlarına 3 ay boyunca ücretsiz öğle yemeği sağladı. Motivasyon arttı, nakit harcaması sıfır!'
      },
      rightBusiness: {
        name: 'Burger House',
        owner: 'Ayşe Hanım',
        location: 'Alsancak',
        icon: Utensils,
        bgColor: 'bg-orange-50',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600',
        product: '3 Ay Öğle Yemeği',
        productDetail: '60 kişi × günlük menü',
        valor: 1600,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
        benefit: 'Restoranına 2 yeni klima aldı, yaz aylarında müşteri memnuniyeti tavan yaptı!'
      }
    },
    {
      id: 'egitim-giyim',
      title: '📚 Eğitim ↔ Moda',
      leftBusiness: {
        name: 'Özel Ders',
        owner: 'Gizem Hoca',
        location: 'Konak',
        icon: GraduationCap,
        bgColor: 'bg-green-50',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        product: '1 Dönem Biyoloji Dersi',
        productDetail: 'Haftada 2 saat, 4 ay',
        valor: 800,
        image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400',
        benefit: 'Yeni sezon kıyafetleri ile dolabını yeniledi, boş zamanlarını değerlendirdi!'
      },
      rightBusiness: {
        name: 'Moda Butik',
        owner: 'Canan Hanım',
        location: 'Konak',
        icon: Shirt,
        bgColor: 'bg-purple-50',
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600',
        product: 'Sezon Sonu Koleksiyonu',
        productDetail: '5 parça kıyafet seti',
        valor: 800,
        image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400',
        benefit: 'Oğlu Efe\'nin biyoloji notu 45\'ten 85\'e çıktı, üniversite hayali yaklaştı!'
      }
    },
    {
      id: 'otel-marangoz',
      title: '🏨 Otel ↔ Marangoz',
      leftBusiness: {
        name: 'Urla Butik Otel',
        owner: 'Serkan Bey',
        location: 'Urla',
        icon: Hotel,
        bgColor: 'bg-cyan-50',
        iconBg: 'bg-cyan-100',
        iconColor: 'text-cyan-600',
        product: '1 Hafta Tam Pansiyon',
        productDetail: '2 kişi, deniz manzaralı oda',
        valor: 4500,
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
        benefit: 'Otelin tüm ahşap mobilyaları yenilendi, misafir memnuniyeti %40 arttı!'
      },
      rightBusiness: {
        name: 'Usta Marangoz',
        owner: 'İbrahim Usta',
        location: 'Urla',
        icon: Hammer,
        bgColor: 'bg-amber-50',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        product: 'Komple Marangozluk',
        productDetail: 'Resepsiyon, 8 oda mobilya tamiri',
        valor: 4500,
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
        benefit: 'Ailesiyle birlikte 1 hafta tatil yaptı, hem dinlendi hem işini tanıttı!'
      }
    },
    {
      id: 'galeri-it',
      title: '🚗 Oto Galeri ↔ IT',
      leftBusiness: {
        name: 'Aliağa Oto Center',
        owner: 'Kemal Bey',
        location: 'Aliağa',
        icon: Car,
        bgColor: 'bg-red-50',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        product: '2. El Otomobil',
        productDetail: '2019 model, 45.000 km sedan',
        valor: 12000,
        image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400',
        benefit: '3 yıl boyunca profesyonel IT desteği aldı, web sitesi ve otomasyon sistemleri kuruldu!'
      },
      rightBusiness: {
        name: 'Dijital Çözümler',
        owner: 'Burak Bey',
        location: 'Aliağa',
        icon: Monitor,
        bgColor: 'bg-indigo-50',
        iconBg: 'bg-indigo-100',
        iconColor: 'text-indigo-600',
        product: '3 Yıllık IT Hizmeti',
        productDetail: 'Web, yazılım, teknik destek',
        valor: 12000,
        image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400',
        benefit: 'Güzel bir araba sahibi oldu, iş toplantılarına rahatlıkla gidebiliyor!'
      }
    }
  ]
  
  const currentScenario = scenarios[activeScenario]
  
  return (
    <div className="pt-20">
      {/* Hero - Animated Background */}
      <section className="py-24 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
        {/* Animated Particles */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full filter blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/30 rounded-full filter blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-pink-500/20 rounded-full filter blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
        
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/30 text-white text-sm mb-8 backdrop-blur-sm"
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
              İşletmeler için Yeni Nesil Takas Ekonomisi
            </motion.div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-8 leading-tight">
              <span className="block">Nakitsiz Ticaretin</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
                Geleceği Burada
              </span>
            </h1>
            
            <p className="text-xl text-white/80 max-w-3xl mx-auto mb-10">
              Ürünlerinizi ve hizmetlerinizi diğer işletmelerle takas edin.
              <span className="text-white font-semibold"> Para akmaz, değer akar.</span>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="#pricing"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all shadow-xl shadow-purple-500/25"
              >
                Paketleri İncele
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/iletisim"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-lg font-semibold bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20 backdrop-blur-sm"
              >
                Demo Talep Edin
              </Link>
            </div>
          </motion.div>
          
          {/* Stats */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto"
          >
            {[
              { value: '150+', label: 'Kurumsal Üye' },
              { value: '₺2.5M', label: 'Takas Hacmi' },
              { value: '%94', label: 'Memnuniyet' }
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ HİZMET TAKASI BÖLÜMÜ ═══ */}
      <section className="py-20 bg-gradient-to-b from-white to-green-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-bold mb-4">
              🆕 Yeni Özellik
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Hizmet Karşılığı <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600">Takas</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Yetkinliğinizi listeleyin, karşılığında ihtiyacınız olan ürünleri alın.
              Para harcamadan, emeğinizle takas yapın!
            </p>
          </div>

          {/* Örnek Kartlar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: '🧹',
                title: 'Ev Temizliği',
                person: 'Ayşe H.',
                offer: '8 saatlik temizlik',
                want: 'Mutfak tüpü veya küçük ev aleti',
                valor: 120,
                color: 'from-blue-500 to-cyan-500',
              },
              {
                icon: '⚡',
                title: 'Elektrik Tesisatı',
                person: 'Mehmet K.',
                offer: '1 günlük elektrik işi',
                want: 'Çamaşır makinesi veya buzdolabı',
                valor: 250,
                color: 'from-yellow-500 to-orange-500',
              },
              {
                icon: '👨‍🏫',
                title: 'Özel Ders',
                person: 'Prof. Zeynep A.',
                offer: '20 saat matematik dersi',
                want: 'Laptop veya tablet',
                valor: 400,
                color: 'from-purple-500 to-pink-500',
              },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className={`bg-gradient-to-r ${item.color} p-4 text-white`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <h3 className="font-bold text-lg">{item.title}</h3>
                      <p className="text-sm opacity-90">{item.person}</p>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 font-medium mb-1">VERİYORUM</p>
                    <p className="text-sm font-semibold text-gray-800">✅ {item.offer}</p>
                  </div>
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 font-medium mb-1">KARŞILIĞINDA İSTİYORUM</p>
                    <p className="text-sm font-semibold text-gray-800">🎯 {item.want}</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t">
                    <span className="text-sm font-bold text-purple-600">{item.valor} Valor değerinde</span>
                    <Link href="/hizmet-takasi" className="text-sm font-bold text-green-600 hover:underline">
                      Teklif Ver →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Hizmet Kategorileri */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">
              Hangi Hizmetleri Takas Edebilirsiniz?
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { icon: '🧹', name: 'Temizlik', count: 'Ev, ofis, araç' },
                { icon: '⚡', name: 'Elektrik', count: 'Tesisat, tamir' },
                { icon: '🔧', name: 'Tadilat', count: 'Boya, tamirat' },
                { icon: '💇', name: 'Güzellik', count: 'Kuaför, bakım' },
                { icon: '👨‍🏫', name: 'Eğitim', count: 'Özel ders, kurs' },
                { icon: '🍳', name: 'Yemek', count: 'Catering, aşçılık' },
                { icon: '🚚', name: 'Taşımacılık', count: 'Nakliyat, kurye' },
                { icon: '💻', name: 'Dijital', count: 'Web, tasarım' },
                { icon: '📸', name: 'Fotoğraf', count: 'Çekim, düzenleme' },
                { icon: '🛠️', name: 'Diğer', count: 'Tüm hizmetler' },
              ].map((cat, i) => (
                <div key={i} className="text-center p-4 bg-gray-50 rounded-xl hover:bg-green-50 transition-colors cursor-pointer">
                  <span className="text-2xl">{cat.icon}</span>
                  <p className="font-semibold text-sm text-gray-800 mt-2">{cat.name}</p>
                  <p className="text-xs text-gray-500">{cat.count}</p>
                </div>
              ))}
            </div>
            
            <div className="text-center mt-8">
              <Link
                href="/hizmet-takasi"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-lg"
              >
                🤝 Hizmetimi Listele
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Scenarios */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Gerçek Hayattan <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">Başarı Hikayeleri</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              İzmir'deki işletmeler nasıl takas yapıyor? Gerçek örneklere göz atın.
            </p>
          </motion.div>

          {/* Scenario Tabs */}
          <div className="flex justify-center gap-4 mb-8">
            {scenarios.map((scenario, index) => (
              <button
                key={scenario.id}
                onClick={() => setActiveScenario(index)}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  activeScenario === index
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {scenario.title}
              </button>
            ))}
          </div>

          {/* Scenario Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScenario.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
            >
              <div className="p-8 md:p-12">
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  {/* Left Business */}
                  <div className="flex-1 w-full">
                    <div className={`${currentScenario.leftBusiness.bgColor} rounded-2xl p-6 border border-gray-100`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-16 h-16 rounded-xl ${currentScenario.leftBusiness.iconBg} flex items-center justify-center`}>
                          <currentScenario.leftBusiness.icon className={`w-8 h-8 ${currentScenario.leftBusiness.iconColor}`} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{currentScenario.leftBusiness.name}</h3>
                          <p className="text-gray-500">{currentScenario.leftBusiness.owner} • {currentScenario.leftBusiness.location}</p>
                        </div>
                      </div>
                      <div className="aspect-video relative rounded-xl overflow-hidden mb-4 bg-gray-100">
                        <Image
                          src={currentScenario.leftBusiness.image}
                          alt={currentScenario.leftBusiness.product}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">{currentScenario.leftBusiness.product}</p>
                          <p className="text-sm text-gray-500">{currentScenario.leftBusiness.productDetail}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-purple-600">{currentScenario.leftBusiness.valor}</p>
                          <p className="text-xs text-gray-400">Valor</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Exchange Icon */}
                  <div className="flex flex-col items-center gap-3 py-4">
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                      className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center shadow-xl"
                    >
                      <ArrowLeftRight className="w-10 h-10 text-white" />
                    </motion.div>
                    <p className="text-sm font-bold text-gray-900">TAKAS</p>
                  </div>

                  {/* Right Business */}
                  <div className="flex-1 w-full">
                    <div className={`${currentScenario.rightBusiness.bgColor} rounded-2xl p-6 border border-gray-100`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-16 h-16 rounded-xl ${currentScenario.rightBusiness.iconBg} flex items-center justify-center`}>
                          <currentScenario.rightBusiness.icon className={`w-8 h-8 ${currentScenario.rightBusiness.iconColor}`} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{currentScenario.rightBusiness.name}</h3>
                          <p className="text-gray-500">{currentScenario.rightBusiness.owner} • {currentScenario.rightBusiness.location}</p>
                        </div>
                      </div>
                      <div className="aspect-video relative rounded-xl overflow-hidden mb-4 bg-gray-100">
                        <Image
                          src={currentScenario.rightBusiness.image}
                          alt={currentScenario.rightBusiness.product}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">{currentScenario.rightBusiness.product}</p>
                          <p className="text-sm text-gray-500">{currentScenario.rightBusiness.productDetail}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-purple-600">{currentScenario.rightBusiness.valor}</p>
                          <p className="text-xs text-gray-400">Valor</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50 p-6 md:p-8 border-t border-gray-100">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{currentScenario.leftBusiness.owner} Kazandı:</h4>
                      <p className="text-gray-600 text-sm">{currentScenario.leftBusiness.benefit}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{currentScenario.rightBusiness.owner} Kazandı:</h4>
                      <p className="text-gray-600 text-sm">{currentScenario.rightBusiness.benefit}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Kurumsal Takas'ın <span className="text-gradient-frozen">Avantajları</span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-50 rounded-2xl p-6 hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className="w-14 h-14 rounded-xl gradient-frozen flex items-center justify-center mb-4">
                  <benefit.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-gray-600 text-sm">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              İşletmeniz için <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">Doğru Paketi</span> Seçin
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-4">
              Sabit aylık ücret + takas başına değere göre komisyon modeli ile adil ve şeffaf fiyatlandırma.
            </p>
            <div className="inline-flex items-center gap-3 px-5 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
              <span className="text-amber-600 font-medium">💡 Komisyon Modeli:</span>
              <span className="text-gray-600">Her tamamlanan takasta, işlem değeri üzerinden paket oranında Valor kesintisi uygulanır.</span>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {corporatePackages.map((pkg, index) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative bg-white rounded-3xl p-8 border-2 transition-all hover:shadow-xl ${
                  pkg.recommended ? 'border-purple-500 shadow-xl' : 'border-gray-100'
                }`}
              >
                {pkg.recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-full">
                    En Popüler
                  </div>
                )}
                
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${pkg.color} flex items-center justify-center mb-6`}>
                  <pkg.icon className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-gray-900">₺{pkg.monthlyFee}</span>
                  <span className="text-gray-500">/ay</span>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 rounded-full text-purple-700 text-sm font-medium">
                    <Gift className="w-4 h-4" />
                    +{pkg.valorBonus} Valor/ay
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 rounded-full text-amber-700 text-sm font-medium">
                    %{pkg.transactionFee} komisyon
                  </div>
                </div>
                
                <ul className="space-y-3 mb-8">
                  {pkg.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link
                  href="/iletisim"
                  className={`block w-full py-3 rounded-xl text-center font-semibold transition-all ${
                    pkg.recommended
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Başvuru Yap
                </Link>
              </motion.div>
            ))}
          </div>
          
          {/* Value Calculator */}
          <div className="mt-16 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Ne Kadar Tasarruf Edersiniz?</h3>
              <p className="text-gray-600 mb-6">
                Aylık takas sayınıza ve ortalama değerine göre yıllık tasarrufunuzu hesaplayın.
                Kurumsal üyelik ile aldığınız Valor bonus'u da değerlendirmeyi unutmayın!
              </p>
              <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-xl">
                <BadgeCheck className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="font-semibold text-gray-900">ROI Garantisi</p>
                  <p className="text-sm text-gray-600">İlk 3 ayda memnun kalmazsanız, ücret iadesi.</p>
                </div>
              </div>
            </div>
            <ValorCalculator />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-purple-900 to-indigo-900">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Sparkles className="w-12 h-12 text-yellow-400 mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              İşletmenizi TAKAS-A Ailesine Katın
            </h2>
            <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
              Para olmadan herkes kazanır. Yerel ekonomiye katkıda bulunun,
              sürdürülebilir bir iş modeli ile büyüyün.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/iletisim"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold bg-white text-purple-900 hover:bg-purple-50 transition-all shadow-lg"
              >
                Hemen Başvurun
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="tel:+902323456789"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20"
              >
                0232 345 67 89
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
