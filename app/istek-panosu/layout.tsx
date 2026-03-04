import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'İstek Panosu - Takas-A',
  description: 'Aradığınız ürünleri isteyin, diğer kullanıcılar size ulaşsın. Takas talepleri ve istekler.',
  keywords: ['istek panosu', 'takas talebi', 'ürün arayan', 'takas isteği'],
  openGraph: {
    title: 'İstek Panosu | TAKAS-A',
    description: 'Aradığınız ürünleri isteyin.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
