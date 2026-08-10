import { generateText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAiGatewayProvider, getAiModelName } from "@/lib/ai-gateway.server";
import { searchTopicPhotos, tavilySearch, youtubeIdFromUrl } from "@/lib/tavily.server";
import { log } from "@/lib/logger.server";
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
- Use explicit operators (\\times, \\cdot), no plain-text math ("x^2", "a/b"), and never bracket delimiters
- Use fenced code blocks with a language tag; use \`inline code\` for identifiers and commands. For code examples, ALWAYS provide complete, runnable code that produces visible output (e.g., using \`print()\`).
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
  traceId?: string;
}): Promise<{
  success: boolean;
  error?: string;
  title?: string;
  cached?: boolean;
}> {
  const { supabase, itemId } = params;
  log(
    "info",
    "agent_start",
    { agent: "curriculum", itemId },
    { userId: params.userId, traceId: params.traceId },
  );

  const { data: item, error: itemErr } = await supabase
    .from("roadmap_items")
    .select("id, title, detail, phase, parent_id, roadmap_id, content")
    .eq("id", itemId)
    .maybeSingle();
  if (itemErr) return { success: false, error: itemErr.message };
  if (!item) return { success: false, error: "Sub-topic not found" };
  if (item.content && !params.force) return { success: true, cached: true, title: item.title };

  const [{ data: roadmap }, { data: parent }] = await Promise.all([
    supabase.from("roadmaps").select("topic").eq("id", item.roadmap_id).maybeSingle(),
    item.parent_id
      ? supabase.from("roadmap_items").select("title").eq("id", item.parent_id).maybeSingle()
      : Promise.resolve({ data: null as { title: string } | null }),
  ]);

  const subject = roadmap?.topic ?? "";

  await supabase.from("roadmap_items").update({ content_status: "generating" }).eq("id", itemId);

  // Build targeted search queries: keep them short and specific.
  // Core = subtopic + roadmap domain (e.g. "Scaling Strategies context engineering AI").
  // Only include phase/parent if they add meaningful disambiguating words not already present.
  const cleanTitle = (t: string | null | undefined): string => {
    if (!t) return "";
    return t.replace(/^(Phase|Part|Section|Chapter|\d+\.)\s*\d*:?\s*/i, "").trim();
  };

  const cleanRoadmap = cleanTitle(subject);
  const cleanParent = cleanTitle(parent?.title);
  const cleanSubtopic = cleanTitle(item.title);

  // Check if a string adds unique words not already covered by the base
  const addsUniqueWords = (candidate: string, base: string): boolean => {
    const baseWords = new Set(
      base
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
    return candidate
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .some((w) => !baseWords.has(w));
  };

  // The primary query is always: "SubTopic RoadmapDomain"
  const primaryQuery = [cleanSubtopic, cleanRoadmap].filter(Boolean).join(" ");

  // Only add parent topic if it disambiguates (adds words not in primary query)
  const disambiguator =
    cleanParent && addsUniqueWords(cleanParent, primaryQuery) ? cleanParent : "";

  const focusedQuery = [cleanSubtopic, disambiguator, cleanRoadmap].filter(Boolean).join(" ");

  // Search queries — precise and human-search-like, not a sentence dump
  const researchQuery = `${focusedQuery} explained guide`;
  const imageQuery = `${focusedQuery} diagram illustration`;
  // Best format for YouTube video retrieval: "{subtopic} in {roadmap domain}"
  const videoQuery = `${cleanSubtopic} in ${cleanRoadmap} site:youtube.com`;

  // Track the focused query for relevance ranking later
  const fullContextQuery = focusedQuery;

  const [research, imageSearch, videoSearch] = await Promise.all([
    tavilySearch(researchQuery, {
      maxResults: 6,
      depth: "advanced",
    }),
    tavilySearch(imageQuery, {
      maxResults: 6,
      includeImages: true,
    }),
    tavilySearch(videoQuery, {
      maxResults: 10,
      // No includeDomains — restricting to youtube.com/youtu.be causes Tavily to return
      // channel and playlist pages (no watch?v= IDs). The site: operator in the query
      // is enough to surface watch-URL results.
    }),
  ]);

  const researchBlock = research.results.length
    ? research.results.map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.content}`).join("\n\n")
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
    await supabase.from("roadmap_items").update({ content_status: "error" }).eq("id", itemId);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Lesson generation failed",
    };
  }

  const images: LessonImage[] = imageSearch.images.slice(0, 2).map((img) => ({
    url: img.url,
    caption: img.description,
  }));

  // Fallback to topic photo search if fewer than 2 web images were found
  if (images.length < 2) {
    const fallbackPhotos = await searchTopicPhotos(fullContextQuery);
    for (const photo of fallbackPhotos) {
      if (images.length >= 2) break;
      if (!images.some((img) => img.url === photo.url)) {
        images.push({ url: photo.url, caption: photo.description });
      }
    }
  }

  // Rank video results by relevance to key terms across the full contextual query
  const contextKeywords = fullContextQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 2 &&
        ![
          "with",
          "from",
          "into",
          "that",
          "this",
          "your",
          "for",
          "and",
          "the",
          "phase",
          "part",
          "section",
          "chapter",
          "topic",
        ].includes(w),
    );

  const sortedVideoResults = [...videoSearch.results].sort((a, b) => {
    const scoreA = contextKeywords.filter((k) => a.title.toLowerCase().includes(k)).length;
    const scoreB = contextKeywords.filter((k) => b.title.toLowerCase().includes(k)).length;
    return scoreB - scoreA;
  });

  const seen = new Set<string>();
  const videos: LessonVideo[] = [];
  for (const r of sortedVideoResults) {
    const id = youtubeIdFromUrl(r.url);
    if (!id) continue; // Skip channels, playlists, or invalid video links

    if (seen.has(id)) continue;
    seen.add(id);
    videos.push({ title: r.title, url: r.url, youtube_id: id });
    if (videos.length >= 2) break;
  }

  // Fallback: if no valid YouTube watch URLs came back from the first search,
  // retry with a broader query (no site: operator).
  if (videos.length === 0) {
    const fallbackVideoSearch = await tavilySearch(`${cleanSubtopic} in ${cleanRoadmap} youtube`, {
      maxResults: 10,
    });
    const fallbackSorted = [...fallbackVideoSearch.results].sort((a, b) => {
      const scoreA = contextKeywords.filter((k) => a.title.toLowerCase().includes(k)).length;
      const scoreB = contextKeywords.filter((k) => b.title.toLowerCase().includes(k)).length;
      return scoreB - scoreA;
    });
    for (const r of fallbackSorted) {
      const id = youtubeIdFromUrl(r.url);
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      videos.push({ title: r.title, url: r.url, youtube_id: id });
      if (videos.length >= 2) break;
    }
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
