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
        `File exceeds the ${maxMb}MB size limit. Please upgrade to premium for larger uploads.`,
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

    const result = await fetchYoutubeTranscript(data.videoId);
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
    const raw = data.urlOrId.trim();
    const match = raw.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/,
    );
    const videoId = match ? match[1] : raw.length === 11 ? raw : null;

    if (!videoId) {
      return {
        success: false,
        error: "Please provide a valid YouTube URL or 11-character video ID.",
      };
    }

    const result = await fetchYoutubeTranscript(videoId);
    if (result.error || !result.fullText) {
      return {
        success: false,
        error: result.error ?? "No transcript available for this video.",
      };
    }

    return {
      success: true,
      videoId,
      fullText: result.fullText,
      segments: result.segments,
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
    // Check cached transcript first
    const { data: resource } = await context.supabase
      .from("study_resources")
      .select("extracted_text")
      .eq("id", data.resourceId)
      .maybeSingle();

    let segments;
    if (resource?.extracted_text) {
      // Re-parse from full text — we need the segment offsets
      // For cached text, fetch fresh segments
      const result = await fetchYoutubeTranscript(data.videoId);
      if (result.error || result.segments.length === 0) {
        return { success: false, error: result.error ?? "No transcript" };
      }
      segments = result.segments;
    } else {
      const result = await fetchYoutubeTranscript(data.videoId);
      if (result.error || result.segments.length === 0) {
        return { success: false, error: result.error ?? "No transcript" };
      }
      segments = result.segments;

      // Cache transcript and embed it
      if (result.fullText) {
        await saveDocumentTextAndEmbed(context.supabase, data.resourceId, result.fullText);
      }
    }

    const { text } = getTranscriptAtTimestamp(segments, data.seconds, 30);
    if (!text.trim()) {
      return { success: false, error: "No transcript text at this timestamp." };
    }

    return { success: true, note: text };
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

    // Get transcript (cached or fresh)
    const { data: resource } = await context.supabase
      .from("study_resources")
      .select("extracted_text")
      .eq("id", data.resourceId)
      .maybeSingle();

    let transcript = resource?.extracted_text;
    if (!transcript) {
      const result = await fetchYoutubeTranscript(data.videoId);
      if (result.error || !result.fullText) {
        return { success: false, error: result.error ?? "No transcript" };
      }
      transcript = result.fullText;
      // Cache it and embed it
      await saveDocumentTextAndEmbed(context.supabase, data.resourceId, transcript);
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
      const targetClient = context.supabase ?? supabaseAdmin;

      const { data: fileData, error: downloadErr } = await targetClient.storage
        .from("materials")
        .download(data.storagePath);

      if (downloadErr || !fileData) {
        console.error("Failed to download material for extraction:", downloadErr);
        return { success: false, error: downloadErr?.message ?? "Download failed" };
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
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
        const { saveDocumentTextAndEmbed } = await import("@/lib/document-processor.server");
        await saveDocumentTextAndEmbed(targetClient, data.resourceId, text, undefined, context.userId);
        console.log(`[DocumentExtraction] Successfully extracted ${text.length} chars for ${data.resourceId}`);
        return { success: true, textLength: text.length };
      }

      console.warn(`[DocumentExtraction] No extractable text found for ${data.resourceId}`);
      return { success: true, textLength: 0, warning: "No text extracted from file." };
    } catch (e) {
      console.error("Failed document extraction:", e);
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
