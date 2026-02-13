'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, Language, TranslationKey } from './translations'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const validLanguages: Language[] = ['tr', 'en', 'es', 'ca']

const defaultContext: LanguageContextType = {
  language: 'tr',
  setLanguage: () => {},
  t: (key: TranslationKey) => translations.tr[key] || key
}

const LanguageContext = createContext<LanguageContextType>(defaultContext)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('tr')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('language') as Language
      if (saved && validLanguages.includes(saved)) {
        setLanguageState(saved)
      }
    } catch (e) {
      // localStorage not available
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem('language', lang)
    } catch (e) {
      // localStorage not available
    }
  }

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key
  }

  const value = mounted ? { language, setLanguage, t } : defaultContext

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
