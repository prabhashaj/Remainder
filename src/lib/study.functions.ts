import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { askMaterial, summarizeResource } from "@/lib/agents/tutor.server";
import { runNotebookAgent } from "@/lib/agents/notebook-agent.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAiApiKey } from "@/lib/ai-gateway.server";
import {
  fetchYoutubeTranscript,
  getTranscriptAtTimestamp,
  generateNotebook,
  type TranscriptSegment,
} from "@/lib/transcript.server";
import { saveDocumentTextAndEmbed } from "@/lib/document-processor.server";
import { checkRateLimit } from "@/lib/rate-limit.server";
import { getRemainingLimitsServer } from "@/lib/limits";

export const getUploadTokenFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        filename: z.string(),
        fileSize: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const limits = await getRemainingLimitsServer(context.supabase, context.userId);
    const maxMb = limits.maxFileSizeMb;
    const maxBytes = maxMb * 1024 * 1024;
    if (data.fileSize > maxBytes) {
      throw new Error(
        limits.isPremium
          ? `File exceeds the maximum limit of ${maxMb}MB.`
          : `File exceeds the 15MB Free tier limit. Please upgrade to Pro to upload documents up to 50MB.`,
      );
    }

    const safe = data.filename.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/\.+/g, ".");
    const path = `${context.userId}/${Date.now()}-${safe}`;
    const { data: uploadData, error } = await context.supabase.storage
      .from("materials")
      .createSignedUploadUrl(path);

    if (error) {
      // Attempt to auto-create bucket if it doesn't exist
      if (
        error.message.includes("not found") ||
        error.message.includes("Bucket") ||
        error.message.includes("does not exist")
      ) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.storage.createBucket("materials", { public: true });
        const retry = await context.supabase.storage.from("materials").createSignedUploadUrl(path);
        if (retry.error) throw new Error(retry.error.message);
        return { path, token: retry.data.token };
      }
      throw new Error(error.message);
    }
    return { path, token: uploadData.token };
  });

export const summarizeMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ resourceId: z.string().max(100), force: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "study_summarize", 50, 60);
    } catch {
      return { success: false, error: "Too many requests. Please try again later." };
    }
    const key = getAiApiKey();
    if (!key) return { success: false, error: "AI is not configured." };
    return summarizeResource({
      resourceId: data.resourceId,
      force: data.force ?? false,
      apiKey: key,
      supabase: context.supabase,
    });
  });

export const askAboutMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({ resourceId: z.string().max(100), question: z.string().min(1).max(2000) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "study_ask", 100, 60);
    } catch {
      return { success: false, error: "Too many requests. Please try again later." };
    }
    const key = getAiApiKey();
    if (!key) return { success: false, error: "AI is not configured." };
    return askMaterial({
      resourceId: data.resourceId,
      question: data.question,
      apiKey: key,
      supabase: context.supabase,
    });
  });

import { extractYouTubeId } from "@/lib/youtube";
import { fetchYouTubeMetadata } from "@/lib/youtube.server";

/** Fetch metadata (title, thumbnail, author) for a YouTube video. */
export const getYouTubeMetadataFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ urlOrId: z.string().min(1).max(1000) }).parse(data))
  .handler(async ({ data }) => {
    const meta = await fetchYouTubeMetadata(data.urlOrId);
    if (!meta) {
      return { success: false, error: "Unable to retrieve YouTube metadata." };
    }
    return { success: true, metadata: meta };
  });

/** Diagnostic: tests transcript fetching from within server function context. */
export const debugTranscriptFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ videoId: z.string().min(1).max(100) }).parse(data))
  .handler(async ({ data }) => {
    const { fetchYoutubeTranscript } = await import("@/lib/transcript.server");
    const startMs = Date.now();
    const result = await fetchYoutubeTranscript(data.videoId);
    return {
      videoId: data.videoId,
      success: result.segments.length > 0,
      segments: result.segments.length,
      chars: result.fullText.length,
      error: result.error ?? null,
      debugLog: result.debugLog ?? [],
      ms: Date.now() - startMs,
      nodeVersion: process.version,
    };
  });

/** Fetch YouTube transcript for a video resource. */
export const fetchTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ videoId: z.string().max(100), resourceId: z.string().max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "study_transcript", 100, 60);
    } catch {
      return { success: false, error: "Too many requests. Please try again later." };
    }
    // Check if we already have a cached transcript
    const { data: resource } = await context.supabase
      .from("study_resources")
      .select("extracted_text")
      .eq("id", data.resourceId)
      .maybeSingle();

    if (resource?.extracted_text) {
      return { success: true, transcript: resource.extracted_text };
    }

    const cleanVideoId = extractYouTubeId(data.videoId) ?? data.videoId;
    const result = await fetchYoutubeTranscript(cleanVideoId);
    if (result.error || !result.fullText) {
      return { success: false, error: result.error ?? "No transcript available" };
    }

    // Cache the transcript and embed it
    await saveDocumentTextAndEmbed(context.supabase, data.resourceId, result.fullText);

    return { success: true, transcript: result.fullText };
  });

/** Fetch transcript directly from any YouTube link or video ID. */
export const getTranscriptFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ urlOrId: z.string().min(1).max(1000) }).parse(data))
  .handler(async ({ data, context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "study_transcript", 100, 60);
    } catch {
      return { success: false, error: "Too many requests. Please try again later." };
    }
    const videoId = extractYouTubeId(data.urlOrId) ?? data.urlOrId.trim();

    if (!videoId) {
      return {
        success: false,
        error: "Please provide a valid YouTube URL or 11-character video ID.",
      };
    }

    const result = await fetchYoutubeTranscript(videoId);
    if (result.segments && result.segments.length > 0) {
      return {
        success: true,
        videoId,
        fullText: result.fullText,
        segments: result.segments,
      };
    }

    // AI Fallback: Generate structured timestamped study chapters
    const key = getAiApiKey();
    if (key) {
      const { createAiGatewayProvider, getAiModelName } = await import("@/lib/ai-gateway.server");
      const { fetchYouTubeMetadata } = await import("@/lib/youtube.server");
      const { generateText } = await import("ai");

      const meta = await fetchYouTubeMetadata(videoId);
      const title = meta?.title ?? "Educational Video";
      const author = meta?.author ?? "YouTube";

      const gateway = createAiGatewayProvider(key);
      const aiRes = await generateText({
        model: gateway(getAiModelName()),
        prompt: `You are an educational AI assistant. Create a structured timestamped chapter breakdown for the video "${title}" by ${author}.
Return ONLY a valid JSON array of 8-12 timestamped segments covering the video topics with exact offsets in seconds:
[
  { "offset": 0, "duration": 45, "text": "Introduction: Core concepts and background overview." },
  { "offset": 45, "duration": 90, "text": "Part 1: Key mechanisms and fundamental principles." }
]`,
      });

      try {
        const jsonMatch = aiRes.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as TranscriptSegment[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            return {
              success: true,
              videoId,
              fullText: parsed.map((s) => s.text).join(" "),
              segments: parsed,
            };
          }
        }
      } catch {
        // Fallback below
      }
    }

    return {
      success: false,
      error: "No transcript available for this video.",
    };
  });

/** Auto-generate a note from transcript at a specific timestamp. */
export const autoNoteFromTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        videoId: z.string().max(100),
        resourceId: z.string().max(100),
        seconds: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "study_autonote", 100, 60);
    } catch {
      return { success: false, error: "Too many requests. Please try again later." };
    }
    const cleanVid = extractYouTubeId(data.videoId) ?? data.videoId.trim();
    
    // 1. Check cached transcript or fetch fresh
    const { data: resource } = await context.supabase
      .from("study_resources")
      .select("title, extracted_text")
      .eq("id", data.resourceId)
      .maybeSingle();

    let segments: TranscriptSegment[] = [];
    const result = await fetchYoutubeTranscript(cleanVid);
    if (result.segments && result.segments.length > 0) {
      segments = result.segments;
      if (!resource?.extracted_text && result.fullText) {
        void saveDocumentTextAndEmbed(context.supabase, data.resourceId, result.fullText);
      }
    }

    if (!segments || segments.length === 0) {
      const key = getAiApiKey();
      if (key) {
        try {
          const { createAiGatewayProvider, getAiModelName } = await import(
            "@/lib/ai-gateway.server"
          );
          const { fetchYouTubeMetadata } = await import("@/lib/youtube.server");
          const { generateText } = await import("ai");

          const meta = await fetchYouTubeMetadata(cleanVid);
          const videoTitle = meta?.title ?? resource?.title ?? "Educational Video";
          const currMins = Math.floor(data.seconds / 60);
          const currSecs = String(Math.floor(data.seconds % 60)).padStart(2, "0");
          const timeStr = `${currMins}:${currSecs}`;

          const gateway = createAiGatewayProvider(key);
          const aiRes = await generateText({
            model: gateway(getAiModelName()),
            system: `You are Remi, an expert study assistant. A learner is watching "${videoTitle}" at timestamp ${timeStr}. Provide a concise, high-yield study takeaway note about this concept for timestamp ${timeStr}. Ground it in the technical subject matter. Return ONLY 1-2 direct sentences without filler.`,
            prompt: `Video topic: ${videoTitle}\nTimestamp: ${timeStr}\nGenerate a concise study note now:`,
          });
          const note = aiRes.text.trim().replace(/^["']|["']$/g, "").replace(/^Note:\s*/i, "");
          if (note) {
            return { success: true, note };
          }
        } catch {
          // Fallback to error below
        }
      }

      return {
        success: false,
        error: "No transcript available for this video to extract timestamped notes.",
      };
    }

    // 2. Extract the exact speech window (e.g. at 2:13 -> considers 2:03 to 2:23)
    const { text: spokenText, start, end } = getTranscriptAtTimestamp(segments, data.seconds, 20);

    if (!spokenText || spokenText.trim().length === 0) {
      return {
        success: false,
        error: `No spoken audio found around this moment (${Math.floor(data.seconds / 60)}:${String(Math.floor(data.seconds % 60)).padStart(2, "0")}).`,
      };
    }

    // 3. Synthesize what is ACTUALLY spoken into a concise, meaningful study note
    const key = getAiApiKey();
    if (!key) {
      return { success: true, note: spokenText };
    }

    try {
      const { createAiGatewayProvider, getAiModelName } = await import("@/lib/ai-gateway.server");
      const { fetchYouTubeMetadata } = await import("@/lib/youtube.server");
      const { generateText } = await import("ai");

      const meta = await fetchYouTubeMetadata(cleanVid);
      const videoTitle = meta?.title ?? resource?.title ?? "Educational Video";
      const startMins = Math.floor(start / 60);
      const startSecs = String(Math.floor(start % 60)).padStart(2, "0");
      const endMins = Math.floor(end / 60);
      const endSecs = String(Math.floor(end % 60)).padStart(2, "0");
      const currMins = Math.floor(data.seconds / 60);
      const currSecs = String(Math.floor(data.seconds % 60)).padStart(2, "0");

      const timeRangeStr = `${startMins}:${startSecs} - ${endMins}:${endSecs}`;
      const targetTimeStr = `${currMins}:${currSecs}`;

      const gateway = createAiGatewayProvider(key);
      const aiRes = await generateText({
        model: gateway(getAiModelName()),
        system: `You are Remi, an expert study notes assistant.
A learner is watching the video "${videoTitle}" and paused at ${targetTimeStr}.

Your task:
Convert what the speaker explains in the provided spoken transcript excerpt (${timeRangeStr}) into a crisp, meaningful 1-2 sentence study note.

Strict Rules:
- Ground the note strictly in what was spoken in this excerpt. Do NOT invent external concepts.
- Do NOT write general video or channel overviews (e.g. "Software engineering is evolving...").
- Capture the specific technical takeaway, definition, logic, or principle being stated right here.
- Keep it concise, high-yield, and actionable (1-2 sentences).
- Output ONLY the final note text directly. No quotes, no prefix like "Note:".`,
        prompt: `Spoken transcript excerpt between ${timeRangeStr}:
"${spokenText}"

Write the 1-2 sentence study note for this moment:`,
      });

      const note = aiRes.text.trim().replace(/^["']|["']$/g, "").replace(/^Note:\s*/i, "");
      if (note) {
        return { success: true, note };
      }
    } catch {
      // Fallback to verbatim cleaned spoken text on generation error
      return { success: true, note: spokenText };
    }

    return { success: true, note: spokenText };
  });

/** Generate a notebook from video transcript and create a page. */
export const generateNotebookFromTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        videoId: z.string().max(100),
        resourceId: z.string().max(100),
        title: z.string().max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "study_generate_notebook", 20, 60);
    } catch {
      return { success: false, error: "Too many requests. Please try again later." };
    }
    const key = getAiApiKey();
    if (!key) return { success: false, error: "AI is not configured." };

    const cleanVid = extractYouTubeId(data.videoId) ?? data.videoId.trim();

    // Get transcript (cached or fresh)
    const { data: resource } = await context.supabase
      .from("study_resources")
      .select("extracted_text")
      .eq("id", data.resourceId)
      .maybeSingle();

    let transcript = resource?.extracted_text;
    if (!transcript || transcript.trim().length === 0) {
      const result = await fetchYoutubeTranscript(cleanVid);
      if (result.fullText) {
        transcript = result.fullText;
        await saveDocumentTextAndEmbed(context.supabase, data.resourceId, transcript);
      } else {
        const meta = await fetchYouTubeMetadata(cleanVid);
        transcript = `Video Topic: ${meta?.title ?? data.title}\nChannel: ${meta?.author ?? "YouTube"}\nSource: https://www.youtube.com/watch?v=${cleanVid}`;
      }
    }

    // Create a page in the workspace
    const userId = context.userId;
    const { data: page, error } = await context.supabase
      .from("pages")
      .insert({
        user_id: userId,
        title: `${data.title} — Notebook`,
        icon: "📒",
      })
      .select("id")
      .single();

    if (error || !page) {
      return { success: false, error: error?.message ?? "Failed to create page" };
    }

    // Run the Notebook Agent to populate the page with native blocks
    await runNotebookAgent({
      pageId: page.id,
      sourceMaterial: transcript,
      topicTitle: data.title,
      apiKey: key,
      supabase: context.supabase,
      userId,
    });

    // Also save as a study resource of kind "note"
    await context.supabase.from("study_resources").insert({
      user_id: userId,
      title: `${data.title} — Notebook`,
      kind: "note",
      roadmap_id:
        (
          await context.supabase
            .from("study_resources")
            .select("roadmap_id")
            .eq("id", data.resourceId)
            .maybeSingle()
        ).data?.roadmap_id ?? null,
    });

    return { success: true, pageId: page.id };
  });

/** Client-callable mutation to save text and trigger embedding generation. */
export const saveExtractedTextFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        resourceId: z.string().max(100),
        text: z.string().max(1000000),
        pages: z.number().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      await checkRateLimit(context.supabase, context.userId, "study_save_text", 50, 60);
    } catch {
      return { success: false, error: "Too many requests. Please try again later." };
    }
    await saveDocumentTextAndEmbed(context.supabase, data.resourceId, data.text, data.pages);
    return { success: true };
  });

/** Client-callable mutation to trigger background PDF extraction and embedding. */
export const triggerDocumentExtractionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        resourceId: z.string().max(100),
        storagePath: z.string().max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Download file using supabaseAdmin (service role key bypasses Storage RLS)
      let { data: fileData, error: downloadErr } = await supabaseAdmin.storage
        .from("materials")
        .download(data.storagePath);

      if (downloadErr || !fileData) {
        const userDl = await (context.supabase ?? supabaseAdmin).storage
          .from("materials")
          .download(data.storagePath);
        fileData = userDl.data;
        downloadErr = userDl.error;
      }

      if (downloadErr || !fileData) {
        console.error("Failed to download material for extraction:", downloadErr);
        return { success: false, error: downloadErr?.message ?? "Download failed" };
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const targetClient = supabaseAdmin;
      let text = "";

      const lowerPath = data.storagePath.toLowerCase();
      const isPdf = lowerPath.endsWith(".pdf") || lowerPath.includes(".pdf");

      if (isPdf) {
        const { extractPdfTextServer } = await import("@/lib/pdf-parser.server");
        text = await extractPdfTextServer(buffer);
      }

      // Fallback to text reading if PDF extraction yielded no text or file is non-PDF text/markdown
      if (!text || text.trim().length === 0) {
        const raw = buffer.toString("utf-8");
        if (!/\0/.test(raw.slice(0, 1000))) {
          text = raw;
        }
      }

      if (text && text.trim().length > 0) {
        const pageMatches = text.match(/^--- Page \d+ ---/gm);
        const pageCount = pageMatches ? pageMatches.length : undefined;

        const { saveDocumentTextAndEmbed } = await import("@/lib/document-processor.server");
        await saveDocumentTextAndEmbed(
          targetClient,
          data.resourceId,
          text,
          pageCount,
          context.userId,
        );
        console.log(
          `[DocumentExtraction] Successfully extracted ${text.length} chars (${pageCount ?? 1} pages) for ${data.resourceId}`,
        );
        return { success: true, textLength: text.length, pageCount: pageCount ?? null };
      }

      console.warn(`[DocumentExtraction] No extractable text found for ${data.resourceId}`);
      return { success: true, textLength: 0, warning: "No text extracted from file." };
    } catch (e) {
      console.error("Failed document extraction:", e);
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
