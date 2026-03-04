import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Global Swap Platform - Free Exchange Worldwide',
  description: 'Global free swap platform. Exchange items without money in any city worldwide. Sustainable sharing economy. Join TAKAS-A today!',
  keywords: ['global swap', 'worldwide exchange', 'free swap platform', 'international barter', 'sharing economy', 'sustainable trade'],
  openGraph: {
    title: 'Global Swap Platform | TAKAS-A',
    description: 'Free swap platform worldwide. Exchange items without money.',
    type: 'website',
    locale: 'en_US',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
