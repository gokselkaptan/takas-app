import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Takas Haritası - Yakınımdaki Ürünler',
  description: 'Takas haritasında yakınınızdaki takasa açık ürünleri keşfedin. Konum bazlı takas, yerel takas fırsatları.',
  keywords: ['takas haritası', 'yakınımdaki takas', 'yerel takas', 'konum bazlı takas'],
  openGraph: {
    title: 'Takas Haritası | TAKAS-A',
    description: 'Yakınınızdaki takas fırsatlarını keşfedin.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
