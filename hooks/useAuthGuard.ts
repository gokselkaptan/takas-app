'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface AuthGuardOptions {
  /** Where to redirect if not authenticated (default: '/giris') */
  redirectTo?: string
  /** Timeout in ms for waiting email after authenticated (default: 5000) */
  sessionTimeout?: number
  /** Callback when session is ready */
  onReady?: (email: string) => void
}

interface AuthGuardResult {
  /** Session status */
  status: 'loading' | 'authenticated' | 'unauthenticated'
  /** User email (null if not ready) */
  email: string | null
  /** Whether auth is fully ready (authenticated + email exists) */
  isReady: boolean
  /** Whether currently loading/checking */
  isLoading: boolean
}

/**
 * Custom hook for auth guard with timeout protection.
 * Handles the edge case where status is 'authenticated' but email is not yet available.
 * 
 * @example
 * const { isReady, isLoading, email } = useAuthGuard({
 *   onReady: (email) => {
 *     fetchUserData(email)
 *   }
 * })
 * 
 * if (isLoading) return <LoadingSpinner />
 */
export function useAuthGuard(options: AuthGuardOptions = {}): AuthGuardResult {
  const {
    redirectTo = '/giris',
    sessionTimeout = 5000,
    onReady
  } = options
  
  const { data: session, status } = useSession()
  const router = useRouter()
  const sessionWaitStartRef = useRef<number | null>(null)
  const onReadyCalledRef = useRef(false)
  
  const email = session?.user?.email ?? null
  const isReady = status === 'authenticated' && !!email
  const isLoading = status === 'loading' || (status === 'authenticated' && !email)
  
  useEffect(() => {
    // Still loading from next-auth
    if (status === 'loading') {
      return
    }
    
    // Not authenticated -> redirect
    if (status === 'unauthenticated') {
      router.replace(redirectTo)
      return
    }
    
    // Authenticated but email not ready -> wait with timeout
    if (status === 'authenticated' && !email) {
      if (!sessionWaitStartRef.current) {
        sessionWaitStartRef.current = Date.now()
      }
      
      const waitedTime = Date.now() - sessionWaitStartRef.current
      if (waitedTime > sessionTimeout) {
        console.warn('[useAuthGuard] Session email timeout - redirecting')
        sessionWaitStartRef.current = null
        router.replace(redirectTo)
        return
      }
      
      // Poll again
      const timeoutId = setTimeout(() => {}, 100)
      return () => clearTimeout(timeoutId)
    }
    
    // Fully ready
    if (status === 'authenticated' && email) {
      sessionWaitStartRef.current = null
      
      // Call onReady only once
      if (onReady && !onReadyCalledRef.current) {
        onReadyCalledRef.current = true
        onReady(email)
      }
    }
  }, [status, email, router, redirectTo, sessionTimeout, onReady])
  
  // Reset onReadyCalled when email changes (e.g., logout then login as different user)
  useEffect(() => {
    if (!email) {
      onReadyCalledRef.current = false
    }
  }, [email])
  
  return {
    status,
    email,
    isReady,
    isLoading
  }
}
