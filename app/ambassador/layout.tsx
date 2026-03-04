import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Takas Elçisi Ol - TAKAS-A Ambassador Program',
  description: 'Takas-A elçisi olun! Topluluğunuzda takas kültürünü yayın, özel ayrıcalıklar ve ödüller kazanın.',
  keywords: ['takas elçisi', 'takas-a ambassador', 'topluluk lideri', 'takas şampiyonu'],
  openGraph: {
    title: 'Takas Elçisi | TAKAS-A',
    description: 'Takas elçisi olun, topluluğunuzda takas kültürünü yayın.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
