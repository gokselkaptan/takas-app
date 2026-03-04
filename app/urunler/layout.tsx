import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tüm Ürünler - Takas-A\'da Takasa Açık Eşyalar',
  description: 'Takas-A\'da binlerce ürün takasa açık! Elektronik, giyim, kitap, mobilya ve daha fazlası. Ücretsiz takas fırsatlarını kaçırma.',
  keywords: ['takas ürünleri', 'takasa açık eşyalar', 'ikinci el takas', 'ücretsiz takas ürün', 'takas-a ürünler'],
  openGraph: {
    title: 'Tüm Ürünler | TAKAS-A',
    description: 'Binlerce ürün takasa açık. Hemen gözat ve takasla!',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
