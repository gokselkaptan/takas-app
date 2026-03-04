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

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
