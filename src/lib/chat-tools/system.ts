import { z } from "zod";
import { tool } from "ai";
import { wrapTool } from "./wrap-tool";
import type { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function getSystemTools(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  traceId: string,
  threadId: string | null,
) {
  return {
    saveMemory: tool({
      description:
        "Store or update a permanent user preference, communication style, response format, background fact, goal, or ambition in their workspace profile. You MUST call this whenever the user expresses how they want you to answer, teach, or format responses (e.g. passage/storytelling style, concise, etc.), or mentions their personal background or goals. If the preference replaces or updates an earlier one, it updates the existing record.",
      inputSchema: z.object({
        content: z.string().describe("The preference, ambition, interest, skill, goal, or accomplishment to remember"),
        category: z
          .enum(["preference", "ambition", "interest", "skill", "goal", "accomplishment", "fact", "learning_style"])
          .nullable()
          .describe("Category of memory"),
        importance: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe(
            "Importance score from 1 to 10 (10 = core non-negotiable preference or high-impact constraint, 5 = standard preference/interest, 1 = casual passing note). Defaults to 5 if omitted.",
          ),
        replace_memory_id: z
          .string()
          .optional()
          .describe("Optional ID of an existing memory that this new preference supersedes or replaces."),
      }),
      execute: async ({ content, category, importance, replace_memory_id }) =>
        wrapTool(
          "saveMemory",
          async () => {
            const cat = category ?? "fact";
            const imp = typeof importance === "number" ? Math.min(10, Math.max(1, importance)) : 5;

            // If an explicit replace_memory_id was provided, update that memory directly
            if (replace_memory_id) {
              const { data: updated, error: updateErr } = await supabase
                .from("agent_memories")
                .update({ content, category: cat, importance: imp, updated_at: new Date().toISOString() })
                .eq("id", replace_memory_id)
                .eq("user_id", userId)
                .select("id")
                .maybeSingle();

              if (!updateErr && updated) {
                const { invalidateUserContextCache } = await import("@/lib/user-context-cache.server");
                invalidateUserContextCache(userId);
                return { success: true, id: updated.id, action: "updated" };
              }
            }

            // Automatic deduplication / conflict detection for preference and learning_style categories
            if (cat === "preference" || cat === "learning_style") {
              const { data: existingList } = await supabase
                .from("agent_memories")
                .select("id, content")
                .eq("user_id", userId)
                .eq("category", cat)
                .limit(10);

              if (existingList && existingList.length > 0) {
                // Check if any existing memory shares significant word tokens with the new memory
                const newTokens = new Set(
                  content
                    .toLowerCase()
                    .split(/\W+/)
                    .filter((w) => w.length >= 4),
                );
                const match = existingList.find((ex) => {
                  const exTokens = ex.content
                    .toLowerCase()
                    .split(/\W+/)
                    .filter((w) => w.length >= 4);
                  const overlap = exTokens.filter((t) => newTokens.has(t)).length;
                  return overlap >= 2 || ex.content.toLowerCase().includes(content.toLowerCase().slice(0, 20));
                });

                if (match) {
                  const { data: updated, error: updateErr } = await supabase
                    .from("agent_memories")
                    .update({ content, importance: imp, updated_at: new Date().toISOString() })
                    .eq("id", match.id)
                    .eq("user_id", userId)
                    .select("id")
                    .single();

                  if (!updateErr && updated) {
                    const { invalidateUserContextCache } = await import("@/lib/user-context-cache.server");
                    invalidateUserContextCache(userId);
                    return { success: true, id: updated.id, action: "updated_duplicate" };
                  }
                }
              }
            }

            // Otherwise insert as new memory
            const { data, error } = await supabase
              .from("agent_memories")
              .insert({ user_id: userId, content, category: cat, importance: imp })
              .select("id")
              .single();
            if (error) return { success: false, error: error.message };
            const { invalidateUserContextCache } = await import("@/lib/user-context-cache.server");
            invalidateUserContextCache(userId);
            return { success: true, id: data.id, action: "created" };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { content: content.slice(0, 200), category, importance: impScore(importance) },
        ),
    }),

    updateMemory: tool({
      description: "Update the content, importance, or category of an existing user memory.",
      inputSchema: z.object({
        memory_id: z.string().describe("ID of the memory to update"),
        content: z.string().describe("New text content for the memory"),
        category: z
          .enum(["preference", "ambition", "interest", "skill", "goal", "accomplishment", "fact", "learning_style"])
          .optional()
          .describe("Updated category"),
        importance: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe("Updated importance score 1-10"),
      }),
      execute: async ({ memory_id, content, category, importance }) =>
        wrapTool(
          "updateMemory",
          async () => {
            const updates: {
              content?: string;
              category?: string;
              importance?: number;
              updated_at?: string;
            } = {
              content,
              updated_at: new Date().toISOString(),
            };
            if (category) updates.category = category;
            if (typeof importance === "number") {
              updates.importance = Math.min(10, Math.max(1, importance));
            }

            const { data, error } = await supabase
              .from("agent_memories")
              .update(updates)
              .eq("id", memory_id)
              .eq("user_id", userId)
              .select("id, content, importance")
              .maybeSingle();

            if (error) return { success: false, error: error.message };
            if (!data) return { success: false, error: "Memory not found or unauthorized" };

            const { invalidateUserContextCache } = await import("@/lib/user-context-cache.server");
            invalidateUserContextCache(userId);
            return { success: true, memory: data };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { memory_id, content: content.slice(0, 100), importance },
        ),
    }),

    forgetMemory: tool({
      description: "Delete an outdated, obsolete, or contradicted memory from the user's workspace profile.",
      inputSchema: z.object({
        memory_id: z.string().describe("ID of the memory to delete"),
      }),
      execute: async ({ memory_id }) =>
        wrapTool(
          "forgetMemory",
          async () => {
            const { error } = await supabase
              .from("agent_memories")
              .delete()
              .eq("id", memory_id)
              .eq("user_id", userId);

            if (error) return { success: false, error: error.message };

            const { invalidateUserContextCache } = await import("@/lib/user-context-cache.server");
            invalidateUserContextCache(userId);
            return { success: true, deleted_id: memory_id };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { memory_id },
        ),
    }),

    getCurrentTime: tool({
      description:
        "Get the current date and time for a specific timezone. You MUST provide a valid IANA Time Zone Database name (e.g., 'Asia/Kolkata', 'America/New_York'). Do NOT use abbreviations like 'IST' or country names like 'India'.",
      inputSchema: z.object({
        timezone: z
          .string()
          .optional()
          .describe(
            "Valid IANA timezone string (e.g., 'Asia/Kolkata', 'Europe/London'). Defaults to UTC if omitted.",
          ),
      }),
      execute: async ({ timezone }) => {
        const now = new Date();
        const tz = timezone || "UTC";
        try {
          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            dateStyle: "full",
            timeStyle: "long",
          });
          return {
            timezone: tz,
            formattedTime: formatter.format(now),
            iso: now.toISOString(),
          };
        } catch (err) {
          // Fallback if timezone is invalid
          return {
            error: `Invalid timezone provided: "${tz}". You MUST use a valid IANA timezone name (e.g., 'Asia/Kolkata', 'Europe/Paris', 'America/Los_Angeles').`,
            utcTime: now.toISOString(),
          };
        }
      },
    }),
  };
}

function impScore(val?: number): number {
  return typeof val === "number" ? Math.min(10, Math.max(1, val)) : 5;
}
