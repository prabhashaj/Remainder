import React from "react";
import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import {
  AlertCircle,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  Compass,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import remiLogo from "@/assets/remi.png";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { SpeechAndCopyToolbar } from "@/components/speech-and-copy";
import { ChatVideoEmbeds } from "@/components/chat-video-embeds";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { supabase } from "@/integrations/supabase/client";
import { renameThread } from "@/lib/db";
import { cn } from "@/lib/utils";

const toolLabels: Record<string, string> = {
  delegateToPlanner: "Building learning plan",
  researchResources: "Finding video tutorials",
  webSearch: "Searching the web",
  searchPhotos: "Searching photos & diagrams",
  writeLessonForSubtopic: "Writing subtopic lesson",
  generateNotebook: "Generating study notebook",
  editNotebook: "Updating study notebook",
  saveMemory: "Saving memory note",
};

type ToolPartLike = { type: string; state: string };

function ToolGroup({ parts }: { parts: ToolPartLike[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const allDone = parts.every((p) => p.state === "output-available");
  const anyError = parts.some((p) => p.state === "output-error");
  const isRunning = !allDone && !anyError;

  const names = Array.from(
    new Set(
      parts.map((p) => {
        const name = p.type === "dynamic-tool" ? "tool" : p.type.replace(/^tool-/, "");
        return toolLabels[name] ?? name;
      }),
    ),
  );

  const summaryText = isRunning
    ? `${names.join(", ")}…`
    : anyError
      ? `Completed with warnings (${parts.length})`
      : parts.length === 1
        ? names[0]
        : `Completed ${parts.length} steps (${names.slice(0, 2).join(", ")})`;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="my-2 flex flex-col items-start">
      <CollapsibleTrigger className="group inline-flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
        {isRunning ? (
          <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
        ) : anyError ? (
          <AlertCircle className="size-3.5 text-destructive shrink-0" />
        ) : (
          <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
        )}
        <span>{summaryText}</span>
        <ChevronDown
          className={cn(
            "size-3 text-muted-foreground/60 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 ml-2.5 border-l border-border/60 pl-3.5 py-1 space-y-2 text-xs">
        {parts.map((part, idx) => {
          const rawName = part.type === "dynamic-tool" ? "tool" : part.type.replace(/^tool-/, "");
          const label = toolLabels[rawName] ?? rawName;
          const done = part.state === "output-available";
          const errored = part.state === "output-error";

          return (
            <div key={idx} className="flex items-center gap-2.5 text-xs">
              {!done && !errored ? (
                <span className="size-1.5 rounded-full bg-primary animate-ping shrink-0" />
              ) : done ? (
                <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
              ) : (
                <span className="size-1.5 rounded-full bg-destructive shrink-0" />
              )}
              <span className="font-medium text-foreground">{label}</span>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

function AttachmentPreviews() {
  const { files, remove } = usePromptInputAttachments();
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-2.5 pb-1 border-b border-border/50">
      {files.map((file) => {
        const isImage = file.mediaType?.startsWith("image/");
        return (
          <div
            key={file.id}
            className="group relative flex items-center gap-2 rounded-xl bg-muted/70 px-2.5 py-1.5 text-xs font-medium text-foreground border border-border/60 shadow-xs"
          >
            {isImage && file.url ? (
              <img src={file.url} alt="" className="size-7 rounded-md object-cover shrink-0" />
            ) : (
              <FileText className="size-4 text-primary shrink-0" />
            )}
            <span className="max-w-[140px] truncate">{file.filename || "Attached file"}</span>
            <button
              type="button"
              onClick={() => remove(file.id)}
              className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              aria-label="Remove attachment"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AttachButton() {
  const { openFileDialog } = usePromptInputAttachments();
  return (
    <PromptInputButton
      type="button"
      onClick={openFileDialog}
      tooltip="Attach documents or images"
      variant="ghost"
      size="icon-sm"
      className="rounded-xl p-2 text-muted-foreground hover:text-foreground"
    >
      <Paperclip className="size-5" />
    </PromptInputButton>
  );
}

// Minimal shape of the SpeechRecognition API needed — avoids depending on
// the `lib: dom` SpeechRecognition global which is missing from this tsconfig.
interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: { resultIndex: number; results: { isFinal?: boolean; 0: { transcript: string } }[] }) => void) | null;
}

/** Voice input button using Web Speech API (Chrome / Edge / Safari). */
function VoiceInputButton({
  textareaRef,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const ctor =
      (window as unknown as Record<string, unknown>)["SpeechRecognition"] ??
      (window as unknown as Record<string, unknown>)["webkitSpeechRecognition"];
    if (!ctor) setSupported(false);
  }, []);

  const toggle = useCallback(() => {
    const Ctor = (
      (window as unknown as Record<string, unknown>)["SpeechRecognition"] ??
      (window as unknown as Record<string, unknown>)["webkitSpeechRecognition"]
    ) as (new () => SpeechRecognitionInstance) | undefined;

    if (!Ctor) {
      toast.error("Voice input is not supported in this browser.");
      return;
    }

    // If already listening, stop manually
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false; // only fire for final segments
    recognition.maxAlternatives = 1;
    recognition.continuous = false; // stops naturally after a pause

    recognition.onstart = () => setListening(true);

    // Accumulate final segments as they are committed by the browser.
    // Do NOT call stop() here — let recognition run until natural end.
    let accumulated = "";
    recognition.onresult = (e: { resultIndex: number; results: { isFinal?: boolean; 0: { transcript: string } }[] }) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result && result.isFinal !== false) {
          accumulated += (accumulated ? " " : "") + (result[0]?.transcript ?? "");
        }
      }
    };

    // onend fires when recognition ends naturally (pause detected) or manually stopped.
    // Inject the accumulated transcript exactly once here.
    recognition.onend = () => {
      setListening(false);
      const transcript = accumulated.trim();
      if (!transcript) return;
      const el = textareaRef.current;
      if (!el) return;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      const current = el.value;
      nativeSetter?.call(el, current ? `${current} ${transcript}` : transcript);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
    };

    recognition.onerror = (e: { error: string }) => {
      setListening(false);
      if (e.error !== "aborted" && e.error !== "no-speech") {
        toast.error(`Microphone error: ${e.error}`);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [listening, textareaRef]);

  if (!supported) return null;

  return (
    <PromptInputButton
      type="button"
      onClick={toggle}
      tooltip={listening ? "Stop listening" : "Speak your message"}
      variant="ghost"
      size="icon-sm"
      className={[
        "rounded-xl p-2 transition-colors",
        listening
          ? "text-red-500 hover:text-red-600 animate-pulse"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
      aria-label={listening ? "Stop voice input" : "Start voice input"}
    >
      {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
    </PromptInputButton>
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
    onError: (error) => toast.error(error.message || "Remi couldn't reply just now."),
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: ["roadmaps"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      void queryClient.invalidateQueries({ queryKey: ["pages"] });
      void queryClient.invalidateQueries({ queryKey: ["blocks"] });
      void queryClient.invalidateQueries({ queryKey: ["study-resources"] });
    },
  });

  async function submit(text: string, files: FileUIPart[] = []) {
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) return;
    onActivity?.();
    if (!renamed.current && trimmed) {
      renamed.current = true;
      await renameThread(threadId, trimmed.slice(0, 60));
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
    }
    const topicId = topic ? topic.itemId : null;
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const pageMatch = pathname.match(/\/page\/([^/]+)/);
    const activePageId = pageMatch ? pageMatch[1] : undefined;

    // Serialize file attachments as {filename, mimeType, dataUrl} for the API
    const attachments = files
      .filter((f) => f.url)
      .map((f) => ({
        filename: f.filename ?? "file",
        mimeType: f.mediaType ?? "application/octet-stream",
        dataUrl: f.url,
      }));

    await sendMessage(
      { text: trimmed || "(attached files)", files },
      {
        body: {
          threadId,
          topicItemId: topicId,
          activePageId,
          ...(attachments.length > 0 ? { attachments } : {}),
        },
      },
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
          <ConversationContent className={compact ? "w-full" : "mx-auto w-full max-w-3xl"}>
            {messages.length === 0 && (
              <div className={compact ? "py-6 text-center" : "py-16 text-center"}>
                <img
                  src={remiLogo}
                  alt="Remi"
                  width={compact ? 56 : 80}
                  height={compact ? 56 : 80}
                  className={compact ? "mx-auto size-14" : "mx-auto size-20"}
                />
                <h1 className={`mt-4 font-display font-bold ${compact ? "text-xl" : "text-3xl"}`}>
                  Hi, I'm Remi.
                </h1>
                <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-muted-foreground">
                  Ask me to build a detailed roadmap, research a topic, or plan your week. Attach
                  documents or images to save them to your workspace library.
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
                  {(() => {
                    const fileParts = message.parts.filter(
                      (p): p is FileUIPart => p.type === "file",
                    );
                    const groupedParts: Array<
                      { type: "text"; text: string } | { type: "tools"; parts: ToolPartLike[] }
                    > = [];
                    let currentTools: ToolPartLike[] = [];

                    for (const part of message.parts) {
                      if (part.type === "text") {
                        if (currentTools.length > 0) {
                          groupedParts.push({ type: "tools", parts: currentTools });
                          currentTools = [];
                        }
                        groupedParts.push({ type: "text", text: part.text });
                      } else if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
                        currentTools.push(part as ToolPartLike);
                      }
                    }
                    if (currentTools.length > 0) {
                      groupedParts.push({ type: "tools", parts: currentTools });
                    }

                    return (
                      <>
                        {fileParts.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {fileParts.map((f, fIdx) => {
                              const isImg = f.mediaType?.startsWith("image/");
                              return (
                                <div
                                  key={fIdx}
                                  className="flex items-center gap-2 rounded-xl bg-muted/80 px-3 py-1.5 text-xs font-medium border border-border/60"
                                >
                                  {isImg && f.url ? (
                                    <img
                                      src={f.url}
                                      alt=""
                                      className="size-8 rounded-md object-cover"
                                    />
                                  ) : (
                                    <FileText className="size-4 text-primary shrink-0" />
                                  )}
                                  <span className="truncate max-w-[160px]">
                                    {f.filename || "Attached file"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {groupedParts.map((group, gIdx) => {
                          if (group.type === "text") {
                            return (
                              <div key={gIdx}>
                                <MessageResponse>{group.text}</MessageResponse>
                                {message.role === "assistant" && (
                                  <>
                                    <ChatVideoEmbeds text={group.text} />
                                    <SpeechAndCopyToolbar text={group.text} className="mt-2" />
                                  </>
                                )}
                              </div>
                            );
                          }
                          return <ToolGroup key={gIdx} parts={group.parts} />;
                        })}
                      </>
                    );
                  })()}
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

      <div className={compact ? "w-full px-3 pb-3" : "mx-auto w-full max-w-3xl px-3 pb-5"}>
        {topic && (
          <p className="mb-2 flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <BookOpen className="size-4 text-primary" />
            <span className="min-w-0 truncate">
              Answering with context from{" "}
              <span className="font-semibold text-foreground">{topic.label}</span>
            </span>
          </p>
        )}
        <PromptInput onSubmit={(message) => void submit(message.text ?? "", message.files)}>
          <AttachmentPreviews />
          <PromptInputTextarea
            ref={textareaRef}
            placeholder={
              topic ? `Ask a doubt about ${topic.label}…` : "What do you want to create or ask?"
            }
            className="min-h-[80px] text-base"
          />

          <PromptInputFooter className="justify-between">
            <div className="flex items-center gap-1">
              <AttachButton />
              <VoiceInputButton textareaRef={textareaRef} />
            </div>
            <PromptInputSubmit status={status} disabled={busy} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
