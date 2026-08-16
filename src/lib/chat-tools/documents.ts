import { z } from "zod";
import { tool } from "ai";
import { wrapTool } from "./wrap-tool";
import type { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { generateEmbedding } from "@/lib/embeddings.server";
import { saveDocumentTextAndEmbed } from "@/lib/document-processor.server";
import { log } from "@/lib/logger.server";

/** Documents with more than this many chunks are treated as "large" — full-text
 *  injection is skipped in favour of pure semantic retrieval. */
const LARGE_DOC_CHUNK_THRESHOLD = 20;

/** How many semantically-similar chunks to return for large documents */
const SEMANTIC_TOP_K_LARGE = 15;

/** How many chunks to return for small documents (also via semantic if query given) */
const SEMANTIC_TOP_K_SMALL = 10;

/** Max chars of full extracted text to return inline for small documents (no query) */
const SMALL_DOC_INLINE_CHARS = 40_000;

export function getDocumentTools(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  traceId: string,
  threadId: string | null,
) {
  return {
    readDocument: tool({
      description:
        "Read the contents, summary, and key points of a document/study resource from the workspace.",
      inputSchema: z.object({
        document_id: z
          .string()
          .describe(
            "The EXACT Document ID (UUID format) from the 'Documents available in workspace' list (e.g., '123e4567-e89b...'). NEVER use the title.",
          ),
        query: z
          .string()
          .optional()
          .describe(
            "The specific topic, question, or chapter you are looking for in the document (e.g., 'Chapter 2 summary' or 'methodology'). Always provide this when the user asks a specific question — it enables precise semantic search over the document chunks.",
          ),
      }),
      execute: async ({ document_id, query }) =>
        wrapTool(
          "readDocument",
          async () => {
            const cleanInput = document_id.trim();
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              cleanInput,
            );

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let bestDoc: any = null;

            // 1. Try exact UUID match first
            if (isUuid) {
              const { data: exactDoc } = await supabase
                .from("study_resources")
                .select(
                  "id, title, kind, status, summary, key_points, extracted_text, storage_path",
                )
                .eq("id", cleanInput)
                .single();

              if (exactDoc) {
                bestDoc = exactDoc;
              }
            }

            // 2. Fetch all user's study resources to find best title match if UUID match failed
            if (!bestDoc) {
              const { data: allDocs } = await supabase
                .from("study_resources")
                .select(
                  "id, title, kind, status, summary, key_points, extracted_text, storage_path",
                )
                .order("created_at", { ascending: false })
                .limit(50);

              if (!allDocs || allDocs.length === 0) {
                return { success: false, error: `No documents available in workspace.` };
              }

              // Strip filler words from input: "rmit_sop document" -> "rmitsop"
              const normalize = (str: string) =>
                str
                  .toLowerCase()
                  .replace(/_|-/g, " ")
                  .replace(/\b(document|pdf|file|book|notes|resource|section)\b/gi, "")
                  .replace(/[^\w\s]/g, "")
                  .trim();

              const searchNormalized = normalize(cleanInput);

              // Find best matching document
              bestDoc = allDocs.find((d) => normalize(d.title) === searchNormalized);

              if (!bestDoc) {
                // Partial keyword match
                const keywords = searchNormalized.split(/\s+/).filter((k) => k.length > 1);
                bestDoc = allDocs.find((d) => {
                  const docNorm = normalize(d.title);
                  return (
                    keywords.some((k) => docNorm.includes(k)) ||
                    docNorm.split(/\s+/).some((k) => searchNormalized.includes(k))
                  );
                });
              }

              if (!bestDoc) {
                return {
                  success: false,
                  error: `Could not match document '${document_id}'. Available documents: ${allDocs
                    .map((d: { title: string }) => `"${d.title}"`)
                    .join(", ")}`,
                };
              }
            }

            const doc = bestDoc;

            // 3. On-demand text extraction & chunking if document text was not extracted yet
            if (
              (!doc.extracted_text || doc.extracted_text.trim().length === 0) &&
              doc.storage_path
            ) {
              try {
                let fileData: Blob | null = null;
                let dlErr: Error | null = null;

                const { data: dData, error: dErr } = await supabase.storage
                  .from("materials")
                  .download(doc.storage_path);

                if (!dErr && dData) {
                  fileData = dData;
                } else {
                  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
                  const { data: adminData, error: adminErr } = await supabaseAdmin.storage
                    .from("materials")
                    .download(doc.storage_path);
                  if (!adminErr && adminData) {
                    fileData = adminData;
                  } else {
                    dlErr = adminErr
                      ? new Error(adminErr.message)
                      : dErr
                        ? new Error(dErr.message)
                        : null;
                  }
                }

                if (fileData && !dlErr) {
                  const buffer = Buffer.from(await fileData.arrayBuffer());
                  let text = "";
                  const isPdf =
                    doc.storage_path.toLowerCase().endsWith(".pdf") || doc.kind === "pdf";
                  if (isPdf) {
                    const { extractPdfTextServer } = await import("@/lib/pdf-parser.server");
                    text = await extractPdfTextServer(buffer);
                  }
                  if (!text || text.trim().length === 0) {
                    const raw = buffer.toString("utf-8");
                    if (!/\0/.test(raw.slice(0, 1000))) {
                      text = raw;
                    }
                  }

                  if (text && text.trim().length > 0) {
                    doc.extracted_text = text;
                    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
                    void saveDocumentTextAndEmbed(supabaseAdmin, doc.id, text, undefined, userId);
                  }
                }
              } catch (extErr) {
                log("warn", "read_document_ondemand_failed", { error: String(extErr) });
              }
            }

            // 4. Count stored chunks to determine large-doc path
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { count: chunkCount } = await (supabase as any)
              .from("document_chunks")
              .select("id", { count: "exact", head: true })
              .eq("document_id", doc.id);

            const isLargeDoc = (chunkCount ?? 0) >= LARGE_DOC_CHUNK_THRESHOLD;
            const topK = isLargeDoc ? SEMANTIC_TOP_K_LARGE : SEMANTIC_TOP_K_SMALL;

            // 5. Semantic search — always used when a query is provided
            let semanticContext: string | null = null;
            if (query && query.trim()) {
              try {
                const queryEmbedding = await generateEmbedding(query.trim());

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: rawChunks, error: matchErr } = await (supabase as any).rpc(
                  "match_document_chunks",
                  {
                    query_embedding: `[${queryEmbedding.join(",")}]`,
                    match_threshold: 0.15,
                    match_count: topK,
                    filter_document_id: doc.id,
                  },
                );

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const chunks = rawChunks as any[] | null;
                if (!matchErr && chunks && chunks.length > 0) {
                  semanticContext = chunks
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((c: any, i: number) => {
                      const pageTag = c.page_number ? ` (p. ${c.page_number})` : "";
                      return `--- CHUNK ${i + 1}${pageTag} ---\n${c.content}`;
                    })
                    .join("\n\n");
                }
              } catch (e) {
                log(
                  "error",
                  "embedding_failed_for_query",
                  { error: String(e) },
                  { userId, traceId },
                );
              }
            }

            // 6. Build return text
            let returnedText = "";

            if (semanticContext) {
              returnedText += "--- RELEVANT CHUNKS FOR YOUR QUERY ---\n" + semanticContext + "\n\n";
            }

            if (!isLargeDoc) {
              // Small document: include full text inline (helps with open-ended questions)
              if (doc.extracted_text) {
                returnedText +=
                  "--- FULL DOCUMENT CONTENT ---\n" +
                  doc.extracted_text.slice(0, SMALL_DOC_INLINE_CHARS);
              } else if (!semanticContext) {
                // Fallback: fetch stored chunks directly
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: dbChunks } = await (supabase as any)
                  .from("document_chunks")
                  .select("content, page_number")
                  .eq("document_id", doc.id)
                  .order("id", { ascending: true })
                  .limit(60);

                if (dbChunks && dbChunks.length > 0) {
                  returnedText +=
                    "--- STORED DOCUMENT CHUNKS ---\n" +
                    dbChunks
                      .map(
                        (c: { content: string; page_number?: number | null }, i: number) => {
                          const pageTag = c.page_number ? ` (p. ${c.page_number})` : "";
                          return `--- CHUNK ${i + 1}${pageTag} ---\n${c.content}`;
                        },
                      )
                      .join("\n\n");
                }
              }
            } else {
              // Large document: only semantic chunks are returned.
              // If no query was provided, return first N chunks so the model can orient itself.
              if (!semanticContext) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: firstChunks } = await (supabase as any)
                  .from("document_chunks")
                  .select("content, page_number")
                  .eq("document_id", doc.id)
                  .order("id", { ascending: true })
                  .limit(SEMANTIC_TOP_K_LARGE);

                if (firstChunks && firstChunks.length > 0) {
                  returnedText +=
                    "--- DOCUMENT OPENING (first chunks) ---\n" +
                    firstChunks
                      .map(
                        (c: { content: string; page_number?: number | null }, i: number) => {
                          const pageTag = c.page_number ? ` (p. ${c.page_number})` : "";
                          return `--- CHUNK ${i + 1}${pageTag} ---\n${c.content}`;
                        },
                      )
                      .join("\n\n");
                  returnedText +=
                    "\n\n[This is a large document. Provide a specific query to search deeper.]";
                }
              }
            }

            log(
              "info",
              "read_document_executed",
              {
                docId: doc.id,
                isLargeDoc,
                chunkCount: chunkCount ?? 0,
                semanticUsed: !!semanticContext,
                returnedChars: returnedText.length,
              },
              { userId, traceId },
            );

            return {
              success: true,
              document_id: doc.id,
              title: doc.title,
              kind: doc.kind,
              status: doc.status,
              summary: doc.summary,
              key_points: doc.key_points,
              extracted_text: returnedText || "Document exists but contains no text content.",
              semantic_search_used: !!semanticContext,
              is_large_document: isLargeDoc,
              total_chunks: chunkCount ?? 0,
              citation_note: `Source: "${doc.title}" (document_id: ${doc.id}). Page numbers are tagged as "(p. N)" in the chunk headers above. Always cite the page number when referencing specific content.`,
            };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { document_id, query },
        ),
    }),
  };
}
