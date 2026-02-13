import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ücretsiz Üye Ol',
  description: 'TAKAS-A\'ya ücretsiz üye ol ve hemen takas yapmaya başla! Kayıt ol, 50 Valor kazan, ilk takasını gerçekleştir.',
  keywords: ['takas üye ol', 'takas-a kayıt', 'ücretsiz üyelik'],
  robots: {
    index: false,
    follow: false,
  },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
