import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessagesSquare, Send, Sparkle } from "lucide-react";
import { useEffect, useRef } from "react";

import { MessageResponse } from "@/components/ai-elements/message";
import { SpeechAndCopyToolbar } from "@/components/speech-and-copy";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

/**
 * An AI tutor scoped to one resource with streaming responses.
 * Uses the dedicated /api/material-chat endpoint for faster,
 * more relevant answers with sentence-level RAG.
 */
export function MaterialTutor({ resourceId }: { resourceId: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status } = useChat({
    id: `material-${resourceId}`,
    transport: new DefaultChatTransport({
      api: "/api/material-chat",
      body: { resourceId },
      headers: async () => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  });

  const busy = status === "submitted" || status === "streaming";

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    await sendMessage({ text: trimmed });
  };

  useEffect(() => {
    textareaRef.current?.focus();
  }, [status]);

  return (
    <section className="card-soft p-6">
      <h2 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-primary">
        <MessagesSquare className="size-5" /> Ask about this material
      </h2>

      <div className="mt-5 space-y-6">
        {messages.map((message) => (
          <div key={message.id}>
            {message.role === "user" ? (
              <p className="rounded-2xl bg-muted/60 px-5 py-3 text-base font-medium text-foreground">
                {message.parts
                  .filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join("")}
              </p>
            ) : (
              <div className="mt-3 text-base leading-relaxed">
                {(() => {
                  const text = message.parts
                    .filter((p) => p.type === "text")
                    .map((p) => p.text)
                    .join("");
                  return (
                    <>
                      <MessageResponse>{text}</MessageResponse>
                      <SpeechAndCopyToolbar text={text} className="mt-2" />
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        ))}

        {status === "submitted" && (
          <p className="flex items-center gap-2 text-base text-muted-foreground">
            <Sparkle className="size-5 animate-pulse text-primary" /> Reading
            your material…
          </p>
        )}

        {messages.length === 0 && !busy && (
          <p className="text-base leading-relaxed text-muted-foreground">
            Ask anything about this resource — Remi answers from its contents and
            your highlights, with responses streaming in real-time.
          </p>
        )}
      </div>

      <div className="mt-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const textarea = textareaRef.current;
            if (textarea) {
              void submit(textarea.value);
              textarea.value = "";
            }
          }}
        >
          <div className="relative flex items-center rounded-3xl border border-border bg-background p-2 shadow-sm transition-all focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
            <Textarea
              ref={textareaRef}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const textarea = e.currentTarget;
                  void submit(textarea.value);
                  textarea.value = "";
                }
              }}
              placeholder="What does this part actually mean?"
              className="min-h-[48px] max-h-36 flex-1 resize-none border-0 bg-transparent px-4 py-3 text-base shadow-none focus-visible:ring-0"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              className="press size-9 shrink-0 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-40"
              disabled={busy}
              aria-label="Ask question"
            >
              {busy ? (
                <Sparkle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
