// Basit HTML entity encoding — XSS önleme
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

// Script tagları ve event handler'ları kaldır
export function stripDangerousTags(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/<iframe/gi, '&lt;iframe')
    .replace(/<object/gi, '&lt;object')
    .replace(/<embed/gi, '&lt;embed')
    .replace(/<form/gi, '&lt;form')
}

// Genel metin temizleme (mesajlar, açıklamalar için)
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return stripDangerousTags(input.trim())
}

// URL temizleme
export function sanitizeUrl(input: string): string {
  if (!input) return ''
  try {
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    return url.toString()
  } catch {
    return ''
  }
}
