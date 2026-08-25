import type { createClient } from "@supabase/supabase-js";
import { log } from "@/lib/logger.server";
import { invalidateUserContextCache } from "@/routes/api/chat";
import type { Database } from "@/integrations/supabase/types";

// In-memory trace call tracking to detect and break infinite tool repetition loops
const traceToolCallMap = new Map<string, Map<string, number>>();

function trackToolCall(traceId: string, toolKey: string): number {
  if (!traceToolCallMap.has(traceId)) {
    // Keep map bounded to 500 active traces
    if (traceToolCallMap.size > 500) {
      const oldestKey = traceToolCallMap.keys().next().value;
      if (oldestKey) traceToolCallMap.delete(oldestKey);
    }
    traceToolCallMap.set(traceId, new Map());
  }
  const traceMap = traceToolCallMap.get(traceId)!;
  const currentCount = (traceMap.get(toolKey) ?? 0) + 1;
  traceMap.set(toolKey, currentCount);
  return currentCount;
}

/**
 * Wraps a tool execute function with timing, structured logging, and a
 * fire-and-forget agent_actions audit write. Does NOT block the stream.
 */
export async function wrapTool<T>(
  toolName: string,
  execute: () => Promise<T>,
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  traceId: string,
  threadId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
): Promise<T> {
  const start = Date.now();
  let output: unknown = null;
  let status: "success" | "error" = "success";
  let errorMessage: string | undefined;

  // Tool repetition loop detection
  const toolInputKey = `${toolName}:${JSON.stringify(input ?? {})}`;
  const callCount = trackToolCall(traceId, toolInputKey);
  if (callCount > 3) {
    const loopMessage = `Repetition safeguard triggered: "${toolName}" was called with identical parameters ${callCount} times in this turn. Stop repeating tool calls and synthesize your answer directly from already retrieved data.`;
    log("warn", "tool_repetition_loop_detected", { toolName, callCount }, { userId, traceId });
    return { success: false, error: loopMessage } as unknown as T;
  }

  try {
    output = await execute();
    log("info", "tool_call", { toolName, durationMs: Date.now() - start }, { userId, traceId });
    if (
      toolName.startsWith("create") ||
      toolName.startsWith("update") ||
      toolName.startsWith("delete") ||
      toolName.startsWith("add") ||
      toolName.startsWith("save") ||
      toolName.startsWith("edit") ||
      toolName.startsWith("forget") ||
      toolName === "delegateToPlanner"
    ) {
      invalidateUserContextCache(userId);
    }
    return output as T;
  } catch (err) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : String(err);
    log(
      "error",
      "tool_call_error",
      { toolName, error: errorMessage, durationMs: Date.now() - start },
      { userId, traceId },
    );
    return { success: false, error: errorMessage } as unknown as T;
  } finally {
    const durationMs = Date.now() - start;
    // Fire-and-forget audit write — never blocks the streaming response
    void supabase
      .from("agent_actions")
      .insert({
        user_id: userId,
        trace_id: traceId,
        thread_id: threadId,
        tool_name: toolName,
        input: input,
        output: output as never,
        status,
        error_message: errorMessage ?? null,
        duration_ms: durationMs,
      })
      .then(({ error }: { error: unknown }) => {
        if (error) {
          log(
            "warn",
            "audit_write_failed",
            { toolName, error: String(error) },
            { userId, traceId },
          );
        }
      });
  }
}
