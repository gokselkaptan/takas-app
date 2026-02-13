import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'
import { ThemeProvider } from '@/components/theme-provider'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { RandomVideoPopup } from '@/components/random-video-popup'
import VisualSearchButton from '@/components/visual-search-button'
import { MobileTopNavigation, MobileBottomNavigation } from '@/components/mobile-navigation'
import ErrorBoundary from '@/components/error-boundary'
import GlobalErrorHandler from '@/components/global-error-handler'
import { organizationSchema, websiteSchema, serviceSchema, softwareAppSchema, aggregateRatingSchema } from '@/lib/seo-config'

export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#0ea5e9',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://takas-a.com'),
  title: {
    default: 'TAKAS-A | İzmir\'in Ücretsiz Takas Platformu',
    template: '%s | TAKAS-A'
  },
  description: 'İzmir\'de eşyalarını para ödemeden takas et. Güvenli teslim noktaları, canlı aktivite akışı ve topluluk odaklı paylaşım ekonomisi. Hemen üye ol!',
  keywords: [
    'takas', 'İzmir takas', 'takas platformu', 'eşya takası', 'ücretsiz takas',
    'ikinci el', 'paylaşım ekonomisi', 'sürdürülebilir', 'çoklu takas', 'barter',
    'swap', 'İzmir ikinci el', 'Bornova takas', 'Konak takas', 'Karşıyaka takas'
  ],
  authors: [{ name: 'TAKAS-A', url: 'https://takas-a.com' }],
  creator: 'TAKAS-A',
  publisher: 'TAKAS-A',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/icons/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TAKAS-A',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: 'https://takas-a.com',
    siteName: 'TAKAS-A',
    title: 'TAKAS-A | İzmir\'in Ücretsiz Takas Platformu',
    description: 'İzmir\'de eşyalarını para ödemeden takas et. Güvenli teslim noktaları, canlı aktivite akışı ve topluluk odaklı paylaşım ekonomisi.',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'TAKAS-A - Paylaşımın Geleceği'
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TAKAS-A | İzmir\'in Ücretsiz Takas Platformu',
    description: 'Para ödemeden eşyalarını takas et. İzmir\'in ilk çoklu takas platformu!',
    images: ['/og-image.png'],
    creator: '@takasaizmir',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || '',
  },
  alternates: {
    canonical: 'https://takas-a.com',
    languages: {
      'tr-TR': 'https://takas-a.com',
      'en-US': 'https://takas-a.com/global',
      'es-ES': 'https://takas-a.com/barcelona',
      'ca-ES': 'https://takas-a.com/barcelona',
    },
  },
  category: 'shopping',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js" />
        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TAKAS-A" />
        <meta name="format-detection" content="telephone=no" />
        {/* Apple Touch Icons - different sizes */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-192x192.png" />
        {/* Apple Splash Screen */}
        <link rel="apple-touch-startup-image" href="/icons/icon-512x512.png" />
        {/* iOS Splash screens - iPhone */}
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" href="/icons/icon-512x512.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" href="/icons/icon-512x512.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" href="/icons/icon-512x512.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" href="/icons/icon-512x512.png" />
        {/* Schema.org JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(aggregateRatingSchema) }}
        />
      </head>
      <body className="min-h-screen bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 antialiased transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <Providers>
            <GlobalErrorHandler />
            <ErrorBoundary>
              {/* Skip to main content link for accessibility */}
              <a href="#main-content" className="skip-link">
                Ana içeriğe atla
              </a>
              <MobileTopNavigation />
              <Header />
              <main id="main-content" className="relative z-10 md:pt-20 pt-12 pb-24 md:pb-0" role="main">{children}</main>
              <Footer />
              <RandomVideoPopup />
              <VisualSearchButton />
              <MobileBottomNavigation />
            </ErrorBoundary>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
