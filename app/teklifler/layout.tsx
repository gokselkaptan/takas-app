import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tekliflerim - Takas-A',
  description: 'Gelen ve giden takas tekliflerinizi yönetin. Teklif kabul, red ve pazarlık seçenekleri.',
  keywords: ['takas teklifleri', 'gelen teklifler', 'giden teklifler', 'teklif yönetimi'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Tekliflerim | TAKAS-A',
    description: 'Takas teklifleriniz.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
