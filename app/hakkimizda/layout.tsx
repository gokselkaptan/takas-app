import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hakkımızda - Takas-A Platformu Hikayesi',
  description: 'Takas-A\'nın hikayesini keşfedin. Parasız takas platformu olarak sürdürülebilir ekonomiye katkı sağlıyoruz. Takasa inanan, paylaşan topluluk.',
  keywords: ['takas-a hakkında', 'takas platformu hikayesi', 'sürdürülebilir takas', 'paylaşım ekonomisi'],
  openGraph: {
    title: 'Hakkımızda | TAKAS-A',
    description: 'Parasız takas platformu Takas-A\'nın hikayesi. Sürdürülebilir ekonomiye katkı sağlayan topluluk.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
