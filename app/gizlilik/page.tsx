'use client'

export default function GizlilikPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          🔒 Gizlilik Politikası & KVKK Aydınlatma Metni
        </h1>
        <p className="text-sm text-gray-500 mb-8">Son güncelleme: Şubat 2026</p>
        
        <div className="prose dark:prose-invert max-w-none space-y-6">
          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">1. Veri Sorumlusu</h2>
            <p className="text-gray-700 dark:text-gray-300">TAKAS-A platformu ("Platform"), İzmir merkezli olup kişisel verilerinizin korunmasına büyük önem vermektedir. 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu olarak hareket etmekteyiz.</p>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">2. Toplanan Kişisel Veriler</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">Platform üzerinden aşağıdaki kişisel veriler toplanmaktadır:</p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li><strong>Kimlik Bilgileri:</strong> Ad, soyad, kullanıcı adı, profil fotoğrafı</li>
              <li><strong>İletişim Bilgileri:</strong> E-posta adresi, telefon numarası</li>
              <li><strong>Konum Bilgileri:</strong> Şehir, semt (takas eşleştirmesi için)</li>
              <li><strong>İşlem Bilgileri:</strong> Takas geçmişi, Valor bakiyesi, ürün bilgileri</li>
              <li><strong>Cihaz Bilgileri:</strong> IP adresi, tarayıcı türü, oturum bilgileri</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">3. Verilerin İşlenme Amaçları</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• Hesap oluşturma ve kimlik doğrulama</li>
              <li>• Takas eşleştirme ve öneri algoritmaları</li>
              <li>• Güvenli teslimat sürecinin yönetimi (QR kod, OTP)</li>
              <li>• Valor ekonomik değerleme sistemi</li>
              <li>• Güven puanı hesaplama ve dolandırıcılık önleme</li>
              <li>• Bildirim gönderimi (teklif, mesaj, sistem bildirimleri)</li>
              <li>• Yasal yükümlülüklerin yerine getirilmesi</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">4. Verilerin Paylaşımı</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">Kişisel verileriniz üçüncü taraflarla paylaşılmaz. Ancak:</p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• Takas sürecinde karşı taraf yalnızca kullanıcı adınızı, şehrinizi ve güven puanınızı görebilir.</li>
              <li>• Yasal zorunluluk halinde yetkili kamu kurumlarıyla paylaşılabilir.</li>
              <li>• Anonim ve toplu istatistikler platform geliştirme amacıyla kullanılabilir.</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">5. KVKK Kapsamında Haklarınız</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">KVKK&apos;nın 11. maddesi gereğince aşağıdaki haklara sahipsiniz:</p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>• İşlenmisse bilgi talep etme</li>
              <li>• İşlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>• Eksik veya yanlış işlenmisse düzeltilmesini isteme</li>
              <li>• KVKK&apos;nın 7. maddesindeki şartlar çerçevesinde silinmesini isteme</li>
              <li>• Düzeltme ve silme işlemlerinin üçüncü kişilere bildirilmesini isteme</li>
              <li>• İşlenen verilerin münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme</li>
              <li>• Kanuna aykırı işlenme sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">6. Veri Güvenliği</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">Verileriniz aşağıdaki teknik önlemlerle korunmaktadır:</p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• SSL/TLS şifreleme (HTTPS)</li>
              <li>• Güvenli oturum yönetimi (JWT + Refresh Token)</li>
              <li>• Şifrelenmiş veri depolama</li>
              <li>• Düzenli güvenlik güncellemeleri</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">7. Çerezler (Cookies)</h2>
            <p className="text-gray-700 dark:text-gray-300">Platform, oturum yönetimi ve kullanıcı tercihlerini saklamak için gerekli çerezler kullanmaktadır. Analitik çerezler yalnızca izninizle kullanılır.</p>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">8. Hesap Silme</h2>
            <p className="text-gray-700 dark:text-gray-300">Hesabınızı ve tüm kişisel verilerinizi silmek için: Profil → Ayarlar → Hesabımı Sil yolunu izleyebilir veya join@takas-a.com adresine e-posta gönderebilirsiniz. Silme talepleriniz 30 gün içinde işleme alınır.</p>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">9. İletişim</h2>
            <p className="text-gray-700 dark:text-gray-300">KVKK kapsamındaki başvurularınız için: <a href="mailto:join@takas-a.com" className="text-purple-600 hover:underline">join@takas-a.com</a></p>
            <p className="text-gray-700 dark:text-gray-300">Adres: İzmir, Türkiye</p>
          </section>
        </div>
      </div>
    </div>
  )
}
