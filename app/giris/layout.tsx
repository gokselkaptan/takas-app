import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Giriş Yap - Takas-A',
  description: 'Takas-A hesabınıza giriş yapın. Ücretsiz takas platformuna erişin, ürünlerinizi takasla, değer yarat.',
  keywords: ['takas-a giriş', 'takas giriş yap', 'takas platformu login', 'ücretsiz takas'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Giriş Yap | TAKAS-A',
    description: 'Takas-A hesabınıza giriş yapın.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
