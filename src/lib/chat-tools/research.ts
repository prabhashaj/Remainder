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
import { getLiveWeatherServer } from "@/lib/weather.server";

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
        "Search the web for accurate, trusted information. Use ALWAYS for current events, news, live scores, facts, versions, prices, or technical queries. Always ground your answer in the returned sources and append a '### Sources' section at the end of your response with clickable markdown links.",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
      }),
      execute: async ({ query }: { query: string }) =>
        wrapTool(
          "webSearch",
          async () => {
            const res = await tavilySearch(query, { maxResults: 5, depth: "basic" });
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
        "Search arXiv for research papers in physics, computer science, mathematics, quantitative biology, and statistics.",
      inputSchema: z.object({
        query: z.string().describe("Search query or paper topic"),
      }),
      execute: async ({ query }: { query: string }) =>
        wrapTool(
          "searchArxiv",
          async () => {
            const papers = await searchArxivServer(query);
            const formattedSources = papers.map(
              (p, i) =>
                `${i + 1}. [**${p.title}**](${p.arxivUrl || p.pdfUrl}) (${p.published?.slice(0, 4) || "arXiv"}) — *arXiv:${p.id}*`,
            );
            return {
              query,
              papers,
              sources_markdown: formattedSources.join("\n"),
              citation_instruction:
                "Include inline citations and append a '### Sources' section at the end of your response with paper links.",
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
        "Search academic databases (Semantic Scholar / OpenAlex) across all scientific disciplines for research papers.",
      inputSchema: z.object({
        query: z.string().describe("Paper title, subject, or research topic"),
      }),
      execute: async ({ query }: { query: string }) =>
        wrapTool(
          "searchPapers",
          async () => {
            const papers = await searchPapersServer(query);
            const formattedSources = papers.map(
              (p, i) =>
                `${i + 1}. [**${p.title}**](${p.url}) (${p.year || "Academic Paper"}) — *${p.authors?.slice(0, 2).join(", ") || "Research"}*`,
            );
            return {
              query,
              papers,
              sources_markdown: formattedSources.join("\n"),
              citation_instruction:
                "Include inline citations and append a '### Sources' section at the end of your response with paper links.",
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
            const formattedSources = docs.map(
              (d, i) => `${i + 1}. [**${d.title}**](${d.url}) — *${library} Documentation*`,
            );
            return {
              library,
              topic,
              docs,
              sources_markdown: formattedSources.join("\n"),
              citation_instruction:
                "Include inline citations and append a '### Sources' section at the end of your response with documentation links.",
            };
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
        "Search for high-quality photos, illustrations, visual diagrams, and images for a topic. Use ONLY when the user explicitly asks for an image, photo, or diagram in their prompt. Returns exactly 1 highly relevant image.",
      inputSchema: z.object({
        query: z.string().describe("The visual topic or image search query"),
        limit: z.number().optional().describe("Maximum number of images to return (always 1)"),
      }),
      execute: async ({ query }: { query: string; limit?: number }) =>
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
                "Render the single relevant photo in your response text using markdown image syntax: ![caption](url). Give ONLY 1 example image per requested category. Do NOT list text bullets or output multiple images for a category.",
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
}
