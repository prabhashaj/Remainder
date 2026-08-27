import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import {
  Share2,
  Copy,
  Check,
  Globe,
  Sparkles,
  ArrowRight,
  MessageSquare,
  Bot,
  User,
  Calendar,
  ExternalLink,
  Loader2,
  FileText,
  Sun,
  Moon,
} from "lucide-react";
import { toast } from "sonner";

import remiLogo from "@/assets/remi.png";
import { RemispaceBrand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { SpeechAndCopyToolbar } from "@/components/speech-and-copy";
import { ChatVideoEmbeds } from "@/components/chat-video-embeds";
import { useTheme } from "@/components/theme-provider";
import { useSession } from "@/hooks/use-session";
import {
  fetchSharedConversation,
  forkSharedConversation,
  type SharedConversation,
} from "@/lib/db";
import { THEMES } from "@/lib/themes";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [
      { title: "Shared Conversation — Remispace" },
      {
        name: "description",
        content: "View a public snapshot of a conversation with Remi, your AI learning companion on Remispace.",
      },
      { property: "og:title", content: "Shared Conversation — Remispace" },
      {
        property: "og:description",
        content: "Explore this AI conversation snapshot on Remispace.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: SharedConversationPage,
});

function SharedConversationPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const { theme, setTheme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [fallbackData, setFallbackData] = useState<SharedConversation | null>(null);

  // Fetch shared conversation by token from Supabase
  const {
    data: sharedFromDb,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["shared-conversation", token],
    queryFn: () => fetchSharedConversation(token),
    staleTime: 60000,
  });

  // Check URL query fallback if DB returns null
  useEffect(() => {
    if (!sharedFromDb && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("data");
      if (encoded) {
        try {
          const json = decodeURIComponent(escape(atob(encoded)));
          setFallbackData(JSON.parse(json));
        } catch (e) {
          console.error("Failed to parse fallback share data:", e);
        }
      }
    }
  }, [sharedFromDb]);

  const conversation = sharedFromDb || fallbackData;

  // Fork conversation mutation (Continue in Remispace)
  const forkMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("No share token found");
      return await forkSharedConversation(token);
    },
    onSuccess: (thread) => {
      toast.success("Conversation added to your chat history!");
      navigate({
        to: "/conversation/$threadId",
        params: { threadId: thread.id },
        search: {},
      });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to continue conversation");
    },
  });

  function handleContinue() {
    if (!session) {
      // Save pending fork token in localStorage so after login we can fork it
      if (typeof window !== "undefined") {
        window.localStorage.setItem("remispace_pending_fork_token", token);
      }
      navigate({ to: "/auth", search: { mode: "signin" } });
      return;
    }
    forkMutation.mutate();
  }

  async function handleCopyShare() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Share link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Failed to copy link");
    }
  }

  function toggleTheme() {
    const isDark = theme === "obsidian" || theme === "emerald" || theme === "velvet" || theme === "sapphire";
    setTheme(isDark ? "blush" : "obsidian");
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-3 text-sm font-medium">Loading shared conversation…</p>
      </div>
    );
  }

  if (!conversation || error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Globe className="size-7" />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
          Shared Conversation Unavailable
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          This share link may have expired, been made private by its author, or never existed.
        </p>
        <div className="mt-6 flex gap-3">
          <Button asChild variant="outline" className="rounded-xl">
            <a href="/">Go to Remispace Home</a>
          </Button>
          <Button asChild className="rounded-xl">
            <a href="/auth">Start Chatting with Remi</a>
          </Button>
        </div>
      </div>
    );
  }

  const rawMessages = Array.isArray(conversation.messages) ? conversation.messages : [];
  const messages: UIMessage[] = rawMessages.map((m: any, i: number) => ({
    id: m.id || `msg-${i}`,
    role: m.role || (i % 2 === 0 ? "user" : "assistant"),
    parts: Array.isArray(m.parts)
      ? m.parts
      : [{ type: "text", text: typeof m.content === "string" ? m.content : "" }],
  }));

  const formattedDate = new Date(conversation.created_at || Date.now()).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* Top Sticky Bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-4 sm:px-8 backdrop-blur-md">
        <a href="/" className="flex items-center gap-2 group hover:opacity-90 transition-opacity">
          <RemispaceBrand size="sm" />
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <Globe className="size-2.5" /> Shared Chat
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-xl text-muted-foreground"
          >
            {theme === "obsidian" || theme === "emerald" || theme === "velvet" || theme === "sapphire" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleCopyShare()}
            className="h-8 gap-1.5 rounded-xl text-xs"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy Link"}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleContinue}
            disabled={forkMutation.isPending}
            className="h-8 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
          >
            {forkMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>Continue this chat</span>
          </Button>
        </div>
      </header>

      {/* Main Conversation Viewer */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Conversation Header & Snapshot Banner */}
        <div className="space-y-4 border-b border-border/60 pb-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {conversation.title || "Shared Conversation"}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                {formattedDate}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <MessageSquare className="size-3.5" />
                {messages.length} {messages.length === 1 ? "message" : "messages"}
              </span>
              {!conversation.is_anonymous && conversation.user_name && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <User className="size-3.5 text-primary" />
                    Shared by {conversation.user_name}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/40 px-4 py-3 text-xs text-muted-foreground flex items-center justify-between gap-4">
            <p className="leading-relaxed">
              This is a point-in-time public snapshot of an AI conversation with <strong>Remi</strong>.
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={handleContinue}
              className="h-auto p-0 text-xs text-primary shrink-0 hover:underline"
            >
              Continue in your account →
            </Button>
          </div>
        </div>

        {/* Message Feed */}
        <div className="space-y-8">
          {messages.map((message, idx) => {
            const isUser = message.role === "user";
            const textParts = message.parts.filter((p): p is { type: "text"; text: string } => p.type === "text");
            const fileParts = message.parts.filter((p): p is any => p.type === "file");

            return (
              <div
                key={message.id || idx}
                className={`flex gap-3 sm:gap-4 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                    <img src={remiLogo} alt="Remi" className="size-5 object-contain" />
                  </div>
                )}

                <div
                  className={`flex max-w-[88%] sm:max-w-[80%] flex-col gap-2 ${
                    isUser ? "items-end" : "items-start w-full"
                  }`}
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground px-1">
                    {isUser ? (
                      <span>User</span>
                    ) : (
                      <span className="text-primary font-bold">Remi AI</span>
                    )}
                  </div>

                  {fileParts.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-1">
                      {fileParts.map((f: any, fIdx: number) => (
                        <div
                          key={fIdx}
                          className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium border border-border"
                        >
                          <FileText className="size-3.5 text-primary" />
                          <span className="truncate max-w-[140px]">{f.filename || "Attachment"}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    className={
                      isUser
                        ? "rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm sm:text-base leading-relaxed shadow-xs"
                        : "w-full rounded-2xl bg-card border border-border/70 p-4 sm:p-5 text-sm sm:text-base leading-relaxed text-card-foreground shadow-xs"
                    }
                  >
                    {textParts.map((part, pIdx) => (
                      <div key={pIdx}>
                        {isUser ? (
                          <div className="whitespace-pre-wrap font-sans">{part.text}</div>
                        ) : (
                          <>
                            <MessageResponse>{part.text}</MessageResponse>
                            <ChatVideoEmbeds text={part.text} />
                            <SpeechAndCopyToolbar
                              text={part.text}
                              id={`shared-${message.id}-${pIdx}`}
                              className="mt-3"
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {isUser && (
                  <div className="flex size-8 shrink-0 select-none items-center justify-center rounded-xl bg-secondary text-secondary-foreground border border-border/60 shadow-xs">
                    <User className="size-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom CTA Card */}
        <div className="mt-12 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 via-card to-card p-6 sm:p-8 text-center space-y-4 shadow-lg">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-6" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              Continue this conversation in Remispace
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Ask follow-up questions, generate structured study roadmaps, create active-recall flashcards, and organize research notebooks with Remi.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={handleContinue}
              disabled={forkMutation.isPending}
              className="w-full sm:w-auto h-10 gap-2 rounded-xl px-6 text-sm font-semibold shadow-md"
            >
              {forkMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Continue Conversation →
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto h-10 rounded-xl px-5 text-sm"
            >
              <a href="/auth">Create Free Account</a>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-background/50 py-6 text-center text-xs text-muted-foreground">
        <p>
          Powered by{" "}
          <a href="/" className="font-semibold text-foreground hover:underline">
            Remispace
          </a>{" "}
          — Your Dedicated AI Learning Companion
        </p>
      </footer>
    </div>
  );
}
