'use client';

// =============================================================================
// TAKAS-A Veri Yükleme Optimizasyonları
// lib/data-fetcher.ts
//
// ✅ SWR pattern (stale-while-revalidate)
// ✅ In-memory cache (tekrarlı istekleri önle)
// ✅ Deduplicate (aynı anda aynı istek bir kez)
// ✅ Retry with backoff
// ✅ Timeout support
// =============================================================================

// ── In-Memory Cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>(); // Deduplicate

const DEFAULT_TTL = 30_000;      // 30 saniye
const STALE_TTL = 300_000;       // 5 dakika (stale ama gösterilebilir)

function getCached(key: string): { data: unknown; fresh: boolean } | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age < entry.ttl) return { data: entry.data, fresh: true };
  if (age < STALE_TTL) return { data: entry.data, fresh: false }; // Stale ama kullanılabilir

  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttl: number = DEFAULT_TTL) {
  cache.set(key, { data, timestamp: Date.now(), ttl });

  // Cache boyutu kontrolü (max 100 entry)
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

// ── Fetch Wrapper ───────────────────────────────────────────────────────────

interface FetchOptions {
  ttl?: number;            // Cache süresi (ms)
  revalidate?: boolean;    // Cache varsa bile yeniden çek
  deduplicate?: boolean;   // Aynı anda aynı isteği tekrarlama
  retry?: number;          // Retry sayısı
  retryDelay?: number;     // İlk retry bekleme (ms)
  timeout?: number;        // Timeout (ms)
  onStale?: (data: unknown) => void;  // Stale data callback
}

async function doFetch<T>(
  url: string,
  fetchInit: RequestInit,
  cacheKey: string,
  ttl: number,
  retry: number,
  retryDelay: number,
  timeout: number
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchInit,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setCache(cacheKey, data, ttl);
      inflight.delete(cacheKey);
      return data as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < retry) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }
  }

  inflight.delete(cacheKey);
  throw lastError || new Error('Fetch failed');
}

export async function fetchAPI<T = unknown>(
  url: string,
  options: FetchOptions & RequestInit = {}
): Promise<T> {
  const {
    ttl = DEFAULT_TTL,
    revalidate = false,
    deduplicate = true,
    retry = 2,
    retryDelay = 1000,
    timeout = 10000,
    onStale,
    ...fetchInit
  } = options;

  const cacheKey = `${fetchInit.method || 'GET'}:${url}:${JSON.stringify(fetchInit.body || '')}`;

  // 1. Cache kontrol
  if (!revalidate) {
    const cached = getCached(cacheKey);
    if (cached?.fresh) return cached.data as T;
    if (cached && !cached.fresh) {
      // Stale data'yı hemen göster, arka planda yenile
      onStale?.(cached.data);
      // Background revalidate (fire and forget)
      doFetch<T>(url, fetchInit, cacheKey, ttl, 1, retryDelay, timeout).catch(() => {});
      return cached.data as T;
    }
  }

  // 2. Deduplicate: aynı istek zaten uçuşta mı?
  if (deduplicate && inflight.has(cacheKey)) {
    return inflight.get(cacheKey) as Promise<T>;
  }

  // 3. Fetch
  const promise = doFetch<T>(url, fetchInit, cacheKey, ttl, retry, retryDelay, timeout);
  inflight.set(cacheKey, promise);
  return promise;
}

// ── Paralel Yükleme ─────────────────────────────────────────────────────────

export async function fetchParallel<T extends Record<string, string>>(
  endpoints: T,
  options: FetchOptions = {}
): Promise<{ [K in keyof T]: unknown }> {
  const entries = Object.entries(endpoints);
  const results = await Promise.all(
    entries.map(([, url]) => fetchAPI(url, options).catch(() => null))
  );

  return Object.fromEntries(
    entries.map(([key], index) => [key, results[index]])
  ) as { [K in keyof T]: unknown };
}

// ── Prefetch ────────────────────────────────────────────────────────────────

export function prefetch(url: string, options: FetchOptions = {}) {
  // Arka planda yükle, sonucu kullanma
  fetchAPI(url, { ...options, deduplicate: true }).catch(() => {});
}

// ── Cache Temizleme ─────────────────────────────────────────────────────────

export function clearCache(pattern?: string) {
  if (!pattern) {
    cache.clear();
    return;
  }
  
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

// ── Preload Hook ────────────────────────────────────────────────────────────

export function usePreload(urls: string[]) {
  if (typeof window !== 'undefined') {
    urls.forEach(url => prefetch(url));
  }
}
