import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gizlilik Politikası - Takas-A',
  description: 'Takas-A gizlilik politikası. Kişisel verilerinizin nasıl korunduğunu ve kullanıldığını öğrenin. KVKK uyumlu.',
  keywords: ['takas-a gizlilik', 'gizlilik politikası', 'kişisel veri koruma', 'KVKK'],
  openGraph: {
    title: 'Gizlilik Politikası | TAKAS-A',
    description: 'Kişisel verileriniz bizimle güvende.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
