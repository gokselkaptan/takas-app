import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

export const SHAPES = ['⭐', '🔑', '❤️', '💎', '🤝', '📦'] as const
const SHAPE_CODE_LENGTH = 5
const SHAPE_CODE_TTL_MS = 5 * 60 * 1000

export function generateShapeCode(): string {
  return Array.from({ length: SHAPE_CODE_LENGTH }, () => SHAPES[Math.floor(Math.random() * SHAPES.length)]).join('')
}

export function isShapeCodeValid(code: string, expiry: Date): boolean {
  if (!code || code.length === 0 || !expiry) return false

  const expiryDate = expiry instanceof Date ? expiry : new Date(expiry)
  if (Number.isNaN(expiryDate.getTime())) return false

  const now = Date.now()
  const expiresAt = expiryDate.getTime()

  return code.length >= SHAPE_CODE_LENGTH && now <= expiresAt && (expiresAt - now) <= SHAPE_CODE_TTL_MS
}