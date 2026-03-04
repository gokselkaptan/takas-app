import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Takas Merkezi - Teklifler ve Aktif Takaslar',
  description: 'Takas merkeziniz. Gelen ve giden teklifleri yönetin, aktif takasları takip edin, tamamlanan takasları görün.',
  keywords: ['takas merkezi', 'takas teklifleri', 'aktif takaslar', 'takas yönetimi'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Takas Merkezi | TAKAS-A',
    description: 'Tüm takas aktiviteleriniz tek yerde.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
