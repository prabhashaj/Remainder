import { fetchSubscription, fetchUsage, type Subscription, type UsageLog } from "@/lib/db";
import { startOfWeek, format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const LIMITS = {
  FREE: {
    ROADMAPS_PER_WEEK: 2,
    NOTEBOOKS_PER_WEEK: 5,
    MAX_FILE_SIZE_MB: 15,
  },
  PREMIUM: {
    ROADMAPS_PER_WEEK: 10,
    NOTEBOOKS_PER_WEEK: 15,
    MAX_FILE_SIZE_MB: 50,
  },
};

export function isSubscriptionPremium(sub: Subscription | null | undefined): boolean {
  if (!sub) return false;
  const isPaidTier =
    sub.tier === "weekly" || sub.tier === "monthly" || sub.tier === "pro" || sub.tier === "premium";
  if (!isPaidTier) return false;

  const isActive = sub.status === "active";
  const isValidTrial =
    sub.status === "trialing" &&
    sub.trial_ends_at != null &&
    new Date(sub.trial_ends_at) > new Date();

  return isActive || isValidTrial;
}

export function getCurrentWeekStart() {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export async function getRemainingLimits() {
  const [sub, usage] = await Promise.all([
    fetchSubscription().catch(() => null),
    fetchUsage(getCurrentWeekStart()).catch(() => null),
  ]);

  const isPremium = isSubscriptionPremium(sub);
  const limits = isPremium ? LIMITS.PREMIUM : LIMITS.FREE;

  const roadmapsUsed = usage?.roadmaps_generated || 0;
  const notebooksUsed = usage?.notebooks_created || 0;

  return {
    isPremium,
    tier: sub?.tier || "free",
    roadmaps: {
      used: roadmapsUsed,
      limit: limits.ROADMAPS_PER_WEEK,
      remaining: Math.max(0, limits.ROADMAPS_PER_WEEK - roadmapsUsed),
      canCreate: roadmapsUsed < limits.ROADMAPS_PER_WEEK,
    },
    notebooks: {
      used: notebooksUsed,
      limit: limits.NOTEBOOKS_PER_WEEK,
      remaining: Math.max(0, limits.NOTEBOOKS_PER_WEEK - notebooksUsed),
      canCreate: notebooksUsed < limits.NOTEBOOKS_PER_WEEK,
    },
    maxFileSizeMb: limits.MAX_FILE_SIZE_MB,
  };
}

export async function getRemainingLimitsServer(supabase: SupabaseClient<Database>, userId: string) {
  const weekStart = getCurrentWeekStart();
  const [subRes, usageRes] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("usage_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("week_start_date", weekStart)
      .maybeSingle(),
  ]);

  const sub = subRes.data;
  const usage = usageRes.data;

  const isPremium = isSubscriptionPremium(sub);
  const limits = isPremium ? LIMITS.PREMIUM : LIMITS.FREE;

  const roadmapsUsed = usage?.roadmaps_generated || 0;
  const notebooksUsed = usage?.notebooks_created || 0;

  return {
    isPremium,
    tier: sub?.tier || "free",
    roadmaps: {
      used: roadmapsUsed,
      limit: limits.ROADMAPS_PER_WEEK,
      remaining: Math.max(0, limits.ROADMAPS_PER_WEEK - roadmapsUsed),
      canCreate: roadmapsUsed < limits.ROADMAPS_PER_WEEK,
    },
    notebooks: {
      used: notebooksUsed,
      limit: limits.NOTEBOOKS_PER_WEEK,
      remaining: Math.max(0, limits.NOTEBOOKS_PER_WEEK - notebooksUsed),
      canCreate: notebooksUsed < limits.NOTEBOOKS_PER_WEEK,
    },
    maxFileSizeMb: limits.MAX_FILE_SIZE_MB,
  };
}
