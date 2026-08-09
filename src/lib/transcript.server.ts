import { generateText } from "ai";
import { getSubtitles } from "youtube-caption-extractor";

import { createAiGatewayProvider, getAiModelName } from "@/lib/ai-gateway.server";

export type TranscriptSegment = {
  text: string;
  offset: number; // seconds
  duration: number; // seconds
};

type CaptionTrack = { baseUrl: string; languageCode: string };

function isCaptionTrack(value: unknown): value is CaptionTrack {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  return (
    Boolean(rec) && typeof rec!["baseUrl"] === "string" && typeof rec!["languageCode"] === "string"
  );
}

/**
 * Robustly fetches YouTube transcripts using youtube-caption-extractor,
 * with fallbacks to InnerTube and timedtext endpoints.
 */
export async function fetchYoutubeTranscript(
  videoId: string,
): Promise<{ segments: TranscriptSegment[]; fullText: string; error?: string }> {
  const empty = { segments: [] as TranscriptSegment[], fullText: "" };

  // --- Primary Strategy: youtube-caption-extractor ---
  try {
    const subtitles = await getSubtitles({ videoID: videoId, lang: "en" });
    if (Array.isArray(subtitles) && subtitles.length > 0) {
      const segments: TranscriptSegment[] = subtitles
        .map((s) => ({
          text: decodeXmlEntities(s.text ?? ""),
          offset: parseFloat(s.start ?? "0") || 0,
          duration: parseFloat(s.dur ?? "0") || 0,
        }))
        .filter((s) => s.text.length > 0);

      if (segments.length > 0) {
        return {
          segments,
          fullText: segments.map((s) => s.text).join(" "),
        };
      }
    }
  } catch (err) {
    console.warn("[Transcript] Primary extractor warning:", err);
  }

  // --- Fallback Strategy 1: InnerTube Player API ---
  try {
    const captionTracks = await fetchCaptionTracksFromInnerTube(videoId);
    if (captionTracks && captionTracks.length > 0) {
      const segments = await fetchSegmentsFromCaptionTracks(captionTracks);
      if (segments.length > 0) {
        return { segments, fullText: segments.map((s) => s.text).join(" ") };
      }
    }
  } catch {
    /* continue */
  }

  // --- Fallback Strategy 2: HTML Page Parsing ---
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
      const captionTracks = extractJsonArrayFromKey(html, '"captionTracks"');
      if (captionTracks && captionTracks.length > 0) {
        const segments = await fetchSegmentsFromCaptionTracks(captionTracks);
        if (segments.length > 0) {
          return { segments, fullText: segments.map((s) => s.text).join(" ") };
        }
      }
    }
  } catch {
    /* continue */
  }

  return {
    ...empty,
    error:
      "No transcript available for this video. The video might not have English captions or auto-generated subtitles.",
  };
}

/* ---------- Helpers ---------- */

async function fetchCaptionTracksFromInnerTube(videoId: string): Promise<CaptionTrack[] | null> {
  const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20240101.00.00",
          hl: "en",
        },
      },
    }),
  });
  if (!res.ok) return null;
  const data: unknown = await res.json();
  if (!data || typeof data !== "object") return null;
  const captions = (data as Record<string, unknown>)["captions"];
  if (!captions || typeof captions !== "object") return null;
  const renderer = (captions as Record<string, unknown>)["playerCaptionsTracklistRenderer"];
  if (!renderer || typeof renderer !== "object") return null;
  const tracks = (renderer as Record<string, unknown>)["captionTracks"];
  return Array.isArray(tracks) ? tracks.filter(isCaptionTrack) : null;
}

async function fetchSegmentsFromCaptionTracks(
  captionTracks: CaptionTrack[],
): Promise<TranscriptSegment[]> {
  const track =
    captionTracks.find((t) => t.languageCode === "en") ??
    captionTracks.find((t) => t.languageCode?.startsWith("en")) ??
    captionTracks[0];

  if (!track || !track.baseUrl) return [];

  const captionUrl = track.baseUrl.replace(/&amp;/g, "&");
  const res = await fetch(captionUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) return [];

  const text = await res.text();
  return parseTranscriptXml(text);
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

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
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
