/**
 * Structured JSON logger for server-side code.
 *
 * Every log line is a single JSON object written to stdout, which Vercel
 * captures automatically. To swap in a real APM tool (Datadog, Axiom, etc.)
 * later, replace the `console.log` call below — the rest of the codebase
 * stays unchanged.
 *
 * Security: `apiKey` and `Authorization` fields are redacted before printing.
 */

type LogLevel = "info" | "warn" | "error";

/** Fields guaranteed on every log line */
interface LogLine {
  level: LogLevel;
  timestamp: string;
  event: string;
  userId?: string;
  traceId?: string;
  [key: string]: unknown;
}

const REDACTED_KEYS = new Set(["apiKey", "api_key", "authorization", "Authorization", "token"]);

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(k)) {
      clean[k] = "[REDACTED]";
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      clean[k] = redact(v as Record<string, unknown>);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export function log(
  level: LogLevel,
  event: string,
  context: Record<string, unknown> = {},
  meta?: { userId?: string | undefined; traceId?: string | undefined },
): void {
  const line: LogLine = {
    level,
    timestamp: new Date().toISOString(),
    event,
    ...(meta?.userId ? { userId: meta.userId } : {}),
    ...(meta?.traceId ? { traceId: meta.traceId } : {}),
    ...redact(context),
  };
  // Use process.stdout.write to avoid Node adding extra newlines on some runtimes
  console.log(JSON.stringify(line));
}
