import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hakkımızda - Paylaşımın Geleceği',
  description: 'TAKAS-A, İzmir\'de sürdürülebilir paylaşım ekonomisini destekleyen yerel bir girişimdir. Misyonumuz ve vizyonumuz hakkında bilgi edinin.',
  keywords: ['takas-a hakkında', 'paylaşım ekonomisi', 'sürdürülebilir yaşam', 'İzmir startup'],
  openGraph: {
    title: 'Hakkımızda | TAKAS-A',
    description: 'Paylaşımın geleceğini inşa ediyoruz. TAKAS-A hikayesi.',
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
