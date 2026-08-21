const ACTIVE_THREAD_KEY = "remispace.active_thread";
export const ACTIVE_THREAD_CHANGE_EVENT = "remispace-active-thread-change";

export function getActiveThreadKey(userId: string): string {
  return `${ACTIVE_THREAD_KEY}.${userId}`;
}

export function getStoredActiveThreadId(userId?: string | null): string | null {
  if (typeof window === "undefined" || !userId) return null;
  return window.localStorage.getItem(getActiveThreadKey(userId));
}

export function setStoredActiveThreadId(userId: string | null | undefined, threadId: string | null): void {
  if (typeof window === "undefined" || !userId) return;
  const key = getActiveThreadKey(userId);
  if (threadId) {
    window.localStorage.setItem(key, threadId);
  } else {
    window.localStorage.removeItem(key);
  }
  window.dispatchEvent(
    new CustomEvent(ACTIVE_THREAD_CHANGE_EVENT, {
      detail: { threadId, userId },
    }),
  );
}

export function clearStoredActiveThreadId(userId?: string | null): void {
  setStoredActiveThreadId(userId, null);
}
