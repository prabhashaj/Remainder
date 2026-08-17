import https from "node:https";
import http from "node:http";
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
    name: "android_vr",
    clientName: "ANDROID_VR",
    clientVersion: "1.62.20",
    clientNameHeader: "28",
    userAgent:
      "com.google.android.apps.youtube.vr.oculus/1.62.20 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
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
    name: "mweb",
    clientName: "MWEB",
    clientVersion: "2.20251209.01.00",
    clientNameHeader: "2",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    context: {
      platform: "MOBILE",
      osName: "iOS",
      osVersion: "17.5.1",
    },
  },
  {
    name: "android",
    clientName: "ANDROID",
    clientVersion: "19.34.42",
    clientNameHeader: "3",
    userAgent:
      "com.google.android.youtube/19.34.42 (Linux; U; Android 14; Pixel 8 Pro Build/AP2A.240805.005) gzip",
    context: {
      deviceMake: "Google",
      deviceModel: "Pixel 8 Pro",
      platform: "MOBILE",
      osName: "Android",
      osVersion: "14",
      androidSdkVersion: 34,
    },
  },
];

function httpRequest(
  urlStr: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {},
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === "https:";
      const lib = isHttps ? https : http;

      const reqHeaders = { ...(options.headers ?? {}) };
      if (options.body) {
        reqHeaders["Content-Length"] = String(Buffer.byteLength(options.body));
      }

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: options.method ?? "GET",
          headers: reqHeaders,
          timeout: options.timeoutMs ?? 10000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve({ status: res.statusCode ?? 200, text: data });
          });
        },
      );

      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Request timeout after ${options.timeoutMs ?? 10000}ms`));
      });

      req.on("error", reject);

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Robustly fetches YouTube transcripts using multiple layered strategies:
 * 1. Primary: Native Node https InnerTube Player API across multiple client profiles
 * 2. Secondary: youtube-caption-extractor
 * 3. Tertiary: YouTube Watch Page parsing
 * 4. Quaternary: Direct TimedText API endpoints
 */
export async function fetchYoutubeTranscript(
  videoIdOrUrl: string,
): Promise<{ segments: TranscriptSegment[]; fullText: string; error?: string }> {
  const empty = { segments: [] as TranscriptSegment[], fullText: "" };
  const videoId = extractYouTubeId(videoIdOrUrl) ?? videoIdOrUrl.trim();

  if (!videoId || videoId.length < 5) {
    return {
      ...empty,
      error: "Invalid YouTube URL or video ID provided.",
    };
  }

  // --- Strategy 1: Native Node.js HTTPS InnerTube Multi-Client Engine ---
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const body = JSON.stringify({
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
      });

      const res = await httpRequest(
        "https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": client.userAgent,
            "X-YouTube-Client-Name": client.clientNameHeader,
            "X-YouTube-Client-Version": client.clientVersion,
            Origin: "https://www.youtube.com",
          },
          body,
          timeoutMs: 6000,
        },
      );

      if (res.status === 200 && res.text) {
        const data = JSON.parse(res.text) as Record<string, unknown>;
        const captions = data["captions"] as Record<string, unknown> | undefined;
        const renderer = captions?.["playerCaptionsTracklistRenderer"] as
          | Record<string, unknown>
          | undefined;
        const tracks = renderer?.["captionTracks"] as CaptionTrack[] | undefined;

        if (Array.isArray(tracks) && tracks.length > 0) {
          const track =
            tracks.find((t) => t.vssId === ".en" || t.languageCode === "en") ??
            tracks.find((t) => t.vssId === "a.en" || t.languageCode?.startsWith("en")) ??
            tracks.find((t) => t.vssId?.includes(".en") || t.languageCode?.includes("en")) ??
            tracks[0];

          if (track?.baseUrl) {
            const capRes = await httpRequest(track.baseUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
              },
              timeoutMs: 6000,
            });

            if (capRes.status === 200 && capRes.text) {
              const segs = normalizeSegments(parseTranscriptXml(capRes.text));
              if (segs.length > 0) {
                return {
                  segments: segs,
                  fullText: segs.map((s) => s.text).join(" "),
                };
              }
            }
          }
        }
      }
    } catch {
      // Continue to next client
    }
  }

  // --- Strategy 2: youtube-caption-extractor (English) ---
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
        return {
          segments,
          fullText: segments.map((s) => s.text).join(" "),
        };
      }
    }
  } catch {
    // Continue to next strategy
  }

  // --- Strategy 3: HTML Page Parsing (captionTracks / ytInitialPlayerResponse) ---
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await httpRequest(watchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeoutMs: 6000,
    });

    if (res.status === 200) {
      const captionTracks = extractCaptionTracksFromHtml(res.text);
      if (captionTracks && captionTracks.length > 0) {
        const track =
          captionTracks.find((t) => t.vssId === ".en" || t.languageCode === "en") ??
          captionTracks.find((t) => t.vssId === "a.en" || t.languageCode?.startsWith("en")) ??
          captionTracks[0];

        if (track?.baseUrl) {
          const capRes = await httpRequest(track.baseUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            },
            timeoutMs: 6000,
          });
          if (capRes.status === 200 && capRes.text) {
            const segs = normalizeSegments(parseTranscriptXml(capRes.text));
            if (segs.length > 0) {
              return { segments: segs, fullText: segs.map((s) => s.text).join(" ") };
            }
          }
        }
      }
    }
  } catch {
    // Continue to next strategy
  }

  // --- Strategy 4: Direct TimedText API ---
  try {
    const timedTextUrls = [
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=a.en`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
    ];

    for (const u of timedTextUrls) {
      const res = await httpRequest(u, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        },
        timeoutMs: 5000,
      });
      if (res.status === 200 && res.text.trim()) {
        let segs: TranscriptSegment[] = [];
        if (res.text.trim().startsWith("{")) {
          segs = parseTranscriptJson3(res.text);
        } else if (res.text.includes("<text")) {
          segs = parseTranscriptXml(res.text);
        }
        const normalized = normalizeSegments(segs);
        if (normalized.length > 0) {
          return { segments: normalized, fullText: normalized.map((s) => s.text).join(" ") };
        }
      }
    }
  } catch {
    // Continue
  }

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

function extractCaptionTracksFromHtml(html: string): CaptionTrack[] | null {
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
  return null;
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

function parseTranscriptXml(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const tagRegex = /<text([^>]*)>([\s\S]*?)<\/text>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(xml)) !== null) {
    const attrs = match[1] ?? "";
    const rawText = match[2] ?? "";

    const startMatch = /start="([\d.]+)"/i.exec(attrs);
    const durMatch = /dur="([\d.]+)"/i.exec(attrs);

    if (startMatch && rawText) {
      const offset = parseFloat(startMatch[1] ?? "0") || 0;
      const duration = durMatch ? parseFloat(durMatch[1] ?? "0") || 0 : 3;
      const text = decodeXmlEntities(rawText);
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
