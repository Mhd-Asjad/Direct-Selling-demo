/**
 * Simple in-memory cache to avoid heavy database queries.
 * Ideal for small to medium scale where external Redis is overkill.
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();

  // Default TTL in milliseconds (e.g. 5 minutes)
  private defaultTTL = 5 * 60 * 1000;

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = this.defaultTTL): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Utility to clear cache entries by prefix
  clearPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const appCache = new MemoryCache();
