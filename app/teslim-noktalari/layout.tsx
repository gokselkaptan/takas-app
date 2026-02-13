import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Teslim Noktaları - Güvenli Buluşma',
  description: 'İzmir genelinde güvenli teslim noktalarımız. Bornova, Konak, Karşıyaka ve daha fazlasında güvenle takas yap.',
  keywords: ['teslim noktası', 'güvenli takas', 'İzmir buluşma noktası', 'takas teslim', 'güvenli buluşma'],
  openGraph: {
    title: 'Teslim Noktaları | TAKAS-A',
    description: 'İzmir\'de güvenli teslim noktaları. Gönül rahatlığıyla takas yap.',
  },
}

export default function DeliveryPointsLayout({ children }: { children: React.ReactNode }) {
  return children
}
