import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Topluluklar - Şehir ve İlgi Alanlarına Göre Takas',
  description: 'Takas topluluklarını keşfedin. Şehrinize, ilgi alanlarınıza göre gruplara katılın ve takas yapın.',
  keywords: ['takas toplulukları', 'şehir takas grubu', 'takas grupları', 'yerel takas topluluğu'],
  openGraph: {
    title: 'Topluluklar | TAKAS-A',
    description: 'Takas topluluklarını keşfedin.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
