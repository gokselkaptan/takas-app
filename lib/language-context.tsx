'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, Language, TranslationKey } from './translations'

// Re-export Language for convenience
export type { Language }

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
  showLanguagePrompt: boolean
  setShowLanguagePrompt: (show: boolean) => void
}

const validLanguages: Language[] = ['tr', 'en', 'es', 'ca']

const defaultContext: LanguageContextType = {
  language: 'tr',
  setLanguage: () => {},
  t: (key: TranslationKey) => translations.tr[key] || key,
  showLanguagePrompt: false,
  setShowLanguagePrompt: () => {},
}

const LanguageContext = createContext<LanguageContextType>(defaultContext)

/**
 * Tarayıcı dilinden desteklenen dili tespit et
 */
function detectBrowserLanguage(): Language | null {
  if (typeof navigator === 'undefined') return null
  
  // navigator.languages (dizi) veya navigator.language (tekil)
  const browserLangs = navigator.languages 
    ? [...navigator.languages] 
    : [navigator.language]
  
  for (const lang of browserLangs) {
    const code = lang.toLowerCase().split('-')[0] // "en-US" → "en"
    if (code === 'tr') return 'tr'
    if (code === 'en') return 'en'
    if (code === 'es') return 'es'
    if (code === 'ca') return 'ca'
  }
  
  return null
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('tr')
  const [mounted, setMounted] = useState(false)
  const [showLanguagePrompt, setShowLanguagePrompt] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    try {
      // 1. localStorage'da kayıtlı tercih var mı?
      const saved = localStorage.getItem('language') as Language
      if (saved && validLanguages.includes(saved)) {
        setLanguageState(saved)
        return
      }
      
      // 2. Daha önce dil soruldu mu?
      const prompted = localStorage.getItem('language-prompted')
      if (prompted) {
        // Sorulmuş ama seçilmemiş → varsayılan TR
        return
      }
      
      // 3. Tarayıcı dilini tespit et
      const browserLang = detectBrowserLanguage()
      
      if (browserLang && browserLang !== 'tr') {
        // Türkçe değilse → kullanıcıya sor
        setLanguageState(browserLang) // geçici olarak tespit edilen dili ayarla
        setShowLanguagePrompt(true)   // prompt göster
      }
      // Türkçe ise sessizce devam et
      
    } catch (e) {
      // localStorage not available
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem('language', lang)
      localStorage.setItem('language-prompted', 'true')
    } catch (e) {}
  }

  const t = (key: TranslationKey): string => {
    return translations[language]?.[key] || translations.tr[key] || key
  }

  const value = mounted 
    ? { language, setLanguage, t, showLanguagePrompt, setShowLanguagePrompt } 
    : defaultContext

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
