import { z } from "zod";
import { tool } from "ai";
import type { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { fetchYoutubeTranscript } from "@/lib/transcript.server";
import { tavilySearch, searchTopicPhotos, youtubeIdFromUrl } from "@/lib/tavily.server";
import { runNotebookAgent } from "@/lib/agents/notebook-agent.server";

export function getNotebookTools(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  traceId: string,
  key: string,
  activePageId: string | null,
) {
  return {
    generateNotebook: tool({
      description:
        "Generate a structured study notebook page in the workspace with native blocks (headings, text, quote callouts, checkable to-dos, dividers). Call this tool ONLY when the user explicitly asks to generate, create, or build a notebook or notes page.",
      inputSchema: z.object({
        topicOrUrl: z
          .string()
          .describe("Topic name OR YouTube video URL / ID to build the notebook from"),
        title: z.string().describe("Optional title for the notebook page"),
        include_images: z
          .boolean()
          .optional()
          .describe(
            "Set to true ONLY if the user explicitly asked for photos, images, or visual diagrams in the notebook. Defaults to false.",
          ),
      }),
      execute: async ({ topicOrUrl, title, include_images }) => {
        const { getRemainingLimitsServer } = await import("@/lib/limits");
        const limits = await getRemainingLimitsServer(supabase, userId);
        if (!limits.notebooks.canCreate) {
          return {
            limitReached: true,
            resource: "notebooks",
            limit: limits.notebooks.limit,
            summary: `Upgrade Required! You have reached your limit of ${limits.notebooks.limit} notebooks this week. Please tell the user to upgrade their subscription.`,
          };
        }

        const raw = topicOrUrl.trim();
        const directVideoId =
          youtubeIdFromUrl(raw) ?? (raw.length === 11 && !raw.includes(" ") ? raw : null);
        const notebookTitle = title ?? raw;

        let sourceMaterial = "";

        if (directVideoId) {
          // 1. Direct YouTube video provided
          const res = await fetchYoutubeTranscript(directVideoId);
          if (res.fullText) {
            sourceMaterial = `Source Video Transcript:\n${res.fullText}`;
          }
        }

        if (!sourceMaterial) {
          // 2. Search YouTube & Web via Tavily search API automatically!
          const [videoSearch, webSearch] = await Promise.all([
            tavilySearch(`${raw} youtube tutorial video`, { maxResults: 5 }),
            tavilySearch(`${raw} comprehensive explanation overview guide`, {
              maxResults: 5,
            }),
          ]);

          // Try extracting transcript from top video result
          const videoResult = videoSearch.results.find((r) => youtubeIdFromUrl(r.url));
          if (videoResult) {
            const vid = youtubeIdFromUrl(videoResult.url);
            if (vid) {
              const res = await fetchYoutubeTranscript(vid);
              if (res.fullText) {
                sourceMaterial = `Source Video: ${videoResult.title} (${videoResult.url})\n\nVideo Transcript:\n${res.fullText}\n\n`;
              }
            }
          }

          // Compile web research context
          const researchContext = [
            videoSearch.answer ? `Search Answer: ${videoSearch.answer}` : "",
            webSearch.answer ? `Summary: ${webSearch.answer}` : "",
            ...webSearch.results.map((r) => `### ${r.title}\nURL: ${r.url}\n${r.content}`),
          ]
            .filter(Boolean)
            .join("\n\n");

          sourceMaterial += `Research Context on "${raw}":\n${researchContext}`;
        }

        const { data: page, error: pageErr } = await supabase
          .from("pages")
          .insert({
            user_id: userId,
            title: `${notebookTitle} — Notebook`,
            icon: "📒",
          })
          .select("id")
          .single();

        if (pageErr || !page) {
          return {
            success: false,
            error: pageErr?.message ?? "Failed to create page.",
          };
        }

        const agentResult = await runNotebookAgent({
          pageId: page.id,
          sourceMaterial,
          topicTitle: notebookTitle,
          apiKey: key,
          supabase,
          userId,
          includeImages: Boolean(include_images),
          traceId,
        });

        const { getCurrentWeekStart } = await import("@/lib/limits");
        await supabase.from("usage_logs").upsert(
          {
            user_id: userId,
            week_start_date: getCurrentWeekStart(),
            notebooks_created: limits.notebooks.used + 1,
          },
          { onConflict: "user_id, week_start_date" },
        );

        return {
          success: true,
          pageId: page.id,
          blockCount: agentResult.blockCount,
          message: `Successfully generated study notebook page for "${notebookTitle}" with ${agentResult.blockCount} native blocks! Page ID: ${page.id}`,
        };
      },
    }),

    editNotebook: tool({
      description:
        "Edit an existing notebook page, append content, or search the web and add visual diagrams/images to the end of the notebook. Call this tool whenever the user asks to add images to a notebook, edit notes, or append sections to a notebook page.",
      inputSchema: z.object({
        page_id: z
          .string()
          .optional()
          .describe(
            "The notebook page ID to edit. If omitted, automatically targets the user's most recent notebook page.",
          ),
        topic_or_query: z
          .string()
          .describe("The topic name or visual query to search images/diagrams for"),
        action: z
          .enum(["add_images", "append_content", "add_section"])
          .default("add_images")
          .describe("The notebook edit action to perform"),
        content: z
          .string()
          .optional()
          .describe("Optional text content to append if adding a text section"),
      }),
      execute: async ({
        page_id,
        topic_or_query,
        action,
        content,
      }: {
        page_id?: string | undefined;
        topic_or_query: string;
        action: "add_images" | "append_content" | "add_section";
        content?: string | undefined;
      }) => {
        let targetPageId = page_id || (activePageId ? activePageId : undefined);

        if (!targetPageId && topic_or_query) {
          // 1. First try matching page by exact or fuzzy title
          const cleanTopic = topic_or_query
            .replace(/diagrams?|workflows?|images?|photos?|notebook/gi, "")
            .trim();
          const { data: titleMatches } = await supabase
            .from("pages")
            .select("id, title")
            .eq("user_id", userId)
            .ilike("title", `%${cleanTopic || topic_or_query}%`)
            .order("updated_at", { ascending: false })
            .limit(1);

          if (titleMatches && titleMatches.length > 0 && titleMatches[0]?.id) {
            targetPageId = titleMatches[0].id;
          }
        }

        if (!targetPageId) {
          // 2. Fallback to user's most recently updated notebook page
          const { data: pages } = await supabase
            .from("pages")
            .select("id, title")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1);

          if (pages && pages.length > 0 && pages[0]?.id) {
            targetPageId = pages[0].id;
          }
        }

        if (!targetPageId) {
          // 3. Create notebook page if none exists
          const { data: newPage, error: createErr } = await supabase
            .from("pages")
            .insert({
              user_id: userId,
              title: `${topic_or_query} — Notebook`,
              icon: "📒",
            })
            .select("id")
            .single();

          if (createErr || !newPage) {
            return { success: false, error: "No notebook page found to edit." };
          }
          targetPageId = newPage.id;
        }

        const { data: existingBlocks } = await supabase
          .from("blocks")
          .select("position")
          .eq("page_id", targetPageId)
          .order("position", { ascending: false })
          .limit(1);

        const lastPos =
          existingBlocks && existingBlocks.length > 0 ? (existingBlocks[0]?.position ?? -1) : -1;
        let nextPos = lastPos + 1;
        let addedCount = 0;
        let imageCount = 0;

        if (action === "add_images" || topic_or_query) {
          const rawPhotos = await searchTopicPhotos(topic_or_query);
          const photos = rawPhotos.slice(0, 4);

          if (photos.length > 0) {
            await supabase.from("blocks").insert({
              page_id: targetPageId,
              user_id: userId,
              type: "divider",
              content: "",
              checked: false,
              position: nextPos++,
            });
            addedCount++;

            await supabase.from("blocks").insert({
              page_id: targetPageId,
              user_id: userId,
              type: "heading",
              content: `Visual Reference & Diagrams — ${topic_or_query}`,
              checked: false,
              position: nextPos++,
            });
            addedCount++;

            for (const img of photos) {
              const caption = img.description || `${topic_or_query} diagram`;
              await supabase.from("blocks").insert({
                page_id: targetPageId,
                user_id: userId,
                type: "text",
                content: `![${caption}](${img.url})`,
                checked: false,
                position: nextPos++,
              });
              imageCount++;
              addedCount++;
            }
          }
        }

        if (content) {
          await supabase.from("blocks").insert({
            page_id: targetPageId,
            user_id: userId,
            type: "text",
            content,
            checked: false,
            position: nextPos++,
          });
          addedCount++;
        }

        await supabase
          .from("pages")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", targetPageId);

        return {
          success: true,
          pageId: targetPageId,
          imageCount,
          blocksAdded: addedCount,
          message: `Successfully updated notebook page (ID: ${targetPageId}) with ${imageCount} visual diagram(s) (${addedCount} blocks total).`,
        };
      },
    }),
  };
}
