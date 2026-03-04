// API Request Deduplication & Caching
// Aynı API çağrılarını birleştir, tekrar çağrıları engelle

interface CacheEntry {
  data: any
  timestamp: number
  promise?: Promise<any>
}

const cache = new Map<string, CacheEntry>()
const CACHE_DURATION = 5000 // 5 saniye - aynı istek tekrar yapılmaz

export function getCachedFetch(url: string, options?: RequestInit): Promise<any> {
  const cacheKey = `${options?.method || 'GET'}:${url}`
  const now = Date.now()
  
  const cached = cache.get(cacheKey)
  
  // Cache'de varsa ve süresi dolmamışsa
  if (cached) {
    // Aktif bir promise varsa (devam eden istek), onu bekle
    if (cached.promise) {
      return cached.promise
    }
    // Cache geçerli, direkt döndür
    if (now - cached.timestamp < CACHE_DURATION) {
      return Promise.resolve(cached.data)
    }
  }
  
  // Yeni istek başlat
  const fetchPromise = fetch(url, options)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      cache.set(cacheKey, { data, timestamp: Date.now() })
      return data
    })
    .catch((err) => {
      // Hata durumunda cache'i temizle
      cache.delete(cacheKey)
      throw err
    })
  
  // Promise'i cache'e koy (deduplikasyon için)
  cache.set(cacheKey, { data: null, timestamp: now, promise: fetchPromise })
  
  return fetchPromise
}

// Cache'i temizle (manuel refresh için)
export function clearFetchCache(urlPattern?: string) {
  if (urlPattern) {
    for (const key of cache.keys()) {
      if (key.includes(urlPattern)) {
        cache.delete(key)
      }
    }
  } else {
    cache.clear()
  }
}
