interface CacheEntry {
  data: any
  expiry: number
}

const cache = new Map<string, CacheEntry>()

// Cache'den oku
export function getCache(key: string): any | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    cache.delete(key)
    return null
  }
  return entry.data
}

// Cache'e yaz
export function setCache(key: string, data: any, ttlSeconds: number = 60): void {
  cache.set(key, {
    data,
    expiry: Date.now() + (ttlSeconds * 1000)
  })
  
  // Cache boyutunu kontrol et (max 500 entry)
  if (cache.size > 500) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }
}

// Cache temizle
export function clearCache(pattern?: string): void {
  if (!pattern) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key)
  }
}
