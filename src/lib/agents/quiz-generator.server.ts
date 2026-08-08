import { generateObject, generateText } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAiGatewayProvider, getAiModelName } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

type Supabase = SupabaseClient<Database>;

export const QuizQuestionSchema = z.object({
  type: z.string().transform((val) => {
    const lower = String(val).toLowerCase();
    if (lower.includes("mcq") || lower.includes("choice") || lower.includes("select")) {
      return "mcq" as const;
    }
    return "short_answer" as const;
  }),
  question: z.string(),
  options: z
    .array(z.string())
    .optional()
    .nullable()
    .transform((val) => val ?? []),
  correct_answer: z.string(),
  explanation: z.string().optional().nullable().transform((val) => val ?? ""),
});

export const QuizSchema = z.object({
  questions: z.array(QuizQuestionSchema),
});

export type QuizQuestion = {
  type: "mcq" | "short_answer";
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
};

export type Quiz = {
  questions: QuizQuestion[];
};

const QUIZ_PROMPT = `You generate a quiz from a lesson written by Remainder, a calm learning workspace.

Rules:
- Create exactly 5 questions from the lesson content
- Mix question types: 3 MCQ + 2 short-answer (approximately)
- MCQ: always 4 options, one correct. Make distractors plausible but clearly wrong to someone who understands
- Short-answer: expect a 1-2 sentence answer. The correct_answer field should contain the key phrase that must appear
- Grade difficulty progressively: first 2 questions = recall, middle 2 = application, last 1 = synthesis
- Test understanding, not memorization of wording
- Never test trivia, formatting details, or exact quotes
- Use standard LaTeX for formulas: $inline$ or $$block$$ (never plain-text math or bracket delimiters)
- Output MUST be JSON format: {"questions": [{"type": "mcq"|"short_answer", "question": "...", "options": ["..."], "correct_answer": "...", "explanation": "..."}]}`;

/**
 * Generate a quiz with multi-stage fallback to ensure JSON generation never fails.
 */
export async function generateQuiz(params: {
  itemId: string;
  apiKey: string;
  supabase: Supabase;
}): Promise<{
  success: boolean;
  quiz?: Quiz;
  error?: string;
}> {
  const { supabase, itemId, apiKey } = params;

  const { data: item, error: itemErr } = await supabase
    .from("roadmap_items")
    .select("id, title, content, parent_id, roadmap_id")
    .eq("id", itemId)
    .maybeSingle();

  if (itemErr) return { success: false, error: itemErr.message };
  if (!item) return { success: false, error: "Sub-topic not found" };
  if (!item.content)
    return { success: false, error: "No lesson content yet — generate the lesson first." };

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

Generate the 5-question quiz now in JSON {"questions": [...]}.`;

  let questions: QuizQuestion[] = [];

  // Attempt 1: generateObject json mode
  try {
    const res = await generateObject({
      model,
      system: QUIZ_PROMPT,
      prompt,
      schema: QuizSchema,
    });
    questions = res.object.questions as QuizQuestion[];
  } catch {
    // Attempt 2: generateObject auto mode
    try {
      const res = await generateObject({
        model,
        system: QUIZ_PROMPT,
        prompt,
        schema: QuizSchema,
      });
      questions = res.object.questions as QuizQuestion[];
    } catch {
      // Attempt 3: generateText with explicit JSON code block
      try {
        const res = await generateText({
          model,
          system: QUIZ_PROMPT + "\nRespond ONLY with JSON code block: ```json {\"questions\": [...]} ```",
          prompt,
        });

        const jsonMatch = res.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, res.text];
        const rawJson = (jsonMatch[1] || res.text).trim();
        const parsed = JSON.parse(rawJson);

        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.questions)
            ? parsed.questions
            : Array.isArray(parsed?.quiz)
              ? parsed.quiz
              : [];

        questions = list.map((q: any) => ({
          type: (String(q.type || "").toLowerCase().includes("mcq") || (q.options && q.options.length > 0)) ? "mcq" : "short_answer",
          question: String(q.question || ""),
          options: Array.isArray(q.options) ? q.options.map(String) : [],
          correct_answer: String(q.correct_answer || q.answer || ""),
          explanation: String(q.explanation || ""),
        }));
      } catch (err3) {
        return {
          success: false,
          error: err3 instanceof Error ? err3.message : "Quiz generation failed",
        };
      }
    }
  }

  questions = questions.filter((q) => q.question.trim().length > 0);
  if (questions.length === 0) {
    return { success: false, error: "No valid quiz questions generated." };
  }

  return { success: true, quiz: { questions } };
}

/**
 * Generate 2-3 quick checkpoint questions for confidence-gated completion.
 */
export async function generateCheckpoint(params: {
  itemId: string;
  apiKey: string;
  supabase: Supabase;
}): Promise<{
  success: boolean;
  questions?: QuizQuestion[];
  error?: string;
}> {
  const { supabase, itemId, apiKey } = params;

  const { data: item, error: itemErr } = await supabase
    .from("roadmap_items")
    .select("id, title, content")
    .eq("id", itemId)
    .maybeSingle();

  if (itemErr) return { success: false, error: itemErr.message };
  if (!item?.content) return { success: false, error: "No lesson content available." };

  const gateway = createAiGatewayProvider(apiKey);
  const model = gateway(getAiModelName());

  const system = `You generate 2-3 quick self-check questions to verify a learner understood a lesson.
Rules:
- Keep it fast — the learner should finish in under 60 seconds
- Test the core ideas, not edge cases
- Use only MCQ type for speed
- 4 options each, one correct
- Output MUST be JSON: {"questions": [{"type": "mcq", "question": "...", "options": ["a","b","c","d"], "correct_answer": "...", "explanation": "..."}]}`;

  const prompt = `Lesson title: ${item.title}

Lesson content:
${item.content}

Generate 2-3 checkpoint questions now in JSON.`;

  let questions: QuizQuestion[] = [];

  try {
    const res = await generateObject({
      model,
      system,
      prompt,
      schema: QuizSchema,
    });
    questions = res.object.questions as QuizQuestion[];
  } catch {
    try {
      const res = await generateText({
        model,
        system: system + "\nRespond ONLY with JSON block: ```json {\"questions\": [...]} ```",
        prompt,
      });

      const jsonMatch = res.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, res.text];
      const rawJson = (jsonMatch[1] || res.text).trim();
      const parsed = JSON.parse(rawJson);

      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.questions)
          ? parsed.questions
          : [];

      questions = list.map((q: any) => ({
        type: "mcq",
        question: String(q.question || ""),
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        correct_answer: String(q.correct_answer || q.answer || ""),
        explanation: String(q.explanation || ""),
      }));
    } catch (err2) {
      return {
        success: false,
        error: err2 instanceof Error ? err2.message : "Checkpoint generation failed",
      };
    }
  }

  questions = questions.filter((q) => q.question.trim().length > 0);
  if (questions.length === 0) {
    return { success: false, error: "No checkpoint questions generated." };
  }

  return { success: true, questions };
}
