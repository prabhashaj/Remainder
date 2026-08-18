import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { generateQuiz, generateCheckpoint } from "@/lib/agents/quiz-generator.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAiApiKey } from "@/lib/ai-gateway.server";
import { checkRateLimit } from "@/lib/rate-limit.server";

/** Generate a quiz for a roadmap item. Returns questions without persisting. */
export const generateQuizForItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ itemId: z.string().max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "quiz_generate", 50, 60);
    } catch {
      return { success: false, error: "Too many requests. Please try again later." };
    }
    const key = getAiApiKey();
    if (!key) return { success: false, error: "AI is not configured." };
    return generateQuiz({
      itemId: data.itemId,
      apiKey: key,
      supabase: context.supabase,
    });
  });

/** Submit a quiz attempt — persist results and update roadmap progress. */
export const submitQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        itemId: z.string().max(100),
        questions: z
          .array(
            z.object({
              question: z.string().max(2000),
              correct_answer: z.string().max(1000),
              user_answer: z.string().max(1000),
              is_correct: z.boolean(),
            }),
          )
          .max(100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "quiz_submit", 200, 60);
    } catch {
      return { success: false, error: "Too many requests. Please try again later." };
    }
    const correct = data.questions.filter((q) => q.is_correct).length;
    const total = data.questions.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= 60;
    let markedCompleted = false;

    // Save to quiz_attempts table
    try {
      await context.supabase.from("quiz_attempts").insert({
        user_id: context.userId,
        roadmap_item_id: data.itemId,
        questions: data.questions as never,
        score,
        total,
      });
    } catch {
      /* ignore attempt insert error */
    }

    // Automatically mark lesson as completed if score is 60% or higher
    if (passed) {
      try {
        const { data: updatedItem } = await context.supabase
          .from("roadmap_items")
          .update({ done: true })
          .eq("id", data.itemId)
          .select("roadmap_id")
          .maybeSingle();

        markedCompleted = true;

        if (updatedItem?.roadmap_id) {
          const { data: allItems } = await context.supabase
            .from("roadmap_items")
            .select("id, done")
            .eq("roadmap_id", updatedItem.roadmap_id);

          if (allItems && allItems.length > 0 && allItems.every((i) => i.done === true)) {
            const { data: roadmap } = await context.supabase
              .from("roadmaps")
              .select("id, topic, user_id")
              .eq("id", updatedItem.roadmap_id)
              .maybeSingle();

            if (roadmap?.topic) {
              const { data: existing } = await context.supabase
                .from("agent_memories")
                .select("id")
                .eq("user_id", context.userId)
                .ilike("content", `%Skilled in ${roadmap.topic}%`)
                .maybeSingle();

              if (!existing) {
                await context.supabase.from("agent_memories").insert({
                  user_id: context.userId,
                  category: "skill",
                  content: `Skilled in ${roadmap.topic} (completed the whole roadmap)`,
                  importance: 5,
                });
              }
            }
          }
        }
      } catch {
        /* ignore completion error */
      }
    }

    return { success: true, score, correct, total, passed, markedCompleted };
  });

/** Generate confidence checkpoint questions for a roadmap item. */
export const generateCheckpointForItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ itemId: z.string().max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "quiz_checkpoint", 50, 60);
    } catch {
      return { success: false, error: "Too many requests. Please try again later." };
    }
    const key = getAiApiKey();
    if (!key) return { success: false, error: "AI is not configured." };
    return generateCheckpoint({
      itemId: data.itemId,
      apiKey: key,
      supabase: context.supabase,
    });
  });
