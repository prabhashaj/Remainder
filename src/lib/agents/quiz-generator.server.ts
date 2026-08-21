import { generateObject, generateText } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAiGatewayProvider, getAiModelName } from "@/lib/ai-gateway.server";
import { log } from "@/lib/logger.server";
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
  explanation: z
    .string()
    .optional()
    .nullable()
    .transform((val) => val ?? ""),
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

function questionFromUnknown(value: unknown, checkpoint = false): QuizQuestion {
  const question = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawOpts = question["options"];
  const options = Array.isArray(rawOpts) ? rawOpts.map(String) : [];
  const qType = String(question["type"] || "");
  const qQuestion = String(question["question"] || "");
  const qCorrect = String(question["correct_answer"] || question["answer"] || "");
  const qExp = String(question["explanation"] || "");

  return {
    type:
      checkpoint || qType.toLowerCase().includes("mcq") || options.length > 0
        ? "mcq"
        : "short_answer",
    question: qQuestion,
    options,
    correct_answer: qCorrect,
    explanation: qExp,
  };
}

const QUIZ_PROMPT = `You generate a high-quality, clear quiz from a lesson written by Remispace, a calm learning workspace.

Rules:
- Create exactly 5 questions from the lesson content
- Mix question types: 3 MCQ + 2 short-answer (approximately)
- MCQ: always 4 options, one correct answer
- IMPORTANT FOR CODE FORMATTING: If a question or option contains code snippets (especially Python, JavaScript, C++, SQL, etc.), ALWAYS format code using fenced Markdown code blocks with language tags (e.g. \`\`\`python\nline 1\nline 2\n\`\`\`). NEVER collapse multi-line code onto a single line without linebreaks!
- Keep option strings clean without leading letter prefixes like "a. " or "A) "
- Set "correct_answer" to match the EXACT string of the correct choice from the options array
- Short-answer: expect a 1-2 sentence answer. The correct_answer field should contain the key phrase that must appear
- Grade difficulty progressively: first 2 questions = recall, middle 2 = application, last 1 = synthesis
- Test understanding, not memorization of wording
- Use standard LaTeX for formulas: $inline$ or $$block$$ (never plain-text math or bracket delimiters)
- Output MUST be JSON format: {"questions": [{"type": "mcq"|"short_answer", "question": "...", "options": ["..."], "correct_answer": "...", "explanation": "..."}]}`;

/**
 * Generate a quiz with multi-stage fallback to ensure JSON generation never fails.
 */
export async function generateQuiz(params: {
  itemId: string;
  apiKey: string;
  supabase: Supabase;
  traceId?: string;
}): Promise<{
  success: boolean;
  quiz?: Quiz;
  error?: string;
}> {
  const { supabase, itemId, apiKey } = params;
  log("info", "agent_start", { agent: "quiz_generator", itemId }, { traceId: params.traceId });

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
    supabase.from("roadmaps").select("topic").eq("id", item.roadmap_id).maybeSingle(),
    item.parent_id
      ? supabase.from("roadmap_items").select("title").eq("id", item.parent_id).maybeSingle()
      : Promise.resolve({ data: null as { title: string } | null }),
  ]);

  const subject = roadmap?.topic ?? "";

  // 1. Check Global Quiz Cache (CAG)
  const { getCachedQuiz, saveCachedQuiz } = await import("@/lib/universal-cache.server");
  const cached = await getCachedQuiz(supabase, subject, item.title);
  if (cached && Array.isArray(cached.questions) && cached.questions.length > 0) {
    return { success: true, quiz: { questions: cached.questions } };
  }

  const gateway = createAiGatewayProvider(apiKey);
  const model = gateway(getAiModelName());

  const prompt = `Subject: ${subject}
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
          system:
            QUIZ_PROMPT + '\nRespond ONLY with JSON code block: ```json {"questions": [...]} ```',
          prompt,
        });

        const jsonMatch = res.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, res.text];
        const rawJson = (jsonMatch[1] || res.text).trim();
        const parsed: unknown = JSON.parse(rawJson);

        const rec =
          parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
        const list: unknown[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(rec?.["questions"])
            ? (rec!["questions"] as unknown[])
            : Array.isArray(rec?.["quiz"])
              ? (rec!["quiz"] as unknown[])
              : [];

        questions = list.map((item) => questionFromUnknown(item));
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

  // Asynchronously save to universal quiz cache
  void saveCachedQuiz(supabase, subject, item.title, questions).catch(() => {});

  return { success: true, quiz: { questions } };
}

/**
 * Generate 2-3 quick checkpoint questions for confidence-gated completion.
 */
export async function generateCheckpoint(params: {
  itemId: string;
  apiKey: string;
  supabase: Supabase;
  traceId?: string;
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

  const system = `You generate 3 quick self-check questions to verify a learner understood a lesson.
Rules:
- Generate exactly 3 self-check questions (MCQ format)
- Keep it fast — the learner should finish in under 60 seconds
- Test the core ideas and practical application
- 4 options per question, exactly one correct
- IMPORTANT FOR CODE FORMATTING: If a question or option includes code snippets (Python, JS, etc.), ALWAYS format multi-line code inside Markdown code blocks (e.g. \`\`\`python\nline 1\nline 2\n\`\`\`). NEVER collapse multi-line code onto a single line without linebreaks!
- Keep option strings clean without leading letter prefixes like "a. " or "A) "
- Set "correct_answer" to match the EXACT string of the correct choice from options
- Output MUST be JSON: {"questions": [{"type": "mcq", "question": "...", "options": ["..."], "correct_answer": "...", "explanation": "..."}]}`;

  const prompt = `Lesson title: ${item.title}

Lesson content:
${item.content}

Generate 3 checkpoint questions now in JSON.`;

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
        system: system + '\nRespond ONLY with JSON block: ```json {"questions": [...]} ```',
        prompt,
      });

      const jsonMatch = res.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, res.text];
      const rawJson = (jsonMatch[1] || res.text).trim();
      const parsed: unknown = JSON.parse(rawJson);

      const rec = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(rec?.["questions"])
          ? (rec!["questions"] as unknown[])
          : [];

      questions = list.map((question) => questionFromUnknown(question, true));
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
