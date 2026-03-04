import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Barcelona Takas - Intercambio Gratis en Barcelona',
  description: 'Plataforma de intercambio gratuito en Barcelona. Intercanvia els teus objectes sense diners. Economía colaborativa y sostenible. ¡Empieza a intercambiar hoy!',
  keywords: ['Barcelona takas', 'intercambio Barcelona', 'trueque Barcelona', 'intercanvi Barcelona', 'swap Barcelona', 'free exchange Barcelona'],
  openGraph: {
    title: 'Barcelona Takas | TAKAS-A',
    description: 'Plataforma de intercambio gratuito en Barcelona. Intercanvia sense diners!',
    type: 'website',
    locale: 'ca_ES',
    alternateLocale: ['es_ES', 'en_US'],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
