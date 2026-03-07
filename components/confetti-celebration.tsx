'use client'
import confetti from 'canvas-confetti'

// Takas tamamlandı — büyük konfeti
export function triggerSwapConfetti() {
  // Sol taraftan
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { x: 0.2, y: 0.6 },
    colors: ['#8b5cf6', '#a78bfa', '#f59e0b', '#fbbf24', '#ffffff'],
    gravity: 0.8,
    scalar: 1.2,
  })
  // Sağ taraftan
  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { x: 0.8, y: 0.6 },
      colors: ['#8b5cf6', '#a78bfa', '#f59e0b', '#fbbf24', '#ffffff'],
      gravity: 0.8,
      scalar: 1.2,
    })
  }, 200)
  // Ortadan patlama
  setTimeout(() => {
    confetti({
      particleCount: 120,
      spread: 100,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#8b5cf6', '#a78bfa', '#f59e0b', '#fbbf24', '#c4b5fd'],
      gravity: 0.6,
      scalar: 0.9,
    })
  }, 400)
}

// Valor kazanma — coin shower
export function triggerValorConfetti() {
  confetti({
    particleCount: 40,
    spread: 45,
    origin: { x: 0.5, y: 0.4 },
    colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'],
    gravity: 1.2,
    scalar: 0.8,
    shapes: ['circle'],
  })
}

// Küçük başarı — mini konfeti
export function triggerMiniConfetti() {
  confetti({
    particleCount: 30,
    spread: 50,
    origin: { x: 0.5, y: 0.6 },
    colors: ['#8b5cf6', '#a78bfa', '#f59e0b'],
    gravity: 1,
    scalar: 0.7,
  })
}
