import { createClient } from "@supabase/supabase-js";
import { saveDocumentTextAndEmbed } from "../src/lib/document-processor.server";
import { extractPdfTextServer } from "../src/lib/pdf-parser.server";
import process from "node:process";
import fs from "node:fs/promises";

const supabase = createClient(
  process.env["SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
);

async function fix() {
  console.log("Fetching documents with null extracted_text...");
  const { data: docs, error } = await supabase
    .from("study_resources")
    .select("id, title, storage_path, kind")
    .is("extracted_text", null);

  if (error || !docs) {
    console.error("Failed to fetch documents", error);
    return;
  }

  console.log(`Found ${docs.length} documents. Processing...`);

  for (const doc of docs) {
    console.log(`Processing "${doc.title}"...`);
    if (doc.kind === "pdf" && doc.storage_path) {
      const { data: fileData, error: downloadErr } = await supabase.storage
        .from("materials")
        .download(doc.storage_path);

      if (downloadErr || !fileData) {
        console.error(`Failed to download ${doc.title}:`, downloadErr);
        continue;
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      try {
        console.log(`Extracting text for ${doc.title}...`);
        const text = await extractPdfTextServer(buffer);
        console.log(`Extracted ${text.length} characters. Chunking and embedding...`);
        await saveDocumentTextAndEmbed(supabase, doc.id, text);
        console.log(`✅ Success for "${doc.title}"`);
      } catch (e) {
        console.error(`❌ Failed to extract/embed "${doc.title}":`, e);
      }
    }
  }

  console.log("Fix complete!");
}

fix();
