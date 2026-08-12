import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createAiGatewayProvider, getAiApiKey, getAiModelName } from "@/lib/ai-gateway.server";
import { checkRateLimit } from "@/lib/rate-limit.server";

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const REFLECTION_PROMPT = `You write a short weekly reflection for someone using Remispace, their calm productivity and learning workspace.
Speak as "Remi", their coach — warm, personal, observant, never preachy.

Structure (markdown, 90-140 words total):
- One opening sentence naming the most real thing they did this week.
- "**Here's what you did**" — 2-3 tight bullets with actual numbers (tasks finished, habit days, focus minutes, flashcard/quiz reviews, lessons read).
- "**The pattern I'm noticing**" — one honest, specific observation about how they work (best days, focus quality, learning retention, what slips, what's building).
- One gentle suggestion for next week, small enough to start on Monday.

Rules: use their real data only, never invent activity, never guilt-trip a quiet week — a quiet week gets kindness and one small restart.`;

export const generateWeeklyReflection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "generate_weekly", 20, 60);
    } catch {
      return { text: "" };
    }
    const { supabase } = context;
    const key = getAiApiKey();
    if (!key) return { text: "" };

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = fmtDate(weekAgo);

    const [
      { data: tasksDone },
      { data: habits },
      { data: habitLogs },
      { data: goals },
      { data: moods },
      { data: focusSessions },
      { data: lessons },
      { data: quizzes },
      { data: flashcardsReviewed },
    ] = await Promise.all([
      supabase
        .from("tasks")
        .select("title,updated_at")
        .eq("done", true)
        .gte("updated_at", weekAgo.toISOString())
        .limit(30),
      supabase.from("habits").select("id,title").eq("archived", false).limit(10),
      supabase.from("habit_logs").select("habit_id,day").gte("day", weekAgoStr),
      supabase.from("goals").select("title,progress").eq("status", "active").limit(5),
      supabase
        .from("journal_entries")
        .select("mood,note,day")
        .gte("day", weekAgoStr)
        .order("day", { ascending: false }),
      supabase
        .from("focus_sessions")
        .select("title,minutes,counted_minutes,created_at,stayed_on_task,tab_away_count")
        .gte("created_at", weekAgo.toISOString()),
      supabase
        .from("roadmap_items")
        .select("title,updated_at")
        .eq("content_status", "ready")
        .gte("updated_at", weekAgo.toISOString())
        .limit(15),
      supabase
        .from("quiz_attempts")
        .select("score,total,created_at")
        .gte("created_at", weekAgo.toISOString()),
      supabase.from("flashcards").select("id,updated_at").gte("updated_at", weekAgo.toISOString()),
    ]);

    const doneTitles = (tasksDone ?? []).map((t) => t.title);
    const habitSummary = (habits ?? []).map((h) => {
      const days = (habitLogs ?? []).filter((l) => l.habit_id === h.id).length;
      return `${h.title}: ${days}/7 days`;
    });
    const focusMin = (focusSessions ?? []).reduce((sum, s) => sum + (s.counted_minutes ?? s.minutes ?? 0), 0);
    const focusDays = new Set((focusSessions ?? []).map((s) => (s.created_at ?? "").slice(0, 10)))
      .size;
    const moodLine = (moods ?? []).map((m) => `${m.day}: ${m.mood ?? "—"}`).join(", ");

    const avgQuizScore =
      quizzes && quizzes.length > 0
        ? Math.round(quizzes.reduce((sum, q) => sum + q.score, 0) / quizzes.length)
        : null;

    const totalTabAways = (focusSessions ?? []).reduce(
      (sum, s) => sum + (s.tab_away_count ?? 0),
      0,
    );

    const summary = [
      `Tasks completed (${doneTitles.length}): ${doneTitles.slice(0, 12).join(", ") || "none"}`,
      `Habits: ${habitSummary.join("; ") || "none set up"}`,
      `Focus: ${focusMin} minutes across ${focusDays} day(s) (${totalTabAways} total tab-aways)`,
      `Lessons read/generated: ${(lessons ?? []).map((l) => l.title).join(", ") || "none"}`,
      `Quizzes taken: ${quizzes?.length ?? 0}${avgQuizScore !== null ? ` (avg score: ${avgQuizScore}%)` : ""}`,
      `Flashcard reviews: ${flashcardsReviewed?.length ?? 0} cards updated/reviewed`,
      `Active goals: ${(goals ?? []).map((g) => `${g.title} (${g.progress}%)`).join(", ") || "none"}`,
      `Moods: ${moodLine || "not logged"}`,
    ].join("\n");

    const gateway = createAiGatewayProvider(key);
    const result = streamText({
      model: gateway(getAiModelName()),
      system: REFLECTION_PROMPT,
      prompt: `This person's last 7 days:\n${summary}\n\nWrite their weekly reflection.`,
    });
    const text = await result.text;
    return { text: text || "" };
  });
