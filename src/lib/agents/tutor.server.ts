import { generateText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAiGatewayProvider, getAiModelName } from "@/lib/ai-gateway.server";
import { saveDocumentTextAndEmbed } from "../document-processor.server";
import { fetchYoutubeTranscript, summarizeTranscript } from "@/lib/transcript.server";
import { extractYouTubeId } from "@/lib/youtube";
import { log } from "@/lib/logger.server";
import type { Database } from "@/integrations/supabase/types";

type Supabase = SupabaseClient<Database>;

const SUMMARY_PROMPT = `You are a study assistant that reads a learning resource and produces a pre-reading brief.

Return markdown with exactly these sections:
## In one paragraph
A 3-4 sentence plain-language summary of what this resource covers and who it is for.

## Key points
6-9 bullets, each a concrete takeaway (not "discusses X" — say what it actually claims).

## Worth your time if
2-3 bullets describing when reading/watching the whole thing pays off.

Rules:
- Ground everything strictly in the supplied text; never invent content.
- **Bold** each key term the first time it appears.
- Write formulas in LaTeX: inline as $a^2+b^2=c^2$, display on dedicated lines as $$E = mc^2$$. Never use plain-text math or bracket delimiters.
- Be specific and technically accurate. No filler.`;

const TUTOR_PROMPT = `You are Remi, a patient tutor answering a learner's question about THEIR OWN study material.

Absolute rules:
- Answer from the supplied material first. Quote or paraphrase the most relevant sentences directly.
- When quoting, use "> " markdown blockquote format so the learner can see exactly where the information comes from.
- If the material does not contain the answer, say so plainly in one line, then answer from well-established fundamentals and label that part "Beyond your material".
- Never invent page numbers, quotes, or facts.

Style:
- Warm, direct, concrete. Short paragraphs.
- **Bold** each key term the first time it appears.
- Include markdown photos/illustrations ONLY if the learner explicitly asks for an image, photo, or diagram. Otherwise, do NOT include images.
- Formulas in LaTeX: inline as $x^2$, display on dedicated lines as $$\\frac{dy}{dx} = 2x$$. Use explicit operators (\\times, \\cdot), never plain-text math or bracket delimiters.
- Fenced code blocks with a language tag; \`inline code\` for identifiers. For code examples, ALWAYS provide complete, runnable code that produces visible output (e.g., using \`print()\`).
- End with one short "Try this" line the learner can act on.`;

function clip(text: string | null | undefined, max: number): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text;
}

/* ---------- Sentence-level relevance scoring for RAG ---------- */

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries, keeping reasonable chunks
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])|(?<=\n)\s*(?=\S)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

/**
 * Scores sentences against a question using keyword overlap + position weighting.
 * Returns the top-K most relevant sentences with their original positions.
 */
function selectRelevantPassages(fullText: string, question: string, topK = 20): string[] {
  const sentences = splitIntoSentences(fullText);
  if (sentences.length <= topK) return sentences;

  const questionTokens = new Set(tokenize(question));
  if (questionTokens.size === 0) return sentences.slice(0, topK);

  // Build IDF-like weights from the document
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
        // IDF-weighted: rarer terms in the document score higher
        const df = docTokenCounts.get(qt) ?? 1;
        const idf = Math.log(totalSentences / df + 1);
        score += idf;
      }
    }

    // Slight bonus for sentences near the beginning (often contain key definitions)
    const positionBonus = Math.max(0, 0.2 * (1 - index / totalSentences));
    score += positionBonus;

    // Bonus for sentences with key indicators
    const lower = sentence.toLowerCase();
    if (
      lower.includes("definition") ||
      lower.includes("means") ||
      lower.includes("is called") ||
      lower.includes("refers to")
    ) {
      score += 0.5;
    }

    return { sentence, score, index };
  });

  // Sort by score descending, take top-K, then re-sort by original position
  const topSentences = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .sort((a, b) => a.index - b.index);

  return topSentences.map((s) => s.sentence);
}

/** Writes an AI summary + key points for one uploaded or linked resource. */
export async function summarizeResource(params: {
  resourceId: string;
  apiKey: string;
  supabase: Supabase;
  force?: boolean;
  traceId?: string;
}): Promise<{ success: boolean; error?: string; summary?: string }> {
  const { supabase, resourceId } = params;

  const { data: resource, error } = await supabase
    .from("study_resources")
    .select("id, title, kind, url, summary, extracted_text")
    .eq("id", resourceId)
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!resource) return { success: false, error: "Resource not found" };
  if (resource.summary && !params.force) return { success: true, summary: resource.summary };

  // For videos: try to use transcript
  const videoId = resource.url ? extractYouTubeId(resource.url) : null;
  if (videoId || resource.kind === "video") {
    const effectiveVideoId = videoId || (resource.url ? extractYouTubeId(resource.url) : null);
    if (!effectiveVideoId) {
      return { success: false, error: "Not a valid YouTube video URL." };
    }

    await supabase
      .from("study_resources")
      .update({ kind: "video", status: "summarizing" })
      .eq("id", resourceId);

    // Fetch transcript if not already cached or if forced
    let transcript = resource.extracted_text;
    if (!transcript || params.force) {
      const result = await fetchYoutubeTranscript(effectiveVideoId);
      if (result.fullText) {
        transcript = result.fullText;
        await saveDocumentTextAndEmbed(supabase, resourceId, transcript);
      }
    }

    try {
      let summary: string;
      if (transcript && transcript.trim().length > 0) {
        summary = await summarizeTranscript(transcript, resource.title, params.apiKey);
      } else {
        await supabase
          .from("study_resources")
          .update({ status: "ready" })
          .eq("id", resourceId);
        return {
          success: false,
          error: "Could not extract video transcript from YouTube. Please ensure closed captions are available.",
        };
      }

      const keyPoints = summary
        .split("\n")
        .filter((line) => /^\s*[-*]\s+/.test(line))
        .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
        .slice(0, 9);

      await supabase
        .from("study_resources")
        .update({ summary, key_points: keyPoints as never, status: "ready" })
        .eq("id", resourceId);

      return { success: true, summary };
    } catch (err) {
      await supabase.from("study_resources").update({ status: "error" }).eq("id", resourceId);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Summarization failed",
      };
    }
  }

  // For PDFs and other text-based resources (original behavior)
  const body = clip(resource.extracted_text, 60000);
  if (!body.trim())
    return {
      success: false,
      error: "No readable text yet. Open the document once so its text can be extracted.",
    };

  await supabase.from("study_resources").update({ status: "summarizing" }).eq("id", resourceId);

  const gateway = createAiGatewayProvider(params.apiKey);
  let summary: string;
  try {
    const result = await generateText({
      model: gateway(getAiModelName()),
      system: SUMMARY_PROMPT,
      prompt: `Resource title: ${resource.title}
Kind: ${resource.kind}${resource.url ? `\nSource: ${resource.url}` : ""}

Text:
${body}

Write the brief now.`,
    });
    summary = result.text.trim();
  } catch (err) {
    await supabase.from("study_resources").update({ status: "error" }).eq("id", resourceId);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Summarization failed",
    };
  }

  const keyPoints = summary
    .split("\n")
    .filter((line) => /^\s*[-*]\s+/.test(line))
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .slice(0, 9);

  await supabase
    .from("study_resources")
    .update({ summary, key_points: keyPoints as never, status: "ready" })
    .eq("id", resourceId);

  return { success: true, summary };
}

/**
 * Answers a question grounded in a specific resource (plus the learner's own
 * highlights and video notes on it), never generic web content.
 * Uses sentence-level relevance scoring for better RAG results.
 */
export async function askMaterial(params: {
  resourceId: string;
  question: string;
  apiKey: string;
  supabase: Supabase;
  traceId?: string;
}): Promise<{ success: boolean; error?: string; answer?: string }> {
  const { supabase, resourceId } = params;
  log("info", "agent_start", { agent: "tutor", resourceId }, { traceId: params.traceId });

  const [{ data: resource }, { data: highlights }, { data: notes }] = await Promise.all([
    supabase
      .from("study_resources")
      .select("title, kind, url, summary, extracted_text")
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

  if (!resource) return { success: false, error: "Resource not found" };

  const blocks: string[] = [`# Material: ${resource.title} (${resource.kind})`];

  if (resource.summary) blocks.push(`## Existing brief\n${resource.summary}`);

  // Use sentence-level relevance scoring for better RAG
  const fullText = resource.extracted_text ?? "";
  if (fullText.trim()) {
    const relevantPassages = selectRelevantPassages(fullText, params.question, 20);

    blocks.push(
      `## Most relevant passages from the material\n${relevantPassages.map((s, i) => `[${i + 1}] ${s}`).join("\n\n")}`,
    );

    // Also include broader context (shortened)
    const shortenedFull = clip(fullText, 30000);
    if (shortenedFull.trim()) {
      blocks.push(`## Full text (for broader context)\n${shortenedFull}`);
    }
  }

  if (highlights && highlights.length > 0)
    blocks.push(
      `## Their highlights\n${highlights
        .map((h) => `- p.${h.page}: "${h.quote}"${h.note ? ` — their note: ${h.note}` : ""}`)
        .join("\n")}`,
    );
  if (notes && notes.length > 0)
    blocks.push(
      `## Their timestamped video notes\n${notes
        .map((n) => `- ${n.seconds}s: ${n.note}`)
        .join("\n")}`,
    );

  if (!fullText.trim() && !resource.summary && !(highlights ?? []).length)
    return {
      success: false,
      error:
        "There's nothing readable in this material yet — open it once so its text can be extracted.",
    };

  const gateway = createAiGatewayProvider(params.apiKey);
  try {
    const result = await generateText({
      model: gateway(getAiModelName()),
      system: TUTOR_PROMPT,
      prompt: `${blocks.join("\n\n")}

---
Their question: ${params.question}

Answer it now, grounded in the material above. Quote the most relevant passages directly using > blockquote format.`,
    });
    return { success: true, answer: result.text.trim() };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Tutor call failed",
    };
  }
}
