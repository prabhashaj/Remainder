import { generateText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAiGatewayProvider, getAiModelName } from "@/lib/ai-gateway.server";
import { tavilySearch, youtubeIdFromUrl } from "@/lib/tavily.server";
import type { Database } from "@/integrations/supabase/types";

type Supabase = SupabaseClient<Database>;

export type LessonImage = { url: string; caption: string | null };
export type LessonVideo = {
  title: string;
  url: string;
  youtube_id: string | null;
};

const LESSON_PROMPT = `You are the curriculum writer inside Remainder, a calm learning workspace.
You write a single self-contained lesson for one sub-topic of a learning roadmap.

Write in clear, warm, plain language for a motivated self-learner. Use markdown:
- Start with a 2-3 sentence "why this matters" intro (no title heading — the app renders the title)
- "## Core ideas" with 3-6 short subsections explaining each concept concretely
- Include small, correct code or concrete worked examples when the topic is technical
- "## Common pitfalls" with 3-4 bullets
- "## Practice" with 2-3 exercises the learner can do right now
- "## Recap" with 3 bullet takeaways

Formatting rules (strict):
- **Bold** each key term the first time it appears; never bold whole sentences or headings
- Write every formula in LaTeX: inline as $a^2 + b^2 = c^2$, and important/derived formulas on their own line as $$\\frac{dy}{dx} = 2x$$
- Never write maths as plain text ("x^2", "a/b") and never leave unbalanced $ or brackets
- Use fenced code blocks with a language tag; use \`inline code\` for identifiers and commands
- Keep paragraphs to 2-4 sentences and use tables only for genuine comparisons

Rules:
- Ground facts in the provided web research; prefer current (2026) best practice
- Be specific and technically accurate — never filler or vague
- Do not invent links or embed images; the app handles those
- Aim for 500-900 words`;

/**
 * Generates a full lesson for a roadmap sub-topic: researched markdown content,
 * illustrative images (Tavily), and vetted YouTube videos for further study.
 */
export async function writeLesson(params: {
  itemId: string;
  apiKey: string;
  supabase: Supabase;
  userId: string;
  force?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  title?: string;
  cached?: boolean;
}> {
  const { supabase, itemId } = params;

  const { data: item, error: itemErr } = await supabase
    .from("roadmap_items")
    .select("id, title, detail, phase, parent_id, roadmap_id, content")
    .eq("id", itemId)
    .maybeSingle();
  if (itemErr) return { success: false, error: itemErr.message };
  if (!item) return { success: false, error: "Sub-topic not found" };
  if (item.content && !params.force)
    return { success: true, cached: true, title: item.title };

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

  const subject = roadmap?.topic ?? "";
  const context = [subject, parent?.title, item.title]
    .filter(Boolean)
    .join(" — ");

  await supabase
    .from("roadmap_items")
    .update({ content_status: "generating" })
    .eq("id", itemId);

  // Visuals and videos are scoped to this sub-topic (not the whole roadmap),
  // so a learner sees material about exactly what they're reading.
  const narrow = [item.title, parent?.title].filter(Boolean).join(" ");

  const [research, imageSearch, videoSearch] = await Promise.all([
    tavilySearch(`${context} explained tutorial guide`, {
      maxResults: 6,
      depth: "advanced",
    }),
    tavilySearch(`${narrow} diagram illustration explained`, {
      maxResults: 6,
      includeImages: true,
    }),
    tavilySearch(`${narrow} tutorial explained`, {
      maxResults: 8,
      includeDomains: ["youtube.com", "youtu.be"],
    }),
  ]);

  const researchBlock = research.results.length
    ? research.results
        .map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.content}`)
        .join("\n\n")
    : "No web research available — rely on well-established fundamentals only.";

  const gateway = createAiGatewayProvider(params.apiKey);

  let content: string;
  try {
    const result = await generateText({
      model: gateway(getAiModelName()),
      system: LESSON_PROMPT,
      prompt: `Roadmap subject: ${subject}
Topic: ${parent?.title ?? item.phase}
Sub-topic to teach: ${item.title}
${item.detail ? `Intent: ${item.detail}` : ""}

Web research:
${researchBlock}

Write the lesson now.`,
    });
    content = result.text.trim();
  } catch (err) {
    await supabase
      .from("roadmap_items")
      .update({ content_status: "error" })
      .eq("id", itemId);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Lesson generation failed",
    };
  }

  const images: LessonImage[] = imageSearch.images.slice(0, 4).map((img) => ({
    url: img.url,
    caption: img.description,
  }));

  const seen = new Set<string>();
  const videos: LessonVideo[] = [];
  for (const r of videoSearch.results) {
    const id = youtubeIdFromUrl(r.url);
    const key = id ?? r.url;
    if (seen.has(key)) continue;
    seen.add(key);
    videos.push({ title: r.title, url: r.url, youtube_id: id });
    if (videos.length >= 4) break;
  }

  const { error: updateErr } = await supabase
    .from("roadmap_items")
    .update({
      content,
      images: images as never,
      video_links: videos as never,
      content_status: "ready",
    })
    .eq("id", itemId);
  if (updateErr) return { success: false, error: updateErr.message };

  // Mirror the videos into the resource library so they show on the roadmap too.
  if (videos.length > 0) {
    await supabase.from("roadmap_resources").insert(
      videos.map((v) => ({
        user_id: params.userId,
        roadmap_id: item.roadmap_id,
        roadmap_item_id: item.id,
        title: v.title,
        url: v.url,
        kind: "video",
      })),
    );
  }

  return { success: true, title: item.title };
}
