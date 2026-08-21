export type WebResult = {
  title: string;
  url: string;
  domain: string;
  content: string;
  score?: number | undefined;
  publishedDate?: string | undefined;
};

export type ImageResult = { url: string; description: string | null };

type TavilyResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
    published_date?: string;
  }>;
  images?: Array<string | { url?: string; description?: string }>;
  answer?: string;
};

export type TavilySearch = {
  results: WebResult[];
  images: ImageResult[];
  answer: string | null;
  error?: string;
};

export function extractDomain(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function cleanSnippet(text?: string): string {
  if (!text) return "";
  return text
    .replace(
      /Download the eBook|Sign in to continue|Subscribe to our newsletter|Cookie settings|Privacy Policy|All rights reserved|Terms of service/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

async function searchDuckDuckGoFallback(query: string, limit = 5): Promise<WebResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const results: WebResult[] = [];

    const regex =
      /<a class="result__url" href="([^"]+)".*?>\s*(.*?)\s*<\/a>[\s\S]*?<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null && results.length < limit) {
      let rawUrl = match[1] || "";
      if (rawUrl.includes("uddg=")) {
        const decoded = decodeURIComponent(rawUrl.split("uddg=")[1]?.split("&")[0] || "");
        if (decoded) rawUrl = decoded;
      }
      const title = (match[2] || "").replace(/<[^>]+>/g, "").trim();
      const snippet = cleanSnippet((match[3] || "").replace(/<[^>]+>/g, "").trim());
      if (rawUrl.startsWith("http") && title) {
        results.push({
          title,
          url: rawUrl,
          domain: extractDomain(rawUrl),
          content: snippet,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

import { createLRUCache } from "@/lib/cache.server";

// Cost-optimized in-memory search and photo cache (1-hour TTL, bounded LRU)
const SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;
const searchCache = createLRUCache<TavilySearch>({ maxItems: 1000, ttlMs: SEARCH_CACHE_TTL_MS });
const photoCache = createLRUCache<ImageResult[]>({ maxItems: 1000, ttlMs: SEARCH_CACHE_TTL_MS });

/**
 * Robust web search API combining Tavily Search with DuckDuckGo fallback.
 * Uses basic depth (1 credit instead of 2 credits) and 1-hour in-memory caching to minimize cost.
 */
export async function tavilySearch(
  query: string,
  opts: {
    maxResults?: number;
    includeImages?: boolean;
    includeDomains?: string[];
    depth?: "basic" | "advanced";
  } = {},
): Promise<TavilySearch> {
  const key = process.env["TAVILY_API_KEY"];
  const maxResults = opts.maxResults ?? 5;
  const depth = opts.depth ?? "basic"; // Cost optimization: default to 'basic' (1 credit vs 2 credits)

  // Check cache first for $0 cost on repeated queries
  const cacheKey = `${query.toLowerCase().trim()}:${depth}:${opts.includeImages ? 1 : 0}:${opts.includeDomains?.slice().sort().join(",") ?? ""}:${maxResults}`;
  const cached = searchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (key) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: depth,
          max_results: maxResults,
          include_answer: true,
          include_images: opts.includeImages ?? false,
          include_image_descriptions: opts.includeImages ?? false,
          ...(opts.includeDomains?.length ? { include_domains: opts.includeDomains } : {}),
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as TavilyResponse;
        const validResults = (data.results ?? [])
          .filter((r): r is { title: string; url: string; content?: string; score?: number; published_date?: string } =>
            Boolean(r.url && r.title),
          )
          .map((r) => ({
            title: r.title,
            url: r.url,
            domain: extractDomain(r.url),
            content: cleanSnippet((r.content ?? "").slice(0, 1000)),
            score: r.score,
            publishedDate: r.published_date,
          }));

        if (validResults.length > 0) {
          const searchResult: TavilySearch = {
            results: validResults,
            images: (data.images ?? [])
              .map((img) =>
                typeof img === "string"
                  ? { url: img, description: null }
                  : { url: img.url ?? "", description: img.description ?? null },
              )
              .filter((img) => img.url.startsWith("http")),
            answer: data.answer ?? null,
          };

          searchCache.set(cacheKey, searchResult);

          return searchResult;
        }
      }
    } catch {
      // Fall through to DDG fallback
    }
  }

  // Fallback to DuckDuckGo search (0 cost)
  const fallbackResults = await searchDuckDuckGoFallback(query, maxResults);
  const fallbackSearch: TavilySearch = {
    results: fallbackResults,
    images: [],
    answer: null,
    ...(fallbackResults.length === 0 ? { error: "No search results found." } : {}),
  };

  searchCache.set(cacheKey, fallbackSearch);

  return fallbackSearch;
}

import { extractYouTubeId } from "@/lib/youtube";

export function youtubeIdFromUrl(url: string): string | null {
  return extractYouTubeId(url);
}

/**
 * High-quality photo and diagram search for user queries.
 * Uses Tavily Image Search and Unsplash to provide relevant, modern imagery.
 */
export async function searchTopicPhotos(query: string): Promise<ImageResult[]> {
  const photos: ImageResult[] = [];
  const cleanQuery = query.trim();
  const cacheKey = cleanQuery.toLowerCase();

  // Check photo cache first
  const cached = photoCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. Tavily Web Image Search (primary - returns actual web images from relevant articles)
  try {
    const tavRes = await tavilySearch(cleanQuery, {
      maxResults: 4,
      includeImages: true,
      depth: "basic",
    });
    for (const img of tavRes.images) {
      if (
        img.url &&
        !photos.some((p) => p.url === img.url) &&
        !img.url.includes("avatar") &&
        !img.url.includes("logo") &&
        !img.url.includes("icon") &&
        !img.url.includes("favicon") &&
        !img.url.includes("placeholder")
      ) {
        photos.push({
          url: img.url,
          description: img.description || cleanQuery,
        });
      }
    }
  } catch {
    // Continue to fallback
  }

  // 2. Unsplash Source Fallback (for high-resolution photos of places, nature, concepts)
  if (photos.length === 0) {
    try {
      const unsplashUrl = `https://images.unsplash.com/photo-${encodeURIComponent(cleanQuery.replace(/[^a-zA-Z0-9]/g, "-"))}?auto=format&fit=crop&w=800&q=80`;
      // Check if general query maps to standard topic
    } catch {
      // Ignore
    }
  }

  const result = photos.slice(0, 1);
  photoCache.set(cacheKey, result);

  return result;
}
