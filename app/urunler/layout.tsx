import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ürünler - Binlerce Takas Fırsatı',
  description: 'Elektronik, giyim, kitap, ev eşyaları ve daha fazlası! İzmir\'de takas için yüzlerce ürün seni bekliyor. Filtrele, bul, takas et.',
  keywords: ['takas ürünleri', 'İzmir ikinci el', 'eşya takası', 'kitap takası', 'elektronik takas'],
  openGraph: {
    title: 'Ürünler | TAKAS-A',
    description: 'Binlerce takas fırsatı! Elektronik, giyim, kitap ve daha fazlası.',
  },
}

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children
}
