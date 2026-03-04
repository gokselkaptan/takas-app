import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Önerilen Ürünler - Takas-A',
  description: 'Size özel takas önerileri. İlgi alanlarınıza ve tercihlerinize göre seçilmiş ürünler.',
  keywords: ['önerilen ürünler', 'takas önerileri', 'kişisel öneriler'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Önerilen Ürünler | TAKAS-A',
    description: 'Size özel takas önerileri.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
