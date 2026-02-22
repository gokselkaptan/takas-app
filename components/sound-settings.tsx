'use client'

import { useState, useEffect } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { isSoundEnabled, setSoundEnabled, getVolume, setVolume, playNotificationSound } from '@/lib/notification-sounds'

export function SoundToggle() {
  const [enabled, setEnabled] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setEnabled(isSoundEnabled())
  }, [])

  if (!mounted) return null

  return (
    <button
      onClick={() => {
        const newState = !enabled
        setEnabled(newState)
        setSoundEnabled(newState)
        if (newState) playNotificationSound()
      }}
      className={`p-2 rounded-lg transition-colors ${
        enabled 
          ? 'text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-gray-700' 
          : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      title={enabled ? 'Sesi kapat' : 'Sesi aç'}
    >
      {enabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
    </button>
  )
}

export function SoundSettingsPanel() {
  const [enabled, setEnabled] = useState(true)
  const [volume, setVolumeState] = useState(0.5)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setEnabled(isSoundEnabled())
    setVolumeState(getVolume())
  }, [])

  if (!mounted) return null

  return (
    <div className="space-y-4">
      {/* Ses Açık/Kapalı */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {enabled ? (
            <Volume2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          ) : (
            <VolumeX className="w-5 h-5 text-gray-400" />
          )}
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Bildirim Sesleri</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mesaj ve takas bildirimleri için ses çal
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            const newState = !enabled
            setEnabled(newState)
            setSoundEnabled(newState)
            if (newState) playNotificationSound()
          }}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            enabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Ses Seviyesi */}
      {enabled && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Ses Seviyesi</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {Math.round(volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => {
              const newVolume = parseFloat(e.target.value)
              setVolumeState(newVolume)
              setVolume(newVolume)
            }}
            onMouseUp={() => playNotificationSound()}
            onTouchEnd={() => playNotificationSound()}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
        </div>
      )}

      {/* Test Butonu */}
      {enabled && (
        <button
          onClick={() => playNotificationSound()}
          className="w-full px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
        >
          🔔 Test Sesi Çal
        </button>
      )}
    </div>
  )
}
