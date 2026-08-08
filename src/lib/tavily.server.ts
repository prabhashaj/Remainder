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
        ...(opts.includeDomains?.length
          ? { include_domains: opts.includeDomains }
          : {}),
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
  const match =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(
      url,
    );
  return match?.[1] ?? null;
}
