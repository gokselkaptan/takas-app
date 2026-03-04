import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sıkça Sorulan Sorular - Takas-A SSS',
  description: 'Takas-A hakkında merak edilen sorular ve cevapları. VALOR nedir, takas nasıl yapılır, güvenlik, kargo ve daha fazlası.',
  keywords: ['takas sss', 'takas-a sıkça sorulan sorular', 'VALOR nedir', 'takas güvenliği', 'takas yardım'],
  openGraph: {
    title: 'Sıkça Sorulan Sorular | TAKAS-A',
    description: 'Takas-A hakkında tüm sorularınızın cevapları burada.',
    type: 'website',
  },
}

// FAQPage JSON-LD Structured Data
const faqPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'TAKAS-A nedir?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'TAKAS-A, kullanıcıların para kullanmadan ürünlerini takas edebildiği sürdürülebilir bir platformdur. Valor puan sistemi ile adil ve dengeli takaslar yapabilirsiniz.'
      }
    },
    {
      '@type': 'Question',
      name: 'TAKAS-A\'ya nasıl üye olabilirim?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Kayıt sayfasından e-posta adresiniz ve şifrenizle kolayca üye olabilirsiniz. E-posta doğrulaması sonrasında 50 Valor hoş geldin bonusu kazanırsınız!'
      }
    },
    {
      '@type': 'Question',
      name: 'TAKAS-A kullanmak ücretsiz mi?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Evet! TAKAS-A\'ya üye olmak ve ürün listelemek tamamen ücretsizdir. Sadece başarılı takaslardan küçük bir Valor ücreti alınır.'
      }
    },
    {
      '@type': 'Question',
      name: 'Valor nedir?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Valor, TAKAS-A\'nın sanal para birimidir. Ürünlerin değerini temsil eder ve takas işlemlerinde kullanılır. Para ödemeden, sadece Valor ile takas yapabilirsiniz.'
      }
    },
    {
      '@type': 'Question',
      name: 'Nasıl Valor kazanabilirim?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Valor kazanmanın birçok yolu var: Hoş geldin bonusu (50 Valor), Günlük giriş bonusu (5 Valor), Ürün ekleme bonusu (ilk 3 ürün için 30\'ar Valor), Anket tamamlama (25 Valor), Arkadaş davet etme (15 Valor), Değerlendirme yapma (10 Valor), Başarılı takas (25-100 Valor bonus).'
      }
    },
    {
      '@type': 'Question',
      name: 'Takas işlemi nasıl yapılır?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Beğendiğiniz ürüne takas teklifi gönderin. Karşı taraf kabul ederse, mesajlaşarak detayları konuşun. Teslim noktasında veya kargo ile ürünleri değiştirin ve takası onaylayın.'
      }
    },
    {
      '@type': 'Question',
      name: 'Takas güvenliği nasıl sağlanıyor?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Her kullanıcının güven puanı vardır. Güvenli teslim noktaları kullanabilirsiniz. Anlaşmazlık durumunda destek ekibimiz devreye girer. QR kod sistemi ile teslimat doğrulaması yapılır.'
      }
    },
    {
      '@type': 'Question',
      name: 'Çoklu takas nedir?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Çoklu takas, 3 veya daha fazla kullanıcının zincir halinde takas yapmasıdır. A\'nın istediği ürün B\'de, B\'nin istediği C\'de olabilir. Sistem otomatik olarak bu zincirleri bulur ve eşleştirir.'
      }
    }
  ]
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema) }}
      />
      {children}
    </>
  )
}
