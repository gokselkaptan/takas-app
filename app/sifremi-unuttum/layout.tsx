import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Şifremi Unuttum - Takas-A',
  description: 'Takas-A şifrenizi mi unuttunuz? E-posta adresinizle şifrenizi sıfırlayın.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
