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

export const summarizeMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ resourceId: z.string(), force: z.boolean().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
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
  .inputValidator((data: unknown) =>
    z
      .object({ resourceId: z.string(), question: z.string().min(1) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
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
  .inputValidator((data: unknown) =>
    z.object({ videoId: z.string(), resourceId: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
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

    // Cache the transcript
    await context.supabase
      .from("study_resources")
      .update({ extracted_text: result.fullText })
      .eq("id", data.resourceId);

    return { success: true, transcript: result.fullText };
  });

/** Fetch transcript directly from any YouTube link or video ID. */
export const getTranscriptFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ urlOrId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
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
  .inputValidator((data: unknown) =>
    z
      .object({
        videoId: z.string(),
        resourceId: z.string(),
        seconds: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
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

      // Cache transcript
      if (result.fullText) {
        await context.supabase
          .from("study_resources")
          .update({ extracted_text: result.fullText })
          .eq("id", data.resourceId);
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
  .inputValidator((data: unknown) =>
    z
      .object({ videoId: z.string(), resourceId: z.string(), title: z.string() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
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
      // Cache it
      await context.supabase
        .from("study_resources")
        .update({ extracted_text: transcript })
        .eq("id", data.resourceId);
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
      roadmap_id: (
        await context.supabase
          .from("study_resources")
          .select("roadmap_id")
          .eq("id", data.resourceId)
          .maybeSingle()
      ).data?.roadmap_id ?? null,
    });

    return { success: true, pageId: page.id };
  });
