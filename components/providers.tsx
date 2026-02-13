'use client'

import { SessionProvider } from 'next-auth/react'
import { LanguageProvider } from '@/lib/language-context'
import { PWAProvider } from '@/components/pwa-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchOnWindowFocus={true}
      refetchInterval={300}
      refetchWhenOffline={false}
    >
      <LanguageProvider>
        <PWAProvider>
          {children}
        </PWAProvider>
      </LanguageProvider>
    </SessionProvider>
  )
}
