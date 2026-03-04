'use client'

import { useState } from 'react'
import { SwapChat } from './SwapChat'
import { MessageCircle, Users } from 'lucide-react'

interface Participant {
  userId: string
  userName: string
}

interface MultiSwapChatProps {
  participants: Participant[]
  swapRequestId: string
  className?: string
}

/**
 * MultiSwapChat - Çoklu takas için tab'lı mesajlaşma component'i
 * Her katılımcı için ayrı bir tab gösterir ve seçili katılımcı ile mesajlaşmayı sağlar.
 */
export function MultiSwapChat({ 
  participants, 
  swapRequestId,
  className = '' 
}: MultiSwapChatProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedParticipant = participants[selectedIndex]

  if (!participants || participants.length === 0) {
    return (
      <div className={`p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center ${className}`}>
        <Users className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Henüz katılımcı yok</p>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* Tab Header */}
      <div className="flex items-center gap-1 p-2 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border-b border-gray-200 dark:border-gray-700">
        <MessageCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 mr-1" />
        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 mr-2">Katılımcılar:</span>
        <div className="flex gap-1 overflow-x-auto">
          {participants.map((participant, index) => (
            <button
              key={participant.userId}
              onClick={() => setSelectedIndex(index)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedIndex === index
                  ? 'bg-purple-600 dark:bg-purple-700 text-white shadow-md'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
              }`}
            >
              {participant.userName || `Kullanıcı ${index + 1}`}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Content */}
      {selectedParticipant && (
        <SwapChat
          swapRequestId={swapRequestId}
          otherUserId={selectedParticipant.userId}
          otherUserName={selectedParticipant.userName}
          className="max-h-[400px]"
        />
      )}
    </div>
  )
}

export default MultiSwapChat
