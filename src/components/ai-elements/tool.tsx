"use client";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { ChevronDownIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

import { CodeBlock } from "./code-block";
import { Shimmer } from "./shimmer";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible className={cn("group not-prose mb-4 w-full", className)} {...props} />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  className?: string;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

const getToolName = (toolName: string, isRunning: boolean) => {
  const mapping: Record<string, { active: string; done: string }> = {
    createTask: { active: "Creating task...", done: "Created task" },
    updateTask: { active: "Updating task...", done: "Updated task" },
    createGoal: { active: "Creating goal...", done: "Created goal" },
    updateGoal: { active: "Updating goal...", done: "Updated goal" },
    addMilestone: { active: "Adding milestone...", done: "Added milestone" },
    createMilestone: { active: "Adding milestone...", done: "Added milestone" },
    createRoadmap: { active: "Creating roadmap", done: "Created roadmap" },
    updateRoadmap: { active: "Updating and modifying...", done: "Updated roadmap" },
    readRoadmap: { active: "Reading roadmap", done: "Read roadmap" },
    researchResources: { active: "Finding video tutorials", done: "Found video tutorials" },
    webSearch: { active: "Searching the web", done: "Searched the web" },
    searchArxiv: { active: "Searching arXiv", done: "Searched arXiv" },
    searchPapers: { active: "Searching academic papers", done: "Searched academic papers" },
    searchDocs: { active: "Searching documentation", done: "Searched documentation" },
    searchPhotos: { active: "Searching photos & diagrams", done: "Searched photos & diagrams" },
    writeLessonForSubtopic: { active: "Writing subtopic lesson", done: "Wrote subtopic lesson" },
    generateNotebook: { active: "Generating study notebook", done: "Generated study notebook" },
    editNotebook: { active: "Updating study notebook", done: "Updated study notebook" },
    saveMemory: { active: "Saving memory note", done: "Saved memory note" },
    readDocument: { active: "Reading document", done: "Read document" },
    deepResearch: { active: "Executing deep multi-agent research...", done: "Completed deep research" },
    getCurrentTime: { active: "Checking time", done: "Checked time" },
    getWeather: { active: "Checking live weather", done: "Checked live weather" },
    delegateToPlanner: { active: "Building learning plan", done: "Built learning plan" },
  };

  if (mapping[toolName]) {
    return isRunning ? mapping[toolName].active : mapping[toolName].done;
  }

  const defaultName = toolName
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase();
  const formattedDefault = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
  return isRunning ? `Creating ${formattedDefault}` : `Created ${formattedDefault}`;
};

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName = type === "dynamic-tool" ? toolName! : type.split("-").slice(1).join("-");
  const isRunning = state === "input-available" || state === "input-streaming";
  const displayName = title ?? getToolName(derivedName, isRunning);

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center gap-2 py-2 text-base text-muted-foreground hover:text-foreground transition-colors",
        className,
      )}
      {...props}
    >
      {isRunning ? (
        <Shimmer>{displayName}</Shimmer>
      ) : (
        <>
          <span>{displayName}</span>
          <ChevronDownIcon className="size-4 opacity-50 transition-transform group-data-[state=open]:rotate-180" />
        </>
      )}
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 space-y-4 p-4 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className,
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-2 overflow-hidden", className)} {...props}>
    <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Parameters
    </h4>
    <div className="rounded-md bg-muted/50">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

export const ToolOutput = ({ className, output, errorText, ...props }: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  // Check if output is a Deep Research result with action trail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDeepResearch = output && typeof output === "object" && Array.isArray((output as any).action_trail);

  let Output = <div>{output as ReactNode}</div>;

  if (isDeepResearch) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = output as any;
    Output = (
      <div className="space-y-3 p-3">
        {data.plan && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="font-semibold text-primary text-xs uppercase tracking-wide">
              Research Plan & Scope
            </div>
            <div className="mt-1 font-medium text-foreground text-sm">{data.plan.topic}</div>
            <div className="mt-0.5 text-muted-foreground text-xs">{data.plan.scope}</div>
            {data.plan.temporalConstraints && (
              <div className="mt-1.5 inline-block rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">
                Time Window: {data.plan.temporalConstraints}
              </div>
            )}
          </div>
        )}

        {Array.isArray(data.subtasks) && data.subtasks.length > 0 && (
          <div className="space-y-1.5">
            <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Decomposed Subtasks ({data.subtasks.length})
            </div>
            <div className="grid gap-1.5">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {data.subtasks.map((st: any, i: number) => (
                <div
                  key={st.id || i}
                  className="flex items-start gap-2 rounded-md border border-border/50 bg-background/50 p-2 text-xs"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono font-semibold text-[10px]">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-medium text-foreground">{st.title}</div>
                    <div className="text-muted-foreground text-[11px]">{st.objective}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(data.action_trail) && data.action_trail.length > 0 && (
          <div className="space-y-1">
            <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Execution Action Trail
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {data.action_trail.map((act: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span className="font-medium text-foreground">{act.step}:</span>
                  <span className="truncate">{act.details}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.verified_papers_count !== undefined && (
          <div className="flex items-center gap-2 pt-1 font-medium text-muted-foreground text-xs">
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {data.verified_papers_count} Verified Papers Retrieved
            </Badge>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {data.subagents_count || 4} Parallel Subagents
            </Badge>
          </div>
        )}
      </div>
    );
  } else if (typeof output === "object" && !isValidElement(output)) {
    Output = <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />;
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output} language="json" />;
  }

  return (
    <div className={cn("space-y-2", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Research & Tool Execution"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-foreground",
        )}
      >
        {errorText && <div className="p-3">{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
