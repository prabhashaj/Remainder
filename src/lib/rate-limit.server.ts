import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Checks if the user has exceeded the rate limit for a specific event type.
 * Records the new event if they haven't exceeded the limit.
 *
 * @param supabase The authenticated Supabase client (MUST be acting as the user)
 * @param userId The ID of the authenticated user
 * @param eventType An identifier for the rate limit bucket (e.g. "chat_llm", "study_function")
 * @param maxEvents Maximum allowed events within the window
 * @param windowMinutes The sliding window length in minutes
 * @throws {Error} with message "429: Too Many Requests" if rate limit exceeded
 */
export async function checkRateLimit(
  supabase: SupabaseClient<Database>,
  userId: string,
  eventType: string,
  maxEvents: number,
  windowMinutes: number,
) {
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

  // 1. Count events in the time window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error: countError } = await (supabase as any)
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", eventType)
    .gte("created_at", windowStart.toISOString());

  if (countError) {
    console.error(`Rate limit check failed for ${eventType}:`, countError);
    // Fail open or fail closed? Usually fail closed on error, but let's throw a 500 equivalent
    throw new Error("500: Internal Server Error checking rate limits");
  }

  // 2. Enforce limit
  if (count !== null && count >= maxEvents) {
    throw new Error("429: Too Many Requests");
  }

  // 3. Record new event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any).from("rate_limit_events").insert({
    user_id: userId,
    event_type: eventType,
  });

  if (insertError) {
    console.error(`Failed to record rate limit event for ${eventType}:`, insertError);
  }
}

/**
 * Helper to wrap Response returning standard 429 Retry-After headers if error is 429.
 */
export function handleRateLimitError(error: unknown, windowMinutes = 60) {
  if (error instanceof Error && error.message.includes("429")) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(windowMinutes * 60),
        "Content-Type": "text/plain",
      },
    });
  }

  console.error("Internal Server Error:", error);
  return new Response("Internal Server Error", { status: 500 });
}
