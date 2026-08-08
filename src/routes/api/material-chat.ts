import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import {
  createAiGatewayProvider,
  getAiApiKey,
  getAiModelName,
} from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

const TUTOR_PROMPT = `You are Remi, a patient tutor answering a learner's question about THEIR OWN study material.

Absolute rules:
- Answer from the supplied material first. Quote or paraphrase the most relevant sentences directly.
- When quoting, use "> " markdown blockquote format so the learner can see exactly where the information comes from.
- If the material does not contain the answer, say so plainly in one line, then answer from well-established fundamentals and label that part "Beyond your material".
- Never invent page numbers, quotes, or facts.

Style:
- Warm, direct, concrete. Short paragraphs.
- **Bold** each key term the first time it appears.
- Formulas in LaTeX: inline $x^2$, display $$\\\\frac{dy}{dx} = 2x$$. Never plain-text maths.
- Fenced code blocks with a language tag; \`inline code\` for identifiers.
- End with one short "Try this" line the learner can act on.`;

function clip(text: string | null | undefined, max: number): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])|(?<=\n)\s*(?=\S)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

function selectRelevantPassages(
  fullText: string,
  question: string,
  topK = 20,
): string[] {
  const sentences = splitIntoSentences(fullText);
  if (sentences.length <= topK) return sentences;

  const questionTokens = new Set(tokenize(question));
  if (questionTokens.size === 0) return sentences.slice(0, topK);

  const docTokenCounts = new Map<string, number>();
  const sentenceTokenSets = sentences.map((s) => {
    const tokens = new Set(tokenize(s));
    for (const t of tokens) {
      docTokenCounts.set(t, (docTokenCounts.get(t) ?? 0) + 1);
    }
    return tokens;
  });

  const totalSentences = sentences.length;

  const scored = sentences.map((sentence, index) => {
    const tokens = sentenceTokenSets[index] ?? new Set();
    let score = 0;
    for (const qt of questionTokens) {
      if (tokens.has(qt)) {
        const df = docTokenCounts.get(qt) ?? 1;
        const idf = Math.log(totalSentences / df + 1);
        score += idf;
      }
    }
    const positionBonus = Math.max(0, 0.2 * (1 - index / totalSentences));
    score += positionBonus;
    return { sentence, score, index };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence);
}

type ChatBody = {
  messages?: unknown;
  resourceId?: unknown;
};

export const Route = createFileRoute("/api/material-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatBody;
        const messages = body.messages;
        const resourceId =
          typeof body.resourceId === "string" ? body.resourceId : null;

        if (!Array.isArray(messages) || !resourceId) {
          return new Response("messages and resourceId are required", {
            status: 400,
          });
        }

        const token = request.headers
          .get("authorization")
          ?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient<Database>(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          },
        );

        const { data: userData, error: userError } =
          await supabase.auth.getUser(token);
        if (userError || !userData.user)
          return new Response("Unauthorized", { status: 401 });

        const key = getAiApiKey();
        if (!key)
          return new Response("Missing AI API Key", { status: 500 });

        // Fetch resource + highlights + notes in parallel
        const [{ data: resource }, { data: highlights }, { data: notes }] =
          await Promise.all([
            supabase
              .from("study_resources")
              .select(
                "title, kind, url, summary, extracted_text",
              )
              .eq("id", resourceId)
              .maybeSingle(),
            supabase
              .from("resource_highlights")
              .select("page, quote, note")
              .eq("resource_id", resourceId)
              .order("page")
              .limit(40),
            supabase
              .from("video_notes")
              .select("seconds, note")
              .eq("resource_id", resourceId)
              .order("seconds")
              .limit(40),
          ]);

        if (!resource)
          return new Response("Resource not found", { status: 404 });

        // Build context
        const uiMessages = messages as UIMessage[];
        const lastUserMsg = uiMessages
          .filter((m) => m.role === "user")
          .pop();
        const question =
          lastUserMsg?.parts
            ?.filter((p) => p.type === "text")
            .map((p) => p.text)
            .join(" ") ?? "";

        const blocks: string[] = [
          `# Material: ${resource.title} (${resource.kind})`,
        ];
        if (resource.summary)
          blocks.push(`## Existing brief\n${resource.summary}`);

        const fullText = resource.extracted_text ?? "";
        if (fullText.trim()) {
          const relevant = selectRelevantPassages(fullText, question, 20);
          blocks.push(
            `## Most relevant passages\n${relevant.map((s, i) => `[${i + 1}] ${s}`).join("\n\n")}`,
          );
          const shortened = clip(fullText, 30000);
          if (shortened.trim())
            blocks.push(`## Full text (broader context)\n${shortened}`);
        }

        if (highlights && highlights.length > 0)
          blocks.push(
            `## Their highlights\n${highlights
              .map(
                (h) =>
                  `- p.${h.page}: "${h.quote}"${h.note ? ` — note: ${h.note}` : ""}`,
              )
              .join("\n")}`,
          );
        if (notes && notes.length > 0)
          blocks.push(
            `## Their video notes\n${notes
              .map((n) => `- ${n.seconds}s: ${n.note}`)
              .join("\n")}`,
          );

        const systemPrompt = `${TUTOR_PROMPT}\n\n${blocks.join("\n\n")}`;

        const gateway = createAiGatewayProvider(key);
        const result = streamText({
          model: gateway(getAiModelName()),
          system: systemPrompt,
          messages: await convertToModelMessages(uiMessages),
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});
