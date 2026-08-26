import { z } from "zod";
import { tool } from "ai";
import { wrapTool } from "./wrap-tool";
import type { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { runResearch } from "@/lib/agents/research.server";
import { runDeepResearch } from "@/lib/agents/deep-research.server";
import { searchTopicPhotos, tavilySearch } from "@/lib/tavily.server";
import {
  searchArxivServer,
  searchPapersServer,
  searchDocsServer,
} from "@/lib/academic-tools.server";
import { getLiveWeatherServer } from "@/lib/weather.server";

export function getResearchTools(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  traceId: string,
  threadId: string | null,
  key: string,
  enableDeepResearch = false,
) {
  // Base general research tools available for all standard queries
  const baseTools = {
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
        "Search the web for verified, up-to-date information, news, current facts, API docs, libraries, and emerging technical topics. Use ALWAYS whenever answering queries anchored in time (2024-2026), live events, specific named tools/frameworks/protocols, or whenever you need to verify facts. Do NOT use for personal workspace questions (tasks, goals, roadmaps, notes) which are already in context. Always ground answers in returned sources and append a '### Sources' section at the end of your response with clickable markdown links.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "The targeted search query, including domain context keywords if needed for disambiguation",
          ),
        time_range: z
          .enum(["day", "week", "month", "year", "d", "w", "m", "y", ""])
          .optional()
          .describe("Optional time range for the search (e.g. 'day' for yesterday/today, 'week' for recent events)"),
        depth: z
          .enum(["basic", "advanced"])
          .optional()
          .describe("Search depth. Use 'advanced' when conducting deep research, in-depth analysis, or literature reviews; defaults to 'basic' for standard fast lookups."),
      }),
      execute: async ({ query, time_range, depth }) =>
        wrapTool(
          "webSearch",
          async () => {
            const searchDepth = depth ?? "basic";
            const res = await tavilySearch(query, {
              maxResults: searchDepth === "advanced" ? 8 : 5,
              depth: searchDepth,
              ...(time_range ? { timeRange: time_range } : {}),
            });
            const formattedSources = res.results.map(
              (r, i) => `${i + 1}. [**${r.title}**](${r.url}) — *${r.domain}*`,
            );

            return {
              answer: res.answer,
              results: res.results.map((r) => ({
                title: r.title,
                url: r.url,
                domain: r.domain,
                content: r.content,
                score: r.score,
                publishedDate: r.publishedDate,
              })),
              sources_markdown: formattedSources.join("\n"),
              citation_instruction:
                "Include inline citations [1], [2] or [Domain](URL) after claims, and ALWAYS append a '### Sources' section listing every referenced source at the end of your message.",
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

    getWeather: tool({
      description:
        "Get live, real-time weather conditions, current temperature, humidity, wind, cloud cover, and forecasts for any city or location in the world. Use ALWAYS when asked about the weather, temperature, or forecast for any place.",
      inputSchema: z.object({
        location: z.string().describe("City, region, or place name (e.g. 'Hyderabad', 'Tokyo', 'London')"),
      }),
      execute: async ({ location }: { location: string }) =>
        wrapTool(
          "getWeather",
          async () => {
            const weather = await getLiveWeatherServer(location);
            return {
              ...weather,
              sources_markdown: `1. [**${weather.source.name}**](${weather.source.url}) — *${weather.source.domain}*`,
              citation_instruction:
                "State the current condition, temperature (°C/°F), humidity, wind, and forecast accurately, and append the Open-Meteo source link in your '### Sources' section.",
            };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { location },
        ),
    }),

    searchArxiv: tool({
      description:
        "Search arXiv for research papers in physics, computer science, mathematics, quantitative biology, and statistics. Supports sorting by newest submitted dates and filtering by minimum publication year.",
      inputSchema: z.object({
        query: z.string().describe("Search query or paper topic"),
        sortBy: z
          .enum(["relevance", "submittedDate", "lastUpdatedDate"])
          .optional()
          .describe("Sorting criteria (use 'submittedDate' when newest/latest papers are requested)"),
        yearMin: z
          .number()
          .optional()
          .describe("Optional minimum publication year (e.g. 2024, 2025, 2026)"),
        category: z
          .string()
          .optional()
          .describe("arXiv category (e.g. 'cs.CV', 'cs.AI', 'cs.LG', 'cs.CL')"),
      }),
      execute: async ({ query, sortBy, yearMin, category }) =>
        wrapTool(
          "searchArxiv",
          async () => {
            const papers = await searchArxivServer(query, {
              sortBy,
              yearMin,
              category,
              maxResults: 6,
            });
            const formattedSources = papers.map(
              (p, i) =>
                `${i + 1}. [**${p.title}**](${p.arxivUrl}) (${p.published || "N/A"}) — *${p.authors.slice(0, 2).join(", ")}${p.authors.length > 2 ? " et al." : ""}*`,
            );

            return {
              papers: papers.map((p) => ({
                title: p.title,
                url: p.arxivUrl,
                pdfUrl: p.pdfUrl,
                authors: p.authors,
                published: p.published,
                summary: p.summary,
              })),
              sources_markdown: formattedSources.join("\n"),
              citation_instruction:
                "Cite paper titles as clickable markdown links to their arXiv abstract URLs, and append them to '### Sources'.",
            };
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
        "Search peer-reviewed academic literature and scientific papers via Semantic Scholar across all disciplines (medicine, biology, CS, social sciences, physics). Returns citation counts, open-access PDFs, and TLDR summaries.",
      inputSchema: z.object({
        query: z.string().describe("Research topic, keywords, or paper title"),
        yearMin: z.number().optional().describe("Optional minimum publication year"),
      }),
      execute: async ({ query, yearMin }) =>
        wrapTool(
          "searchPapers",
          async () => {
            const papers = await searchPapersServer(query, {
              yearMin,
              maxResults: 6,
            });
            const formattedSources = papers.map(
              (p, i) =>
                `${i + 1}. [**${p.title}**](${p.url}) (${p.year ?? "N/A"}) — *${p.authors.slice(0, 2).join(", ")}${p.authors.length > 2 ? " et al." : ""}* (Citations: ${p.citationCount ?? 0})`,
            );

            return {
              papers: papers.map((p) => ({
                title: p.title,
                url: p.url,
                authors: p.authors,
                year: p.year,
                citationCount: p.citationCount,
                abstract: p.abstract,
              })),
              sources_markdown: formattedSources.join("\n"),
              citation_instruction:
                "Cite paper titles with clickable links to their Semantic Scholar pages, and append them to '### Sources'.",
            };
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
        "Search official documentation for popular open-source libraries and frameworks (React, Next.js, TanStack, Tailwind, Supabase, PyTorch, LangChain, etc.).",
      inputSchema: z.object({
        library: z
          .string()
          .describe(
            "Library name (e.g. 'react', 'nextjs', 'tanstack-router', 'supabase', 'pytorch')",
          ),
        query: z.string().describe("Specific feature, API, hook, or function to look up"),
      }),
      execute: async ({ library, query }) =>
        wrapTool(
          "searchDocs",
          async () => {
            const res = await searchDocsServer(library, query);
            return {
              results: res,
              citation_instruction:
                "Cite official documentation URLs in markdown and provide accurate API signatures and examples.",
            };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { library, query },
        ),
    }),

    searchPhotos: tool({
      description:
        "Search the web for the best relevant image, photo, or diagram for a topic. Use ONLY when the user explicitly asks to see or get an image, photo, or diagram. Returns 1 highly relevant web image.",
      inputSchema: z.object({
        query: z.string().describe("The visual topic or image search query"),
      }),
      execute: async ({ query }: { query: string }) =>
        wrapTool(
          "searchPhotos",
          async () => {
            const res = await searchTopicPhotos(query);
            const photos = res
              .slice(0, 1)
              .map((img) => ({ url: img.url, caption: img.description ?? query }));
            return {
              query,
              photos,
              instruction:
                "Render the single relevant photo in your response text using markdown image syntax: ![caption](url). Do NOT call this tool multiple times.",
            };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { query },
        ),
    }),
  };

  // Only include the heavy multi-agent Deep Research workflow when explicitly requested by user toggle
  if (!enableDeepResearch) {
    return baseTools;
  }

  return {
    ...baseTools,
    deepResearch: tool({
      description:
        "Execute an in-depth multi-agent technical research investigation. Only invoked when the user has explicitly enabled Deep Research Mode. Coordinates parallel worker subagents across arXiv, Semantic Scholar, and Web index, and returns a verified, mathematically rigorous synthesis.",
      inputSchema: z.object({
        topic: z
          .string()
          .describe(
            "The specific technical, scientific, or architectural topic to research thoroughly",
          ),
      }),
      execute: async ({ topic }: { topic: string }) =>
        wrapTool(
          "deepResearch",
          async () => {
            const res = await runDeepResearch({
              topic,
              apiKey: key,
              supabase,
              userId,
              traceId,
            });

            return {
              topic: res.topic,
              plan: res.plan,
              subtasks: res.subtasks.map((s) => ({
                id: s.id,
                title: s.title,
                objective: s.objective,
              })),
              action_trail: res.actionTrail,
              subagents_count: res.subagentResults.length,
              verified_papers_count: res.subagentResults.reduce(
                (acc, s) => acc + s.papers.length,
                0,
              ),
              report: res.report,
              sources_markdown: res.sourcesMarkdown,
              citation_instruction:
                "Deliver the synthesized comprehensive report with mathematical LaTeX expressions ($$inline$$ / $$$$block$$$$), clear structured comparisons, and verified clickable citations. Keep completely emoji-free.",
            };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { topic },
        ),
    }),
  };
}
