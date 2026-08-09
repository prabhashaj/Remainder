import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIcon,
  CheckCircleIcon,
  ClockIcon,
  SearchIcon,
  XCircleIcon,
  ChevronDownIcon,
  DatabaseIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/activity")({
  component: ActivityPage,
});

type AgentAction = {
  id: string;
  trace_id: string;
  thread_id: string | null;
  tool_name: string;
  input: Record<string, unknown>;
  output: unknown;
  status: string;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
};

type BackgroundJob = {
  id: string;
  job_type: string;
  resource_id: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString();
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success" || status === "done") {
    return (
      <Badge
        variant="secondary"
        className="gap-1 rounded-full text-xs text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400"
      >
        <CheckCircleIcon className="size-3" />
        {status}
      </Badge>
    );
  }
  if (status === "error" || status === "failed") {
    return (
      <Badge
        variant="secondary"
        className="gap-1 rounded-full text-xs text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400"
      >
        <XCircleIcon className="size-3" />
        {status}
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge
        variant="secondary"
        className="gap-1 rounded-full text-xs text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
      >
        <ClockIcon className="size-3 animate-pulse" />
        running
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 rounded-full text-xs">
      <ClockIcon className="size-3" />
      {status}
    </Badge>
  );
}

function JsonViewer({ data }: { data: unknown }) {
  if (data === null || data === undefined)
    return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <pre className="rounded-md bg-muted/50 p-3 text-xs overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function ActionCard({ action }: { action: AgentAction }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group rounded-md border bg-card text-card-foreground shadow-sm"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 p-3 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs font-semibold truncate">{action.tool_name}</span>
          <StatusBadge status={action.status} />
          <span className="text-xs text-muted-foreground shrink-0">{action.duration_ms}ms</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(action.created_at)}
          </span>
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 space-y-3">
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Input
          </h4>
          <JsonViewer data={action.input} />
        </div>
        {action.output !== null && (
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Output
            </h4>
            <JsonViewer data={action.output} />
          </div>
        )}
        {action.error_message && (
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-destructive uppercase tracking-wide">Error</h4>
            <p className="text-xs text-destructive bg-destructive/10 rounded-md p-2">
              {action.error_message}
            </p>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground font-mono">trace: {action.trace_id}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TraceGroup({ traceId, actions }: { traceId: string; actions: AgentAction[] }) {
  const [open, setOpen] = useState(false);
  const hasError = actions.some((a) => a.status === "error");
  const earliest = actions[actions.length - 1];

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ActivityIcon className="size-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {actions.length} tool call{actions.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground font-mono truncate">{traceId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasError && <StatusBadge status="error" />}
          {earliest && (
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(earliest.created_at)}
            </span>
          )}
          <ChevronDownIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>
      {open && (
        <div className="border-t bg-muted/10 p-3 space-y-2">
          {actions.map((action) => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ job }: { job: BackgroundJob }) {
  return (
    <div className="rounded-md border bg-card p-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <DatabaseIcon className="size-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{job.job_type}</p>
          {job.resource_id && (
            <p className="text-xs text-muted-foreground font-mono truncate">{job.resource_id}</p>
          )}
          {job.error_message && (
            <p className="text-xs text-destructive truncate">{job.error_message}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={job.status} />
        <span className="text-xs text-muted-foreground">{formatRelativeTime(job.created_at)}</span>
      </div>
    </div>
  );
}

function ActivityPage() {
  const { session } = useSession();
  const [tab, setTab] = useState<"actions" | "jobs">("actions");
  const [traceFilter, setTraceFilter] = useState("");

  const { data: actions = [], isLoading: actionsLoading } = useQuery({
    queryKey: ["agent_actions"],
    enabled: !!session,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("agent_actions")
        .select(
          "id,trace_id,thread_id,tool_name,input,output,status,error_message,duration_ms,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AgentAction[];
    },
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["background_jobs"],
    enabled: !!session && tab === "jobs",
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("background_jobs")
        .select("id,job_type,resource_id,status,error_message,created_at,completed_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as BackgroundJob[];
    },
  });

  // Group actions by trace_id
  const filteredActions = traceFilter
    ? actions.filter((a) => a.trace_id.toLowerCase().includes(traceFilter.toLowerCase()))
    : actions;

  const grouped = filteredActions.reduce<Record<string, AgentAction[]>>((acc, action) => {
    if (!acc[action.trace_id]) acc[action.trace_id] = [];
    acc[action.trace_id]!.push(action);
    return acc;
  }, {});

  const traceGroups = Object.entries(grouped).sort(
    ([, a], [, b]) => new Date(b[0]!.created_at).getTime() - new Date(a[0]!.created_at).getTime(),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ActivityIcon className="size-6" />
          Activity
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          End-to-end trace of every AI tool call and background job. Use the trace ID from{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">X-Trace-Id</code> response header
          to filter.
        </p>
      </div>

      {/* Tab strip */}
      <div className="flex gap-2 border-b pb-0">
        {(["actions", "jobs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "actions" ? "Tool Calls" : "Background Jobs"}
          </button>
        ))}
      </div>

      {tab === "actions" && (
        <>
          {/* Trace search */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Filter by trace ID…"
              value={traceFilter}
              onChange={(e) => setTraceFilter(e.target.value)}
              className="pl-9 font-mono text-sm"
            />
          </div>

          {actionsLoading && (
            <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading…</div>
          )}

          {!actionsLoading && traceGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <ActivityIcon className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {traceFilter
                  ? "No traces matching that ID."
                  : "No tool calls recorded yet. Start a chat with Remi!"}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {traceGroups.map(([traceId, traceActions]) => (
              <TraceGroup key={traceId} traceId={traceId} actions={traceActions} />
            ))}
          </div>
        </>
      )}

      {tab === "jobs" && (
        <>
          {jobsLoading && (
            <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading…</div>
          )}
          {!jobsLoading && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <DatabaseIcon className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No background jobs recorded yet. Upload a document to trigger embedding.
              </p>
            </div>
          )}
          <div className="space-y-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
