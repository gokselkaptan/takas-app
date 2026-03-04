import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Panel - Takas-A',
  description: 'Takas-A yönetim paneli.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
