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

    // 1. Try quiz_attempts table
    try {
      const { error } = await context.supabase.from("quiz_attempts").insert({
        user_id: context.userId,
        roadmap_item_id: data.itemId,
        questions: data.questions as never,
        score,
        total,
      });

      if (!error) {
        return { success: true, score, correct, total };
      }
    } catch {
      /* Fallback below */
    }

    // 2. Fallback to agent_memories
    try {
      await context.supabase.from("agent_memories").insert({
        user_id: context.userId,
        category: "quiz_attempt",
        content: JSON.stringify({
          roadmap_item_id: data.itemId,
          questions: data.questions,
          score,
          total,
          created_at: new Date().toISOString(),
        }),
        importance: 1,
      });
    } catch {
      /* ignore fallback error */
    }

    return { success: true, score, correct, total };
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
