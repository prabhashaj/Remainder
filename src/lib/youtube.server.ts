import { extractYouTubeId, getYouTubeThumbnailUrl, getYouTubeWatchUrl } from "@/lib/youtube";

export type YouTubeVideoDetails = {
  id: string;
  title: string;
  url: string;
  author?: string | undefined;
  thumbnail?: string | undefined;
  durationText?: string | undefined;
};

export type YouTubeSearchResult = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  channel: string;
  durationText?: string | undefined;
};

// In-memory cache for search & oembed (1 hour TTL)
const YOUTUBE_CACHE_TTL = 60 * 60 * 1000;
const ytSearchCache = new Map<string, { data: YouTubeSearchResult[]; expiresAt: number }>();
const ytMetadataCache = new Map<string, { data: YouTubeVideoDetails; expiresAt: number }>();

/**
 * Checks if a YouTube video exists, is public, and is playable.
 * Returns true if available, false if deleted, private, or invalid.
 */
export async function isYouTubeVideoValid(urlOrId: string): Promise<boolean> {
  const id = extractYouTubeId(urlOrId);
  if (!id) return false;

  const now = Date.now();
  const cached = ytMetadataCache.get(id);
  if (cached && cached.expiresAt > now) {
    return true;
  }

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(3500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Robustly fetches YouTube video metadata (title, author, thumbnail) via public oEmbed API.
 * 0 API key required.
 */
export async function fetchYouTubeMetadata(
  urlOrId: string,
): Promise<YouTubeVideoDetails | null> {
  const id = extractYouTubeId(urlOrId);
  if (!id) return null;

  const now = Date.now();
  const cached = ytMetadataCache.get(id);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };

      const result: YouTubeVideoDetails = {
        id,
        title: data.title?.trim() || `YouTube Video (${id})`,
        url: getYouTubeWatchUrl(id),
        author: data.author_name?.trim(),
        thumbnail: data.thumbnail_url || getYouTubeThumbnailUrl(id, "hq"),
      };

      ytMetadataCache.set(id, {
        data: result,
        expiresAt: now + YOUTUBE_CACHE_TTL,
      });

      return result;
    }
  } catch {
    // Continue
  }

  return null;
}

/**
 * Searches YouTube directly without external API keys or search quota.
 * Parses public search results reliably to return structured videos.
 */
export async function searchYouTubeDirect(
  query: string,
  limit = 5,
): Promise<YouTubeSearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const cacheKey = `${cleanQuery.toLowerCase()}:${limit}`;
  const now = Date.now();
  const cached = ytSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) return [];
    const html = await res.text();

    const match =
      html.match(/ytInitialData\s*=\s*({.+?});<\/script>/s) ||
      html.match(/var ytInitialData\s*=\s*({.+?});/s);

    if (match && match[1]) {
      try {
        const data = JSON.parse(match[1]) as Record<string, unknown>;
        const items: YouTubeSearchResult[] = [];
        const seenIds = new Set<string>();

        // Recursive tree traversal to find all videoRenderers
        function findVideos(obj: unknown) {
          if (!obj || typeof obj !== "object" || items.length >= limit) return;

          const rec = obj as Record<string, unknown>;
          if (rec["videoRenderer"] && typeof rec["videoRenderer"] === "object") {
            const vr = rec["videoRenderer"] as Record<string, unknown>;
            const videoId = vr["videoId"];
            if (typeof videoId === "string" && /^[a-zA-Z0-9_-]{11}$/.test(videoId) && !seenIds.has(videoId)) {
              seenIds.add(videoId);

              const titleObj = vr["title"] as Record<string, unknown> | undefined;
              const runs = titleObj?.["runs"] as Array<{ text?: string }> | undefined;
              const title =
                runs?.map((r) => r.text ?? "").join("") ||
                (typeof titleObj?.["simpleText"] === "string" ? titleObj["simpleText"] : "YouTube Video");

              const ownerText = vr["ownerText"] as Record<string, unknown> | undefined;
              const ownerRuns = ownerText?.["runs"] as Array<{ text?: string }> | undefined;
              const shortByline = vr["shortBylineText"] as Record<string, unknown> | undefined;
              const bylineRuns = shortByline?.["runs"] as Array<{ text?: string }> | undefined;
              const channel =
                ownerRuns?.[0]?.text ||
                bylineRuns?.[0]?.text ||
                "YouTube Creator";

              const thumbObj = vr["thumbnail"] as Record<string, unknown> | undefined;
              const thumbList = thumbObj?.["thumbnails"] as Array<{ url?: string }> | undefined;
              const thumbnail =
                thumbList?.[thumbList.length - 1]?.url ||
                thumbList?.[0]?.url ||
                getYouTubeThumbnailUrl(videoId, "hq");

              const lengthObj = vr["lengthText"] as Record<string, unknown> | undefined;
              const durationText =
                typeof lengthObj?.["simpleText"] === "string"
                  ? lengthObj["simpleText"]
                  : undefined;

              items.push({
                id: videoId,
                title: title.trim(),
                url: getYouTubeWatchUrl(videoId),
                thumbnail,
                channel: channel.trim(),
                durationText,
              });
            }
          }

          for (const key of Object.keys(rec)) {
            findVideos(rec[key]);
            if (items.length >= limit) break;
          }
        }

        findVideos(data);

        if (items.length > 0) {
          // Validate availability of top candidate videos in parallel
          const validationChecks = await Promise.allSettled(
            items.map((item) => isYouTubeVideoValid(item.id)),
          );
          const validItems = items.filter((_, idx) => {
            const check = validationChecks[idx];
            return check?.status === "fulfilled" && check.value === true;
          });

          if (validItems.length > 0) {
            ytSearchCache.set(cacheKey, {
              data: validItems,
              expiresAt: now + YOUTUBE_CACHE_TTL,
            });
            return validItems;
          }
        }
      } catch {
        // Fallback below
      }
    }

    // Secondary fallback: regex match video IDs in HTML with strict oEmbed metadata verification
    const vidMatches = [...html.matchAll(/\/watch\?v=([\w-]{11})/g)];
    const ids = [...new Set(vidMatches.map((m) => m[1]))].filter(Boolean) as string[];
    const validatedFallbacks: YouTubeSearchResult[] = [];

    const metaResults = await Promise.allSettled(
      ids.slice(0, limit * 2).map((id) => fetchYouTubeMetadata(id)),
    );

    for (const metaRes of metaResults) {
      if (metaRes.status === "fulfilled" && metaRes.value) {
        const meta = metaRes.value;
        validatedFallbacks.push({
          id: meta.id,
          title: meta.title,
          url: meta.url,
          thumbnail: meta.thumbnail || getYouTubeThumbnailUrl(meta.id, "hq"),
          channel: meta.author || "YouTube",
        });
        if (validatedFallbacks.length >= limit) break;
      }
    }

    if (validatedFallbacks.length > 0) {
      ytSearchCache.set(cacheKey, {
        data: validatedFallbacks,
        expiresAt: now + YOUTUBE_CACHE_TTL,
      });
      return validatedFallbacks;
    }
  } catch {
    // Continue
  }

  return [];
}
