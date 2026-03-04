import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Takaslarım - Takas-A',
  description: 'Tüm takaslarınızı yönetin. Aktif takaslar, tamamlanan takaslar ve takas geçmişiniz.',
  keywords: ['takaslarım', 'takas geçmişi', 'aktif takaslar', 'tamamlanan takaslar'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Takaslarım | TAKAS-A',
    description: 'Tüm takaslarınız tek yerde.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
