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
    createHabit: { active: "Creating habit", done: "Created habit" },
    updateHabit: { active: "Updating habit", done: "Updated habit" },
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
    getCurrentTime: { active: "Checking time", done: "Checked time" },
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

  let Output = <div>{output as ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />;
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output} language="json" />;
  }

  return (
    <div className={cn("space-y-2", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-foreground",
        )}
      >
        {errorText && <div>{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
