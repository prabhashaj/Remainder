import React from "react";
import { useChat } from "@ai-sdk/react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import {
  AlertCircle,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Compass,
  Database,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Microscope,
  Network,
  Paperclip,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
  Zap,
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
import { isSubscriptionPremium } from "@/lib/limits";
import { cn } from "@/lib/utils";

function getToolLabel(
  part:
    | {
        type?: string;
        toolName?: string;
        toolInvocation?: { toolName?: string; args?: Record<string, unknown> };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((part as any).toolInvocation?.toolName) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name = (part as any).toolInvocation.toolName;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args = ((part.args || part.input || (part as any).toolInvocation?.args || {}) as Record<string, unknown>) ?? {};

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
    if (inst.includes("task") || inst.includes("todo")) {
      return isRunning ? "Creating tasks" : "Created tasks";
    }
    return isRunning ? "Creating roadmap" : "Created roadmap";
  }

  const mapping: Record<string, { active: string; done: string }> = {
    deepResearch: {
      active: "Researching with subagents, verifier & writer",
      done: "Synthesized verified research report",
    },
    searchArxiv: { active: "Searching arXiv", done: "Searched arXiv" },
    searchPapers: { active: "Searching academic papers", done: "Searched academic papers" },
    fetchPaperDetails: { active: "Fetching paper details", done: "Fetched paper details" },
    fetchLatestPapers: { active: "Fetching latest papers", done: "Fetched latest papers" },
    createTask: { active: "Creating task", done: "Created task" },
    updateTask: { active: "Updating task", done: "Updated task" },
    createGoal: { active: "Creating goal", done: "Created goal" },
    updateGoal: { active: "Updating goal", done: "Updated goal" },
    addMilestone: { active: "Adding milestone", done: "Added milestone" },
    createMilestone: { active: "Adding milestone", done: "Added milestone" },
    createRoadmap: { active: "Designing roadmap", done: "Created roadmap" },
    updateRoadmap: { active: "Updating roadmap", done: "Updated roadmap" },
    readRoadmap: { active: "Reading roadmap", done: "Read roadmap" },
    researchResources: { active: "Finding resources", done: "Found resources" },
    webSearch: { active: "Searching the web", done: "Searched the web" },
    searchPhotos: { active: "Finding images", done: "Found images" },
    writeLessonForSubtopic: { active: "Writing lesson", done: "Wrote lesson" },
    generateNotebook: { active: "Creating notebook", done: "Created notebook" },
    editNotebook: { active: "Updating notebook", done: "Updated notebook" },
    saveMemory: { active: "Saving memory", done: "Saved memory" },
    readDocument: { active: "Reading document", done: "Read document" },
    getCurrentTime: { active: "Checking time", done: "Checked time" },
    getWeather: { active: "Checking weather", done: "Checked weather" },
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isToolPartDone(part: any): boolean {
  if (!part) return false;
  if (part.state === "output-available" || part.state === "result") return true;
  if (part.toolInvocation?.state === "result") return true;
  if (part.output !== undefined || part.result !== undefined || part.toolInvocation?.result !== undefined) return true;
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isToolPartError(part: any): boolean {
  if (!part) return false;
  if (part.state === "output-error" || part.state === "error") return true;
  if (part.toolInvocation?.state === "error") return true;
  const out = part.output ?? part.result ?? part.toolInvocation?.result;
  if (out && out.success === false) return true;
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolPartOutput(part: any): any {
  if (!part) return {};
  return part.output ?? part.result ?? part.toolInvocation?.result ?? {};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolPartInput(part: any): any {
  if (!part) return {};
  return part.input ?? part.args ?? part.toolInvocation?.args ?? part.toolInvocation?.input ?? {};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToolGroup({ parts }: { parts: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const allDone = parts.every((p) => isToolPartDone(p));
  const anyError = parts.some((p) => isToolPartError(p));
  const isRunning = !allDone && !anyError;

  // Single-line active indicator: show ONLY the current running action and remove previous ones
  const activePart =
    parts.slice().reverse().find((p) => !isToolPartDone(p) && !isToolPartError(p)) ||
    parts[parts.length - 1];

  const currentLabel = activePart ? getToolLabel(activePart, isRunning) : "Working";

  const summaryText = isRunning
    ? `${currentLabel}…`
    : anyError
      ? `Completed with warnings (${parts.length})`
      : parts.length === 1 && parts[0]
        ? getToolLabel(parts[0], false)
        : `Completed ${parts.length} steps`;

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
          const done = isToolPartDone(part);
          const errored = isToolPartError(part);

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isRoadmapTool(part: any): boolean {
  if (!part) return false;
  const typeStr = typeof part.type === "string" ? part.type : "";
  const toolName =
    typeof part.toolName === "string"
      ? part.toolName
      : (part.toolInvocation?.toolName || typeStr.replace(/^tool-/, ""));
  const output = getToolPartOutput(part);
  return (
    toolName === "createRoadmap" ||
    (toolName === "delegateToPlanner" && Boolean(output?.roadmap_id))
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RoadmapChatCard({ part }: { part: any }) {
  const navigate = useNavigate();
  const output = getToolPartOutput(part) as {
    success?: boolean;
    roadmap_id?: string;
    topic?: string;
    phases?: number;
    topics?: number;
    subtopics?: number;
    summary?: string;
  };
  const input = getToolPartInput(part) as { topic?: string };
  const isDone = isToolPartDone(part) && output.success !== false;
  const isError = isToolPartError(part);
  const isRunning = !isDone && !isError;

  const topicName = output.topic || input.topic || "Learning Roadmap";
  const summary = output.summary || "Structured personalized learning curriculum";
  const roadmapId = output.roadmap_id;
  const phasesCount = output.phases || 4;
  const topicsCount = output.topics || 20;
  const subtopicsCount = output.subtopics || 80;

  if (isRunning || !isDone || !roadmapId) return null;

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-sm transition-all hover:border-primary/50">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Compass className="size-5 sm:size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  ROADMAP READY
                </span>
              </div>
              <h3 className="font-display text-base sm:text-lg font-bold text-foreground mt-0.5">
                {topicName}
              </h3>
            </div>
          </div>
        </div>

        {summary && (
          <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-muted-foreground line-clamp-3">
            {summary}
          </p>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-lg bg-muted/80 px-2.5 py-1 font-medium text-foreground">
            {phasesCount} phases
          </span>
          <span className="rounded-lg bg-muted/80 px-2.5 py-1 font-medium text-foreground">
            {topicsCount} topics
          </span>
          <span className="rounded-lg bg-muted/80 px-2.5 py-1 font-medium text-foreground">
            {subtopicsCount} sub-topics
          </span>
        </div>

        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">0% completed</span>
          <button
            type="button"
            onClick={() => navigate({ to: `/roadmap/${roadmapId}` })}
            className="press inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 cursor-pointer"
          >
            <span>Open Roadmap & Start Learning</span>
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isDeepResearchTool(part: any): boolean {
  if (!part) return false;
  const typeStr = typeof part.type === "string" ? part.type : "";
  const toolName =
    typeof part.toolName === "string"
      ? part.toolName
      : (part.toolInvocation?.toolName || typeStr.replace(/^tool-/, ""));
  return (
    toolName === "deepResearch" ||
    toolName === "searchArxiv" ||
    toolName === "searchPapers" ||
    typeStr === "tool-deepResearch"
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DeepResearchChatCard({ part }: { part: any }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const output = getToolPartOutput(part) as {
    success?: boolean;
    report?: string;
    sources_markdown?: string;
    plan?: { topic?: string; scope?: string; temporalConstraints?: string };
    subtasks?: Array<{ id: string; title: string; objective: string; query?: string }>;
    action_trail?: Array<{ step: string; details: string; timestamp?: string }>;
    verified_papers_count?: number;
    subagents_count?: number;
    worker_reports?: Array<{
      subtaskId: string;
      title: string;
      agentName?: string;
      sourceCount?: number;
      sources?: Array<{ title?: string; year?: number; url?: string; is_arxiv?: boolean }>;
    }>;
  };
  const input = getToolPartInput(part) as {
    query?: string;
    topic?: string;
    subtasksCount?: number;
  };

  const isDone = isToolPartDone(part) && output.success !== false;
  const isError = isToolPartError(part);
  const isRunning = !isDone && !isError;

  const topicQuery = output.plan?.topic || input.topic || input.query || "Academic & Technical Topic";
  const temporalConstraint = output.plan?.temporalConstraints || "2024–2026 (Recent Verified)";

  if (isRunning || !isDone) return null;

  const subtasksList = output.subtasks || [];
  const actionTrail = output.action_trail || [];
  const verifiedPapersCount =
    output.verified_papers_count ??
    (output.worker_reports?.reduce((acc, w) => acc + (w.sources?.length || 0), 0) || 12);
  const subagentsCount = output.subagents_count || (subtasksList.length > 0 ? subtasksList.length : 4);

  return (
    <div className="my-2.5 overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-sm transition-all hover:border-primary/40">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  DEEP RESEARCH SYNTHESIZED
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Window: {temporalConstraint}
                </span>
              </div>
              <h3 className="font-display text-sm sm:text-base font-bold text-foreground mt-0.5">
                {output.plan?.topic || topicQuery}
              </h3>
            </div>
          </div>
        </div>

        {output.plan?.scope && (
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
            {output.plan.scope}
          </p>
        )}

        {/* Stats Badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
            {verifiedPapersCount} Verified Papers Retrieved
          </span>
          <span className="rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-0.5 font-semibold text-primary">
            {subagentsCount} Subagent Workers
          </span>
          <span className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 font-semibold text-blue-600 dark:text-blue-400">
            Verifier Agent Audited
          </span>
          <span className="rounded-lg bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 font-semibold text-purple-600 dark:text-purple-400">
            Writer Agent Formatted
          </span>
        </div>

        {/* Expandable Execution Trail & Subagents Work */}
        {(subtasksList.length > 0 || actionTrail.length > 0) && (
          <div className="mt-3 pt-2.5 border-t border-border/50">
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger className="group flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-1.5">
                  <Network className="size-3.5 text-primary" />
                  {detailsOpen ? "Hide Subagents & Action Trail" : "View Subagents Work & Action Trail"}
                </span>
                <ChevronDown className={cn("size-3.5 transition-transform duration-200", detailsOpen && "rotate-180")} />
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-2.5 space-y-2.5 pt-1 text-xs">
                {subtasksList.length > 0 && (
                  <div className="space-y-1">
                    <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                      Parallel Subtasks Executed
                    </div>
                    <div className="grid gap-1">
                      {subtasksList.map((st, i) => (
                        <div
                          key={st.id || i}
                          className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-2 text-xs"
                        >
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono font-bold text-[10px] text-primary">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground">{st.title}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{st.objective}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {actionTrail.length > 0 && (
                  <div className="space-y-1">
                    <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                      Coordinator Action Trail
                    </div>
                    <div className="space-y-1 font-mono text-[11px]">
                      {actionTrail.map((act, i) => (
                        <div key={i} className="flex items-start gap-2 text-muted-foreground">
                          <span className="text-emerald-500 font-bold shrink-0">✓</span>
                          <div>
                            <span className="font-medium text-foreground">{act.step}: </span>
                            <span>{act.details}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Full Synthesized Technical Research Report */}
        {output.report && (
          <div className="mt-4 pt-3.5 border-t border-border/60">
            <div className="text-foreground text-sm sm:text-base leading-relaxed">
              <MessageResponse>{output.report}</MessageResponse>
            </div>
            <SpeechAndCopyToolbar
              text={output.report}
              id={`deep-research-report-${part.toolInvocation?.toolCallId || "done"}`}
              className="mt-3.5"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isNotebookTool(part: any): boolean {
  if (!part) return false;
  const typeStr = typeof part.type === "string" ? part.type : "";
  const toolName =
    typeof part.toolName === "string"
      ? part.toolName
      : (part.toolInvocation?.toolName || typeStr.replace(/^tool-/, ""));
  return toolName === "generateNotebook" || typeStr === "tool-generateNotebook";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NotebookChatCard({ part }: { part: any }) {
  const navigate = useNavigate();
  const output = getToolPartOutput(part) as {
    success?: boolean;
    pageId?: string;
    blockCount?: number;
    message?: string;
  };
  const isDone = isToolPartDone(part) && output.success !== false;
  if (!isDone || !output.pageId) return null;

  return (
    <div className="my-2.5 flex items-center justify-between rounded-xl border border-border/80 bg-card/90 p-3 shadow-xs">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <BookOpen className="size-4" />
        </div>
        <div>
          <div className="text-xs font-semibold text-foreground">Study Notebook Ready</div>
          <div className="text-[11px] text-muted-foreground">{output.blockCount || "Multiple"} blocks created</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate({ to: `/notebook/${output.pageId}` })}
        className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 cursor-pointer transition-colors"
      >
        <span>Open Notebook</span>
        <ChevronRight className="size-3.5" />
      </button>
    </div>
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

function DeepResearchToggleButton({
  active,
  onToggle,
  disabled,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={
        active
          ? "Deep Research Mode ON (Multi-Agent: Planner, Subagents, Verifier, Writer)"
          : "Turn on Deep Research for multi-agent arXiv discovery, academic verification & publication report"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition-all duration-200 cursor-pointer select-none",
        active
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs ring-1 ring-emerald-500/25 hover:bg-emerald-500/20"
          : "text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50 hover:border-border",
      )}
    >
      <Microscope
        className={cn(
          "size-3.5 transition-transform",
          active ? "text-emerald-600 dark:text-emerald-400 scale-105" : "text-muted-foreground",
        )}
      />
      <span>Deep Research</span>
      {active && (
        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
      )}
    </button>
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
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ctor =
      (window as unknown as Record<string, unknown>)["SpeechRecognition"] ??
      (window as unknown as Record<string, unknown>)["webkitSpeechRecognition"];
    if (!ctor) setSupported(false);

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recognitionRef.current?.stop();
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    clearTimer();
    // 5-second silence timeout: allows natural pauses before committing
    silenceTimerRef.current = setTimeout(() => {
      recognitionRef.current?.stop();
    }, 5000);
  }, [clearTimer]);

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
      clearTimer();
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true; // Stay active across pauses

    let accumulated = "";

    recognition.onstart = () => {
      setListening(true);
      resetSilenceTimer();
    };

    recognition.onresult = (e: {
      resultIndex: number;
      results: { isFinal?: boolean; 0: { transcript: string } }[];
    }) => {
      resetSilenceTimer();
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result) {
          if (result.isFinal !== false) {
            accumulated += (accumulated ? " " : "") + (result[0]?.transcript ?? "");
          } else {
            interim += " " + (result[0]?.transcript ?? "");
          }
        }
      }
    };

    // onend fires when recognition finishes (after 5s silence timeout or manual stop)
    recognition.onend = () => {
      clearTimer();
      setListening(false);
      let transcript = accumulated.trim();
      if (!transcript) return;

      // Ensure the transcribed query ends with punctuation
      if (!transcript.endsWith("?") && !transcript.endsWith(".") && !transcript.endsWith("!")) {
        transcript = transcript + "?";
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
      clearTimer();
      setListening(false);
      if (e.error !== "aborted" && e.error !== "no-speech") {
        toast.error(`Microphone error: ${e.error}`);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [listening, textareaRef, clearTimer, resetSilenceTimer]);

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
  suggestions = [
    "Create a roadmap to learn Agentic AI",
    "Explain what is photosynthesis",
  ],
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
  const [deepResearchActive, setDeepResearchActive] = useState(false);

  const { data: usageData } = useQuery({
    queryKey: ["planUsage"],
    queryFn: () => getPlanUsage(),
    refetchInterval: 30000, // refresh every 30s
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return null;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return sub;
    },
  });

  const isPremium = isSubscriptionPremium(subscription);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
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
      void queryClient.invalidateQueries({ queryKey: ["planUsage"] });
      if (
        error.message.includes("Plan limit reached") ||
        error.message.includes("403") ||
        error.message.includes("Limit Exceeded")
      ) {
        setLimitType("chat");
        setUpgradeModalOpen(true);
        toast.error("You've reached your free daily message limit of 20. Upgrade to Pro for unlimited messages.");
        return;
      }
      toast.error(error.message || "Remi couldn't reply just now.");
    },
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: ["thread-messages", threadId] });
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      void queryClient.invalidateQueries({ queryKey: ["planUsage"] });
      void queryClient.invalidateQueries({ queryKey: ["roadmaps"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      void queryClient.invalidateQueries({ queryKey: ["pages"] });
      void queryClient.invalidateQueries({ queryKey: ["blocks"] });
      void queryClient.invalidateQueries({ queryKey: ["study-resources"] });
      void queryClient.invalidateQueries({ queryKey: ["memories"] });
    },
  });

  // Keep useChat messages in sync whenever initialMessages or threadId changes
  const isStreaming = status === "streaming" || status === "submitted";
  const lastSyncedThreadId = useRef<string>(threadId);

  useEffect(() => {
    // If threadId changed, immediately set that thread's messages
    if (lastSyncedThreadId.current !== threadId) {
      lastSyncedThreadId.current = threadId;
      setMessages(initialMessages);
      return;
    }

    // If query fetched or updated messages while idle, sync internal state
    if (!isStreaming) {
      if (initialMessages.length >= messages.length && initialMessages.length > 0) {
        const currentIds = messages.map((m) => m.id).join(",");
        const initialIds = initialMessages.map((m) => m.id).join(",");
        if (currentIds !== initialIds) {
          setMessages(initialMessages);
        }
      }
    }
  }, [threadId, initialMessages, isStreaming, setMessages, messages]);

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

    if (
      !isPremium &&
      usageData?.daily &&
      !usageData.daily.isUnlimited &&
      usageData.daily.used >= usageData.daily.limit
    ) {
      setLimitType("chat");
      setUpgradeModalOpen(true);
      toast.error("You've reached your daily limit of 20 messages. Upgrade to Pro for unlimited messages.", {
        action: {
          label: "Upgrade",
          onClick: () => navigate({ to: "/pricing" }),
        },
        duration: 8000,
      });
      return;
    }

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

      // Try to get the raw File object from the sourceFile or blob URL
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const source = (f as any).sourceFile;
      let rawFile: File | null =
        source instanceof File
          ? source
          : source instanceof Blob
            ? new File([source], f.filename ?? "file", { type: f.mediaType ?? source.type })
            : null;

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
          const maxBytes = (isPremium ? 50 : 15) * 1024 * 1024;
          if (rawFile.size > maxBytes) {
            if (!isPremium) {
              toast.error(
                `"${f.filename ?? "file"}" (${(rawFile.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 15MB Free tier limit. Please upgrade to Pro to upload documents up to 50MB.`,
                {
                  action: {
                    label: "Upgrade",
                    onClick: () => {
                      navigate({ to: "/pricing" });
                    },
                  },
                  duration: 10000,
                },
              );
            } else {
              toast.error(`"${f.filename ?? "file"}" exceeds the 50MB maximum upload limit.`);
            }
            continue;
          }

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
            const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
            const isLimitErr =
              msg.includes("15MB") || msg.includes("limit") || msg.includes("upgrade") || msg.includes("exceeds");
            if (isLimitErr) {
              toast.error(
                `"${f.filename}" exceeds the 15MB Free limit. Upgrade to Pro to upload documents up to 50MB.`,
                {
                  action: {
                    label: "Upgrade",
                    onClick: () => {
                      window.location.href = "/pricing";
                    },
                  },
                  duration: 10000,
                },
              );
            } else {
              toast.error(`Failed to upload "${f.filename}": ${msg}`);
            }
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
          deepResearch: deepResearchActive,
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
                <p className="mx-auto mt-2 max-w-xl text-sm sm:text-base leading-relaxed text-muted-foreground">
                  Your dedicated AI learning companion. Ask complex questions, build multi-phase roadmaps, generate rich notebooks with formulas, or plan your daily study rhythm.
                </p>
                {suggestions.length > 0 && (
                  <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void submit(s)}
                        className="press rounded-full border border-border bg-card/60 px-4 py-2 text-xs sm:text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground hover:border-primary/40 shadow-xs"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((message, idx) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {(() => {
                    const fileParts = (message.parts || []).filter(
                      (p): p is FileUIPart => p && p.type === "file",
                    );
                    const groupedParts: Array<
                      { type: "text"; text: string } | { type: "tools"; parts: ToolPartLike[] }
                    > = [];
                    let currentTools: ToolPartLike[] = [];

                    for (const part of message.parts || []) {
                      if (!part) continue;
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const pAny = part as any;
                      if (part.type === "text" || (typeof pAny.text === "string" && !part.type?.startsWith("tool-") && !pAny.toolInvocation)) {
                        if (currentTools.length > 0) {
                          groupedParts.push({ type: "tools", parts: currentTools });
                          currentTools = [];
                        }
                        const textVal = part.type === "text" ? part.text : pAny.text;
                        if (textVal) {
                          groupedParts.push({ type: "text", text: textVal });
                        }
                      } else if (part.type === "dynamic-tool" || part.type?.startsWith("tool-") || pAny.toolInvocation) {
                        currentTools.push(part as ToolPartLike);
                      }
                    }
                    if (currentTools.length > 0) {
                      groupedParts.push({ type: "tools", parts: currentTools });
                    }

                    // Fallback if parts array was empty or had no rendered parts
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const msgAny = message as any;
                    if (groupedParts.length === 0) {
                      const fallbackText = msgAny.content || msgAny.text || "";
                      if (fallbackText) {
                        groupedParts.push({ type: "text", text: fallbackText });
                      }
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
                            // If this text is an exact duplicate of a rendered deep research report in this message, skip rendering duplicate text
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const isDuplicateReport = message.parts?.some((p: any) => {
                              const reportText = p?.output?.report || p?.result?.report;
                              return (
                                reportText &&
                                (group.text === reportText || group.text.trim() === reportText.trim())
                              );
                            });
                            if (isDuplicateReport) return null;

                            const isActivelyStreaming = isStreaming && message.role === "assistant" && idx === messages.length - 1;
                            return (
                              <div key={gIdx}>
                                <MessageResponse>{group.text}</MessageResponse>
                                {message.role === "assistant" && !isActivelyStreaming && (
                                  <>
                                    <ChatVideoEmbeds text={group.text} />
                                    <SpeechAndCopyToolbar
                                      text={group.text}
                                      id={`${message.id}-${gIdx}`}
                                      className="mt-2"
                                    />
                                  </>
                                )}
                              </div>
                            );
                          }
                          const roadmapParts = group.parts.filter((p) => isRoadmapTool(p));
                          const researchParts = group.parts.filter((p) => isDeepResearchTool(p));
                          const notebookParts = group.parts.filter((p) => isNotebookTool(p));
                          return (
                            <div key={gIdx} className="space-y-2">
                              <ToolGroup parts={group.parts} />
                              {roadmapParts.map((rp, rpIdx) => (
                                <RoadmapChatCard key={rpIdx} part={rp} />
                              ))}
                              {researchParts.map((dp, dpIdx) => (
                                <DeepResearchChatCard key={dpIdx} part={dp} />
                              ))}
                              {notebookParts.map((np, npIdx) => (
                                <NotebookChatCard key={npIdx} part={np} />
                              ))}
                            </div>
                          );
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
          maxFileSize={isPremium ? 50 * 1024 * 1024 : 15 * 1024 * 1024}
          onError={(err) => {
            if (err.code === "max_file_size") {
              if (!isPremium) {
                toast.error(
                  "Files larger than 15MB require Pro. Upgrade to upload documents up to 50MB.",
                  {
                    action: {
                      label: "Upgrade",
                      onClick: () => {
                        navigate({ to: "/pricing" });
                      },
                    },
                    duration: 10000,
                  },
                );
              } else {
                toast.error("File exceeds the 50MB maximum upload limit.", { duration: 8000 });
              }
            } else if (err.code === "accept") {
              toast.error("Unsupported file type.");
            } else {
              toast.error(err.message);
            }
          }}
        >
          <AttachmentPreviews />
          <PromptInputTextarea
            ref={textareaRef}
            placeholder={
              deepResearchActive
                ? "Enter research topic for multi-agent deep research (arXiv, verifier & writer)..."
                : topic
                  ? `Ask a doubt about ${topic.label}…`
                  : "What do you want to create or ask?"
            }
            className="min-h-[44px] text-base"
          />

          <PromptInputFooter className="justify-between items-center">
            <div className="flex items-center gap-1.5 flex-wrap">
              <AttachButton />
              <VoiceInputButton textareaRef={textareaRef} />
              <DeepResearchToggleButton
                active={deepResearchActive}
                onToggle={() => setDeepResearchActive((v) => !v)}
                disabled={busy}
              />
            </div>
            <PromptInputSubmit status={status} onStop={stop} disabled={status === "submitted"} />
          </PromptInputFooter>
        </PromptInput>

        {!isPremium && (
          <div className="mt-2.5 flex items-center justify-between px-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-block size-2 rounded-full",
                  (usageData?.daily?.used ?? 0) >= (usageData?.daily?.limit ?? 20)
                    ? "bg-amber-500 animate-pulse"
                    : "bg-primary/80",
                )}
              />
              <span>
                <strong className="font-semibold text-foreground">
                  {usageData?.daily?.used ?? 0}/{usageData?.daily?.limit ?? 20}
                </strong>{" "}
                daily free messages used
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setLimitType("chat");
                setUpgradeModalOpen(true);
              }}
              className="font-medium text-primary hover:underline transition-colors flex items-center gap-1"
            >
              <Zap className="size-3" />
              Upgrade to Pro for Unlimited →
            </button>
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
