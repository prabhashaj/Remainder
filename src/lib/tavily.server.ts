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

// Cost-optimized in-memory search and photo cache (1-hour TTL)
const SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;
const searchCache = new Map<string, { data: TavilySearch; expiresAt: number }>();
const photoCache = new Map<string, { data: ImageResult[]; expiresAt: number }>();

function cleanExpiredCache() {
  const now = Date.now();
  for (const [k, v] of searchCache.entries()) {
    if (v.expiresAt <= now) searchCache.delete(k);
  }
  for (const [k, v] of photoCache.entries()) {
    if (v.expiresAt <= now) photoCache.delete(k);
  }
}

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
  cleanExpiredCache();
  const cacheKey = `${query.toLowerCase().trim()}:${depth}:${opts.includeImages ? 1 : 0}:${opts.includeDomains?.slice().sort().join(",") ?? ""}:${maxResults}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
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

          searchCache.set(cacheKey, {
            data: searchResult,
            expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
          });

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

  searchCache.set(cacheKey, {
    data: fallbackSearch,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
  });

  return fallbackSearch;
}

export function youtubeIdFromUrl(url: string): string | null {
  const match = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return match?.[1] ?? null;
}

/**
 * Robust photo/diagram search for topics.
 * Prioritizes free Wikimedia Commons API before falling back to Tavily Image Search to minimize API consumption.
 */
export async function searchTopicPhotos(query: string): Promise<ImageResult[]> {
  const photos: ImageResult[] = [];
  const cleanQuery = query.trim();
  const cacheKey = cleanQuery.toLowerCase();

  // Check photo cache first
  cleanExpiredCache();
  const cached = photoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // 1. Wikimedia Commons Search API (0 cost, highly accurate for educational diagrams)
  try {
    const wikiKeyword = cleanQuery
      .replace(/diagrams?|workflows?|images?|photos?|notebook/gi, "")
      .trim();
    const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(wikiKeyword || cleanQuery)}&gsrnamespace=6&format=json&prop=imageinfo&iiprop=url&iiurlwidth=800`;
    const res = await fetch(wikiUrl);
    if (res.ok) {
      const data = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              title?: string;
              imageinfo?: Array<{ thumburl?: string; url?: string }>;
            }
          >;
        };
      };
      const pages = data.query?.pages || {};
      for (const p of Object.values(pages)) {
        const imgUrl = p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url;
        if (
          imgUrl &&
          !photos.some((existing) => existing.url === imgUrl) &&
          (imgUrl.endsWith(".png") ||
            imgUrl.endsWith(".jpg") ||
            imgUrl.endsWith(".jpeg") ||
            imgUrl.includes("thumb"))
        ) {
          const cap = p.title
            ? p.title
                .replace("File:", "")
                .replace(/\.[^/.]+$/, "")
                .replace(/_/g, " ")
            : cleanQuery;
          photos.push({ url: imgUrl, description: cap });
        }
      }
    }
  } catch {
    // Continue
  }

  // 2. If Wikimedia provided 0 images, fallback to Tavily with basic depth
  if (photos.length === 0) {
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
          !img.url.includes("logo")
        ) {
          photos.push({
            url: img.url,
            description: img.description || cleanQuery,
          });
        }
      }
    } catch {
      // Continue
    }
  }

  const result = photos.slice(0, 2);
  photoCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
  });

  return result;
}
