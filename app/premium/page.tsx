'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Crown, Check } from 'lucide-react'

export default function PremiumPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly')

  const features = [
    { icon: '📦', title: 'Sınırsız Ürün', free: 'Günde 3', premium: 'Sınırsız' },
    { icon: '🔄', title: 'Takas Teklifi', free: 'Günde 5', premium: 'Sınırsız' },
    { icon: '🚀', title: 'Öne Çıkar', free: 'Yok', premium: 'Ayda 3 Bedava' },
    { icon: '⚡', title: 'Eşleşme Önceliği', free: 'Normal', premium: '+%10 Ağırlık' },
    { icon: '📊', title: 'Valor Analizi', free: 'Temel', premium: 'Detaylı Endeks Bilgisi' },
    { icon: '🏆', title: 'Aktif Boost', free: 'Max 2', premium: 'Max 5' },
    { icon: '✅', title: 'Güvenilir Rozeti', free: 'Trust 80+ gerekli', premium: 'Otomatik' },
    { icon: '🎯', title: 'AI Öneriler', free: 'Temel', premium: 'Gelişmiş + Neden Açıklaması' },
    { icon: '💰', title: 'Aylık Bonus Tavanı', free: 'Seviyeye göre', premium: '+%50 Artırılmış' },
    { icon: '📱', title: 'Öncelikli Destek', free: 'Yok', premium: 'E-posta ile hızlı destek' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-gray-900 to-gray-900 py-16">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-full text-purple-300 text-sm mb-4">
            <Crown className="w-4 h-4" />
            Premium Üyelik
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Takas Deneyimini<br />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Üst Seviyeye Taşı
            </span>
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            Sınırsız ürün, öncelikli eşleşme, bedava boost ve daha fazlası.
          </p>
        </div>

        {/* Plan Seçimi */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setSelectedPlan('monthly')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              selectedPlan === 'monthly' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Aylık — 99 ₺
          </button>
          <button
            onClick={() => setSelectedPlan('yearly')}
            className={`px-6 py-3 rounded-xl font-bold transition-all relative ${
              selectedPlan === 'yearly' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Yıllık — 799 ₺
            <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full">
              %33 İndirim
            </span>
          </button>
        </div>

        {/* Özellik Tablosu */}
        <div className="bg-gray-800/50 rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-3 gap-4 mb-4 text-sm font-bold text-gray-400">
            <span>Özellik</span>
            <span className="text-center">Ücretsiz</span>
            <span className="text-center text-purple-400">Premium 👑</span>
          </div>
          {features.map((f, i) => (
            <div key={i} className="grid grid-cols-3 gap-4 py-3 border-t border-gray-700 text-sm">
              <span className="text-white flex items-center gap-2">
                <span>{f.icon}</span> {f.title}
              </span>
              <span className="text-center text-gray-500">{f.free}</span>
              <span className="text-center text-purple-300 font-medium flex items-center justify-center gap-1">
                <Check className="w-4 h-4 text-green-400" />
                {f.premium}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => {
              if (!session) {
                router.push('/giris')
                return
              }
              // Şimdilik bilgilendirme — ödeme entegrasyonu sonra
              alert('Premium üyelik yakında aktif olacak! Şu an erken erişim için bizi takip edin.')
            }}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/30 transition-all"
          >
            Premium&apos;a Geç — {selectedPlan === 'monthly' ? '99 ₺/ay' : '799 ₺/yıl'} →
          </button>
          <p className="text-gray-500 text-sm mt-3">İstediğin zaman iptal et. İlk 7 gün ücretsiz dene.</p>
        </div>

        {/* SSS */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Sık Sorulan Sorular</h2>
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h3 className="font-bold text-white mb-2">Premium üyelik nasıl iptal edilir?</h3>
              <p className="text-gray-400 text-sm">İstediğiniz zaman Profil → Ayarlar → Premium Üyelik bölümünden iptal edebilirsiniz. İptal sonrası mevcut dönemin sonuna kadar özelliklerinizi kullanmaya devam edersiniz.</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h3 className="font-bold text-white mb-2">Bedava boost hakları bir sonraki aya devreder mi?</h3>
              <p className="text-gray-400 text-sm">Hayır, kullanılmayan bedava boost hakları bir sonraki aya devretmez. Her ay 3 yeni hak tanımlanır.</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h3 className="font-bold text-white mb-2">Premium üyelik Valor bakiyemi etkiler mi?</h3>
              <p className="text-gray-400 text-sm">Hayır, Premium üyelik Valor bakiyenizi doğrudan etkilemez. Ancak aylık bonus tavanınız %50 artar ve ek avantajlar kazanırsınız.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
