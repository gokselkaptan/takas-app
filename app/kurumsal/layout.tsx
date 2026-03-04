import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kurumsal - İşletmeler İçin Takas',
  description: 'İşletmeniz için stok fazlası ürünlerinizi değerlendirin. Kurumsal takas çözümleri ile atık azaltın, değer kazanın.',
  keywords: ['kurumsal takas', 'B2B takas', 'stok fazlası', 'işletme takası', 'şirket takası'],
  openGraph: {
    title: 'Kurumsal | TAKAS-A',
    description: 'İşletmeler için takas çözümleri. Stok fazlanızı değere dönüştürün.',
  },
}

export default function CorporateLayout({ children }: { children: React.ReactNode }) {
  return children
}
