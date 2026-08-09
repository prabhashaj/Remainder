import { SupabaseClient } from "@supabase/supabase-js";
import { chunkText } from "./chunking.server";
import { generateEmbeddings } from "./embeddings.server";

/**
 * Saves extracted text to the study_resources table and asynchronously
 * generates document chunks and embeddings in the background.
 */
export async function saveDocumentTextAndEmbed(
  supabase: SupabaseClient,
  resourceId: string,
  text: string,
  pageCount?: number
) {
  // 1. Update text and page count synchronously so UI updates immediately
  const updateData: any = { extracted_text: text };
  if (pageCount) updateData.page_count = pageCount;
  
  const { error: updateErr } = await supabase
    .from("study_resources")
    .update(updateData)
    .eq("id", resourceId);
    
  if (updateErr) {
    throw new Error(`Failed to save extracted text: ${updateErr.message}`);
  }

  // 2. Generate chunks and embeddings asynchronously in the background
  // Fire and forget so we don't block the request or hit Vercel timeouts for large books
  (async () => {
    try {
      const chunks = chunkText(text);
      if (chunks.length > 0) {
        // Clear existing chunks for this document if any
        await supabase.from("document_chunks").delete().eq("document_id", resourceId);
        
        // Batch process to avoid hitting API limits
        for (let i = 0; i < chunks.length; i += 50) {
          const batchChunks = chunks.slice(i, i + 50);
          const batchEmbeddings = await generateEmbeddings(batchChunks);
          
          const chunkRows = batchChunks.map((content, idx) => ({
            document_id: resourceId,
            content,
            embedding: `[${(batchEmbeddings[idx] || []).join(",")}]`,
          }));
          
          const { error: chunkErr } = await supabase.from("document_chunks").insert(chunkRows);
          if (chunkErr) {
            console.error("Failed to insert document chunks in background:", chunkErr.message);
          }
        }
        console.log(`✅ Successfully background embedded ${chunks.length} chunks for document ${resourceId}`);
      }
    } catch (e) {
      console.error("Background embedding failed:", e);
    }
  })();
}
