/**
 * POST /api/upload-document
 *
 * Accepts multipart/form-data with:
 *   - file: the binary file (PDF, text, etc.)
 *   - Authorization header: Bearer <supabase-jwt>
 *
 * Handles large PDFs correctly — no base64 inflation, no chat-body size limit.
 * Uploads to Supabase Storage, extracts text, triggers chunking + embedding.
 * Returns { resourceId, title, pageCount, chars } on success.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { extractPdfTextServer } from "@/lib/pdf-parser.server";
import { saveDocumentTextAndEmbed } from "@/lib/document-processor.server";
import { log } from "@/lib/logger.server";
import { getRemainingLimitsServer } from "@/lib/limits";

/** Max upload size (bytes) for this route — enforced before calling Supabase */
const HARD_LIMIT_BYTES = 100 * 1024 * 1024; // 100 MB hard ceiling

export const Route = createFileRoute("/api/upload-document")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Auth ────────────────────────────────────────────────────────────
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient<Database>(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          },
        );

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        // ── Parse multipart ─────────────────────────────────────────────────
        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return new Response("Expected multipart/form-data", { status: 400 });
        }

        const fileField = formData.get("file");
        if (!fileField || !(fileField instanceof File)) {
          return new Response("Missing 'file' field", { status: 400 });
        }

        const file = fileField as File;
        const filename = file.name;
        const mime = file.type || "application/octet-stream";

        // ── Size limits ─────────────────────────────────────────────────────
        const limits = await getRemainingLimitsServer(supabase, userId);
        const planLimitBytes = limits.maxFileSizeMb * 1024 * 1024;
        const maxBytes = Math.min(planLimitBytes, HARD_LIMIT_BYTES);

        if (file.size > maxBytes) {
          return new Response(
            JSON.stringify({
              error: `File exceeds the ${limits.maxFileSizeMb} MB limit for your plan.`,
            }),
            { status: 413, headers: { "Content-Type": "application/json" } },
          );
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // ── Upload to Supabase Storage ───────────────────────────────────────
        const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/\.+/g, ".");
        const storagePath = `${userId}/${Date.now()}-${safeName}`;

        let { error: uploadErr } = await supabase.storage
          .from("materials")
          .upload(storagePath, buffer, { contentType: mime, upsert: true });

        if (
          uploadErr &&
          (uploadErr.message.includes("not found") ||
            uploadErr.message.includes("does not exist") ||
            uploadErr.message.includes("Bucket"))
        ) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.storage.createBucket("materials", { public: false });
          const retry = await supabase.storage
            .from("materials")
            .upload(storagePath, buffer, { contentType: mime, upsert: true });
          uploadErr = retry.error;
        }

        if (uploadErr) {
          log("error", "upload_document_storage_failed", {
            filename,
            error: uploadErr.message,
          });
          return new Response(JSON.stringify({ error: uploadErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        // ── Determine document kind ──────────────────────────────────────────
        const lower = filename.toLowerCase();
        let kind = "note";
        if (mime.startsWith("image/")) kind = "image";
        else if (mime === "application/pdf" || lower.endsWith(".pdf")) kind = "pdf";

        // ── Extract text ─────────────────────────────────────────────────────
        let extractedText = "";
        let pageCount: number | undefined;

        if (kind === "pdf") {
          extractedText = await extractPdfTextServer(buffer);
          // Count pages from "--- Page N ---" markers produced by unpdf
          const pageMatches = extractedText.match(/^--- Page \d+ ---/gm);
          pageCount = pageMatches ? pageMatches.length : undefined;
        } else if (kind === "note" || mime.startsWith("text/")) {
          extractedText = buffer.toString("utf-8");
        }

        // ── Insert study_resources row ───────────────────────────────────────
        const title = filename.replace(/\.[^.]+$/, "");
        const { data: insertedResource, error: insertErr } = await supabase
          .from("study_resources")
          .insert({
            user_id: userId,
            title,
            kind,
            storage_path: storagePath,
            mime_type: mime,
            extracted_text: extractedText || null,
            page_count: pageCount ?? null,
            status: "ready",
          })
          .select("id")
          .single();

        if (insertErr || !insertedResource) {
          log("error", "upload_document_resource_insert_failed", {
            filename,
            error: insertErr?.message ?? "no row returned",
          });
          return new Response(JSON.stringify({ error: "Failed to save document record" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const resourceId = insertedResource.id;

        // ── Background chunking + embedding ──────────────────────────────────
        if (extractedText && extractedText.trim().length > 0) {
          saveDocumentTextAndEmbed(supabase, resourceId, extractedText, pageCount, userId).catch(
            (e) => {
              log("error", "upload_document_embed_failed", {
                resourceId,
                error: String(e),
              });
            },
          );
        } else if (kind === "pdf") {
          // Log clearly so we know extraction produced nothing
          log("warn", "upload_document_no_text", {
            filename,
            resourceId,
            mime,
            bufferBytes: buffer.length,
          });
        }

        log("info", "upload_document_success", {
          resourceId,
          filename,
          kind,
          pageCount,
          chars: extractedText.length,
        });

        return new Response(
          JSON.stringify({
            resourceId,
            title,
            kind,
            pageCount: pageCount ?? null,
            chars: extractedText.length,
            hasText: extractedText.length > 0,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
