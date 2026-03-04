'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { WelcomeStep } from './WelcomeStep'
import { ProfileStep } from './ProfileStep'
import { FirstProductStep } from './FirstProductStep'
import { TutorialStep } from './TutorialStep'
import { FeaturesStep } from './FeaturesStep'

type OnboardingStep = 'welcome' | 'profile' | 'first-product' | 'tutorial' | 'features'

const STORAGE_KEY = 'takas-a-onboarding-completed'
const STEP_KEY = 'takas-a-onboarding-step'

export function OnboardingFlow() {
  const { data: session, status } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
  const [profileData, setProfileData] = useState<{
    nickname?: string
    interests: string[]
    image?: string
  }>({ interests: [] })

  // Onboarding durumunu kontrol et
  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) return // Giriş yapmamış kullanıcılara gösterme

    // LocalStorage kontrolü
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem(STORAGE_KEY)
      const savedStep = localStorage.getItem(STEP_KEY) as OnboardingStep | null

      if (completed === 'true') {
        setIsOpen(false)
        return
      }

      // Daha önce başlamış ama tamamlamamışsa, kaldığı yerden devam
      if (savedStep) {
        setCurrentStep(savedStep)
      }

      // Kısa gecikme ile aç (sayfa yüklenince hemen açılmasın)
      const timer = setTimeout(() => {
        setIsOpen(true)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [session, status])

  // Adım değişikliğini kaydet
  useEffect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      localStorage.setItem(STEP_KEY, currentStep)
    }
  }, [currentStep, isOpen])

  const handleComplete = async () => {
    // Profil verilerini API'ye gönder (opsiyonel)
    if (profileData.nickname || profileData.interests.length > 0) {
      try {
        await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nickname: profileData.nickname,
            interests: profileData.interests
          })
        })
      } catch (err) {
        console.error('Profile update error:', err)
      }
    }

    // Tamamlandı olarak işaretle
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true')
      localStorage.removeItem(STEP_KEY)
    }
    setIsOpen(false)
  }

  const handleSkip = () => {
    // "Daha sonra" seçeneği - bir sonraki girişte tekrar göster
    setIsOpen(false)
  }

  const handleClose = () => {
    // X butonu ile kapat - tamamlanmış say
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true')
      localStorage.removeItem(STEP_KEY)
    }
    setIsOpen(false)
  }

  const goToStep = (step: OnboardingStep) => {
    setCurrentStep(step)
  }

  const handleProfileNext = (data: typeof profileData) => {
    setProfileData(data)
    goToStep('first-product')
  }

  // Progress hesapla
  const steps: OnboardingStep[] = ['welcome', 'profile', 'first-product', 'tutorial', 'features']
  const currentIndex = steps.indexOf(currentStep)
  const progress = ((currentIndex + 1) / steps.length) * 100

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 50 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl"
        >
          {/* Progress Bar */}
          <div className="h-1.5 bg-gray-100">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
            aria-label="Kapat"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {/* Step Göstergesi */}
          <div className="pt-4 pb-2 px-4 text-center">
            <span className="text-xs text-gray-400 font-medium">
              Adım {currentIndex + 1} / {steps.length}
            </span>
          </div>

          {/* İçerik */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] pb-6">
            <AnimatePresence mode="wait">
              {currentStep === 'welcome' && (
                <WelcomeStep
                  key="welcome"
                  userName={session?.user?.name?.split(' ')[0]}
                  onNext={() => goToStep('profile')}
                  onSkip={handleSkip}
                />
              )}

              {currentStep === 'profile' && (
                <ProfileStep
                  key="profile"
                  onNext={handleProfileNext}
                  onBack={() => goToStep('welcome')}
                  onSkip={() => goToStep('first-product')}
                />
              )}

              {currentStep === 'first-product' && (
                <FirstProductStep
                  key="first-product"
                  onNext={() => goToStep('tutorial')}
                  onBack={() => goToStep('profile')}
                  onSkip={handleSkip}
                />
              )}

              {currentStep === 'tutorial' && (
                <TutorialStep
                  key="tutorial"
                  onNext={() => goToStep('features')}
                  onBack={() => goToStep('first-product')}
                  onSkip={() => goToStep('features')}
                />
              )}

              {currentStep === 'features' && (
                <FeaturesStep
                  key="features"
                  onComplete={handleComplete}
                  onBack={() => goToStep('tutorial')}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
