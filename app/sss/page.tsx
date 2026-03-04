'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, HelpCircle, Shield, CreditCard, Package, Users, RefreshCw, MapPin, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/lib/language-context'

const faqTexts = {
  tr: {
    title: 'Sıkça Sorulan Sorular',
    subtitle: 'TAKAS-A hakkında merak ettikleriniz',
    categories: {
      general: 'Genel',
      valor: 'Valor Sistemi',
      swap: 'Takas İşlemleri',
      delivery: 'Teslimat',
      safety: 'Güvenlik'
    },
    faqs: [
      {
        category: 'general',
        question: "TAKAS-A nedir?",
        answer: "TAKAS-A, kullanıcıların para kullanmadan ürünlerini takas edebildiği sürdürülebilir bir platformdur. Valor puan sistemi ile adil ve dengeli takaslar yapabilirsiniz."
      },
      {
        category: 'general',
        question: "TAKAS-A'ya nasıl üye olabilirim?",
        answer: "Kayıt sayfasından e-posta adresiniz ve şifrenizle kolayca üye olabilirsiniz. E-posta doğrulaması sonrasında 50 Valor hoş geldin bonusu kazanırsınız!"
      },
      {
        category: 'general',
        question: "TAKAS-A kullanmak ücretsiz mi?",
        answer: "Evet! TAKAS-A'ya üye olmak ve ürün listelemek tamamen ücretsizdir. Sadece başarılı takaslardan küçük bir Valor ücreti alınır."
      },
      {
        category: 'valor',
        question: "Valor nedir?",
        answer: "Valor, TAKAS-A'nın sanal para birimidir. Ürünlerin değerini temsil eder ve takas işlemlerinde kullanılır. Para ödemeden, sadece Valor ile takas yapabilirsiniz."
      },
      {
        category: 'valor',
        question: "Nasıl Valor kazanabilirim?",
        answer: "Valor kazanmanın birçok yolu var: 1) Hoş geldin bonusu: 50 Valor, 2) Günlük giriş bonusu: 5 Valor, 3) Ürün ekleme bonusu: İlk 3 ürün için 30'ar Valor (toplam 90), 4) Anket tamamlama: 25 Valor, 5) Arkadaş davet etme: 15 Valor (ayda max 5 davet = 75 Valor), 6) Davet edilen aktif arkadaş bonusu: +15 Valor (arkadaş ay içinde 10+ giriş yaparsa), 7) Değerlendirme yapma: 10 Valor (ayda max 10), 8) Başarılı takas: 25-100 Valor bonus, 9) Çoklu takas: +50 Valor ekstra bonus."
      },
      {
        category: 'valor',
        question: "Arkadaş davet sistemi nasıl çalışır?",
        answer: "Her başarılı davet için 15 Valor kazanırsınız. Ayda maksimum 5 arkadaş davet edebilirsiniz (toplam 75 Valor). Bonus: Davet ettiğiniz arkadaş aynı ay içinde platforma 10 veya daha fazla giriş yaparsa, ekstra 15 Valor kazanırsınız! Böylece her aktif arkadaş için toplam 30 Valor kazanabilirsiniz."
      },
      {
        category: 'valor',
        question: "Günlük giriş bonusu nasıl çalışır?",
        answer: "Her gün platforma giriş yaptığınızda 5 Valor kazanabilirsiniz. Bonus almak için profil sayfanızdaki 'Valor Kazan' sekmesinden günlük bonusunuzu talep edin. 24 saat sonra tekrar talep edebilirsiniz."
      },
      {
        category: 'valor',
        question: "Ürün ekleme bonusu nedir?",
        answer: "Platforma eklediğiniz ilk 3 ürün için her biri 30 Valor bonus kazanırsınız. Toplamda 90 Valor! Ürünlerinizi ekleyerek hem takas yapabilir hem de Valor kazanabilirsiniz."
      },
      {
        category: 'valor',
        question: "Değerlendirme yaparak Valor kazanabilir miyim?",
        answer: "Evet! Tamamladığınız her takas sonrası değerlendirme yaparak 10 Valor kazanırsınız. Her ay maksimum 10 değerlendirme bonusu (100 Valor) alabilirsiniz."
      },
      {
        category: 'valor',
        question: "Başarı rozetleri ve ödülleri nelerdir?",
        answer: "Platformda aktivitelerinize göre başarı rozetleri kazanabilirsiniz: İlk Takas (20 Valor), Takas Ustası - 5 takas (50 Valor), Takas Efsanesi - 10 takas (100 Valor), Satıcı - ilk ürün (15 Valor), Koleksiyoncu - 5 ürün (40 Valor), Eleştirmen - ilk değerlendirme (10 Valor), Güvenilir Değerlendirici - 5 değerlendirme (30 Valor), Davetçi - ilk davet (15 Valor), Topluluk Lideri - 5 davet (50 Valor), Telefon Doğrulaması (15 Valor)."
      },
      {
        category: 'valor',
        question: "AI görselleştirme hakkım kaç tane?",
        answer: "Her ay 3 ücretsiz AI görselleştirme hakkınız bulunuyor. Bu haklar her ayın başında yenilenir. Ürünlerin evinizde nasıl görüneceğini yapay zeka ile görebilirsiniz."
      },
      {
        category: 'swap',
        question: "Takas nasıl yapılır?",
        answer: "1) Beğendiğiniz ürüne takas teklifi gönderin, 2) Ürün sahibi kabul ederse teslimat yöntemini belirleyin, 3) Teslim noktasında veya kargo ile ürünleri değiştirin, 4) QR kod ile onaylayın ve takas tamamlansın!"
      },
      {
        category: 'swap',
        question: "Çoklu takas nedir?",
        answer: "Çoklu takas, 3 veya daha fazla kullanıcının zincir halinde takas yapmasıdır. Örneğin: A→B, B→C, C→A. Bu sayede normalde eşleşemeyecek ürünler bile takas edilebilir. Çoklu takaslarda +25 Valor bonus kazanırsınız!"
      },
      {
        category: 'swap',
        question: "Takas teklifimi nasıl iptal edebilirim?",
        answer: "Profil sayfanızdaki 'Teklifler' sekmesinden gönderdiğiniz teklifleri görüntüleyebilir ve henüz kabul edilmemiş tekliflerinizi iptal edebilirsiniz."
      },
      {
        category: 'delivery',
        question: "Ürünleri nasıl teslim alırım/veririm?",
        answer: "İki seçeneğiniz var: 1) TAKAS-A teslim noktalarında buluşarak yüz yüze teslim, 2) Kargo ile gönderim. Her iki yöntemde de QR kod ile onay yapılır."
      },
      {
        category: 'delivery',
        question: "Teslim noktaları nerede?",
        answer: "İzmir'de Forum Bornova, Buca Park, Karşıyaka gibi çeşitli noktalarda ve Barcelona'da da teslim noktalarımız bulunuyor. Harita sayfasından tüm noktaları görebilirsiniz."
      },
      {
        category: 'delivery',
        question: "QR kod sistemi nasıl çalışır?",
        answer: "Takas onaylandığında benzersiz bir QR kod oluşturulur. Teslim sırasında her iki taraf da QR kodu tarayarak teslimatı onaylar. Bu sayede güvenli ve takip edilebilir teslimler sağlanır."
      },
      {
        category: 'safety',
        question: "Takas güvenli mi?",
        answer: "TAKAS-A'da güvenliğiniz önceliğimizdir. Kullanıcı puanlama sistemi, mesaj moderasyonu, QR kod onaylı teslimatlar ve anlaşmazlık çözüm sistemi ile güvenli takas deneyimi sunuyoruz."
      },
      {
        category: 'safety',
        question: "Ürün beklediğim gibi çıkmazsa ne yapmalıyım?",
        answer: "Teslimat sırasında ürünü kontrol edin. Sorun varsa QR kod onayı yapmadan önce anlaşmazlık bildirin. Anlaşmazlık ekibimiz durumu değerlendirir ve adil bir çözüm sunar."
      },
      {
        category: 'safety',
        question: "Kişisel bilgilerim korunuyor mu?",
        answer: "Evet! Telefon numarası, e-posta ve adres gibi kişisel bilgileriniz mesajlaşmada paylaşılamaz. Tüm iletişim TAKAS-A platformu üzerinden güvenle yapılır."
      }
    ],
    stillHaveQuestions: 'Hâlâ sorunuz mu var?',
    contactUs: 'Bize ulaşın'
  },
  en: {
    title: 'Frequently Asked Questions',
    subtitle: 'Everything you want to know about TAKAS-A',
    categories: {
      general: 'General',
      valor: 'Valor System',
      swap: 'Swap Process',
      delivery: 'Delivery',
      safety: 'Safety'
    },
    faqs: [
      {
        category: 'general',
        question: "What is TAKAS-A?",
        answer: "TAKAS-A is a sustainable platform where users can swap their items without using money. With the Valor point system, you can make fair and balanced swaps."
      },
      {
        category: 'general',
        question: "How can I sign up for TAKAS-A?",
        answer: "You can easily sign up with your email and password on the registration page. After email verification, you'll receive a 50 Valor welcome bonus!"
      },
      {
        category: 'general',
        question: "Is TAKAS-A free to use?",
        answer: "Yes! Signing up and listing items on TAKAS-A is completely free. Only a small Valor fee is charged for successful swaps."
      },
      {
        category: 'valor',
        question: "What is Valor?",
        answer: "Valor is TAKAS-A's virtual currency. It represents the value of items and is used in swap transactions. You can swap with just Valor, without paying money."
      },
      {
        category: 'valor',
        question: "How can I earn Valor?",
        answer: "There are many ways to earn Valor: 1) Welcome bonus: 50 Valor, 2) Daily login bonus: 5 Valor, 3) Product listing bonus: 30 Valor each for first 3 products (total 90), 4) Survey completion: 25 Valor, 5) Friend referral: 15 Valor (max 5 invites/month = 75 Valor), 6) Active friend bonus: +15 Valor (if friend logs in 10+ times in the month), 7) Reviews: 10 Valor each (max 10/month), 8) Successful swap: 25-100 Valor bonus, 9) Multi-swap: +50 Valor extra bonus."
      },
      {
        category: 'valor',
        question: "How does the referral system work?",
        answer: "You earn 15 Valor for each successful referral. You can invite up to 5 friends per month (total 75 Valor). Bonus: If your invited friend logs into the platform 10 or more times within the same month, you earn an extra 15 Valor! So you can earn up to 30 Valor per active friend."
      },
      {
        category: 'valor',
        question: "How does the daily login bonus work?",
        answer: "You can earn 5 Valor every day by logging into the platform. To claim your bonus, go to the 'Earn Valor' tab on your profile page. You can claim again after 24 hours."
      },
      {
        category: 'valor',
        question: "What is the product listing bonus?",
        answer: "You earn 30 Valor for each of your first 3 products listed on the platform. That's 90 Valor total! Add your products to both swap and earn Valor."
      },
      {
        category: 'valor',
        question: "Can I earn Valor by leaving reviews?",
        answer: "Yes! You earn 10 Valor for every review you leave after a completed swap. You can receive up to 10 review bonuses (100 Valor) per month."
      },
      {
        category: 'valor',
        question: "What are achievements and their rewards?",
        answer: "You can earn achievement badges based on your activities: First Swap (20 Valor), Swap Master - 5 swaps (50 Valor), Swap Legend - 10 swaps (100 Valor), Seller - first product (15 Valor), Collector - 5 products (40 Valor), Critic - first review (10 Valor), Trusted Reviewer - 5 reviews (30 Valor), Inviter - first referral (15 Valor), Community Leader - 5 referrals (50 Valor), Phone Verified (15 Valor)."
      },
      {
        category: 'valor',
        question: "How many AI visualization credits do I have?",
        answer: "You have 3 free AI visualization credits per month. These credits reset at the beginning of each month. You can see how items would look in your home using AI."
      },
      {
        category: 'swap',
        question: "How do I make a swap?",
        answer: "1) Send a swap offer for an item you like, 2) If the owner accepts, choose the delivery method, 3) Exchange items at a delivery point or via shipping, 4) Confirm with QR code and complete the swap!"
      },
      {
        category: 'swap',
        question: "What is multi-swap?",
        answer: "Multi-swap is a chain swap involving 3 or more users. For example: A→B, B→C, C→A. This allows items that wouldn't normally match to be swapped. You earn +25 Valor bonus for multi-swaps!"
      },
      {
        category: 'swap',
        question: "How can I cancel my swap offer?",
        answer: "You can view your sent offers in the 'Offers' tab on your profile page and cancel offers that haven't been accepted yet."
      },
      {
        category: 'delivery',
        question: "How do I receive/deliver items?",
        answer: "You have two options: 1) In-person delivery at TAKAS-A delivery points, 2) Shipping. Both methods use QR code confirmation."
      },
      {
        category: 'delivery',
        question: "Where are the delivery points?",
        answer: "We have delivery points in Izmir at Forum Bornova, Buca Park, Karşıyaka and also in Barcelona. You can see all points on the map page."
      },
      {
        category: 'delivery',
        question: "How does the QR code system work?",
        answer: "A unique QR code is generated when a swap is confirmed. Both parties scan the QR code during delivery to confirm. This ensures secure and trackable deliveries."
      },
      {
        category: 'safety',
        question: "Is swapping safe?",
        answer: "Your safety is our priority at TAKAS-A. We offer a secure swap experience with user rating system, message moderation, QR-confirmed deliveries, and dispute resolution system."
      },
      {
        category: 'safety',
        question: "What if the item isn't as expected?",
        answer: "Check the item during delivery. If there's an issue, report a dispute before QR confirmation. Our dispute team will evaluate and provide a fair solution."
      },
      {
        category: 'safety',
        question: "Is my personal information protected?",
        answer: "Yes! Personal information like phone numbers, emails, and addresses cannot be shared in messages. All communication is done securely through the TAKAS-A platform."
      }
    ],
    stillHaveQuestions: 'Still have questions?',
    contactUs: 'Contact us'
  },
  es: {
    title: 'Preguntas Frecuentes',
    subtitle: 'Todo lo que quieres saber sobre TAKAS-A',
    categories: {
      general: 'General',
      valor: 'Sistema Valor',
      swap: 'Proceso de Intercambio',
      delivery: 'Entrega',
      safety: 'Seguridad'
    },
    faqs: [
      {
        category: 'general',
        question: "¿Qué es TAKAS-A?",
        answer: "TAKAS-A es una plataforma sostenible donde los usuarios pueden intercambiar sus artículos sin usar dinero. Con el sistema de puntos Valor, puedes hacer intercambios justos y equilibrados."
      },
      {
        category: 'valor',
        question: "¿Qué es Valor?",
        answer: "Valor es la moneda virtual de TAKAS-A. Representa el valor de los artículos y se usa en transacciones de intercambio."
      },
      {
        category: 'valor',
        question: "¿Cómo puedo ganar Valor?",
        answer: "Hay muchas formas de ganar Valor: 1) Bono de bienvenida: 50 Valor, 2) Bono diario: 5 Valor, 3) Bono por agregar productos: 30 Valor cada uno para los primeros 3 (total 90), 4) Encuesta: 25 Valor, 5) Invitar amigos: 15 Valor (máx 5 invitaciones/mes = 75 Valor), 6) Bono amigo activo: +15 Valor (si el amigo inicia sesión 10+ veces en el mes), 7) Reseñas: 10 Valor cada una (máx 10/mes), 8) Intercambio exitoso: 25-100 Valor, 9) Multi-intercambio: +50 Valor extra."
      },
      {
        category: 'valor',
        question: "¿Cómo funciona el sistema de referidos?",
        answer: "Ganas 15 Valor por cada referido exitoso. Puedes invitar hasta 5 amigos por mes (total 75 Valor). Bono: Si tu amigo invitado inicia sesión 10 o más veces en el mismo mes, ¡ganas 15 Valor extra! Así puedes ganar hasta 30 Valor por cada amigo activo."
      },
      {
        category: 'valor',
        question: "¿Cómo funciona el bono diario?",
        answer: "Puedes ganar 5 Valor cada día al iniciar sesión. Reclama tu bono en la pestaña 'Ganar Valor' de tu perfil. Puedes reclamarlo nuevamente después de 24 horas."
      },
      {
        category: 'valor',
        question: "¿Qué son los logros y sus recompensas?",
        answer: "Puedes ganar insignias de logros según tus actividades: Primer Intercambio (20 Valor), Maestro del Intercambio - 5 intercambios (50 Valor), Leyenda - 10 intercambios (100 Valor), Vendedor - primer producto (15 Valor), Coleccionista - 5 productos (40 Valor), Crítico - primera reseña (10 Valor), Revisor Confiable - 5 reseñas (30 Valor), Invitador - primera invitación (15 Valor), Líder Comunitario - 5 invitaciones (50 Valor), Teléfono Verificado (15 Valor)."
      },
      {
        category: 'swap',
        question: "¿Cómo hago un intercambio?",
        answer: "1) Envía una oferta de intercambio, 2) Si el propietario acepta, elige el método de entrega, 3) Intercambia en un punto de entrega o por envío, 4) Confirma con código QR."
      },
      {
        category: 'safety',
        question: "¿Es seguro el intercambio?",
        answer: "Tu seguridad es nuestra prioridad. Ofrecemos sistema de calificación, moderación de mensajes, entregas con QR y resolución de disputas."
      }
    ],
    stillHaveQuestions: '¿Todavía tienes preguntas?',
    contactUs: 'Contáctanos'
  },
  ca: {
    title: 'Preguntes Freqüents',
    subtitle: 'Tot el que vols saber sobre TAKAS-A',
    categories: {
      general: 'General',
      valor: 'Sistema Valor',
      swap: 'Procés d\'Intercanvi',
      delivery: 'Lliurament',
      safety: 'Seguretat'
    },
    faqs: [
      {
        category: 'general',
        question: "Què és TAKAS-A?",
        answer: "TAKAS-A és una plataforma sostenible on els usuaris poden intercanviar els seus articles sense utilitzar diners. Amb el sistema de punts Valor, pots fer intercanvis justos i equilibrats."
      },
      {
        category: 'valor',
        question: "Què és Valor?",
        answer: "Valor és la moneda virtual de TAKAS-A. Representa el valor dels articles i s'utilitza en transaccions d'intercanvi."
      },
      {
        category: 'valor',
        question: "Com puc guanyar Valor?",
        answer: "Hi ha moltes maneres de guanyar Valor: 1) Bonus de benvinguda: 50 Valor, 2) Bonus diari: 5 Valor, 3) Bonus per afegir productes: 30 Valor cadascun pels primers 3 (total 90), 4) Enquesta: 25 Valor, 5) Convidar amics: 15 Valor (màx 5 invitacions/mes = 75 Valor), 6) Bonus amic actiu: +15 Valor (si l'amic inicia sessió 10+ vegades al mes), 7) Ressenyes: 10 Valor cada una (màx 10/mes), 8) Intercanvi exitós: 25-100 Valor, 9) Multi-intercanvi: +50 Valor extra."
      },
      {
        category: 'valor',
        question: "Com funciona el sistema de referits?",
        answer: "Guanyes 15 Valor per cada referit exitós. Pots convidar fins a 5 amics per mes (total 75 Valor). Bonus: Si el teu amic convidat inicia sessió 10 o més vegades en el mateix mes, guanyes 15 Valor extra! Així pots guanyar fins a 30 Valor per cada amic actiu."
      },
      {
        category: 'valor',
        question: "Com funciona el bonus diari?",
        answer: "Pots guanyar 5 Valor cada dia en iniciar sessió. Reclama el teu bonus a la pestanya 'Guanyar Valor' del teu perfil. Pots reclamar-lo de nou després de 24 hores."
      },
      {
        category: 'valor',
        question: "Què són els assoliments i les seves recompenses?",
        answer: "Pots guanyar insígnies d'assoliment segons les teves activitats: Primer Intercanvi (20 Valor), Mestre de l'Intercanvi - 5 intercanvis (50 Valor), Llegenda - 10 intercanvis (100 Valor), Venedor - primer producte (15 Valor), Col·leccionista - 5 productes (40 Valor), Crític - primera ressenya (10 Valor), Revisor de Confiança - 5 ressenyes (30 Valor), Convidador - primera invitació (15 Valor), Líder Comunitari - 5 invitacions (50 Valor), Telèfon Verificat (15 Valor)."
      },
      {
        category: 'swap',
        question: "Com faig un intercanvi?",
        answer: "1) Envia una oferta d'intercanvi, 2) Si el propietari accepta, tria el mètode de lliurament, 3) Intercanvia en un punt de lliurament o per enviament, 4) Confirma amb codi QR."
      },
      {
        category: 'safety',
        question: "És segur l'intercanvi?",
        answer: "La teva seguretat és la nostra prioritat. Oferim sistema de qualificació, moderació de missatges, lliuraments amb QR i resolució de disputes."
      }
    ],
    stillHaveQuestions: 'Encara tens preguntes?',
    contactUs: 'Contacta\'ns'
  }
}

const categoryIcons: Record<string, any> = {
  general: HelpCircle,
  valor: CreditCard,
  swap: RefreshCw,
  delivery: MapPin,
  safety: Shield
}

export default function SSSPage() {
  const { language } = useLanguage()
  const texts = faqTexts[language] || faqTexts.tr
  const [activeCategory, setActiveCategory] = useState('general')
  const [openQuestion, setOpenQuestion] = useState<number | null>(null)

  const filteredFaqs = texts.faqs.filter(faq => faq.category === activeCategory)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="gradient-frozen py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-white text-sm mb-6"
          >
            <HelpCircle className="w-4 h-4" />
            SSS
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            {texts.title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-white/90"
          >
            {texts.subtitle}
          </motion.p>
        </div>
      </section>

      {/* Category Tabs */}
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg p-2 flex flex-wrap gap-2"
        >
          {Object.entries(texts.categories).map(([key, label]) => {
            const Icon = categoryIcons[key]
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveCategory(key)
                  setOpenQuestion(null)
                }}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                  activeCategory === key
                    ? 'bg-frozen-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{label}</span>
              </button>
            )
          })}
        </motion.div>
      </div>

      {/* FAQ List */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {filteredFaqs.map((faq, index) => (
              <motion.div
                key={`${activeCategory}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setOpenQuestion(openQuestion === index ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900 pr-4">{faq.question}</span>
                  <motion.div
                    animate={{ rotate: openQuestion === index ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openQuestion === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex flex-col items-center gap-4 p-8 bg-gradient-to-br from-frozen-50 to-blue-50 rounded-2xl">
            <div className="w-16 h-16 rounded-2xl gradient-frozen flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">{texts.stillHaveQuestions}</h3>
            <Link
              href="/iletisim"
              className="px-6 py-3 gradient-frozen text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              {texts.contactUs}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
