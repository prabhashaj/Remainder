import { generateObject, generateText } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAiGatewayProvider, getAiModelName } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

type Supabase = SupabaseClient<Database>;

export const FlashcardSchema = z.object({
  front: z.string(),
  back: z.string(),
});

export const FlashcardSetSchema = z.object({
  cards: z.array(FlashcardSchema),
});

export type FlashcardSet = z.infer<typeof FlashcardSetSchema>;

const FLASHCARD_PROMPT = `You generate spaced-repetition flashcards from a lesson written by Remainder, a calm learning workspace.

Rules:
- Create 5-8 cards from the lesson content provided
- Each card tests ONE concept — never bundle multiple ideas
- Front: a clear question, fill-in-the-blank, or "Explain…" prompt
- Back: a concise, correct answer. Include standard LaTeX for formulas ($inline$ or $$display$$), inline code for identifiers
- Vary question types: definition, application, comparison, "what happens if…"
- Never test trivia or wording — test understanding
- Cards should be self-contained (a learner who sees the card months later should understand it without context)
- Output MUST be JSON format with key "cards": [{"front": "...", "back": "..."}]`;

/**
 * Generate flashcards with multi-stage fallback to handle model schema differences.
 * Uses agent_memories fallback if flashcards table is not present in Supabase schema.
 */
export async function writeFlashcards(params: {
  itemId: string;
  apiKey: string;
  supabase: Supabase;
  userId: string;
}): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  const { supabase, itemId, userId, apiKey } = params;

  // Fetch the lesson content
  const { data: item, error: itemErr } = await supabase
    .from("roadmap_items")
    .select("id, title, content, parent_id, roadmap_id")
    .eq("id", itemId)
    .maybeSingle();

  if (itemErr) return { success: false, error: itemErr.message };
  if (!item) return { success: false, error: "Sub-topic not found" };
  if (!item.content) return { success: false, error: "No lesson content yet — generate the lesson first." };

  // Fetch context
  const [{ data: roadmap }, { data: parent }] = await Promise.all([
    supabase
      .from("roadmaps")
      .select("topic")
      .eq("id", item.roadmap_id)
      .maybeSingle(),
    item.parent_id
      ? supabase
          .from("roadmap_items")
          .select("title")
          .eq("id", item.parent_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { title: string } | null }),
  ]);

  const gateway = createAiGatewayProvider(apiKey);
  const model = gateway(getAiModelName());

  const prompt = `Subject: ${roadmap?.topic ?? ""}
Topic: ${parent?.title ?? ""}
Sub-topic: ${item.title}

Lesson content:
${item.content}

Generate 5 to 8 flashcards now as JSON {"cards": [{"front": "...", "back": "..."}]}.`;

  let cards: { front: string; back: string }[] = [];

  // Attempt 1: generateObject
  try {
    const res = await generateObject({
      model,
      system: FLASHCARD_PROMPT,
      prompt,
      schema: FlashcardSetSchema,
    });
    cards = res.object.cards;
  } catch {
    // Attempt 2: generateText with explicit JSON formatting
    try {
      const res = await generateText({
        model,
        system: FLASHCARD_PROMPT + "\nRespond ONLY with JSON code block: ```json {\"cards\": [...]} ```",
        prompt,
      });

      const jsonMatch = res.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, res.text];
      const rawJson = (jsonMatch[1] || res.text).trim();
      const parsed = JSON.parse(rawJson);

      if (Array.isArray(parsed)) {
        cards = parsed.map((c: any) => ({ front: String(c.front || c.question || ""), back: String(c.back || c.answer || "") }));
      } else if (parsed && Array.isArray(parsed.cards)) {
        cards = parsed.cards.map((c: any) => ({ front: String(c.front || c.question || ""), back: String(c.back || c.answer || "") }));
      } else if (parsed && Array.isArray(parsed.flashcards)) {
        cards = parsed.flashcards.map((c: any) => ({ front: String(c.front || c.question || ""), back: String(c.back || c.answer || "") }));
      }
    } catch (err2) {
      return {
        success: false,
        error: err2 instanceof Error ? err2.message : "Flashcard generation failed",
      };
    }
  }

  // Filter out empty cards
  cards = cards.filter((c) => c.front.trim() && c.back.trim());
  if (cards.length === 0) {
    return { success: false, error: "No valid flashcards generated." };
  }

  const today = new Date().toISOString().slice(0, 10);

  // Try saving to flashcards table first, fallback to agent_memories
  try {
    await supabase
      .from("flashcards")
      .delete()
      .eq("roadmap_item_id", itemId)
      .eq("user_id", userId);

    const { error: insertErr } = await supabase.from("flashcards").insert(
      cards.map((card) => ({
        user_id: userId,
        roadmap_item_id: itemId,
        front: card.front,
        back: card.back,
        due_date: today,
      })),
    );

    if (!insertErr) {
      return { success: true, count: cards.length };
    }
  } catch {
    /* Fallback below */
  }

  // Fallback: Store in agent_memories table
  try {
    // Delete previous memory flashcards for this item
    const { data: existingMemories } = await supabase
      .from("agent_memories")
      .select("id, content")
      .eq("user_id", userId)
      .eq("category", "flashcard");

    if (existingMemories) {
      const toDelete = existingMemories
        .filter((m) => {
          try {
            const parsed = JSON.parse(m.content);
            return parsed.roadmap_item_id === itemId;
          } catch {
            return false;
          }
        })
        .map((m) => m.id);

      if (toDelete.length > 0) {
        await supabase.from("agent_memories").delete().in("id", toDelete);
      }
    }

    // Insert new memory cards
    const memoryInserts = cards.map((c, i) => ({
      user_id: userId,
      category: "flashcard",
      content: JSON.stringify({
        id: `fc_${itemId}_${i}_${Date.now()}`,
        roadmap_item_id: itemId,
        front: c.front,
        back: c.back,
        ease: 2.5,
        interval_days: 0,
        repetitions: 0,
        due_date: today,
        created_at: new Date().toISOString(),
      }),
      importance: 1,
    }));

    await supabase.from("agent_memories").insert(memoryInserts);
    return { success: true, count: cards.length };
  } catch (errMem) {
    return {
      success: false,
      error: errMem instanceof Error ? errMem.message : "Failed to save flashcards",
    };
  }
}
