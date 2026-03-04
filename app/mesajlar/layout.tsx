import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mesajlarım - Takas-A',
  description: 'Takas mesajlarınızı yönetin. Satıcılarla iletişim, takas görüşmeleri ve sorular.',
  keywords: ['takas mesajları', 'satıcı iletişimi', 'takas görüşmesi'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Mesajlarım | TAKAS-A',
    description: 'Takas mesajlarınız.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
