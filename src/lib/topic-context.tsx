import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type TopicFocus = { itemId: string; label: string };

type Ctx = {
  topic: TopicFocus | null;
  setTopic: (topic: TopicFocus | null) => void;
};

const TopicContext = createContext<Ctx>({ topic: null, setTopic: () => {} });

/**
 * Tracks which lesson / sub-topic the user is currently reading so Remi's dock
 * can offer "ask about this topic" with real page context.
 */
export function TopicProvider({ children }: { children: ReactNode }) {
  const [topic, setTopic] = useState<TopicFocus | null>(null);
  const value = useMemo(() => ({ topic, setTopic }), [topic]);
  return <TopicContext.Provider value={value}>{children}</TopicContext.Provider>;
}

export function useTopicContext(): Ctx {
  return useContext(TopicContext);
}

/** Registers the current page's topic while mounted. */
export function useRegisterTopic(topic: TopicFocus | null) {
  const { setTopic } = useTopicContext();
  const itemId = topic?.itemId ?? null;
  const label = topic?.label ?? null;

  useEffect(() => {
    if (itemId && label) setTopic({ itemId, label });
    return () => setTopic(null);
  }, [itemId, label, setTopic]);
}
