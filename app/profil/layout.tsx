import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Profilim - Takas-A',
  description: 'Takas-A profilinizi yönetin. Ürünleriniz, takas geçmişiniz, güven puanınız ve hesap ayarlarınız.',
  keywords: ['takas profil', 'kullanıcı profili', 'takas geçmişi'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Profilim | TAKAS-A',
    description: 'Takas profiliniz.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
