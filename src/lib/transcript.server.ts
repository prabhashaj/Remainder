import { generateText } from "ai";
import { getSubtitles } from "youtube-caption-extractor";

import { createAiGatewayProvider, getAiModelName } from "@/lib/ai-gateway.server";
import { extractYouTubeId } from "@/lib/youtube";

export type TranscriptSegment = {
  text: string;
  offset: number; // seconds
  duration: number; // seconds
};

type CaptionTrack = {
  baseUrl: string;
  languageCode?: string;
  name?: { simpleText?: string; runs?: Array<{ text?: string }> } | string;
  vssId?: string;
  kind?: string;
  isTranslatable?: boolean;
};

const INNERTUBE_CLIENTS = [
  {
    name: "ios",
    clientName: "IOS",
    clientVersion: "20.10.4",
    clientNameHeader: "5",
    userAgent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
    context: {
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      platform: "MOBILE",
      osName: "iOS",
      osVersion: "18.3.2.22D82",
    },
  },
  {
    name: "android",
    clientName: "ANDROID",
    clientVersion: "19.34.42",
    clientNameHeader: "3",
    userAgent: "com.google.android.youtube/19.34.42 (Linux; U; Android 14; Pixel 8 Pro Build/AP2A.240805.005) gzip",
    context: {
      deviceMake: "Google",
      deviceModel: "Pixel 8 Pro",
      platform: "MOBILE",
      osName: "Android",
      osVersion: "14",
      androidSdkVersion: 34,
    },
  },
  {
    name: "android_vr",
    clientName: "ANDROID_VR",
    clientVersion: "1.62.20",
    clientNameHeader: "28",
    userAgent: "com.google.android.apps.youtube.vr.oculus/1.62.20 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
    context: {
      deviceMake: "Oculus",
      deviceModel: "Quest 3",
      platform: "MOBILE",
      osName: "Android",
      osVersion: "12L",
      androidSdkVersion: 32,
    },
  },
  {
    name: "tv_embedded",
    clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    clientVersion: "2.0",
    clientNameHeader: "85",
    userAgent: "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/4.0 Chrome/76.0.3809.146 TV Safari/537.36",
    context: {
      clientScreen: "TV",
    },
  },
];

/**
 * Robustly fetches YouTube transcripts using multiple layered strategies:
 * 1. Primary: youtube-caption-extractor
 * 2. Secondary: InnerTube multi-client player API (iOS/Android/TV)
 * 3. Tertiary: YouTube Watch Page parsing (JSON3 / XML caption tracks)
 * 4. Quaternary: Direct TimedText API endpoints
 */
export async function fetchYoutubeTranscript(
  videoIdOrUrl: string,
): Promise<{ segments: TranscriptSegment[]; fullText: string; error?: string }> {
  const empty = { segments: [] as TranscriptSegment[], fullText: "" };
  const videoId = extractYouTubeId(videoIdOrUrl);

  if (!videoId) {
    return {
      ...empty,
      error: "Invalid YouTube URL or video ID provided.",
    };
  }

  console.log(`[transcript] Fetching transcript for videoId=${videoId}`);

  // --- Strategy 1: youtube-caption-extractor (English) ---
  try {
    const subtitles = await getSubtitles({ videoID: videoId, lang: "en" });
    if (Array.isArray(subtitles) && subtitles.length > 0) {
      const segments = normalizeSegments(
        subtitles.map((s) => ({
          text: decodeXmlEntities(s.text ?? ""),
          offset: parseFloat(s.start ?? "0") || 0,
          duration: parseFloat(s.dur ?? "0") || 0,
        })),
      );

      if (segments.length > 0) {
        console.log(`[transcript] Strategy 1 OK: ${segments.length} segments`);
        return {
          segments,
          fullText: segments.map((s) => s.text).join(" "),
        };
      }
    }
    console.warn(`[transcript] Strategy 1: empty result for ${videoId}`);
  } catch (err) {
    console.error(`[transcript] Strategy 1 error:`, err instanceof Error ? err.message : err);
  }

  // --- Strategy 2: Multi-Client InnerTube Player API ---
  try {
    const captionTracks = await fetchCaptionTracksFromInnerTube(videoId);
    if (captionTracks && captionTracks.length > 0) {
      const segments = await fetchSegmentsFromCaptionTracks(captionTracks);
      if (segments.length > 0) {
        console.log(`[transcript] Strategy 2 OK: ${segments.length} segments`);
        return { segments, fullText: segments.map((s) => s.text).join(" ") };
      }
    }
    console.warn(`[transcript] Strategy 2: no caption tracks for ${videoId}`);
  } catch (err) {
    console.error(`[transcript] Strategy 2 error:`, err instanceof Error ? err.message : err);
  }

  // --- Strategy 3: HTML Page Parsing (captionTracks / ytInitialPlayerResponse) ---
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(watchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (res.ok) {
      const html = await res.text();
      const captionTracks = extractCaptionTracksFromHtml(html);
      if (captionTracks && captionTracks.length > 0) {
        const segments = await fetchSegmentsFromCaptionTracks(captionTracks);
        if (segments.length > 0) {
          console.log(`[transcript] Strategy 3 OK: ${segments.length} segments`);
          return { segments, fullText: segments.map((s) => s.text).join(" ") };
        }
        console.warn(`[transcript] Strategy 3: caption tracks found but no segments`);
      } else {
        console.warn(`[transcript] Strategy 3: HTML fetched (${html.length}b) but no caption tracks. Bot-detected: ${html.includes("<title>Before you continue</title>")}`);
      }
    } else {
      console.warn(`[transcript] Strategy 3: HTTP ${res.status} for ${watchUrl}`);
    }
  } catch (err) {
    console.error(`[transcript] Strategy 3 error:`, err instanceof Error ? err.message : err);
  }

  // --- Strategy 4: Direct TimedText API ---
  try {
    const timedTextUrls = [
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=a.en&fmt=json3`,
    ];

    for (const u of timedTextUrls) {
      const res = await fetch(u, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        },
      });
      if (res.ok) {
        const content = await res.text();
        if (content.trim()) {
          let segs: TranscriptSegment[] = [];
          if (content.trim().startsWith("{")) {
            segs = parseTranscriptJson3(content);
          } else if (content.includes("<text")) {
            segs = parseTranscriptXml(content);
          }
          const normalized = normalizeSegments(segs);
          if (normalized.length > 0) {
            console.log(`[transcript] Strategy 4 OK via ${u.split("?")[0]}: ${normalized.length} segments`);
            return { segments: normalized, fullText: normalized.map((s) => s.text).join(" ") };
          }
          console.warn(`[transcript] Strategy 4: ${u.split("?")[1]} → empty after parse (${content.length}b)`);
        } else {
          console.warn(`[transcript] Strategy 4: ${u.split("?")[1]} → empty response`);
        }
      } else {
        console.warn(`[transcript] Strategy 4: HTTP ${res.status} for ${u.split("?")[1]}`);
      }
    }
  } catch (err) {
    console.error(`[transcript] Strategy 4 error:`, err instanceof Error ? err.message : err);
  }

  console.error(`[transcript] ALL strategies failed for videoId=${videoId}`);
  return {
    ...empty,
    error:
      "No transcript available for this video. The video might not have English captions or auto-generated subtitles enabled on YouTube.",
  };
}

/* ---------- Internal Helpers ---------- */

function isCaptionTrack(value: unknown): value is CaptionTrack {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  return Boolean(rec) && typeof rec!["baseUrl"] === "string";
}

async function fetchCaptionTracksFromInnerTube(videoId: string): Promise<CaptionTrack[] | null> {
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const res = await fetch("https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "*/*",
          "User-Agent": client.userAgent,
          "X-YouTube-Client-Name": client.clientNameHeader,
          "X-YouTube-Client-Version": client.clientVersion,
          Origin: "https://www.youtube.com",
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: client.clientName,
              clientVersion: client.clientVersion,
              hl: "en",
              gl: "US",
              ...client.context,
            },
            user: { lockedSafetyMode: false },
            request: { useSsl: true },
          },
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
        }),
      });

      if (!res.ok) continue;
      const data = (await res.json()) as Record<string, unknown>;
      const captions = data["captions"] as Record<string, unknown> | undefined;
      const renderer = captions?.["playerCaptionsTracklistRenderer"] as
        | Record<string, unknown>
        | undefined;
      const tracks = renderer?.["captionTracks"];

      if (Array.isArray(tracks)) {
        const valid = tracks.filter(isCaptionTrack);
        if (valid.length > 0) return valid;
      }
    } catch {
      // Try next client
    }
  }
  return null;
}

function extractCaptionTracksFromHtml(html: string): CaptionTrack[] | null {
  // 1. Try finding ytInitialPlayerResponse
  const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);
  if (playerMatch && playerMatch[1]) {
    try {
      const parsed = JSON.parse(playerMatch[1]) as Record<string, unknown>;
      const captions = parsed["captions"] as Record<string, unknown> | undefined;
      const renderer = captions?.["playerCaptionsTracklistRenderer"] as
        | Record<string, unknown>
        | undefined;
      const tracks = renderer?.["captionTracks"];
      if (Array.isArray(tracks)) {
        const valid = tracks.filter(isCaptionTrack);
        if (valid.length > 0) return valid;
      }
    } catch {
      // Fallback
    }
  }

  // 2. Extract captionTracks array directly
  return extractJsonArrayFromKey(html, '"captionTracks"');
}

async function fetchSegmentsFromCaptionTracks(
  captionTracks: CaptionTrack[],
): Promise<TranscriptSegment[]> {
  // Best track selection: English manual -> English auto -> any English prefix -> first track
  const track =
    captionTracks.find((t) => t.vssId === ".en" || t.languageCode === "en") ??
    captionTracks.find((t) => t.vssId === "a.en" || t.languageCode?.startsWith("en")) ??
    captionTracks.find((t) => t.vssId?.includes(".en") || t.languageCode?.includes("en")) ??
    captionTracks[0];

  if (!track || !track.baseUrl) return [];

  // Try fetching as JSON3 first (cleanest structure), then XML
  let captionUrl = track.baseUrl.replace(/&amp;/g, "&");
  if (!captionUrl.includes("fmt=")) {
    captionUrl += "&fmt=json3";
  }

  try {
    const res = await fetch(captionUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
    });

    if (res.ok) {
      const text = await res.text();
      if (text.trim().startsWith("{")) {
        const jsonSegments = parseTranscriptJson3(text);
        if (jsonSegments.length > 0) return normalizeSegments(jsonSegments);
      } else if (text.includes("<text")) {
        const xmlSegments = parseTranscriptXml(text);
        if (xmlSegments.length > 0) return normalizeSegments(xmlSegments);
      }
    }
  } catch {
    // Fall through to XML retry
  }

  // Fallback to XML endpoint if json3 was not returned
  const xmlUrl = track.baseUrl.replace(/&amp;/g, "&").replace(/&fmt=[^&]+/, "");
  try {
    const xmlRes = await fetch(xmlUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
    });
    if (xmlRes.ok) {
      const xmlText = await xmlRes.text();
      return normalizeSegments(parseTranscriptXml(xmlText));
    }
  } catch {
    // Return empty
  }

  return [];
}

function parseTranscriptJson3(jsonString: string): TranscriptSegment[] {
  try {
    const data = JSON.parse(jsonString) as {
      events?: Array<{
        tStartMs?: number;
        dDurationMs?: number;
        segs?: Array<{ utf8?: string }>;
        aAppend?: number;
      }>;
    };
    const events = data.events ?? [];
    const segments: TranscriptSegment[] = [];

    for (const event of events) {
      if (!event.segs || event.aAppend === 1) continue;
      const rawText = event.segs.map((s) => s.utf8 ?? "").join("");
      const text = decodeXmlEntities(rawText.replace(/<[^>]+>/g, "")).trim();
      if (!text) continue;

      const offset = (event.tStartMs ?? 0) / 1000;
      const duration = (event.dDurationMs ?? 0) / 1000;
      segments.push({ text, offset, duration });
    }

    return segments;
  } catch {
    return [];
  }
}

function extractJsonArrayFromKey(html: string, key: string): CaptionTrack[] | null {
  const idx = html.indexOf(key);
  if (idx === -1) return null;
  const startBracket = html.indexOf("[", idx);
  if (startBracket === -1 || startBracket - idx > 120) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startBracket; i < html.length; i++) {
    const char = html[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "[") depth++;
      else if (char === "]") {
        depth--;
        if (depth === 0) {
          try {
            const rawJson = html.slice(startBracket, i + 1);
            const parsed: unknown = JSON.parse(rawJson);
            return Array.isArray(parsed) ? parsed.filter(isCaptionTrack) : null;
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

function parseTranscriptXml(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    const rawOffset = match[1];
    const rawDur = match[2];
    const rawText = match[3];

    if (rawOffset && rawDur && rawText) {
      const offset = parseFloat(rawOffset);
      const duration = parseFloat(rawDur);
      const text = decodeXmlEntities(rawText.trim());
      if (text) {
        segments.push({ text, offset, duration });
      }
    }
  }

  return segments;
}

function normalizeSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  const cleaned: TranscriptSegment[] = [];
  for (const s of segments) {
    const text = s.text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
    if (!text || text === "[Music]" || text === "[Applause]") continue;

    // Deduplicate consecutive identical lines
    const last = cleaned[cleaned.length - 1];
    if (last && last.text === text) {
      last.duration += s.duration;
      continue;
    }

    cleaned.push({
      text,
      offset: s.offset,
      duration: s.duration,
    });
  }
  return cleaned;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns transcript segments within a window around the given timestamp.
 */
export function getTranscriptAtTimestamp(
  segments: TranscriptSegment[],
  seconds: number,
  windowSeconds = 30,
): { text: string; segments: TranscriptSegment[] } {
  const start = Math.max(0, seconds - windowSeconds / 2);
  const end = seconds + windowSeconds / 2;

  const matched = segments.filter((s) => s.offset + s.duration >= start && s.offset <= end);

  return {
    text: matched.map((s) => s.text).join(" "),
    segments: matched,
  };
}

/**
 * Chunks a long transcript into pieces, summarizes each, then combines.
 */
export async function summarizeTranscript(
  transcript: string,
  title: string,
  apiKey: string,
): Promise<string> {
  const gateway = createAiGatewayProvider(apiKey);
  const model = gateway(getAiModelName());
  const CHUNK_SIZE = 25000;

  if (transcript.length <= CHUNK_SIZE) {
    const result = await generateText({
      model,
      system: TRANSCRIPT_SUMMARY_PROMPT,
      prompt: `Video title: ${title}\n\nTranscript:\n${transcript}\n\nWrite the brief now.`,
    });
    return result.text.trim();
  }

  // Chunk and summarize each part
  const chunks: string[] = [];
  for (let i = 0; i < transcript.length; i += CHUNK_SIZE) {
    chunks.push(transcript.slice(i, i + CHUNK_SIZE));
  }

  const chunkSummaries: string[] = [];
  for (const [i, chunk] of chunks.entries()) {
    const result = await generateText({
      model,
      system: `You are a study assistant. Summarize part ${i + 1} of ${chunks.length} of a video transcript into key points. Be concise — 4-6 bullet points maximum. Ground everything in what was actually said.`,
      prompt: `Video title: ${title}\n\nTranscript part ${i + 1}/${chunks.length}:\n${chunk}`,
    });
    chunkSummaries.push(result.text.trim());
  }

  // Combine chunk summaries into final brief
  const combined = chunkSummaries.join("\n\n---\n\n");
  const result = await generateText({
    model,
    system: TRANSCRIPT_SUMMARY_PROMPT,
    prompt: `Video title: ${title}\n\nCombined section summaries:\n${combined}\n\nWrite the final unified brief now.`,
  });
  return result.text.trim();
}

/**
 * Generates a structured notebook (markdown) from a video transcript.
 */
export async function generateNotebook(
  transcript: string,
  title: string,
  apiKey: string,
): Promise<string> {
  const gateway = createAiGatewayProvider(apiKey);
  const model = gateway(getAiModelName());
  const CHUNK_SIZE = 25000;

  let sourceText = transcript;
  if (transcript.length > CHUNK_SIZE) {
    const chunks: string[] = [];
    for (let i = 0; i < transcript.length; i += CHUNK_SIZE) {
      chunks.push(transcript.slice(i, i + CHUNK_SIZE));
    }
    const summaries: string[] = [];
    for (const [i, chunk] of chunks.entries()) {
      const result = await generateText({
        model,
        system: `Summarize part ${i + 1} of ${chunks.length} of this video transcript into detailed notes covering all major points, examples, and key terms.`,
        prompt: chunk,
      });
      summaries.push(result.text.trim());
    }
    sourceText = summaries.join("\n\n---\n\n");
  }

  const result = await generateText({
    model,
    system: NOTEBOOK_PROMPT,
    prompt: `Video title: ${title}\n\nSource material:\n${sourceText}\n\nGenerate the notebook now.`,
  });
  return result.text.trim();
}

const TRANSCRIPT_SUMMARY_PROMPT = `You are a study assistant that reads a video transcript and produces a pre-watching brief.

Return markdown with exactly these sections:
## In one paragraph
A 3-4 sentence plain-language summary of what this video covers and who it is for.

## Key points
6-9 bullets, each a concrete takeaway (not "discusses X" — say what it actually claims or teaches).

## Worth your time if
2-3 bullets describing when watching the whole thing pays off.

Rules:
- Ground everything strictly in the supplied transcript; never invent content.
- **Bold** each key term the first time it appears.
- Write formulas in LaTeX: inline as $a^2+b^2=c^2$, display on dedicated lines as $$E = mc^2$$. Never use plain-text math or bracket delimiters.
- Be specific and technically accurate. No filler.`;

const NOTEBOOK_PROMPT = `You are a study assistant that converts a video transcript into a structured, comprehensive notebook for a learner.

Create a well-organized notebook in markdown with:
## Overview
A 2-3 sentence summary of what the video teaches.

## Key Concepts
For each major concept covered, create a subsection with:
- Clear explanation
- Any examples or code mentioned
- Important formulas or definitions

## Summary Notes
Bullet-point summary of all the important information, organized by topic.

## Key Terms
A glossary of important terms with brief definitions.

## Review Questions
3-5 questions a learner could use to test their understanding.

Rules:
- Ground everything strictly in the supplied material; never invent content.
- **Bold** each key term the first time it appears.
- Write formulas in LaTeX: inline as $x^2$, display on dedicated lines as $$\\frac{dy}{dx} = 2x$$. Use explicit operators (\\times, \\cdot), never plain-text math or bracket delimiters.
- Use fenced code blocks with language tags for code.
- Be thorough — capture all concepts discussed, not just highlights.
- Aim for 600-1200 words.`;
