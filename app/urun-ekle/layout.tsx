import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ürün Ekle - Takas-A\'da Ürününü Listele',
  description: 'Ürününü Takas-A\'ya ekle, VALOR değeri al ve takasa başla. Ücretsiz ürün listeleme, yapay zeka destekli değerleme.',
  keywords: ['ürün ekle takas', 'takas ürün listele', 'ücretsiz ürün ekleme', 'VALOR değeri'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Ürün Ekle | TAKAS-A',
    description: 'Ürününü ekle ve takasa başla.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
