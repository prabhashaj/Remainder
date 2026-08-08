import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type UIMessage } from "ai";
import { BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import remiLogo from "@/assets/remi.png";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ChatVideoEmbeds } from "@/components/chat-video-embeds";

import { supabase } from "@/integrations/supabase/client";
import { renameThread } from "@/lib/db";

const toolLabels: Record<string, string> = {
  delegateToPlanner: "Building your plan",
  researchResources: "Finding tutorials",
  webSearch: "Searching the web",
  writeLessonForSubtopic: "Writing the lesson",
  generateNotebook: "Generating study notebook",
  saveMemory: "Remembering this",
};

type ToolPartLike = { type: string; state: string };

function ToolChip({ part }: { part: ToolPartLike }) {
  const name =
    part.type === "dynamic-tool" ? "tool" : part.type.replace(/^tool-/, "");
  const label = toolLabels[name] ?? name;
  const done = part.state === "output-available";
  const errored = part.state === "output-error";

  return (
    <div
      className={`my-1.5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
        errored
          ? "bg-destructive/10 text-destructive"
          : done
            ? "bg-accent text-accent-foreground"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {done ? (
        <CheckCircle2 className="size-4 text-primary" />
      ) : errored ? null : (
        <Loader2 className="size-4 animate-spin" />
      )}
      {done ? label : errored ? `${label} failed` : `${label}…`}
    </div>
  );
}

export function RemiChat({
  threadId,
  initialMessages,
  seed,
  onSeedConsumed,
  compact = false,
  suggestions = [],
  showTranscript = true,
  topic = null,
  onActivity,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  seed?: string | undefined;
  onSeedConsumed?: (() => void) | undefined;
  compact?: boolean;
  suggestions?: string[];
  showTranscript?: boolean;
  topic?: { itemId: string; label: string } | null | undefined;
  onActivity?: (() => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const renamed = useRef(initialMessages.length > 0);
  const seedSent = useRef(false);

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { threadId },
      headers: async () => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
    onError: (error) =>
      toast.error(error.message || "Remi couldn't reply just now."),
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: ["roadmaps"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      void queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
  });

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    onActivity?.();
    if (!renamed.current) {
      renamed.current = true;
      await renameThread(threadId, trimmed.slice(0, 60));
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
    const topicId = topic ? topic.itemId : null;
    await sendMessage(
      { text: trimmed },
      topicId ? { body: { threadId, topicItemId: topicId } } : undefined,
    );
  }

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  useEffect(() => {
    if (!seed || seedSent.current || initialMessages.length > 0) return;
    seedSent.current = true;
    void submit(seed);
    onSeedConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const busy = status === "submitted" || status === "streaming";


  return (
    <div className="flex h-full min-h-0 flex-col text-base">
      {showTranscript && (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent
            className={compact ? "w-full" : "mx-auto w-full max-w-3xl"}
          >
            {messages.length === 0 && (
              <div className={compact ? "py-6 text-center" : "py-16 text-center"}>
                <img
                  src={remiLogo}
                  alt="Remi"
                  width={compact ? 56 : 80}
                  height={compact ? 56 : 80}
                  className={compact ? "mx-auto size-14" : "mx-auto size-20"}
                />
                <h1
                  className={`mt-4 font-display font-bold ${compact ? "text-xl" : "text-3xl"}`}
                >
                  Hi, I'm Remi.
                </h1>
                <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-muted-foreground">
                  Ask me to build a detailed roadmap, research a topic, or plan
                  your week. I can search the web for the latest and write full
                  lessons for every sub-topic.
                </p>
                {suggestions.length > 0 && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void submit(s)}
                        className="press rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return (
                        <div key={index}>
                          <MessageResponse>{part.text}</MessageResponse>
                          {message.role === "assistant" && (
                            <ChatVideoEmbeds text={part.text} />
                          )}
                        </div>
                      );
                    }
                    if (
                      part.type === "dynamic-tool" ||
                      part.type.startsWith("tool-")
                    ) {
                      return <ToolChip key={index} part={part as ToolPartLike} />;
                    }
                    return null;
                  })}

                </MessageContent>
              </Message>
            ))}

            {status === "submitted" && (
              <div className="px-3 py-2 text-base">
                <Shimmer>Thinking…</Shimmer>
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div
        className={
          compact ? "w-full px-3 pb-3" : "mx-auto w-full max-w-3xl px-3 pb-5"
        }
      >
        {topic && (
          <p className="mb-2 flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <BookOpen className="size-4 text-primary" />
            <span className="min-w-0 truncate">
              Answering with context from{" "}
              <span className="font-semibold text-foreground">{topic.label}</span>
            </span>
          </p>
        )}
        <PromptInput onSubmit={(message) => void submit(message.text ?? "")}>
          <PromptInputTextarea
            ref={textareaRef}
            placeholder={
              topic
                ? `Ask a doubt about ${topic.label}…`
                : "What do you want to create?"
            }
            className="min-h-[64px]"
          />

          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={busy} />
          </PromptInputFooter>

        </PromptInput>
      </div>
    </div>
  );
}
