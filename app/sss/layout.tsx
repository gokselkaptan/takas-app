import type { Metadata } from 'next'
import { generateFAQSchema } from '@/lib/seo-config'

const faqs = [
  { question: 'TAKAS-A nedir?', answer: 'TAKAS-A, İzmir\'de para ödemeden eşya takası yapmanızı sağlayan ücretsiz bir platformdur.' },
  { question: 'Nasıl üye olabilirim?', answer: 'Ana sayfadaki Kayıt Ol butonuna tıklayarak ücretsiz üye olabilirsiniz.' },
  { question: 'Valor nedir?', answer: 'Valor, TAKAS-A\'nın kendi takas birimidir. Ürünlerin değerini Valor ile belirleriz.' },
  { question: 'Teslim nasıl yapılır?', answer: 'Güvenli teslim noktalarımızda veya karşılıklı anlaşarak teslim yapabilirsiniz.' },
  { question: 'Güvenli mi?', answer: 'Evet! Kullanıcı doğrulama, güven puanı ve güvenli teslim noktaları ile takasınız güvende.' },
]

export const metadata: Metadata = {
  title: 'Sıkça Sorulan Sorular (SSS)',
  description: 'TAKAS-A hakkında merak ettiğiniz her şey! Nasıl takas yapılır? Güvenli mi? Valor nedir? Tüm soruların cevapları burada.',
  keywords: ['takas SSS', 'takas soruları', 'takas yardım', 'sık sorulan sorular'],
  openGraph: {
    title: 'Sıkça Sorulan Sorular | TAKAS-A',
    description: 'TAKAS-A hakkında tüm soruların cevapları.',
  },
  other: {
    'script:ld+json': JSON.stringify(generateFAQSchema(faqs)),
  },
}

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children
}
