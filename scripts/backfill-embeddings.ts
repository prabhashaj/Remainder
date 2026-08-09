import { createClient } from "@supabase/supabase-js";
import { chunkText } from "../src/lib/chunking.server";
import { generateEmbeddings } from "../src/lib/embeddings.server";
import process from "node:process";

const supabase = createClient(
  process.env["SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
);

async function backfill() {
  console.log("Fetching all documents...");
  const { data: docs, error } = await supabase
    .from("study_resources")
    .select("id, title, extracted_text");

  if (error || !docs) {
    console.error("Failed to fetch documents", error);
    return;
  }

  console.log(`Found ${docs.length} documents. Chunking and embedding...`);

  for (const doc of docs) {
    if (!doc.extracted_text) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from("document_chunks")
      .select("*", { count: "exact", head: true })
      .eq("document_id", doc.id);

    if (count && count > 0) {
      console.log(`Skipping "${doc.title}" (already chunked)`);
      continue;
    }

    console.log(`Processing "${doc.title}"...`);
    try {
      const chunks = chunkText(doc.extracted_text);
      let inserted = 0;

      for (let i = 0; i < chunks.length; i += 50) {
        const batchChunks = chunks.slice(i, i + 50);
        const batchEmbeddings = await generateEmbeddings(batchChunks);

        const chunkRows = batchChunks.map((content, idx) => ({
          document_id: doc.id,
          content,
          embedding: `[${(batchEmbeddings[idx] || []).join(",")}]`,
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertErr } = await (supabase as any)
          .from("document_chunks")
          .insert(chunkRows);
        if (insertErr) throw insertErr;

        inserted += batchChunks.length;
      }
      console.log(`✅ Successfully embedded ${inserted} chunks for "${doc.title}"`);
    } catch (e) {
      console.error(`❌ Failed to process "${doc.title}":`, e);
    }
  }

  console.log("Backfill complete!");
}

backfill();
