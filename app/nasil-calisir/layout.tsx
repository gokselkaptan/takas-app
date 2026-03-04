import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nasıl Çalışır? - 3 Kolay Adım',
  description: 'TAKAS-A ile takas yapmak çok kolay! 1) Ürününü ekle 2) Takas teklifleri al 3) Güvenle takas et. İşte bu kadar basit!',
  keywords: ['takas nasıl yapılır', 'takas rehberi', 'takas adımları', 'eşya takası nasıl'],
  openGraph: {
    title: 'Nasıl Çalışır? | TAKAS-A',
    description: '3 kolay adımda takas yap! Ürün ekle, teklif al, takas et.',
  },
}

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children
}
