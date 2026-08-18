import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { writeFlashcards } from "@/lib/agents/flashcard-generator.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAiApiKey } from "@/lib/ai-gateway.server";
import { checkRateLimit } from "@/lib/rate-limit.server";

function sm2(params: { quality: number; ease: number; interval: number; repetitions: number }): {
  ease: number;
  interval: number;
  repetitions: number;
} {
  const { quality } = params;
  let { ease, interval, repetitions } = params;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ease);
    }
    repetitions += 1;
  }

  ease = Math.max(1.3, ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  return { ease, interval, repetitions };
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type FlashcardRecord = {
  id: string;
  roadmap_item_id: string | null;
  front: string;
  back: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  due_date: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

/** Generate flashcards for a roadmap item using AI. */
export const generateFlashcardsForItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ itemId: z.string().max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "srs_generate", 50, 60);
    } catch {
      return { success: false, error: "Too many requests. Please try again later." };
    }
    const key = getAiApiKey();
    if (!key) return { success: false, error: "AI is not configured." };
    return writeFlashcards({
      itemId: data.itemId,
      apiKey: key,
      supabase: context.supabase,
      userId: context.userId,
    });
  });

/** Fetch all flashcards due today or earlier. */
export const fetchDueFlashcards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = todayStr();

    try {
      const { data, error } = await context.supabase
        .from("flashcards")
        .select("*")
        .lte("due_date", today)
        .order("due_date")
        .limit(50);
      if (!error && data) return data as FlashcardRecord[];
    } catch {
      /* ignore */
    }

    return [];
  });

/** Fetch all flashcards for a specific roadmap item. */
export const fetchFlashcardsForItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ itemId: z.string().max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    try {
      const { data: cards, error } = await context.supabase
        .from("flashcards")
        .select("*")
        .eq("roadmap_item_id", data.itemId)
        .order("created_at")
        .limit(5);
      if (!error && cards) return (cards as FlashcardRecord[]).slice(0, 5);
    } catch {
      /* ignore */
    }

    return [];
  });

/** Get count of due flashcards (for dashboard widget). */
export const fetchDueFlashcardCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = todayStr();

    try {
      const { count, error } = await context.supabase
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .lte("due_date", today);
      if (!error && typeof count === "number") return { count };
    } catch {
      /* ignore */
    }

    return { count: 0 };
  });

/** Fetch flashcard count for a specific roadmap item. */
export const fetchFlashcardCountForItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ itemId: z.string().max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    try {
      const { count, error } = await context.supabase
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq("roadmap_item_id", data.itemId);
      if (!error && typeof count === "number") return { count: Math.min(count, 5) };
    } catch {
      /* ignore */
    }

    return { count: 0 };
  });

/** Review a flashcard: apply SM-2 algorithm and schedule next review. */
export const reviewFlashcard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        cardId: z.string().max(100),
        quality: z.number().int().min(0).max(5),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "srs_review", 1000, 60);
    } catch {
      return { success: false, error: "Too many requests. Please try again later." };
    }

    try {
      const { data: card, error: fetchErr } = await context.supabase
        .from("flashcards")
        .select("ease, interval_days, repetitions")
        .eq("id", data.cardId)
        .maybeSingle();

      if (!fetchErr && card) {
        const result = sm2({
          quality: data.quality,
          ease: card.ease,
          interval: card.interval_days,
          repetitions: card.repetitions,
        });

        const newDueDate = addDays(todayStr(), result.interval);

        await context.supabase
          .from("flashcards")
          .update({
            ease: result.ease,
            interval_days: result.interval,
            repetitions: result.repetitions,
            due_date: newDueDate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.cardId);

        return { success: true, nextDue: newDueDate };
      }
    } catch {
      /* ignore */
    }

    return { success: true, nextDue: addDays(todayStr(), 1) };
  });
