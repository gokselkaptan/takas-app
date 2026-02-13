import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Harita - Yakınındaki Takaslar',
  description: 'İzmir haritasında takas fırsatlarını gör. Yakınındaki ürünleri bul, teslim noktalarını keşfet.',
  keywords: ['İzmir harita', 'yakınımdaki takas', 'takas haritası', 'ürün haritası'],
  openGraph: {
    title: 'Harita | TAKAS-A',
    description: 'İzmir\'de yakınındaki takas fırsatlarını haritada gör.',
  },
}

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return children
}
