'use client'

export default function KullanimKosullariPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          📋 Kullanım Koşulları
        </h1>
        <p className="text-sm text-gray-500 mb-8">Son güncelleme: Şubat 2026</p>
        
        <div className="prose dark:prose-invert max-w-none space-y-6">
          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">1. Platform Hakkında</h2>
            <p className="text-gray-700 dark:text-gray-300">TAKAS-A, kullanıcılar arasında para kullanmadan ürün ve hizmet takası yapılmasını sağlayan bir platformdur. Platform, "Valor" adlı sanal değer birimi ile çalışır.</p>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">2. Üyelik Koşulları</h2>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• Platform&apos;a kayıt olmak için 18 yaşından büyük olmanız gerekmektedir.</li>
              <li>• Doğru ve güncel bilgiler vermeniz zorunludur.</li>
              <li>• Her kullanıcı yalnızca bir hesap oluşturabilir.</li>
              <li>• Hesabınızın güvenliğinden siz sorumlusunuz.</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">3. Valor Sistemi</h2>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• Valor, platform içi değer birimidir ve gerçek para karşılığı yoktur.</li>
              <li>• Valor bakiyesi nakde çevrilemez, platform dışına transfer edilemez.</li>
              <li>• AI destekli değerleme ve piyasa endekslerine göre hesaplanır.</li>
              <li>• Platform, Valor değerlemesini güncelleme hakkını saklı tutar.</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">4. Takas Kuralları</h2>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• Yalnızca yasal ürün ve hizmetlerin takası yapılabilir.</li>
              <li>• Ürün açıklamaları doğru ve güncel olmalıdır.</li>
              <li>• Teslimat, QR kod + OTP doğrulama ile güvenli şekilde yapılmalıdır.</li>
              <li>• Her takas sonrası karşılıklı değerlendirme (rating) zorunludur.</li>
              <li>• Anlaşmazlık durumunda dispute sistemi kullanılmalıdır.</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">5. Yasaklı İçerikler</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">Aşağıdaki ürün ve hizmetlerin takası kesinlikle yasaktır:</p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• Yasadışı maddeler, silah, patlayıcı</li>
              <li>• Çalıntı veya sahte ürünler</li>
              <li>• Tıbbi cihazlar ve reçeteli ilaçlar</li>
              <li>• Canlı hayvanlar (evcil hayvan aksesuarları hariç)</li>
              <li>• Müstehcen, ırkçı veya ayrımcı içerikler</li>
              <li>• Finansal enstrümanlar ve kripto paralar</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">6. Güven ve Güvenlik</h2>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• Platform, güven puanı (trust score) sistemiyle çalışır.</li>
              <li>• Dolandırıcılık girişimleri tespit edildiğinde hesap askıya alınır.</li>
              <li>• Teminat (escrow) sistemi ile her iki tarafın hakları korunur.</li>
              <li>• Platform, taraflar arasındaki anlaşmazlıklarda arabuluculuk yapabilir ancak nihai sorumluluk taraflara aittir.</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">7. Premium Üyelik</h2>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• Premium üyelik ek özellikler sunar (sınırsız ürün, öncelikli eşleşme, bedava boost).</li>
              <li>• Ücretler ve özellikler değişiklik gösterebilir.</li>
              <li>• İptal, sonraki dönem başlangıcında geçerli olur.</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">8. Sorumluluk Sınırlaması</h2>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• Platform, kullanıcılar arası takasların sonucundan doğrudan sorumlu değildir.</li>
              <li>• Ürünlerin kalitesi, doğruluğu ve teslimata kullanıcıların sorumluluğundadır.</li>
              <li>• Platform, teknik aksaklıklar için azami özen gösterir ancak garanti vermez.</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">9. Değişiklikler</h2>
            <p className="text-gray-700 dark:text-gray-300">Platform, bu koşulları önceden bildirimde bulunarak güncelleme hakkını saklı tutar. Güncelleme sonrası platform kullanımınız devam ederse yeni koşulları kabul etmiş sayılırsınız.</p>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">10. İletişim</h2>
            <p className="text-gray-700 dark:text-gray-300">Sorularınız için: <a href="mailto:join@takas-a.com" className="text-purple-600 hover:underline">join@takas-a.com</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
