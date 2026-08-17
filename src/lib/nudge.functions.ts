import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createAiGatewayProvider, getAiApiKey, getAiModelName } from "@/lib/ai-gateway.server";
import { checkRateLimit } from "@/lib/rate-limit.server";

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const NUDGE_PROMPT = `You generate a single warm, personalized nudge for the user's dashboard based on their current workspace state.
Rules:
- One or two sentences max
- Be encouraging and specific — reference real streaks, tasks, or goals
- Never guilt-trip about missed days
- If everything is done, celebrate calmly
- If nothing is set up, gently suggest starting one small thing
- Speak as "Remi", the user's coach`;

export const generateNudge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "generate_nudge", 50, 60);
    } catch {
      return { text: "" };
    }
    const { supabase } = context;
    const key = getAiApiKey();
    if (!key) return { text: "" };

    const now = new Date();
    const todayStr = fmtDate(now);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      { data: tasks },
      { data: roadmaps },
      { data: roadmapItems },
      { data: goals },
      { data: moods },
      { data: focusSessions },
    ] = await Promise.all([
      supabase
        .from("tasks")
        .select("title,due_date")
        .eq("done", false)
        .order("due_date", { nullsFirst: false })
        .limit(5),
      supabase.from("roadmaps").select("id,topic").limit(5),
      supabase
        .from("roadmap_items")
        .select("title,done,updated_at,created_at")
        .limit(100),
      supabase.from("goals").select("title,progress").eq("status", "active").limit(4),
      supabase
        .from("journal_entries")
        .select("mood,day")
        .order("day", { ascending: false })
        .limit(7),
      supabase
        .from("focus_sessions")
        .select("minutes,counted_minutes,created_at")
        .gte("created_at", thirtyDaysAgo.toISOString()),
    ]);

    const openTasks = (tasks ?? []).map(
      (t) => `"${t.title}"${t.due_date ? ` (due ${t.due_date})` : ""}`,
    );

    const activeDates = new Set<string>();
    (roadmapItems ?? []).forEach((item) => {
      if (item.done) {
        if (item.updated_at) activeDates.add(item.updated_at.slice(0, 10));
        else if (item.created_at) activeDates.add(item.created_at.slice(0, 10));
      }
    });
    (focusSessions ?? []).forEach((fs) => {
      const mins = fs.counted_minutes ?? fs.minutes ?? 0;
      if (mins > 0 && fs.created_at) activeDates.add(fs.created_at.slice(0, 10));
    });

    const todayStudied = activeDates.has(todayStr);
    let streak = 0;
    const startOffset = todayStudied ? 0 : activeDates.has(fmtDate(new Date(Date.now() - 86400000))) ? 1 : null;
    if (startOffset !== null) {
      for (let i = startOffset; i < 365; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        if (activeDates.has(fmtDate(d))) streak++;
        else break;
      }
    }

    const roadmapsList = (roadmaps ?? []).map((r) => r.topic);
    const goalsList = (goals ?? []).map((g) => `${g.title} (${g.progress}%)`);
    const moodStr = (moods ?? []).map((m) => m.mood ?? "—").join(" ");
    const focusMin = (focusSessions ?? []).reduce(
      (sum, s) => sum + (s.counted_minutes ?? s.minutes ?? 0),
      0,
    );

    let stateSummary = "";
    if (streak > 0) stateSummary += `Roadmap Study Streak: ${streak} days (${todayStudied ? "already studied today" : "not studied yet today"}).\n`;
    if (roadmapsList.length) stateSummary += `Active Roadmaps: ${roadmapsList.join(", ")}.\n`;
    if (openTasks.length)
      stateSummary += `Open tasks (${openTasks.length}): ${openTasks.join(", ")}.\n`;
    if (goalsList.length) stateSummary += `Active goals: ${goalsList.join(", ")}.\n`;
    if (moodStr.trim()) stateSummary += `Recent moods (last 7 days): ${moodStr}.\n`;
    stateSummary += `Focus minutes this week: ${focusMin}.\n`;
    if (!stateSummary.trim()) stateSummary = "The user has no roadmaps, tasks, or goals set up yet.";

    const gateway = createAiGatewayProvider(key);
    const result = streamText({
      model: gateway(getAiModelName()),
      system: NUDGE_PROMPT,
      prompt: `User's current state:\n${stateSummary}\n\nGenerate a warm nudge for their dashboard.`,
    });
    const text = await result.text;
    return { text: text || "" };
  });
