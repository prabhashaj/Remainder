import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { Plus, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { RemiChat } from "@/components/remi-chat";
import { ShareConversationDialog } from "@/components/share-conversation-dialog";
import { Button } from "@/components/ui/button";
import { createThread, deleteThread, fetchNormalizedThreadMessages, fetchThreads, normalizeUIMessage } from "@/lib/db";
import { setStoredActiveThreadId } from "@/lib/thread-storage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/conversation/$threadId")({
  head: () => ({
    meta: [
      { title: "Conversation — Remispace" },
      {
        name: "description",
        content: "Chat with Remi to plan roadmaps, shape goals and stay encouraged.",
      },
      { property: "og:title", content: "Conversation — Remispace" },
      {
        property: "og:description",
        content: "Threaded conversations with Remi inside Remispace.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { seed?: string } =>
    typeof search["seed"] === "string" && search["seed"] ? { seed: search["seed"] } : {},
  component: ConversationThread,
});

function ConversationThread() {
  const { threadId } = Route.useParams();
  const { seed } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id;
      if (userId && threadId) {
        setStoredActiveThreadId(userId, threadId);
      }
    });
  }, [threadId]);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    queryFn: fetchThreads,
    staleTime: 30000,
  });

  const currentThread = threads.find((t) => t.id === threadId);
  const threadTitle = currentThread?.title || "Conversation";

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: () => fetchNormalizedThreadMessages(threadId),
    staleTime: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteThread(threadId),
    onSuccess: async () => {
      toast.success("Conversation deleted");
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      const remainingThreads = threads.filter((t) => t.id !== threadId);
      if (remainingThreads.length > 0 && remainingThreads[0]) {
        setStoredActiveThreadId(userId, remainingThreads[0].id);
      } else {
        setStoredActiveThreadId(userId, null);
      }
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/conversation", search: {}, replace: true });
    },
  });

  async function startNew() {
    const thread = await createThread();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    setStoredActiveThreadId(userId, thread.id);
    await queryClient.invalidateQueries({ queryKey: ["threads"] });
    navigate({
      to: "/conversation/$threadId",
      params: { threadId: thread.id },
      search: {},
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const initial = messages;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-border/60 bg-background/50 px-4 py-2 backdrop-blur-sm">
        <span className="text-xs font-semibold text-muted-foreground truncate max-w-[200px] sm:max-w-md">
          {threadTitle}
        </span>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-xl text-xs font-medium"
            onClick={() => setShareOpen(true)}
            disabled={initial.length === 0}
            title={initial.length === 0 ? "Send a message first to share" : "Share conversation"}
          >
            <Share2 className="size-3.5" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-xl text-xs"
            onClick={() => void startNew()}
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-xl text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="size-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </div>

      <ShareConversationDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        threadId={threadId}
        threadTitle={threadTitle}
        messages={initial}
      />
      <div className="min-h-0 flex-1">
        <RemiChat
          key={threadId}
          threadId={threadId}
          initialMessages={initial}
          seed={seed}
          suggestions={[
            "Create a roadmap to learn Agentic AI",
            "Explain what is photosynthesis",
          ]}
          onSeedConsumed={() =>
            navigate({
              to: "/conversation/$threadId",
              params: { threadId },
              search: {},
              replace: true,
            })
          }
        />
      </div>
    </div>
  );
}
