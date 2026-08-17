import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAiGatewayProvider, getAiModelName } from "@/lib/ai-gateway.server";
import { log } from "@/lib/logger.server";
import { tavilySearch } from "@/lib/tavily.server";
import type { Database } from "@/integrations/supabase/types";

const RESEARCH_PROMPT = `You are the research specialist inside Remispace, a calm learning workspace.
Your job: find quality learning resources (tutorials, videos, courses) for a given topic and save them to the user's roadmap.

Steps:
1. Use webSearch to find 2-4 high-quality, free resources for the topic. Try different search queries if the first doesn't yield good results.
2. For each good result, use saveResourceToRoadmap to save it with an appropriate kind (video, article, course, interactive).
3. Prefer well-regarded resources — YouTube tutorials, official documentation, free university courses, interactive platforms.
4. Give a brief summary of what you found.

If web search is unavailable, say so and suggest the user try again later.`;

type Supabase = SupabaseClient<Database>;

type SearchResult = { title: string; url: string; content: string };

export async function runResearch(params: {
  topic: string;
  roadmapId: string | null;
  apiKey: string;
  supabase: Supabase;
  userId: string;
  traceId?: string;
}) {
  const gateway = createAiGatewayProvider(params.apiKey);
  const tavilyKey = process.env["TAVILY_API_KEY"];

  let fullTopic = params.topic;
  if (params.roadmapId) {
    const { data: roadmap } = await params.supabase
      .from("roadmaps")
      .select("topic")
      .eq("id", params.roadmapId)
      .maybeSingle();
    if (roadmap?.topic && !fullTopic.toLowerCase().includes(roadmap.topic.toLowerCase())) {
      fullTopic = `${roadmap.topic} — ${params.topic}`;
    }
  }

  const tools = {
    webSearch: tool({
      description: "Search the web for learning resources, tutorials, and videos.",
      inputSchema: z.object({ query: z.string().describe("The search query") }),
      execute: async ({ query }: { query: string }) => {
        const res = await tavilySearch(query, { maxResults: 5, depth: "basic" });
        return {
          results: res.results.map((r) => ({
            title: r.title,
            url: r.url,
            content: r.content.slice(0, 500),
          })),
          answer: res.answer,
        };
      },
    }),

    saveResourceToRoadmap: tool({
      description: "Save a discovered learning resource to the user's roadmap.",
      inputSchema: z.object({
        title: z.string().describe("Resource title"),
        url: z.string().describe("Resource URL"),
        kind: z
          .enum(["video", "article", "course", "interactive"])
          .nullable()
          .describe("Type of resource, or null"),
        roadmap_item_id: z
          .string()
          .nullable()
          .describe("ID of the roadmap step this resource belongs to, or null"),
        thumbnail: z.string().nullable().describe("Thumbnail URL, or null"),
        duration_text: z.string().nullable().describe("Duration text like '12 min', or null"),
      }),
      execute: async ({
        title,
        url,
        kind,
        roadmap_item_id,
        thumbnail,
        duration_text,
      }: {
        title: string;
        url: string;
        kind: "video" | "article" | "course" | "interactive" | null;
        roadmap_item_id: string | null;
        thumbnail: string | null;
        duration_text: string | null;
      }) => {
        const { data, error } = await params.supabase
          .from("roadmap_resources")
          .insert({
            user_id: params.userId,
            roadmap_id: params.roadmapId,
            roadmap_item_id: roadmap_item_id ?? null,
            title,
            url,
            kind: kind ?? "article",
            thumbnail: thumbnail ?? null,
            duration_text: duration_text ?? null,
          })
          .select("id")
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, id: data.id };
      },
    }),
  };

  try {
    const result = await generateText({
      model: gateway(getAiModelName()),
      system: RESEARCH_PROMPT,
      prompt: `Find 2-4 quality learning resources (tutorials, videos, courses) for: ${fullTopic}. Save each one using saveResourceToRoadmap.`,
      tools,
      maxRetries: 5,
      stopWhen: stepCountIs(5),
    });
    return { summary: result.text };
  } catch (err) {
    log(
      "error",
      "agent_error",
      { agent: "research", error: err instanceof Error ? err.message : String(err) },
      { userId: params.userId, traceId: params.traceId },
    );
    return {
      summary: `Research failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}
