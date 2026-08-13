import { startOfDay } from "date-fns";
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
  const { count, error: countError } = await supabase
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
  const { error: insertError } = await supabase.from("rate_limit_events").insert({
    user_id: userId,
    event_type: eventType,
  });

  if (insertError) {
    console.error(`Failed to record rate limit event for ${eventType}:`, insertError);
  }
}

/**
 * Checks if the user has exceeded their daily/monthly limit based on their active plan.
 */
export async function checkPlanUsage(
  supabase: SupabaseClient<Database>,
  userId: string,
  eventType: string
) {
  // Fetch active subscription and plan
  const { data: subData } = await supabase
    .from("subscriptions")
    .select("*, plans(*)")
    .eq("user_id", userId)
    .maybeSingle();

  let dailyLimit = 20; // Default Free Tier Limit
  let monthlyLimit = 200; // Default Free Tier Monthly Limit
  
  if (subData && subData.status === "active" && subData.plans) {
    const plan = subData.plans as any;
    dailyLimit = plan.daily_message_limit ?? dailyLimit;
    monthlyLimit = plan.monthly_message_limit ?? monthlyLimit;
  }

  // We use UTC midnight to avoid timezone edge cases.
  const todayStartUtc = new Date();
  todayStartUtc.setUTCHours(0, 0, 0, 0);

  const monthStartUtc = new Date();
  monthStartUtc.setUTCDate(1);
  monthStartUtc.setUTCHours(0, 0, 0, 0);

  // Count events for today
  const { count: dailyCount } = await supabase
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", eventType)
    .gte("created_at", todayStartUtc.toISOString());

  // Count events for this month
  const { count: monthlyCount } = await supabase
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", eventType)
    .gte("created_at", monthStartUtc.toISOString());

  if (dailyCount !== null && dailyCount >= dailyLimit) {
    throw new Error("403: Plan Daily Limit Exceeded");
  }

  if (monthlyCount !== null && monthlyCount >= monthlyLimit) {
    throw new Error("403: Plan Monthly Limit Exceeded");
  }

  // We don't record the event here, we rely on checkRateLimit to record it
  // to avoid double-recording in rate_limit_events
  
  return {
     daily: { used: dailyCount || 0, limit: dailyLimit },
     monthly: { used: monthlyCount || 0, limit: monthlyLimit }
  };
}

/**
 * Helper to wrap Response returning standard 429 or 403 headers based on the error.
 */
export function handleRateLimitError(error: unknown, windowMinutes = 60) {
  if (error instanceof Error) {
    if (error.message.includes("429")) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": String(windowMinutes * 60),
          "Content-Type": "text/plain",
        },
      });
    }
    
    if (error.message.includes("403: Plan")) {
      return new Response(JSON.stringify({ 
         error: "Plan limit reached", 
         message: "You've reached your plan's message limit. Upgrade to continue using this feature." 
      }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  console.error("Internal Server Error:", error);
  return new Response("Internal Server Error", { status: 500 });
}
