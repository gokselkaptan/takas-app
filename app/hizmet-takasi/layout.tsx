import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hizmet Takası - Yeteneklerinizi Takaslayın',
  description: 'Hizmet takası ile yeteneklerinizi değerlendirin. Web tasarım, çeviri, tamir, ders verme ve daha fazlası. Yetenek takası yapın.',
  keywords: ['hizmet takası', 'yetenek takası', 'servis takası', 'beceri takası', 'skill swap'],
  openGraph: {
    title: 'Hizmet Takası | TAKAS-A',
    description: 'Yeteneklerinizi takaslayın. Hizmet takası platformu.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
