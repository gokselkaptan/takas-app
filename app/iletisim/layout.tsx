import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'İletişim - Takas-A Destek ve Yardım',
  description: 'Takas-A ile iletişime geçin. Sorularınız, önerileriniz veya destek talepleriniz için bize ulaşın. 7/24 destek.',
  keywords: ['takas-a iletişim', 'takas destek', 'takas-a müşteri hizmetleri', 'takas yardım'],
  openGraph: {
    title: 'İletişim | TAKAS-A',
    description: 'Takas-A ekibiyle iletişime geçin. Sorularınız için buradayız.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
