import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Teslim Noktaları - Güvenli Takas Lokasyonları',
  description: 'Takas-A teslim noktaları. Güvenli takas için onaylanmış teslim lokasyonları. Kafeler, AVM\'ler ve daha fazlası.',
  keywords: ['takas teslim noktaları', 'güvenli takas yeri', 'takas lokasyonu', 'buluşma noktası'],
  openGraph: {
    title: 'Teslim Noktaları | TAKAS-A',
    description: 'Güvenli takas için onaylanmış teslim noktaları.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
