import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Premium Üyelik - Takas-A VIP Avantajları',
  description: 'Takas-A Premium üyelik avantajları. Sınırsız teklif, öncelikli listeleme, özel destek ve daha fazlası.',
  keywords: ['takas-a premium', 'VIP üyelik', 'takas premium', 'sınırsız teklif'],
  openGraph: {
    title: 'Premium Üyelik | TAKAS-A',
    description: 'Premium üyelik avantajlarını keşfedin.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
