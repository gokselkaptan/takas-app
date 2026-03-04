import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Giriş Yap',
  description: 'TAKAS-A hesabına giriş yap ve takas yapmaya başla. İzmir\'in en büyük takas topluluğuna katıl!',
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
