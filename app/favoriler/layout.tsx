import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Favorilerim - Takas-A',
  description: 'Favori ürünleriniz tek yerde. Beğendiğiniz takasa açık ürünleri kaydedin ve takip edin.',
  keywords: ['favori ürünler', 'beğenilen ürünler', 'takas favorileri'],
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Favorilerim | TAKAS-A',
    description: 'Favori ürünleriniz.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
