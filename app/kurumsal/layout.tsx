import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kurumsal - Takas-A İş Ortaklığı',
  description: 'Takas-A ile kurumsal iş birliği yapın. Şirketler için özel takas çözümleri, promosyon fırsatları ve ortaklık programları.',
  keywords: ['takas-a kurumsal', 'kurumsal takas', 'iş ortaklığı', 'B2B takas', 'şirket takası'],
  openGraph: {
    title: 'Kurumsal | TAKAS-A',
    description: 'Kurumsal takas çözümleri ve iş ortaklığı fırsatları.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
