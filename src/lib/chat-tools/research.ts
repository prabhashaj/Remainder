import { z } from "zod";
import { tool } from "ai";
import { wrapTool } from "./wrap-tool";
import type { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { runResearch } from "@/lib/agents/research.server";
import { searchTopicPhotos, tavilySearch } from "@/lib/tavily.server";
import {
  searchArxivServer,
  searchPapersServer,
  searchDocsServer,
} from "@/lib/academic-tools.server";

export function getResearchTools(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  traceId: string,
  threadId: string | null,
  key: string,
) {
  return {
    researchResources: tool({
      description:
        "Find tutorials, videos, and courses for a learning topic using web search. Saves results to the user's roadmap.",
      inputSchema: z.object({
        topic: z.string().describe("The topic to find learning resources for"),
        roadmap_id: z
          .string()
          .nullable()
          .describe("ID of the roadmap to attach resources to, or null"),
      }),
      execute: async ({ topic, roadmap_id }: { topic: string; roadmap_id: string | null }) =>
        wrapTool(
          "researchResources",
          () =>
            runResearch({
              topic,
              roadmapId: roadmap_id,
              apiKey: key,
              supabase,
              userId,
              traceId,
            }),
          supabase,
          userId,
          traceId,
          threadId,
          { topic, roadmap_id },
        ),
    }),

    webSearch: tool({
      description:
        "Search the web for current information. Use ALWAYS for live sports scores, current events, recent facts, versions, prices, news, or anything you are unsure about. ALWAYS include the current date/time (from your Workspace Context) in the search query for live events to ensure the freshest results. NEVER guess these facts.",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
      }),
      execute: async ({ query }: { query: string }) =>
        wrapTool(
          "webSearch",
          async () => {
            const res = await tavilySearch(query, { maxResults: 5, depth: "advanced" });
            return {
              answer: res.answer,
              results: res.results.map((r) => ({
                title: r.title,
                url: r.url,
                content: r.content.slice(0, 500),
              })),
              error: res.error ?? null,
            };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { query },
        ),
    }),

    searchArxiv: tool({
      description:
        "Search arXiv for research papers in physics, computer science, mathematics, quantitative biology, and statistics.",
      inputSchema: z.object({
        query: z.string().describe("Search query or paper topic"),
      }),
      execute: async ({ query }: { query: string }) =>
        wrapTool(
          "searchArxiv",
          async () => {
            const papers = await searchArxivServer(query);
            return { query, papers };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { query },
        ),
    }),

    searchPapers: tool({
      description:
        "Search academic databases (Semantic Scholar / OpenAlex) across all scientific disciplines for research papers.",
      inputSchema: z.object({
        query: z.string().describe("Paper title, subject, or research topic"),
      }),
      execute: async ({ query }: { query: string }) =>
        wrapTool(
          "searchPapers",
          async () => {
            const papers = await searchPapersServer(query);
            return { query, papers };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { query },
        ),
    }),

    searchDocs: tool({
      description:
        "Search technical documentation, framework guides, and API reference pages for software libraries.",
      inputSchema: z.object({
        library: z.string().describe("Library or framework name (e.g. React, PyTorch, Tailwind)"),
        topic: z.string().describe("Specific feature, hook, or API method to look up"),
      }),
      execute: async ({ library, topic }: { library: string; topic: string }) =>
        wrapTool(
          "searchDocs",
          async () => {
            const docs = await searchDocsServer(library, topic);
            return { library, topic, docs };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { library, topic },
        ),
    }),

    searchPhotos: tool({
      description:
        "Search for high-quality photos, illustrations, visual diagrams, and images for a topic. Use ONLY when the user explicitly asks for an image, photo, or diagram in their prompt.",
      inputSchema: z.object({
        query: z.string().describe("The visual topic or image search query"),
        limit: z.number().optional().describe("Maximum number of images to return (default: 1)"),
      }),
      execute: async ({ query, limit }) =>
        wrapTool(
          "searchPhotos",
          async () => {
            const res = await searchTopicPhotos(query);
            const photos = res
              .slice(0, limit || 1)
              .map((img) => ({ url: img.url, caption: img.description ?? query }));
            return {
              query,
              photos,
              instruction:
                "Render each photo in your response text using markdown image syntax: ![caption](url). Do NOT list text bullets — embed the markdown images directly so they display visually in the chat.",
            };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { query, limit },
        ),
    }),
  };
}
