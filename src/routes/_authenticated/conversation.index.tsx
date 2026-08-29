import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { createThread, fetchThreads } from "@/lib/db";
import { getStoredActiveThreadId, setStoredActiveThreadId } from "@/lib/thread-storage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/conversation/")({
  validateSearch: (search: Record<string, unknown>): { seed?: string; new?: string } => ({
    ...(typeof search["seed"] === "string" && search["seed"] ? { seed: search["seed"] } : {}),
    ...(typeof search["new"] === "string" && search["new"] ? { new: search["new"] } : {}),
  }),
  component: ConversationIndex,
});

function ConversationIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { seed, new: isNew } = Route.useSearch();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;

        // If a seed prompt or explicit new conversation requested (e.g. on mobile launch), create fresh thread
        if (seed || isNew === "true" || isNew === "1") {
          const thread = await createThread();
          setStoredActiveThreadId(userId, thread.id);
          await qc.invalidateQueries({ queryKey: ["threads"] });
          navigate({
            to: "/conversation/$threadId",
            params: { threadId: thread.id },
            search: seed ? { seed } : {},
            replace: true,
          });
          return;
        }

        // Check if there is an active thread stored in localStorage
        const storedId = getStoredActiveThreadId(userId);
        const existingThreads = await fetchThreads();

        if (storedId) {
          const matched = existingThreads.find((t) => t.id === storedId);
          if (matched) {
            navigate({
              to: "/conversation/$threadId",
              params: { threadId: matched.id },
              search: {},
              replace: true,
            });
            return;
          }
        }

        // If no stored active thread or invalid, check for the most recent thread
        if (existingThreads.length > 0 && existingThreads[0]) {
          const latestId = existingThreads[0].id;
          setStoredActiveThreadId(userId, latestId);
          navigate({
            to: "/conversation/$threadId",
            params: { threadId: latestId },
            search: {},
            replace: true,
          });
          return;
        }

        // Fallback: create fresh thread if user has zero threads
        const newThread = await createThread();
        setStoredActiveThreadId(userId, newThread.id);
        await qc.invalidateQueries({ queryKey: ["threads"] });
        navigate({
          to: "/conversation/$threadId",
          params: { threadId: newThread.id },
          search: {},
          replace: true,
        });
      } catch {
        // Safe fallback
        const fallback = await createThread();
        navigate({
          to: "/conversation/$threadId",
          params: { threadId: fallback.id },
          search: seed ? { seed } : {},
          replace: true,
        });
      }
    })();
  }, [navigate, qc, seed]);

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-muted-foreground">
      Opening conversation…
    </div>
  );
}

