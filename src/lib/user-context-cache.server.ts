import { createLRUCache } from "@/lib/cache.server";

// Bounded LRU cache for user workspace context (500 max users, 20s TTL)
const contextCache = createLRUCache<string>({ maxItems: 500, ttlMs: 20_000 });

export function getCachedUserContext(userId: string): string | null {
  return contextCache.get(userId);
}

export function setCachedUserContext(userId: string, text: string, ttlMs = 20_000): void {
  contextCache.set(userId, text, ttlMs);
}

export function invalidateUserContextCache(userId?: string): void {
  if (userId) contextCache.delete(userId);
  else contextCache.clear();
}

