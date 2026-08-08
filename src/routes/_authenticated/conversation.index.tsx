import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { createThread } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/conversation/")({
  validateSearch: (search: Record<string, unknown>): { seed?: string } =>
    typeof search["seed"] === "string" && search["seed"] ? { seed: search["seed"] } : {},
  component: ConversationIndex,
});

function ConversationIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { seed } = Route.useSearch();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const thread = await createThread();
      await qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({
        to: "/conversation/$threadId",
        params: { threadId: thread.id },
        search: seed ? { seed } : {},
        replace: true,
      });
    })();
  }, [navigate, qc, seed]);

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-muted-foreground">
      Opening a conversation with Remi…
    </div>
  );
}
