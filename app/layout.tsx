import type { Metadata, Viewport } from 'next'
import dynamic from 'next/dynamic'
import './globals.css'
import { Providers } from '@/components/providers'
import { ThemeProvider } from '@/components/theme-provider'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { MobileNavSkeleton } from '@/components/skeletons'

// Mobile navigation - lazy load (25KB tasarruf)
const MobileTopNavigation = dynamic(
  () => import('@/components/mobile-navigation').then(m => ({ default: m.MobileTopNavigation })),
  { ssr: false }
)
const MobileBottomNavigation = dynamic(
  () => import('@/components/mobile-navigation').then(m => ({ default: m.MobileBottomNavigation })),
  { ssr: false, loading: () => <MobileNavSkeleton /> }
)
import ErrorBoundary from '@/components/error-boundary'
import GlobalErrorHandler from '@/components/global-error-handler'
import { ConnectionStatus } from '@/components/connection-status'
import UpdateManager from '@/components/update-manager'
import { organizationSchema, websiteSchema, serviceSchema, softwareAppSchema, aggregateRatingSchema } from '@/lib/seo-config'

// Lazy load - ağır bileşenler
const RandomVideoPopup = dynamic(() => import('@/components/random-video-popup').then(m => ({ default: m.RandomVideoPopup })), { ssr: false })
const VisualSearchButton = dynamic(() => import('@/components/visual-search-button'), { ssr: false })
const BadgeNotification = dynamic(() => import('@/components/badge-notification').then(m => ({ default: m.BadgeNotification })), { ssr: false })
const EducationalPopups = dynamic(() => import('@/components/educational-popups'), { ssr: false })

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
    default: 'TAKAS-A | Global Free Swap Platform – Exchange Without Money',
    template: '%s | TAKAS-A'
  },
  description: 'Free swap platform in every city worldwide! Exchange your items without money, contribute to sustainable economy. Global sharing economy – Start now with Takas-A! | Plataforma de intercambio gratuita | Kostenlose Tauschplattform | Plataforma d\'intercanvi gratuïta',
  keywords: [
    // Turkish
    'takas', 'global takas', 'takas platformu', 'eşya takası', 'ücretsiz takas',
    'ikinci el', 'paylaşım ekonomisi', 'sürdürülebilir', 'çoklu takas', 'barter',
    // English
    'swap', 'worldwide swap', 'free exchange', 'barter platform', 'trade items',
    'sharing economy', 'sustainable exchange', 'free swap app',
    // Spanish
    'intercambio gratis', 'trueque', 'plataforma de intercambio', 'economía colaborativa',
    // German
    'tauschen', 'kostenlos tauschen', 'tauschbörse', 'nachhaltig',
    // Catalan
    'intercanvi gratuït', 'bescanvi',
    // Cities
    'Barcelona', 'İstanbul', 'Ankara', 'Madrid', 'Berlin', 'İzmir'
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
    locale: 'en_US',
    alternateLocale: ['tr_TR', 'es_ES', 'de_DE', 'ca_ES'],
    url: 'https://takas-a.com',
    siteName: 'TAKAS-A',
    title: 'TAKAS-A | Global Free Swap Platform',
    description: 'Free swap platform in every city worldwide! Exchange items without money. Sustainable sharing economy.',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'TAKAS-A - The Future of Sharing – Free Swap in Every City'
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TAKAS-A | Global Free Swap Platform',
    description: 'Free swap platform worldwide! Exchange items without money. 🌍 Sustainable sharing economy.',
    images: ['/og-image.png'],
    creator: '@takasa_global',
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
      'x-default': 'https://takas-a.com',
      'tr-TR': 'https://takas-a.com',
      'en-US': 'https://takas-a.com/global',
      'en-GB': 'https://takas-a.com/global',
      'es-ES': 'https://takas-a.com/barcelona',
      'ca-ES': 'https://takas-a.com/barcelona',
      'de-DE': 'https://takas-a.com/global',
      'de-AT': 'https://takas-a.com/global',
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
        <meta name="google-site-verification" content="oki8Bc8mHWIVN3sRObHjpu5hvCgr_Wmp9uRssMjSzRo" />
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js" async defer />
        {/* Performance - DNS Prefetch & Preconnect */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
        <ConnectionStatus />
        <UpdateManager />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <Providers>
            <GlobalErrorHandler />
            <BadgeNotification />
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
              <EducationalPopups />
              <MobileBottomNavigation />
            </ErrorBoundary>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
