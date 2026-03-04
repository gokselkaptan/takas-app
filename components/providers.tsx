'use client'

import { SessionProvider } from 'next-auth/react'
import { LanguageProvider } from '@/lib/language-context'
import { ToastProvider } from '@/lib/toast-context'
import { LanguagePrompt } from '@/components/language-prompt'
import dynamic from 'next/dynamic'

// PWA Provider - lazy load (~34KB tasarruf)
const PWAProvider = dynamic(
  () => import('@/components/pwa-provider').then(m => ({ default: m.PWAProvider })),
  { ssr: false }
)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchOnWindowFocus={true}
      refetchInterval={0}
      refetchWhenOffline={false}
    >
      <LanguageProvider>
        <LanguagePrompt />
        <ToastProvider>
          <PWAProvider>
            {children}
          </PWAProvider>
        </ToastProvider>
      </LanguageProvider>
    </SessionProvider>
  )
}
