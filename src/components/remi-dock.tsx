import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { MessageCircle, Maximize2, Plus, Sparkle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { RemiChat } from "@/components/remi-chat";
import { Button } from "@/components/ui/button";
import { createThread, fetchThreadMessages } from "@/lib/db";
import { useTopicContext } from "@/lib/topic-context";

const STORAGE_KEY = "remainder.dock.thread";

/** Shared thread bootstrap so the dock and the dashboard panel share one chat. */
function useDockThread() {
  const qc = useQueryClient();
  const [threadId, setThreadId] = useState<string | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current || typeof window === "undefined") return;
    booted.current = true;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setThreadId(stored);
      return;
    }
    void createThread().then((thread) => {
      window.localStorage.setItem(STORAGE_KEY, thread.id);
      setThreadId(thread.id);
      void qc.invalidateQueries({ queryKey: ["threads"] });
    });
  }, [qc]);

  async function startFresh() {
    const thread = await createThread();
    window.localStorage.setItem(STORAGE_KEY, thread.id);
    setThreadId(thread.id);
    void qc.invalidateQueries({ queryKey: ["threads"] });
    return thread.id;
  }

  return { threadId, startFresh };
}

function RemiHeader({
  threadId,
  onNew,
  right,
}: {
  threadId: string | null;
  onNew: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-5 pt-4 pb-1">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
        <Sparkle className="size-5 text-primary" />
      </span>
      <span className="font-display text-lg font-bold">Remi</span>
      <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
        Agent
      </span>
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="New conversation"
        className="rounded-xl text-muted-foreground"
        onClick={onNew}
      >
        <Plus className="size-5" />
      </Button>
      {threadId && (
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          aria-label="Open full chat"
          className="rounded-xl text-muted-foreground"
        >
          <Link to="/conversation/$threadId" params={{ threadId }} search={{}}>
            <Maximize2 className="size-5" />
          </Link>
        </Button>
      )}
      {right}
    </div>
  );
}

/**
 * Floating chatbot bubble available on every workspace page except the
 * dashboard (which hosts a full-size Remi panel in its main section).
 */
export function RemiDock() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { topic } = useTopicContext();
  const { threadId, startFresh } = useDockThread();
  const [open, setOpen] = useState(false);

  if (pathname.startsWith("/conversation") || pathname.startsWith("/dashboard"))
    return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Chat with Remi"
        className="press fixed bottom-6 right-6 z-40 flex size-15 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_18px_40px_-16px_hsl(var(--foreground)/0.5)] transition-transform hover:scale-105"
      >
        <MessageCircle className="size-7" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex max-h-[min(82vh,760px)] w-[min(calc(100vw-2.5rem),480px)] flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card/98 shadow-[0_24px_60px_-24px_hsl(var(--foreground)/0.4)] backdrop-blur">
      <RemiHeader
        threadId={threadId}
        onNew={() => void startFresh()}
        right={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close Remi"
            className="rounded-xl text-muted-foreground"
            onClick={() => setOpen(false)}
          >
            <X className="size-5" />
          </Button>
        }
      />
      {threadId ? (
        <DockChat threadId={threadId} topic={topic} />
      ) : (
        <div className="px-5 py-6 text-base text-muted-foreground">
          Waking Remi up…
        </div>
      )}
    </div>
  );
}

/** Inline, roomy Remi workspace for the dashboard's main column. */
export function RemiPanel({ className = "" }: { className?: string }) {
  const { topic } = useTopicContext();
  const { threadId, startFresh } = useDockThread();

  return (
    <section
      className={`card-soft flex h-[min(75vh,700px)] flex-col overflow-hidden p-0 ${className}`}
    >
      <RemiHeader threadId={threadId} onNew={() => void startFresh()} />
      {threadId ? (
        <DockChat threadId={threadId} topic={topic} />
      ) : (
        <div className="px-5 py-6 text-base text-muted-foreground">
          Waking Remi up…
        </div>
      )}
    </section>
  );
}

function DockChat({
  threadId,
  topic,
}: {
  threadId: string;
  topic: { itemId: string; label: string } | null;
}) {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: () => fetchThreadMessages(threadId),
  });

  if (isLoading) {
    return (
      <div className="px-5 py-6 text-sm text-muted-foreground">Loading…</div>
    );
  }

  const initial = (rows ?? [])
    .map((row) => row.message as unknown as UIMessage)
    .filter((m) => m && typeof m === "object" && Array.isArray(m.parts));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RemiChat
        key={threadId}
        threadId={threadId}
        initialMessages={initial}
        compact
        topic={topic}
        suggestions={[
          "Plan a detailed roadmap for me",
          "What should I do today?",
        ]}
      />
    </div>
  );
}
