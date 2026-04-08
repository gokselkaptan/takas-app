'use client'

import { useState, useEffect } from 'react'
import { Star, Quote, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/lib/language-context'

// All testimonials pool - multilingual reviews
const allTestimonials = [
  // Turkish Reviews
  { name: 'Ayşe Yılmaz', role: 'Anne, Karşıyaka', content: 'Çocuklarımın büyüdüğü oyuncakları takas ederek hem tasarruf ettim hem de diğer ailelere faydalı oldum. Müthiş bir platform!', rating: 5, lang: 'tr', flag: '🇹🇷' },
  { name: 'Mehmet Demir', role: 'Öğrenci, Bornova', content: 'Üniversite kitaplarımı takas ederek yeni dönem kitaplarımı hiç para ödemeden aldım. Öğrenciler için harika!', rating: 5, lang: 'tr', flag: '🇹🇷' },
  { name: 'Zeynep Kaya', role: 'Girişimci, Alsancak', content: 'Sürdürülebilirliğe katkıda bulunmak her zaman istediğim bir şeydi. TAKAS-A bunu çok kolay hale getirdi.', rating: 5, lang: 'tr', flag: '🇹🇷' },
  { name: 'Ahmet Özkan', role: 'Mühendis, Konak', content: 'Evdeki kullanmadığım elektronik aletleri takas ettim. Hem evim düzenlendi hem de ihtiyacım olanları buldum.', rating: 5, lang: 'tr', flag: '🇹🇷' },
  { name: 'Fatma Arslan', role: 'Emekli Öğretmen, Buca', content: 'Yıllardır biriktirdiğim kitapları takas ederek yeni okuyacak şeyler buldum. 60 yaşında yeni arkadaşlıklar kurdum!', rating: 5, lang: 'tr', flag: '🇹🇷' },
  { name: 'Can Yıldırım', role: 'Grafik Tasarımcı, Bayraklı', content: 'Eski tablet\'imi profesyonel çizim tableti ile takas ettim. TAKAS-A olmasaydı bunu nasıl bulurdum bilmiyorum.', rating: 5, lang: 'tr', flag: '🇹🇷' },
  { name: 'Elif Şahin', role: 'Yoga Eğitmeni, Çeşme', content: 'Spor ekipmanlarımı takas ederek yoga matından pilates topuna her şeyi buldum. Süper pratik!', rating: 4, lang: 'tr', flag: '🇹🇷' },
  { name: 'Burak Aydın', role: 'Fotoğrafçı, Foça', content: 'Kamera lensi takas ettim. Profesyonel ekipman bulmak hiç bu kadar kolay olmamıştı. Teşekkürler TAKAS-A!', rating: 5, lang: 'tr', flag: '🇹🇷' },
  { name: 'Selin Koç', role: 'Müzisyen, Gaziemir', content: 'Gitarımı takas ederek piyano aldım. Müzik aletleri takası için mükemmel bir platform!', rating: 5, lang: 'tr', flag: '🇹🇷' },
  { name: 'Deniz Eren', role: 'Öğrenci, Narlıdere', content: 'Değerlendirme sistemi sayesinde güvenle takas yapabiliyorum. Her takasta yeni insanlarla tanışıyorum.', rating: 5, lang: 'tr', flag: '🇹🇷' },
  
  // English Reviews
  { name: 'Sarah Johnson', role: 'Designer, London', content: 'Amazing concept! I exchanged my old furniture and got exactly what I needed for my new apartment. Love the community!', rating: 5, lang: 'en', flag: '🇬🇧' },
  { name: 'Michael Brown', role: 'Teacher, Manchester', content: 'Swapped textbooks with other teachers. The verification system makes everything feel safe and secure.', rating: 5, lang: 'en', flag: '🇬🇧' },
  { name: 'Emma Wilson', role: 'Student, Edinburgh', content: 'Found vintage clothes through swapping! Sustainable fashion at its best. Highly recommended for eco-conscious people.', rating: 5, lang: 'en', flag: '🇬🇧' },
  { name: 'James Miller', role: 'Engineer, Bristol', content: 'Exchanged my old gaming console for a drone. The Valor system is genius - makes trading fair for everyone!', rating: 5, lang: 'en', flag: '🇬🇧' },
  { name: 'Olivia Davis', role: 'Mom of 3, Cardiff', content: 'Kids grow so fast! TAKAS-A helped me swap outgrown clothes and toys. Saved hundreds of pounds already!', rating: 5, lang: 'en', flag: '🇬🇧' },
  { name: 'David Thompson', role: 'Musician, Liverpool', content: 'Traded my keyboard for a guitar. The music community here is incredible. Found my dream instrument!', rating: 4, lang: 'en', flag: '🇬🇧' },
  
  // Spanish Reviews
  { name: 'María García', role: 'Profesora, Madrid', content: '¡Plataforma increíble! Intercambié libros de texto y encontré exactamente lo que necesitaba. La comunidad es muy amable.', rating: 5, lang: 'es', flag: '🇪🇸' },
  { name: 'Carlos Rodríguez', role: 'Estudiante, Barcelona', content: 'Cambié mi bicicleta vieja por una guitarra eléctrica. El sistema de Valor hace que todo sea justo y transparente.', rating: 5, lang: 'es', flag: '🇪🇸' },
  { name: 'Ana Martínez', role: 'Madre, Valencia', content: 'Los juguetes de mis hijos encontraron nuevos hogares y nosotros encontramos nuevos tesoros. ¡Economía circular en acción!', rating: 5, lang: 'es', flag: '🇪🇸' },
  { name: 'Pablo Sánchez', role: 'Arquitecto, Sevilla', content: 'Intercambié muebles de diseño. La verificación de usuarios me da mucha confianza. Excelente experiencia.', rating: 5, lang: 'es', flag: '🇪🇸' },
  { name: 'Laura Fernández', role: 'Chef, Bilbao', content: 'Encontré utensilios de cocina profesionales a través de intercambios. ¡Una manera sostenible de equipar mi cocina!', rating: 4, lang: 'es', flag: '🇪🇸' },
  { name: 'Diego López', role: 'Fotógrafo, Málaga', content: 'Cambié lentes de cámara con otros fotógrafos. La comunidad aquí entiende el valor real de las cosas.', rating: 5, lang: 'es', flag: '🇪🇸' },
  
  // Catalan Reviews
  { name: 'Jordi Puig', role: 'Programador, Barcelona', content: "Vaig canviar el meu portàtil antic per una càmera professional. El sistema de Valor és brillant i just per a tothom!", rating: 5, lang: 'ca', flag: '🏴󠁥󠁳󠁣󠁴󠁿' },
  { name: 'Marta Ferrer', role: 'Mestra, Girona', content: "Intercanviar llibres de text amb altres mestres m'ha permès renovar la meva biblioteca sense gastar res.", rating: 5, lang: 'ca', flag: '🏴󠁥󠁳󠁣󠁴󠁿' },
  { name: 'Pere Soler', role: 'Estudiant, Tarragona', content: "Vaig trobar material d'estudi increïble a través dels intercanvis. Perfecte per a estudiants amb pressupost limitat!", rating: 5, lang: 'ca', flag: '🏴󠁥󠁳󠁣󠁴󠁿' },
  { name: 'Anna Vidal', role: 'Artista, Lleida', content: "Vaig intercanviar materials d'art i vaig descobrir una comunitat creativa meravellosa. La sostenibilitat m'encanta!", rating: 5, lang: 'ca', flag: '🏴󠁥󠁳󠁣󠁴󠁿' },
  
  // German Reviews
  { name: 'Hans Müller', role: 'Ingenieur, München', content: 'Fantastische Plattform! Habe meine alte Kamera gegen ein Objektiv getauscht. Das Valor-System ist fair und transparent.', rating: 5, lang: 'de', flag: '🇩🇪' },
  { name: 'Sabine Schmidt', role: 'Lehrerin, Berlin', content: 'Bücher tauschen war noch nie so einfach. Die Gemeinschaft ist freundlich und vertrauenswürdig. Sehr empfehlenswert!', rating: 5, lang: 'de', flag: '🇩🇪' },
  { name: 'Klaus Weber', role: 'Rentner, Hamburg', content: 'Mit 65 Jahren neue Leute durch Tauschen kennengelernt. Eine tolle Möglichkeit, Dinge weiterzugeben!', rating: 4, lang: 'de', flag: '🇩🇪' },
  
  // French Reviews
  { name: 'Marie Dupont', role: 'Designer, Paris', content: "J'ai échangé mes vieux meubles contre des pièces vintage. Le concept est génial et la communauté est super!", rating: 5, lang: 'fr', flag: '🇫🇷' },
  { name: 'Pierre Martin', role: 'Étudiant, Lyon', content: "Échange de livres universitaires sans frais. Parfait pour les étudiants! Le système de Valor est très équitable.", rating: 5, lang: 'fr', flag: '🇫🇷' },
  { name: 'Sophie Bernard', role: 'Mère, Marseille', content: "Les jouets de mes enfants ont trouvé de nouveaux foyers heureux. L'économie circulaire à son meilleur!", rating: 5, lang: 'fr', flag: '🇫🇷' },
  
  // Italian Reviews
  { name: 'Marco Rossi', role: 'Musicista, Roma', content: 'Ho scambiato la mia chitarra per un violino. La comunità musicale qui è incredibile! Altamente raccomandato.', rating: 5, lang: 'it', flag: '🇮🇹' },
  { name: 'Giulia Bianchi', role: 'Studentessa, Milano', content: "Libri universitari scambiati facilmente. Il sistema è sicuro e affidabile. Un'ottima esperienza!", rating: 5, lang: 'it', flag: '🇮🇹' },
  { name: 'Alessandro Ferrari', role: 'Chef, Napoli', content: 'Attrezzature da cucina professionali trovate attraverso scambi. Sostenibile e conveniente!', rating: 4, lang: 'it', flag: '🇮🇹' },
  
  // Portuguese Reviews
  { name: 'João Silva', role: 'Designer, Lisboa', content: 'Troquei móveis antigos por peças modernas. O sistema de Valor torna tudo justo e transparente. Adoro!', rating: 5, lang: 'pt', flag: '🇵🇹' },
  { name: 'Ana Costa', role: 'Estudante, Porto', content: 'Livros universitários trocados sem gastar nada! Perfeito para estudantes. A comunidade é muito acolhedora.', rating: 5, lang: 'pt', flag: '🇵🇹' },
  
  // Dutch Reviews
  { name: 'Jan de Vries', role: 'Leraar, Amsterdam', content: 'Boeken ruilen was nog nooit zo makkelijk! De gemeenschap is vriendelijk en betrouwbaar. Geweldig platform!', rating: 5, lang: 'nl', flag: '🇳🇱' },
  { name: 'Sophie Jansen', role: 'Student, Rotterdam', content: 'Studieboeken geruild zonder kosten. Perfect voor studenten met een beperkt budget. Zeer aan te raden!', rating: 5, lang: 'nl', flag: '🇳🇱' },
  
  // Arabic Reviews
  { name: 'أحمد محمد', role: 'مهندس، دبي', content: 'منصة رائعة! بادلت جهازي القديم بكاميرا احترافية. نظام Valor عادل وشفاف للجميع.', rating: 5, lang: 'ar', flag: '🇦🇪' },
  { name: 'فاطمة علي', role: 'معلمة، الرياض', content: 'تبادل الكتب أصبح سهلاً جداً. المجتمع ودود وموثوق. تجربة ممتازة!', rating: 5, lang: 'ar', flag: '🇸🇦' },
  
  // Japanese Reviews  
  { name: '田中太郎', role: 'エンジニア、東京', content: '素晴らしいコンセプト！古いカメラを交換して、欲しかったレンズを手に入れました。Valorシステムは公平です！', rating: 5, lang: 'ja', flag: '🇯🇵' },
  { name: '山田花子', role: '学生、大阪', content: '教科書を無料で交換できました。学生にとって最高のプラットフォームです！コミュニティも素敵です。', rating: 5, lang: 'ja', flag: '🇯🇵' },
  
  // Korean Reviews
  { name: '김민수', role: '디자이너, 서울', content: '놀라운 플랫폼! 오래된 가구를 교환하여 필요한 것을 정확히 얻었습니다. 커뮤니티가 정말 좋아요!', rating: 5, lang: 'ko', flag: '🇰🇷' },
  { name: '이지영', role: '학생, 부산', content: '교과서를 무료로 교환했어요. 학생들에게 완벽한 플랫폼입니다! Valor 시스템이 공정해요.', rating: 5, lang: 'ko', flag: '🇰🇷' },
  
  // Russian Reviews
  { name: 'Иван Петров', role: 'Инженер, Москва', content: 'Отличная платформа! Обменял старую технику на профессиональную камеру. Система Valor честная и прозрачная!', rating: 5, lang: 'ru', flag: '🇷🇺' },
  { name: 'Анна Смирнова', role: 'Студентка, Санкт-Петербург', content: 'Обменяла учебники бесплатно. Идеально для студентов! Сообщество дружелюбное и надёжное.', rating: 5, lang: 'ru', flag: '🇷🇺' },
  
  // Chinese Reviews
  { name: '李明', role: '工程师，上海', content: '太棒了！用旧电脑换了专业相机。Valor系统公平透明，社区非常友好！', rating: 5, lang: 'zh', flag: '🇨🇳' },
  { name: '王小红', role: '学生，北京', content: '免费交换教科书，对学生来说太完美了！整个过程安全可靠，强烈推荐！', rating: 5, lang: 'zh', flag: '🇨🇳' },
]

const titles = {
  tr: { title1: 'Dünya Genelinde', title2: 'Kullanıcı Yorumları' },
  en: { title1: 'Global User', title2: 'Reviews' },
  es: { title1: 'Opiniones de', title2: 'Usuarios Globales' },
  ca: { title1: 'Opinions dels', title2: 'Usuaris Globals' },
}

// Shuffle function
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function TestimonialsSection() {
  const { language } = useLanguage()
  const titleData = titles[language] || titles.tr
  
  // Start with empty array to avoid hydration mismatch
  const [displayedReviews, setDisplayedReviews] = useState<typeof allTestimonials>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isClient, setIsClient] = useState(false)
  
  // Get random reviews
  const getRandomReviews = (lang: string) => {
    // Mix: 2 from user's language (if available), 4 from other languages
    const userLangReviews = allTestimonials.filter(t => t.lang === lang)
    const otherReviews = allTestimonials.filter(t => t.lang !== lang)
    
    const shuffledUserLang = shuffleArray(userLangReviews).slice(0, 2)
    const shuffledOther = shuffleArray(otherReviews).slice(0, 4)
    
    // Combine and shuffle final selection
    return shuffleArray([...shuffledUserLang, ...shuffledOther])
  }
  
  // Only run on client to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true)
    setDisplayedReviews(getRandomReviews(language))
  }, [])
  
  // Update when language changes (client-side only)
  useEffect(() => {
    if (isClient) {
      setDisplayedReviews(getRandomReviews(language))
    }
  }, [language, isClient])
  
  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setDisplayedReviews(getRandomReviews(language))
      setIsRefreshing(false)
    }, 300)
  }
  
  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isClient) return
    const interval = setInterval(() => {
      setDisplayedReviews(getRandomReviews(language))
    }, 30000)
    return () => clearInterval(interval)
  }, [language, isClient])
  
  return (
    <section className="py-16 bg-gradient-to-b from-white to-orange-50/30 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            {titleData.title1} <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">{titleData.title2}</span>
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">🌍 {allTestimonials.length}+ kullanıcı yorumu • 15+ dil</p>
          
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="mt-4 inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Farklı yorumlar göster
          </button>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div 
            key={displayedReviews.length > 0 ? displayedReviews.map(r => r.name).join('-') : 'loading'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {displayedReviews.length === 0 ? (
              // Skeleton loading
              Array.from({ length: 6 }).map((_, index) => (
                <div key={`skeleton-${index}`} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
                  <div className="flex justify-between mb-4">
                    <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                  <div className="flex gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                    ))}
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-1" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                  </div>
                </div>
              ))
            ) : displayedReviews.map((testimonial, index) => (
              <motion.div
                key={`${testimonial.name}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 relative shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                {/* Flag badge */}
                <div className="absolute top-4 right-4 text-2xl" title={testimonial.lang.toUpperCase()}>
                  {testimonial.flag}
                </div>
                
                <Quote className="absolute top-4 left-4 w-6 h-6 text-orange-200" />
                
                <div className="flex gap-0.5 mb-3 mt-6">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                  {Array.from({ length: 5 - testimonial.rating }).map((_, i) => (
                    <Star
                      key={`empty-${i}`}
                      className="w-4 h-4 text-gray-200"
                    />
                  ))}
                </div>
                
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-4">"{testimonial.content}"</p>
                
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="font-semibold text-gray-900 dark:text-white text-sm">
                    {testimonial.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{testimonial.role}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
        
        {/* Trust indicators */}
        <div className="mt-10 flex flex-wrap justify-center gap-6 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl px-6 py-3 shadow-sm border dark:border-gray-700">
            <div className="text-2xl font-bold text-orange-500">4.9</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Ortalama Puan</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl px-6 py-3 shadow-sm border dark:border-gray-700">
            <div className="text-2xl font-bold text-orange-500">15+</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Ülke</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl px-6 py-3 shadow-sm border dark:border-gray-700">
            <div className="text-2xl font-bold text-orange-500">98%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Memnuniyet</div>
          </div>
        </div>
      </div>
    </section>
  )
}
