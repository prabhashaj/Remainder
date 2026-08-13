import { SupabaseClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { chunkText } from "./chunking.server";
import { generateEmbeddings } from "./embeddings.server";
import { log } from "./logger.server";

/**
 * Saves extracted text to the study_resources table and asynchronously
 * generates document chunks and embeddings in the background.
 *
 * Also writes a `background_jobs` row so failures are queryable
 * rather than silently lost in serverless logs.
 */
export async function saveDocumentTextAndEmbed(
  supabase: SupabaseClient,
  resourceId: string,
  text: string,
  pageCount?: number,
  userId?: string,
) {
  // 1. Update text, page count, and status synchronously so UI updates immediately
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = { extracted_text: text, status: "ready" };
  if (pageCount) updateData.page_count = pageCount;

  const { error: updateErr } = await supabase
    .from("study_resources")
    .update(updateData)
    .eq("id", resourceId);

  if (updateErr) {
    throw new Error(`Failed to save extracted text: ${updateErr.message}`);
  }

  // 2. Create background_jobs row so we can track embedding progress
  let jobId: string | null = null;
  if (userId) {
    const { data: jobRow } = await supabase
      .from("background_jobs")
      .insert({
        user_id: userId,
        job_type: "embed_document",
        resource_id: resourceId,
        status: "running",
      })
      .select("id")
      .single();
    jobId = jobRow?.id ?? null;
  }

  // 3. Generate chunks and embeddings asynchronously in the background
  // Fire and forget so we don't block the request or hit Vercel timeouts
  waitUntil(
    (async () => {
      try {
        const chunks = chunkText(text);
        if (chunks.length > 0) {
          // Clear existing chunks for this document if any
          await supabase.from("document_chunks").delete().eq("document_id", resourceId);

          // Batch process to avoid hitting API limits
          for (let i = 0; i < chunks.length; i += 50) {
            const batchChunks = chunks.slice(i, i + 50);
            let batchEmbeddings: number[][] = [];
            try {
              batchEmbeddings = await generateEmbeddings(batchChunks);
            } catch (embErr) {
              log("warn", "embed_generation_failed_fallback", {
                error: embErr instanceof Error ? embErr.message : String(embErr),
              });
            }

            const chunkRows = batchChunks.map((content, idx) => {
              const emb = batchEmbeddings[idx];
              return {
                document_id: resourceId,
                content,
                ...(emb && emb.length > 0 ? { embedding: `[${emb.join(",")}]` } : {}),
              };
            });

            const { error: chunkErr } = await supabase.from("document_chunks").insert(chunkRows);
            if (chunkErr) {
              log(
                "error",
                "embed_document_chunk_insert_failed",
                {
                  resourceId,
                  batch: Math.floor(i / 50),
                  error: chunkErr.message,
                },
                { userId: userId ?? undefined },
              );
            }
          }

          log(
            "info",
            "embed_document_done",
            {
              resourceId,
              chunkCount: chunks.length,
            },
            { userId: userId ?? undefined },
          );
        }

        // Mark job as done
        if (jobId) {
          await supabase
            .from("background_jobs")
            .update({ status: "done", completed_at: new Date().toISOString() })
            .eq("id", jobId);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log(
          "error",
          "embed_document_failed",
          { resourceId, error: msg },
          { userId: userId ?? undefined },
        );

        // Mark job as failed
        if (jobId) {
          await supabase
            .from("background_jobs")
            .update({
              status: "failed",
              error_message: msg,
              completed_at: new Date().toISOString(),
            })
            .eq("id", jobId);
        }
      }
    })(),
  );
}
