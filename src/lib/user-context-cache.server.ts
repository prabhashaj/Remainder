// In-memory short-TTL cache for user workspace context (20s TTL)
const contextCache = new Map<string, { text: string; expiresAt: number }>();

export function getCachedUserContext(userId: string): string | null {
  const now = Date.now();
  const cached = contextCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.text;
  }
  return null;
}

export function setCachedUserContext(userId: string, text: string, ttlMs = 20_000): void {
  contextCache.set(userId, { text, expiresAt: Date.now() + ttlMs });
}

export function invalidateUserContextCache(userId?: string): void {
  if (userId) contextCache.delete(userId);
  else contextCache.clear();
}
