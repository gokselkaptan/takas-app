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

export const SHAPES = [
  { icon: 'Circle', color: 'blue', gradient: 'from-blue-500 to-blue-600', ringClass: 'ring-blue-500/20', legacyEmoji: '⭐' },
  { icon: 'Star', color: 'amber', gradient: 'from-amber-500 to-amber-600', ringClass: 'ring-amber-500/20', legacyEmoji: '🔑' },
  { icon: 'Heart', color: 'rose', gradient: 'from-rose-500 to-rose-600', ringClass: 'ring-rose-500/20', legacyEmoji: '❤️' },
  { icon: 'Diamond', color: 'purple', gradient: 'from-purple-500 to-purple-600', ringClass: 'ring-purple-500/20', legacyEmoji: '💎' },
  { icon: 'Handshake', color: 'emerald', gradient: 'from-emerald-500 to-emerald-600', ringClass: 'ring-emerald-500/20', legacyEmoji: '🤝' },
  { icon: 'Package', color: 'orange', gradient: 'from-orange-500 to-orange-600', ringClass: 'ring-orange-500/20', legacyEmoji: '📦' },
  { icon: 'Hexagon', color: 'cyan', gradient: 'from-cyan-500 to-cyan-600', ringClass: 'ring-cyan-500/20', legacyEmoji: '⬢' },
  { icon: 'Zap', color: 'yellow', gradient: 'from-yellow-500 to-yellow-600', ringClass: 'ring-yellow-500/20', legacyEmoji: '⚡' },
] as const

export type ShapeDefinition = (typeof SHAPES)[number]

export const SHAPE_CODE_LENGTH = 5
const SHAPE_CODE_TTL_MS = 5 * 60 * 1000

const LEGACY_EMOJI_TO_INDEX = SHAPES.reduce<Record<string, number>>((acc, shape, index) => {
  acc[shape.legacyEmoji] = index
  return acc
}, {})

const ICON_TO_INDEX = SHAPES.reduce<Record<string, number>>((acc, shape, index) => {
  acc[shape.icon.toLowerCase()] = index
  return acc
}, {})

const parseLegacyEmojiCode = (code: string): number[] => {
  if (!code) return []

  const indices: number[] = []
  let remaining = code

  while (remaining.length > 0) {
    const matchedEntry = Object.entries(LEGACY_EMOJI_TO_INDEX)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([emoji]) => remaining.startsWith(emoji))

    if (!matchedEntry) return []

    const [emoji, index] = matchedEntry
    indices.push(index)
    remaining = remaining.slice(emoji.length)
  }

  return indices
}

export function shapeCodeToIndices(code: string): number[] {
  const normalized = normalizeShapeCode(code)

  if (!normalized || !/^\d+$/.test(normalized)) return []

  return normalized
    .split('')
    .map((char) => Number.parseInt(char, 10))
    .filter((index) => Number.isInteger(index) && index >= 0 && index < SHAPES.length)
}

export function normalizeShapeCode(code: string): string {
  const rawCode = String(code || '').trim()
  if (!rawCode) return ''

  if (rawCode.includes(',')) {
    const tokens = rawCode.split(',').map((token) => token.trim()).filter(Boolean)
    if (!tokens.length) return ''

    const indices = tokens.map((token) => {
      const iconIndex = ICON_TO_INDEX[token.toLowerCase()]
      return Number.isInteger(iconIndex) ? iconIndex : -1
    })

    if (indices.some((index) => index < 0)) return ''
    return indices.join('')
  }

  if (/^\d+$/.test(rawCode)) {
    const allInRange = rawCode.split('').every((char) => {
      const index = Number.parseInt(char, 10)
      return Number.isInteger(index) && index >= 0 && index < SHAPES.length
    })

    return allInRange ? rawCode : ''
  }

  const legacyIndices = parseLegacyEmojiCode(rawCode)
  if (legacyIndices.length) {
    return legacyIndices.join('')
  }

  return ''
}

export function generateShapeCode(): string {
  return Array.from({ length: SHAPE_CODE_LENGTH }, () => Math.floor(Math.random() * SHAPES.length)).join('')
}

export function isShapeCodeValid(code: string, expiry: Date): boolean {
  const normalizedCode = normalizeShapeCode(code)
  if (!normalizedCode || normalizedCode.length === 0 || !expiry) return false

  const expiryDate = expiry instanceof Date ? expiry : new Date(expiry)
  if (Number.isNaN(expiryDate.getTime())) return false

  const now = Date.now()
  const expiresAt = expiryDate.getTime()

  return normalizedCode.length >= SHAPE_CODE_LENGTH && now <= expiresAt && (expiresAt - now) <= SHAPE_CODE_TTL_MS
}
