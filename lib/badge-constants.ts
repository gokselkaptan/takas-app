// Badge sabitleri - Client-side güvenli
// Prisma kullanan badge-system.ts'den ayrılmış

// Tier renkleri
export const TIER_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  bronze: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  silver: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
  gold: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400' },
  platinum: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  diamond: { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' }
}

// Kategori çevirileri
export const CATEGORY_NAMES: Record<string, { tr: string, en: string }> = {
  swap: { tr: 'Takas', en: 'Swap' },
  trust: { tr: 'Güven', en: 'Trust' },
  community: { tr: 'Topluluk', en: 'Community' },
  achievement: { tr: 'Başarı', en: 'Achievement' }
}
