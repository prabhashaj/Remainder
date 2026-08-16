import React from "react";
import { useChat } from "@ai-sdk/react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { getPlanUsage } from "@/lib/billing.functions";
import { cn } from "@/lib/utils";

function getToolLabel(
  part:
    | {
        type?: string;
        toolName?: string;
        args?: Record<string, unknown>;
        input?: Record<string, unknown>;
      }
    | Record<string, unknown>,
  isRunning: boolean,
): string {
  const typeStr = typeof part.type === "string" ? part.type : "";
  let name = typeStr.replace(/^tool-/, "");
  if (typeStr === "dynamic-tool" && typeof part.toolName === "string") {
    name = part.toolName;
  }
  if (typeof part.toolName === "string") {
    name = part.toolName;
  }

  const args = ((part.args || part.input || {}) as Record<string, unknown>) ?? {};

  if (name === "delegateToPlanner") {
    const inst = (typeof args["instruction"] === "string" ? args["instruction"] : "").toLowerCase();
    if (
      inst.includes("roadmap") ||
      inst.includes("curriculum") ||
      inst.includes("study plan") ||
      inst.includes("learning plan") ||
      inst.includes("learn")
    ) {
      if (
        inst.includes("update") ||
        inst.includes("modify") ||
        inst.includes("remove") ||
        inst.includes("replace") ||
        inst.includes("change") ||
        inst.includes("adjust") ||
        inst.includes("restructure")
      ) {
        return isRunning ? "Updating and modifying..." : "Updated roadmap";
      }
      return isRunning ? "Creating roadmap" : "Created roadmap";
    }
    if (inst.includes("goal") || inst.includes("milestone")) {
      return isRunning ? "Creating goals" : "Created goals";
    }
    if (inst.includes("habit")) {
      return isRunning ? "Creating habits" : "Created habits";
    }
    if (inst.includes("task") || inst.includes("todo")) {
      return isRunning ? "Creating tasks" : "Created tasks";
    }
    return isRunning ? "Creating roadmap" : "Created roadmap";
  }

  const mapping: Record<string, { active: string; done: string }> = {
    createTask: { active: "Creating task...", done: "Created task" },
    updateTask: { active: "Updating task...", done: "Updated task" },
    createGoal: { active: "Creating goal...", done: "Created goal" },
    updateGoal: { active: "Updating goal...", done: "Updated goal" },
    addMilestone: { active: "Adding milestone...", done: "Added milestone" },
    createMilestone: { active: "Adding milestone...", done: "Added milestone" },
    createHabit: { active: "Creating habit", done: "Created habit" },
    updateHabit: { active: "Updating habit", done: "Updated habit" },
    createRoadmap: { active: "Creating roadmap", done: "Created roadmap" },
    updateRoadmap: { active: "Updating and modifying...", done: "Updated roadmap" },
    readRoadmap: { active: "Reading roadmap", done: "Read roadmap" },
    researchResources: { active: "Finding video tutorials", done: "Found video tutorials" },
    webSearch: { active: "Searching the web", done: "Searched the web" },
    searchPhotos: { active: "Searching photos & diagrams", done: "Searched photos & diagrams" },
    writeLessonForSubtopic: { active: "Writing subtopic lesson", done: "Wrote subtopic lesson" },
    generateNotebook: { active: "Generating study notebook", done: "Generated study notebook" },
    editNotebook: { active: "Updating study notebook", done: "Updated study notebook" },
    saveMemory: { active: "Saving memory note", done: "Saved memory note" },
    readDocument: { active: "Reading document", done: "Read document" },
    getCurrentTime: { active: "Checking time", done: "Checked time" },
  };

  const found = mapping[name];
  if (found) {
    return isRunning ? found.active : found.done;
  }

  const formattedName = name
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase();
  const capitalized = formattedName.charAt(0).toUpperCase() + formattedName.slice(1);
  return isRunning ? `Creating ${formattedName}` : `Created ${formattedName}`;
}

type ToolPartLike = { type: string; state: string };

function ToolGroup({ parts }: { parts: ToolPartLike[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const allDone = parts.every((p) => p.state === "output-available");
  const anyError = parts.some((p) => p.state === "output-error");
  const isRunning = !allDone && !anyError;

  const names = Array.from(new Set(parts.map((p) => getToolLabel(p, isRunning))));

  const summaryText = isRunning
    ? `${names.join(", ")}…`
    : anyError
      ? `Completed with warnings (${parts.length})`
      : parts.length === 1
        ? names[0]
        : `Completed ${parts.length} steps (${names.slice(0, 2).join(", ")})`;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="my-1 flex flex-col items-start">
      <CollapsibleTrigger className="group inline-flex items-center gap-1.5 py-1 text-base font-normal text-muted-foreground transition-colors hover:text-foreground">
        {isRunning ? (
          <Shimmer>{summaryText || ""}</Shimmer>
        ) : (
          <>
            <span className="text-sm">{summaryText}</span>
            <ChevronDown
              className={cn(
                "size-3 text-muted-foreground/60 transition-transform duration-200",
                isOpen && "rotate-180",
              )}
            />
          </>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 ml-2.5 border-l border-border/60 pl-3.5 py-1 space-y-2 text-xs">
        {parts.map((part, idx) => {
          const label = getToolLabel(part, false);
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
      <Paperclip className="size-6" />
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
  onresult:
    | ((e: {
        resultIndex: number;
        results: { isFinal?: boolean; 0: { transcript: string } }[];
      }) => void)
    | null;
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
    const Ctor = ((window as unknown as Record<string, unknown>)["SpeechRecognition"] ??
      (window as unknown as Record<string, unknown>)["webkitSpeechRecognition"]) as
      (new () => SpeechRecognitionInstance) | undefined;

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
    recognition.onresult = (e: {
      resultIndex: number;
      results: { isFinal?: boolean; 0: { transcript: string } }[];
    }) => {
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
      let transcript = accumulated.trim();
      if (!transcript) return;

      // Ensure the transcribed text ends like a question ('?') after speech finishes
      if (!transcript.endsWith("?")) {
        if (transcript.endsWith(".")) {
          transcript = transcript.slice(0, -1) + "?";
        } else if (!transcript.endsWith("!")) {
          transcript = transcript + "?";
        }
      }

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
      {listening ? <MicOff className="size-6" /> : <Mic className="size-6" />}
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
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const renamed = useRef(initialMessages.length > 0);
  const seedSent = useRef(false);

  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [limitType, setLimitType] = useState<"chat" | "features">("features");
  const [lastCheckedMessageId, setLastCheckedMessageId] = useState<string | null>(null);

  const { data: usageData } = useQuery({
    queryKey: ["planUsage"],
    queryFn: () => getPlanUsage(),
    refetchInterval: 30000, // refresh every 30s
  });

  const { messages, sendMessage, status, stop } = useChat({
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
    onError: (error) => {
      if (error.message.includes("Plan limit reached") || error.message.includes("403")) {
        setLimitType("chat");
        setUpgradeModalOpen(true);
        return;
      }
      toast.error(error.message || "Remi couldn't reply just now.");
      if (error.message.includes("Thread not found") && typeof window !== "undefined") {
        window.localStorage.removeItem("remispace.dock.thread");
        setTimeout(() => {
          if (window.location.pathname.startsWith("/conversation/")) {
            window.location.href = "/conversation";
          } else {
            window.location.reload();
          }
        }, 1000);
      }
    },
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

  const seenLimitMessages = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const message of messages) {
      if (message.role === "assistant" && !seenLimitMessages.current.has(message.id)) {
        // Robustly check for the limitReached signal inside the structured tool invocations/parts
        // to avoid any Vercel AI SDK version inconsistencies with nested object structures.
        const msgAny = message as unknown as { toolInvocations?: unknown; parts?: unknown };
        const hitLimit =
          (msgAny.toolInvocations &&
            JSON.stringify(msgAny.toolInvocations).includes('"limitReached":true')) ||
          (msgAny.parts && JSON.stringify(msgAny.parts).includes('"limitReached":true'));

        if (hitLimit) {
          seenLimitMessages.current.add(message.id);
          stop(); // Force stop streaming so the send button reverts to normal
          setLimitType("features");
          setUpgradeModalOpen(true);
        }
      }
    }
  }, [messages, stop]);

  async function blobUrlToDataUrl(url: string): Promise<string | null> {
    if (url.startsWith("data:")) return url;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  /**
   * Pre-uploads a non-image file directly to Supabase Storage via signed URL.
   * Returns { resourceId, title } on success.
   * This completely bypasses Vercel's 4.5 MB serverless request body limit,
   * allowing direct browser-to-storage upload for large PDFs and 500-page textbooks up to 100 MB.
   */
  async function preUploadDocument(
    file: File,
  ): Promise<{ resourceId: string; title: string; kind: string; hasText: boolean } | null> {
    const { uploadMaterial, createStudyResource } = await import("@/lib/study");
    const { triggerDocumentExtractionFn } = await import("@/lib/study.functions");

    // 1. Direct-to-storage upload via presigned URL (bypasses Vercel)
    const storagePath = await uploadMaterial(file);

    // 2. Create study resource record
    const title = file.name.replace(/\.[^.]+$/, "");
    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith(".pdf") || file.type === "application/pdf";
    const kind = isPdf ? "pdf" : "note";

    const resource = await createStudyResource({
      title,
      kind,
      storage_path: storagePath,
      mime_type: file.type || (isPdf ? "application/pdf" : "text/plain"),
    });

    // 3. Trigger server-side text extraction and async vector embedding
    let hasText = true;
    try {
      const extRes = await triggerDocumentExtractionFn({
        data: {
          resourceId: resource.id,
          storagePath,
        },
      });
      hasText = extRes ? (extRes.textLength ?? 0) > 0 : true;
    } catch (e) {
      console.warn("Extraction trigger error:", e);
    }

    return {
      resourceId: resource.id,
      title: resource.title,
      kind: resource.kind,
      hasText,
    };
  }

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

    const inlineAttachments: Array<{ filename: string; mimeType: string; dataUrl: string }> = [];
    const uploadedRefs: Array<{ resourceId: string; title: string; kind: string; filename: string }> = [];
    const sanitizedFiles: FileUIPart[] = [];

    const IMAGE_INLINE_LIMIT = 1 * 1024 * 1024; // 1 MB

    for (const f of files.filter((fi) => fi.url || fi.filename)) {
      const isImage = (f.mediaType ?? "").startsWith("image/");
      const lowerName = (f.filename ?? "").toLowerCase();
      const isPdf = lowerName.endsWith(".pdf") || f.mediaType === "application/pdf";

      // Try to get the raw File object from the blob URL or sourceFile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let rawFile: File | null = (f as any).sourceFile ?? null;
      if (!rawFile && f.url && f.url.startsWith("blob:")) {
        try {
          const res = await fetch(f.url);
          const blob = await res.blob();
          rawFile = new File([blob], f.filename ?? "file", { type: f.mediaType ?? blob.type });
        } catch {
          // ignore — fall through
        }
      }

      const fileSizeBytes = rawFile?.size ?? 0;
      const useInline = isImage && fileSizeBytes < IMAGE_INLINE_LIMIT;

      if (useInline && !isPdf) {
        // Small image: send inline as base64
        const dataUrl = f.url?.startsWith("data:") ? f.url : await blobUrlToDataUrl(f.url ?? "");
        if (dataUrl && dataUrl.startsWith("data:")) {
          inlineAttachments.push({
            filename: f.filename ?? "image",
            mimeType: f.mediaType ?? "image/jpeg",
            dataUrl,
          });
          sanitizedFiles.push({
            type: "file",
            ...(f.filename ? { filename: f.filename } : {}),
            mediaType: f.mediaType ?? "image/jpeg",
            url: dataUrl,
          });
        }
      } else {
        // PDF or large file: direct-to-storage upload via presigned URL
        if (rawFile) {
          toast.loading(`Uploading ${f.filename ?? "file"}…`, { id: "doc-upload" });
          try {
            const result = await preUploadDocument(rawFile);
            toast.dismiss("doc-upload");
            if (result) {
              uploadedRefs.push({
                resourceId: result.resourceId,
                title: result.title,
                kind: result.kind,
                filename: f.filename ?? "file",
              });
              toast.success(`"${f.filename}" uploaded and processed.`, { duration: 3000 });
            }
          } catch (uploadErr) {
            toast.dismiss("doc-upload");
            toast.error(
              `Failed to upload "${f.filename}": ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`,
            );
            // Don't abort the whole submit — just skip this file
          }
        }

        // Pass sanitized file to UI so chat bubble shows the badge, but URL is empty so ZERO bytes are sent in HTTP JSON body!
        sanitizedFiles.push({
          type: "file",
          filename: f.filename ?? "document.pdf",
          mediaType: f.mediaType || "application/pdf",
          url: "",
        });
      }
    }

    await sendMessage(
      { text: trimmed || "(attached files)", files: sanitizedFiles },
      {
        body: {
          threadId,
          topicItemId: topicId,
          activePageId,
          ...(inlineAttachments.length > 0 ? { attachments: inlineAttachments } : {}),
          ...(uploadedRefs.length > 0 ? { uploadedDocuments: uploadedRefs } : {}),
        },
      },
    );

    if (inlineAttachments.length > 0 || uploadedRefs.length > 0) {
      void queryClient.invalidateQueries({ queryKey: ["study-resources"] });
    }
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
        <PromptInput
          onSubmit={(message) => submit(message.text ?? "", message.files)}
          maxFileSize={10 * 1024 * 1024}
        >
          <AttachmentPreviews />
          <PromptInputTextarea
            ref={textareaRef}
            placeholder={
              topic ? `Ask a doubt about ${topic.label}…` : "What do you want to create or ask?"
            }
            className="min-h-[44px] text-base"
          />

          <PromptInputFooter className="justify-between">
            <div className="flex items-center gap-1">
              <AttachButton />
              <VoiceInputButton textareaRef={textareaRef} />
            </div>
            <PromptInputSubmit status={status} onStop={stop} disabled={status === "submitted"} />
          </PromptInputFooter>
        </PromptInput>
        {usageData && usageData.daily && (
          <div className="text-center mt-2 text-xs text-muted-foreground">
            {usageData.daily.used} / {usageData.daily.limit} daily messages used.
          </div>
        )}
      </div>

      <AlertDialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <AlertDialogContent className="rounded-3xl border-border/70 p-6 sm:max-w-sm">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex items-center justify-center">
              <img src={remiLogo} alt="Remi" className="h-16 w-16" />
            </div>
            <AlertDialogTitle className="text-center font-display text-xl">
              Upgrade to Pro
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {limitType === "chat"
                ? "You've used your 20 daily messages limit. Upgrade to Pro to get unlimited messages."
                : "You've reached your free limit this week. Upgrade to Pro to create up to 10 roadmaps and 15 notebooks per week, unlock premium features, and more."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              className="w-full rounded-2xl"
              onClick={() => navigate({ to: "/pricing" })}
            >
              View Pricing
            </AlertDialogAction>
            <AlertDialogCancel className="w-full rounded-2xl border-none">
              Maybe later
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
