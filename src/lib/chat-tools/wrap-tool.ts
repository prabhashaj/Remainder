import type { createClient } from "@supabase/supabase-js";
import { log } from "@/lib/logger.server";
import type { Database } from "@/integrations/supabase/types";

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
  let output: any = null;
  let status: "success" | "error" = "success";
  let errorMessage: string | undefined;

  try {
    output = await execute();
    log("info", "tool_call", { toolName, durationMs: Date.now() - start }, { userId, traceId });
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
        output: output,
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
