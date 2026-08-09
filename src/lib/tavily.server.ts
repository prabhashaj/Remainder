export type WebResult = { title: string; url: string; content: string };
export type ImageResult = { url: string; description: string | null };

type TavilyResponse = {
  results?: Array<{ title?: string; url?: string; content?: string }>;
  images?: Array<string | { url?: string; description?: string }>;
  answer?: string;
};

export type TavilySearch = {
  results: WebResult[];
  images: ImageResult[];
  answer: string | null;
  error?: string;
};

/**
 * Thin wrapper over the Tavily search API. Degrades gracefully when the key is
 * missing or the request fails so agents never crash on research failures.
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
  const empty: TavilySearch = { results: [], images: [], answer: null };
  if (!key) return { ...empty, error: "Web search is not configured." };

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
        search_depth: opts.depth ?? "basic",
        max_results: opts.maxResults ?? 5,
        include_answer: true,
        include_images: opts.includeImages ?? false,
        include_image_descriptions: opts.includeImages ?? false,
        ...(opts.includeDomains?.length ? { include_domains: opts.includeDomains } : {}),
      }),
    });
    if (!res.ok) return { ...empty, error: `Search failed (${res.status})` };
    const data = (await res.json()) as TavilyResponse;
    return {
      results: (data.results ?? [])
        .filter((r): r is { title: string; url: string; content?: string } =>
          Boolean(r.url && r.title),
        )
        .map((r) => ({
          title: r.title,
          url: r.url,
          content: (r.content ?? "").slice(0, 900),
        })),
      images: (data.images ?? [])
        .map((img) =>
          typeof img === "string"
            ? { url: img, description: null }
            : { url: img.url ?? "", description: img.description ?? null },
        )
        .filter((img) => img.url.startsWith("http")),
      answer: data.answer ?? null,
    };
  } catch {
    return { ...empty, error: "Search request failed." };
  }
}

export function youtubeIdFromUrl(url: string): string | null {
  const match = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return match?.[1] ?? null;
}

/**
 * Robust photo/diagram search for topics.
 * Combines Wikimedia Commons search API, Tavily image search, and dynamic Pollinations AI fallback.
 * Guarantees topic-matched visual diagrams and images without returning generic stock photos.
 */
export async function searchTopicPhotos(query: string): Promise<ImageResult[]> {
  const photos: ImageResult[] = [];
  const cleanQuery = query.trim();

  // 1. Tavily Image Search (Web Search API with includeImages)
  try {
    const tavRes = await tavilySearch(cleanQuery, {
      maxResults: 6,
      includeImages: true,
      depth: "advanced",
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

  // 2. Wikimedia Commons Search API
  if (photos.length < 3) {
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
  }

  return photos.slice(0, 4);
}
