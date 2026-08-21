/**
 * Bounded In-Memory LRU Cache with TTL support.
 * Safe for serverless environments with zero memory leak risk.
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export interface LRUCacheOptions {
  maxItems?: number;
  ttlMs?: number;
}

export class BoundedLRUCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  private maxItems: number;
  private ttlMs: number;

  constructor(options: LRUCacheOptions = {}) {
    this.maxItems = options.maxItems ?? 500;
    this.ttlMs = options.ttlMs ?? 60_000;
  }

  get(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }

    // Refresh LRU order (delete & re-insert)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, customTtlMs?: number): void {
    const ttl = customTtlMs ?? this.ttlMs;
    const expiresAt = Date.now() + ttl;

    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxItems) {
      // Evict oldest item (first key in map)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }

    this.map.set(key, { value, expiresAt });
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}

export function createLRUCache<T>(options?: LRUCacheOptions): BoundedLRUCache<T> {
  return new BoundedLRUCache<T>(options);
}
