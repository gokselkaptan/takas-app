import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Takas Topluluğu - TAKAS-A',
  description: 'Takas-A topluluğuna katılın. Takasa inanan, paylaşan, sürdürülebilir yaşamı benimseyen insanlarla tanışın.',
  keywords: ['takas topluluğu', 'takas-a topluluk', 'paylaşım topluluğu', 'sürdürülebilir topluluk'],
  openGraph: {
    title: 'Takas Topluluğu | TAKAS-A',
    description: 'Takas topluluğuna katılın.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
