import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kullanım Koşulları - Takas-A',
  description: 'Takas-A platformu kullanım koşulları ve şartları. Platform kuralları, takas güvenliği ve kullanıcı sorumlulukları.',
  keywords: ['takas-a kullanım koşulları', 'takas şartları', 'platform kuralları', 'takas güvenliği'],
  openGraph: {
    title: 'Kullanım Koşulları | TAKAS-A',
    description: 'Takas-A kullanım şartları ve kuralları.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
