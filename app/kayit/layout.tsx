import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Üye Ol - Takas-A Ücretsiz Kayıt',
  description: 'Takas-A\'ya ücretsiz üye olun. Parasız takas platformuna katılın, ürünlerinizi değerlendirin, sürdürülebilir ekonominin parçası olun.',
  keywords: ['takas-a kayıt', 'takas üye ol', 'ücretsiz takas kaydı', 'takas platformu üyelik'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Üye Ol | TAKAS-A',
    description: 'Takas-A\'ya ücretsiz üye olun ve takasa başlayın.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
