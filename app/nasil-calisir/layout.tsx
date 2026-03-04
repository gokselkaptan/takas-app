import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nasıl Çalışır - Takas-A Kullanım Rehberi',
  description: 'Takas-A nasıl kullanılır? Adım adım takas yapma rehberi. Ürün ekle, VALOR değeri al, takas teklifi gönder, anlaş ve takasla!',
  keywords: ['takas nasıl yapılır', 'takas-a kullanımı', 'takas rehberi', 'VALOR sistemi', 'ücretsiz takas'],
  openGraph: {
    title: 'Nasıl Çalışır | TAKAS-A',
    description: 'Takas-A platformunu kullanmayı öğrenin. Adım adım takas rehberi.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
