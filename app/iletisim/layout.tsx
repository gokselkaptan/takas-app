import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'İletişim - Bize Ulaşın',
  description: 'İzmir - TAKAS-A ekibiyle iletişime geçin. Sorularınız, önerileriniz ve iş birliği teklifleriniz için buradayız.',
  keywords: ['takas-a iletişim', 'destek', 'yardım', 'soru sor'],
  openGraph: {
    title: 'İletişim | TAKAS-A',
    description: 'Sorularınız için bize ulaşın. Her zaman yanınızdayız.',
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
