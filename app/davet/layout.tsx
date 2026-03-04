import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Arkadaşlarını Davet Et - Takas-A',
  description: 'Arkadaşlarınızı Takas-A\'ya davet edin ve bonus kazanın. Davet linkinizi paylaşın, topluluğu büyütün.',
  keywords: ['takas davet', 'arkadaş davet', 'takas-a referans', 'davet bonusu'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Arkadaşlarını Davet Et | TAKAS-A',
    description: 'Arkadaşlarınızı davet edin, bonus kazanın.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
