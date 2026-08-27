/**
 * Universal YouTube utilities for parsing URLs, video IDs, thumbnails, and embeds.
 * Safe for use in both browser and server environments.
 */

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Robustly extracts an 11-character YouTube video ID from any format:
 * - Direct ID: "dQw4w9WgXcQ"
 * - Standard Watch: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
 * - Watch with extra params: "https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ&t=10s"
 * - Short URL: "https://youtu.be/dQw4w9WgXcQ?si=abcdef"
 * - Shorts: "https://www.youtube.com/shorts/dQw4w9WgXcQ"
 * - Live: "https://www.youtube.com/live/dQw4w9WgXcQ"
 * - Embed: "https://www.youtube.com/embed/dQw4w9WgXcQ"
 * - Legacy: "https://www.youtube.com/v/dQw4w9WgXcQ"
 * - Mobile / Music / Gaming: "https://m.youtube.com/watch?v=dQw4w9WgXcQ"
 * - Markdown / dirty strings: "[video](https://youtu.be/dQw4w9WgXcQ)"
 */
export function extractYouTubeId(urlOrId: string | null | undefined): string | null {
  if (!urlOrId) return null;
  const raw = urlOrId.trim();
  if (!raw) return null;

  // 1. Direct 11-character ID
  if (YOUTUBE_ID_REGEX.test(raw)) {
    return raw;
  }

  // 2. URL parsing (handling query params in any position)
  try {
    const normalized = raw.startsWith("//")
      ? `https:${raw}`
      : !/^https?:\/\//i.test(raw)
        ? `https://${raw}`
        : raw;

    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    // youtu.be/<id>
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1).split(/[?#/]/)[0];
      if (id && YOUTUBE_ID_REGEX.test(id)) return id;
    }

    // youtube.com, m.youtube.com, music.youtube.com, etc.
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "gaming.youtube.com" ||
      host.endsWith(".youtube.com")
    ) {
      // Query param 'v'
      const v = parsed.searchParams.get("v");
      if (v && YOUTUBE_ID_REGEX.test(v)) return v;

      // Pathnames like /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
      const paths = parsed.pathname.split("/").filter(Boolean);
      if (paths.length >= 2 && ["embed", "v", "shorts", "live"].includes(paths[0] ?? "")) {
        const id = paths[1]?.split(/[?#/]/)[0];
        if (id && YOUTUBE_ID_REGEX.test(id)) return id;
      }
    }
  } catch {
    // Continue to regex fallback
  }

  // 3. Robust regex fallback for malformed or dirty URLs
  const regex =
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|shorts\/|live\/|(?:.*[?&]v=)))([\w-]{11})/;
  const match = raw.match(regex);
  return match?.[1] ?? null;
}

/** Check whether a given URL is a YouTube video URL or ID. */
export function isYouTubeUrl(urlOrId: string | null | undefined): boolean {
  return Boolean(extractYouTubeId(urlOrId));
}

/** Returns the standard YouTube watch URL for a video ID or URL. */
export function getYouTubeWatchUrl(urlOrId: string, startSeconds?: number): string {
  const id = extractYouTubeId(urlOrId) ?? urlOrId;
  const start = startSeconds && startSeconds > 0 ? `&t=${Math.floor(startSeconds)}s` : "";
  return `https://www.youtube.com/watch?v=${id}${start}`;
}

/** Returns the embed URL suitable for an iframe. */
export function getYouTubeEmbedUrl(
  urlOrId: string,
  options?: {
    autoplay?: boolean;
    start?: number;
    enableJsApi?: boolean;
    modestbranding?: boolean;
    rel?: number;
  },
): string {
  const id = extractYouTubeId(urlOrId) ?? urlOrId;
  const params = new URLSearchParams();

  if (options?.autoplay) params.set("autoplay", "1");
  if (options?.start && options.start > 0) params.set("start", String(Math.floor(options.start)));
  if (options?.enableJsApi ?? true) params.set("enablejsapi", "1");
  if (options?.modestbranding ?? true) params.set("modestbranding", "1");
  if (options?.rel !== undefined) params.set("rel", String(options.rel));
  else params.set("rel", "0");

  const query = params.toString();
  return `https://www.youtube.com/embed/${id}${query ? `?${query}` : ""}`;
}

/** Returns a YouTube thumbnail image URL. */
export function getYouTubeThumbnailUrl(
  urlOrId: string,
  quality: "default" | "mq" | "hq" | "maxres" = "hq",
): string {
  const id = extractYouTubeId(urlOrId) ?? urlOrId;
  switch (quality) {
    case "default":
      return `https://i.ytimg.com/vi/${id}/default.jpg`;
    case "mq":
      return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
    case "maxres":
      return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
    case "hq":
    default:
      return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
}

/** Formats playback seconds into MM:SS or HH:MM:SS */
export function formatVideoTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const remSec = s % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(remSec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(remSec).padStart(2, "0")}`;
}

const YT_URL_SCANNER =
  /https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:youtube\.com|youtu\.be)\/[^\s)>\]"]+/gi;

/** Pulls unique YouTube video ids out of a markdown/plain text answer. */
export function youtubeIdsIn(text: string): string[] {
  if (!text) return [];
  const ids: string[] = [];
  const matches = text.match(YT_URL_SCANNER);

  if (matches) {
    for (const url of matches) {
      const id = extractYouTubeId(url);
      if (id && !ids.includes(id)) {
        ids.push(id);
      }
    }
  }

  return ids.slice(0, 4);
}
