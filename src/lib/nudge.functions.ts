import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createAiGatewayProvider, getAiApiKey, getAiModelName } from "@/lib/ai-gateway.server";

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
      { data: habits },
      { data: habitLogs },
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
      supabase.from("habits").select("id,title,icon").eq("archived", false).limit(6),
      supabase
        .from("habit_logs")
        .select("habit_id,day")
        .gte("day", fmtDate(thirtyDaysAgo)),
      supabase.from("goals").select("title,progress").eq("status", "active").limit(4),
      supabase
        .from("journal_entries")
        .select("mood,day")
        .order("day", { ascending: false })
        .limit(7),
      supabase
        .from("focus_sessions")
        .select("minutes")
        .gte("created_at", weekAgo.toISOString()),
    ]);

    const openTasks = (tasks ?? []).map(
      (t) => `"${t.title}"${t.due_date ? ` (due ${t.due_date})` : ""}`,
    );
    const habitsList = (habits ?? []).map((h) => {
      const doneToday = (habitLogs ?? []).some(
        (l) => l.habit_id === h.id && l.day === todayStr,
      );
      const days = new Set(
        (habitLogs ?? []).filter((l) => l.habit_id === h.id).map((l) => l.day),
      );
      let streak = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        if (days.has(fmtDate(d))) streak++;
        else if (i > 0) break;
      }
      return `${h.title} (${streak}-day streak${doneToday ? ", done today" : ""})`;
    });
    const goalsList = (goals ?? []).map((g) => `${g.title} (${g.progress}%)`);
    const moodStr = (moods ?? []).map((m) => m.mood ?? "—").join(" ");
    const focusMin = (focusSessions ?? []).reduce(
      (sum, s) => sum + (s.minutes ?? 0),
      0,
    );

    let stateSummary = "";
    if (openTasks.length)
      stateSummary += `Open tasks (${openTasks.length}): ${openTasks.join(", ")}.\n`;
    if (habitsList.length)
      stateSummary += `Habits: ${habitsList.join("; ")}.\n`;
    if (goalsList.length)
      stateSummary += `Active goals: ${goalsList.join(", ")}.\n`;
    if (moodStr.trim())
      stateSummary += `Recent moods (last 7 days): ${moodStr}.\n`;
    stateSummary += `Focus minutes this week: ${focusMin}.\n`;
    if (!stateSummary.trim())
      stateSummary =
        "The user has no tasks, habits, or goals set up yet.";

    const gateway = createAiGatewayProvider(key);
    const result = streamText({
      model: gateway(getAiModelName()),
      system: NUDGE_PROMPT,
      prompt: `User's current state:\n${stateSummary}\n\nGenerate a warm nudge for their dashboard.`,
    });
    const text = await result.text;
    return { text: text || "" };
  });
