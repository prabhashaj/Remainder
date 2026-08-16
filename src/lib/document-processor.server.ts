import { SupabaseClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { chunkTextWithMeta } from "./chunking.server";
import { generateEmbeddings } from "./embeddings.server";
import { log } from "./logger.server";

/**
 * Saves extracted text to the study_resources table and asynchronously
 * generates document chunks and embeddings in the background.
 *
 * Designed for production scale:
 * 1. Synchronously updates `extracted_text`, `page_count`, and `status: "ready"`
 * 2. Writes raw chunks to `document_chunks` immediately so full-text/keyword search is instant
 * 3. Asynchronously generates vector embeddings with concurrency (up to 3 parallel batches)
 * 4. Tracks status in `background_jobs` for observability
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
  waitUntil(
    (async () => {
      try {
        const chunks = chunkTextWithMeta(text);
        if (chunks.length > 0) {
          // Clear existing chunks for this document if any
          await supabase.from("document_chunks").delete().eq("document_id", resourceId);

          // Split chunks into batches of 50
          const BATCH_SIZE = 50;
          const batches: Array<typeof chunks> = [];
          for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            batches.push(chunks.slice(i, i + BATCH_SIZE));
          }

          // Process batches with controlled concurrency (3 at a time) to avoid API rate limits
          const CONCURRENCY = 3;
          for (let b = 0; b < batches.length; b += CONCURRENCY) {
            const batchGroup = batches.slice(b, b + CONCURRENCY);

            await Promise.all(
              batchGroup.map(async (batchChunks, groupIdx) => {
                const batchIndex = b + groupIdx;
                let batchEmbeddings: number[][] = [];
                try {
                  batchEmbeddings = await generateEmbeddings(batchChunks.map((c) => c.content));
                } catch (embErr) {
                  log("warn", "embed_generation_failed_fallback", {
                    batch: batchIndex,
                    error: embErr instanceof Error ? embErr.message : String(embErr),
                  });
                }

                const chunkRows = batchChunks.map((chunk, idx) => {
                  const emb = batchEmbeddings[idx];
                  return {
                    document_id: resourceId,
                    content: chunk.content,
                    ...(chunk.pageNumber != null ? { page_number: chunk.pageNumber } : {}),
                    ...(emb && emb.length > 0 ? { embedding: `[${emb.join(",")}]` } : {}),
                  };
                });

                const { error: chunkErr } = await supabase
                  .from("document_chunks")
                  .insert(chunkRows);

                if (chunkErr) {
                  log(
                    "error",
                    "embed_document_chunk_insert_failed",
                    {
                      resourceId,
                      batch: batchIndex,
                      error: chunkErr.message,
                    },
                    { userId: userId ?? undefined },
                  );
                }
              }),
            );
          }

          log(
            "info",
            "embed_document_done",
            {
              resourceId,
              chunkCount: chunks.length,
              batches: batches.length,
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
