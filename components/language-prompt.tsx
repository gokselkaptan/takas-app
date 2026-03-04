'use client'

import { useLanguage } from '@/lib/language-context'
import { Language } from '@/lib/translations'
import { X, Globe } from 'lucide-react'

const LANGUAGE_OPTIONS: { code: Language; name: string; nativeName: string; flag: string }[] = [
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', flag: '🏴' },
]

export function LanguagePrompt() {
  const { language, setLanguage, showLanguagePrompt, setShowLanguagePrompt } = useLanguage()

  if (!showLanguagePrompt) return null

  const handleSelect = (lang: Language) => {
    setLanguage(lang)
    setShowLanguagePrompt(false)
  }

  const handleDismiss = () => {
    setShowLanguagePrompt(false)
    try {
      localStorage.setItem('language-prompted', 'true')
    } catch {}
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-5 text-center">
          <Globe className="w-10 h-10 mx-auto mb-2 opacity-80" />
          <h2 className="text-lg font-bold">Choose Your Language</h2>
          <p className="text-sm text-white/70 mt-1">Dilinizi seçin / Elige tu idioma</p>
        </div>

        {/* Dil Seçenekleri */}
        <div className="p-4 space-y-2">
          {LANGUAGE_OPTIONS.map(opt => (
            <button
              key={opt.code}
              onClick={() => handleSelect(opt.code)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                language === opt.code
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span className="text-2xl">{opt.flag}</span>
              <div className="text-left flex-1">
                <p className="font-bold text-gray-900 dark:text-white">{opt.nativeName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{opt.name}</p>
              </div>
              {language === opt.code && (
                <span className="text-purple-600 font-bold">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Kapat */}
        <div className="px-4 pb-4">
          <button
            onClick={handleDismiss}
            className="w-full py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Sonra seçerim / Decide later
          </button>
        </div>
      </div>
    </div>
  )
}
