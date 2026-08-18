import https from "node:https";
import http from "node:http";
import { generateText } from "ai";
import { YoutubeTranscript } from "youtube-transcript";

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
    name: "android",
    clientName: "ANDROID",
    clientVersion: "20.10.38",
    clientNameHeader: "3",
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
    context: {
      deviceMake: "Google",
      deviceModel: "Pixel 8",
      platform: "MOBILE",
      osName: "Android",
      osVersion: "14",
      androidSdkVersion: 34,
    },
  },
  {
    name: "web",
    clientName: "WEB",
    clientVersion: "2.20250101.00.00",
    clientNameHeader: "1",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    context: {
      platform: "DESKTOP",
      osName: "Windows",
      osVersion: "10.0",
    },
  },
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
];

import { HttpsProxyAgent } from "https-proxy-agent";

export function getProxyList(): string[] {
  const raw =
    process.env["YOUTUBE_PROXY"] ||
    process.env["youtubeproxy"] ||
    process.env["YOUTUBEPROXY"] ||
    process.env["youtube_proxy"] ||
    process.env["HTTPS_PROXY"] ||
    process.env["https_proxy"] ||
    process.env["HTTP_PROXY"] ||
    process.env["http_proxy"] ||
    Object.entries(process.env).find(([k]) => k.toUpperCase().includes("YOUTUBE") && k.toUpperCase().includes("PROXY"))?.[1] ||
    "";
  if (!raw.trim()) return [];
  return raw
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getProxyAgent(customProxyUrl?: string): HttpsProxyAgent<string> | undefined {
  const url = customProxyUrl || getProxyList()[0];
  if (!url) return undefined;
  try {
    return new HttpsProxyAgent(url);
  } catch {
    return undefined;
  }
}

function httpRequest(
  urlStr: string,
  options: {
    method?: string | undefined;
    headers?: Record<string, string> | undefined;
    body?: string | undefined;
    timeoutMs?: number | undefined;
    proxyUrl?: string | undefined;
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

      const agent = isHttps ? getProxyAgent(options.proxyUrl) : undefined;

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: options.method ?? "GET",
          headers: reqHeaders,
          rejectUnauthorized: false,
          timeout: options.timeoutMs ?? 10000,
          ...(agent ? { agent } : {}),
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
 * 1. Primary: Native Node https InnerTube API with genuine VisitorData token
 * 2. Secondary: youtube-caption-extractor
 * 3. Tertiary: Watch page direct caption extraction
 * 4. Quaternary: Direct TimedText API endpoints
 */
export async function fetchYoutubeTranscript(
  videoIdOrUrl: string,
): Promise<{ segments: TranscriptSegment[]; fullText: string; error?: string; debugLog?: string[] }> {
  const debugLog: string[] = [];
  const empty = { segments: [] as TranscriptSegment[], fullText: "", debugLog };
  const videoId = extractYouTubeId(videoIdOrUrl) ?? videoIdOrUrl.trim();

  if (!videoId || videoId.length < 5) {
    debugLog.push(`Invalid ID: "${videoIdOrUrl}"`);
    return {
      ...empty,
      error: "Invalid YouTube URL or video ID provided.",
    };
  }

  debugLog.push(`Starting fetch for videoId=${videoId}`);

  // Step 0: Extract VisitorData from YouTube Watch Page to bypass bot/login blocks
  let visitorData: string | undefined;
  try {
    const pageRes = await httpRequest(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeoutMs: 5000,
    });
    if (pageRes.status === 200) {
      const visitorMatch = pageRes.text.match(/"VISITOR_DATA"\s*:\s*"([^"]+)"/);
      if (visitorMatch?.[1]) {
        visitorData = visitorMatch[1];
        debugLog.push(`Acquired VisitorData token (${visitorData.length} chars)`);
      }
    }
  } catch (err) {
    debugLog.push(`Watch page fetch notice: ${err instanceof Error ? err.message : String(err)}`);
  }

  // --- Strategy 1: YoutubeTranscript Engine ---
  try {
    const rawSegments = await (async () => {
      try {
        const yt =
          typeof (YoutubeTranscript as any)?.fetchTranscript === "function"
            ? YoutubeTranscript
            : typeof (YoutubeTranscript as any)?.default?.fetchTranscript === "function"
              ? (YoutubeTranscript as any).default
              : YoutubeTranscript;

        if (typeof yt?.fetchTranscript === "function") {
          try {
            return await yt.fetchTranscript(videoId);
          } catch {
            try {
              return await yt.fetchTranscript(videoId, { lang: "en" });
            } catch {
              return null;
            }
          }
        }
        return null;
      } catch (e) {
        debugLog.push(`Strategy 1 inner catch: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
    })();

    if (Array.isArray(rawSegments) && rawSegments.length > 0) {
      const isMs =
        rawSegments.length > 0 &&
        rawSegments[rawSegments.length - 1]!.offset > 1000 &&
        rawSegments[0]!.duration > 50;

      const segs: TranscriptSegment[] = rawSegments
        .map((s) => ({
          text: decodeXmlEntities(s.text ?? "").replace(/\n+/g, " ").trim(),
          offset: isMs ? s.offset / 1000 : s.offset,
          duration: isMs ? s.duration / 1000 : s.duration,
        }))
        .filter((s) => s.text && s.text !== "[Music]" && s.text !== "[Applause]");

      const normalized = normalizeSegments(segs);
      if (normalized.length > 0) {
        debugLog.push(`Strategy 1 (youtube-transcript) OK: ${normalized.length} segments`);
        return {
          segments: normalized,
          fullText: normalized.map((s) => s.text).join(" "),
          debugLog,
        };
      }
    }
  } catch (err) {
    debugLog.push(
      `Strategy 1 (youtube-transcript) error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const proxyList = getProxyList();
  const proxyAttempts = proxyList.length > 0 ? proxyList : [undefined];

  for (const currentProxy of proxyAttempts) {
    if (currentProxy) {
      debugLog.push(`Trying proxy: ${currentProxy.replace(/:[^:@]+@/, ":***@")}`);
    }

    // --- Strategy 2: Multi-Client InnerTube Engine ---
    for (const client of INNERTUBE_CLIENTS) {
      try {
        const body = JSON.stringify({
          context: {
            client: {
              clientName: client.clientName,
              clientVersion: client.clientVersion,
              hl: "en",
              gl: "US",
              ...(visitorData ? { visitorData } : {}),
              ...client.context,
            },
            user: { lockedSafetyMode: false },
            request: { useSsl: true },
          },
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
        });

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": client.userAgent,
          "X-YouTube-Client-Name": client.clientNameHeader,
          "X-YouTube-Client-Version": client.clientVersion,
          Origin: "https://www.youtube.com",
        };
        if (visitorData) {
          headers["X-Goog-Visitor-Id"] = visitorData;
        }

        const res = await httpRequest(
          "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
          {
            method: "POST",
            headers,
            body,
            timeoutMs: 8000,
            proxyUrl: currentProxy,
          },
        );

        debugLog.push(`Client ${client.name}: /player HTTP ${res.status}`);

        if (res.status === 200 && res.text) {
          const data = JSON.parse(res.text) as Record<string, unknown>;
          const captions = data["captions"] as Record<string, unknown> | undefined;
          const renderer = captions?.["playerCaptionsTracklistRenderer"] as
            | Record<string, unknown>
            | undefined;
          const tracks = renderer?.["captionTracks"] as CaptionTrack[] | undefined;

          if (Array.isArray(tracks) && tracks.length > 0) {
            debugLog.push(`Client ${client.name}: found ${tracks.length} caption tracks`);
            const track =
              tracks.find((t) => t.vssId === ".en" || t.languageCode === "en") ??
              tracks.find((t) => t.vssId === "a.en" || t.languageCode?.startsWith("en")) ??
              tracks.find((t) => t.vssId?.includes(".en") || t.languageCode?.includes("en")) ??
              tracks[0];

            if (track?.baseUrl) {
              const formats = [
                track.baseUrl.includes("fmt=") ? track.baseUrl : `${track.baseUrl}&fmt=srv3`,
                track.baseUrl.includes("fmt=") ? track.baseUrl : `${track.baseUrl}&fmt=json3`,
                track.baseUrl,
              ];

              for (const fmtUrl of formats) {
                for (const pUrl of [currentProxy, undefined]) {
                  try {
                    const capRes = await httpRequest(fmtUrl, {
                      headers: {
                        "User-Agent": client.userAgent,
                        Referer: `https://www.youtube.com/watch?v=${videoId}`,
                      },
                      timeoutMs: 8000,
                      proxyUrl: pUrl,
                    });

                    debugLog.push(
                      `Client ${client.name}: timedtext fetch (proxy=${pUrl ? "yes" : "no"}) HTTP ${capRes.status} (len: ${capRes.text.length})`,
                    );

                    if (capRes.status === 200 && capRes.text && capRes.text.length > 0) {
                      let segs = capRes.text.trim().startsWith("{")
                        ? parseTranscriptJson3(capRes.text)
                        : parseTranscriptXml(capRes.text);
                      segs = normalizeSegments(segs);
                      if (segs.length > 0) {
                        debugLog.push(`Success via ${client.name}: ${segs.length} segments`);
                        return {
                          segments: segs,
                          fullText: segs.map((s) => s.text).join(" "),
                          debugLog,
                        };
                      }
                    }
                  } catch (e) {
                    debugLog.push(
                      `Client ${client.name}: timedtext error (proxy=${pUrl ? "yes" : "no"}): ${e instanceof Error ? e.message : String(e)}`,
                    );
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        debugLog.push(`Client ${client.name} error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // --- Strategy 3: Watch Page Direct Extraction ---
    try {
      const pageRes = await httpRequest(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeoutMs: 8000,
        proxyUrl: currentProxy,
      });

      if (pageRes.status === 200 && pageRes.text) {
        const html = pageRes.text;
        let tracks: CaptionTrack[] | null = null;
        const pIdx = html.indexOf("ytInitialPlayerResponse = ");
        if (pIdx !== -1) {
          let depth = 0;
          const start = html.indexOf("{", pIdx);
          if (start !== -1) {
            for (let i = start; i < html.length; i++) {
              if (html[i] === "{") depth++;
              else if (html[i] === "}") {
                depth--;
                if (depth === 0) {
                  try {
                    const obj = JSON.parse(html.slice(start, i + 1)) as Record<string, unknown>;
                    const caps = obj?.["captions"] as Record<string, unknown> | undefined;
                    const rend = caps?.["playerCaptionsTracklistRenderer"] as
                      | Record<string, unknown>
                      | undefined;
                    tracks = (rend?.["captionTracks"] as CaptionTrack[] | undefined) ?? null;
                  } catch {
                    /* ignore */
                  }
                  break;
                }
              }
            }
          }
        }

        if (tracks && tracks.length > 0) {
          const track =
            tracks.find((t) => t.vssId === ".en" || t.languageCode === "en") ??
            tracks.find((t) => t.vssId === "a.en" || t.languageCode?.startsWith("en")) ??
            tracks.find((t) => t.vssId?.includes(".en") || t.languageCode?.includes("en")) ??
            tracks[0];

          if (track?.baseUrl) {
            const formats = [
              track.baseUrl.includes("fmt=") ? track.baseUrl : `${track.baseUrl}&fmt=srv3`,
              track.baseUrl.includes("fmt=") ? track.baseUrl : `${track.baseUrl}&fmt=json3`,
              track.baseUrl,
            ];

            for (const fmtUrl of formats) {
              for (const pUrl of [currentProxy, undefined]) {
                try {
                  const capRes = await httpRequest(fmtUrl, {
                    headers: {
                      "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                      Referer: `https://www.youtube.com/watch?v=${videoId}`,
                    },
                    timeoutMs: 8000,
                    proxyUrl: pUrl,
                  });

                  debugLog.push(
                    `Strategy 3: timedtext fetch (proxy=${pUrl ? "yes" : "no"}) HTTP ${capRes.status} (len: ${capRes.text.length})`,
                  );

                  if (capRes.status === 200 && capRes.text.length > 0) {
                    let segs = capRes.text.trim().startsWith("{")
                      ? parseTranscriptJson3(capRes.text)
                      : parseTranscriptXml(capRes.text);
                    segs = normalizeSegments(segs);
                    if (segs.length > 0) {
                      debugLog.push(`Strategy 3 (Watch Page) OK: ${segs.length} segments`);
                      return {
                        segments: segs,
                        fullText: segs.map((s) => s.text).join(" "),
                        debugLog,
                      };
                    }
                  }
                } catch (e) {
                  debugLog.push(
                    `Strategy 3: timedtext error (proxy=${pUrl ? "yes" : "no"}): ${e instanceof Error ? e.message : String(e)}`,
                  );
                }
              }
            }
          }
        }
      }
    } catch (err) {
      debugLog.push(`Strategy 3 error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    ...empty,
    debugLog,
    error:
      "No transcript available for this video. The video might not have English captions or auto-generated subtitles enabled on YouTube.",
  };
}

/* ---------- Internal Helpers ---------- */

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

  // Format 1: Classic <text start="seconds" dur="seconds">...</text>
  const textRegex = /<text([^>]*)>([\s\S]*?)<\/text>/gi;
  let match: RegExpExecArray | null;
  while ((match = textRegex.exec(xml)) !== null) {
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

  // Format 2: srv3 format <p t="milliseconds" d="milliseconds">...</p>
  if (segments.length === 0) {
    const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/gi;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pRegex.exec(xml)) !== null) {
      const offset = parseInt(pMatch[1] ?? "0", 10) / 1000;
      const duration = parseInt(pMatch[2] ?? "0", 10) / 1000;
      const rawText = pMatch[3] ?? "";
      const text = decodeXmlEntities(rawText.replace(/<[^>]+>/g, ""));
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
 * Returns transcript segments within a window around the given timestamp (e.g. ±10s -> 20s window).
 * If target timestamp is 2:13 (133s), default window covers 2:03 to 2:23.
 */
export function getTranscriptAtTimestamp(
  segments: TranscriptSegment[],
  seconds: number,
  windowSeconds = 20,
): { text: string; start: number; end: number; segments: TranscriptSegment[] } {
  const half = windowSeconds / 2; // e.g. 10s
  let start = Math.max(0, seconds - half);
  let end = seconds + half;

  let matched = segments.filter((s) => s.offset + s.duration >= start && s.offset <= end);

  // If matched text is sparse or very brief (e.g., pause in speech), expand window to ±20s
  if (matched.map((s) => s.text).join(" ").trim().length < 35) {
    start = Math.max(0, seconds - 20);
    end = seconds + 20;
    matched = segments.filter((s) => s.offset + s.duration >= start && s.offset <= end);
  }

  // If still no speech in that window, find the closest neighboring segment
  if (matched.length === 0 && segments.length > 0) {
    let closest = segments[0]!;
    let minDiff = Math.abs(closest.offset - seconds);
    for (const seg of segments) {
      const diff = Math.abs(seg.offset - seconds);
      if (diff < minDiff) {
        minDiff = diff;
        closest = seg;
      }
    }
    matched = [closest];
  }

  const text = matched
    .map((s) => s.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    text,
    start,
    end,
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

  // Chunk and summarize each part in parallel
  const chunks: string[] = [];
  for (let i = 0; i < transcript.length; i += CHUNK_SIZE) {
    chunks.push(transcript.slice(i, i + CHUNK_SIZE));
  }

  const chunkSummaries = await Promise.all(
    chunks.map((chunk, i) =>
      generateText({
        model,
        system: `You are a study assistant. Summarize part ${i + 1} of ${chunks.length} of a video transcript into key points. Be concise — 4-6 bullet points maximum. Ground everything in what was actually said.`,
        prompt: `Video title: ${title}\n\nTranscript part ${i + 1}/${chunks.length}:\n${chunk}`,
      }).then((r) => r.text.trim()),
    ),
  );

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
    const summaries = await Promise.all(
      chunks.map((chunk, i) =>
        generateText({
          model,
          system: `Summarize part ${i + 1} of ${chunks.length} of this video transcript into detailed notes covering all major points, examples, and key terms.`,
          prompt: chunk,
        }).then((r) => r.text.trim()),
      ),
    );
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
