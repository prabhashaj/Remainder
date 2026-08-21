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
        "Store a permanent user preference, communication style, response format, background fact, goal, or ambition in their workspace profile. You MUST call this whenever the user expresses how they want you to answer, teach, or format responses (e.g. passage/storytelling style, concise, etc.), or mentions their personal background or goals.",
      inputSchema: z.object({
        content: z.string().describe("The preference, ambition, interest, skill, goal, or accomplishment to remember"),
        category: z
          .enum(["preference", "ambition", "interest", "skill", "goal", "accomplishment", "fact", "learning_style"])
          .nullable()
          .describe("Category of memory"),
      }),
      execute: async ({ content, category }: { content: string; category: string | null }) =>
        wrapTool(
          "saveMemory",
          async () => {
            const { data, error } = await supabase
              .from("agent_memories")
              .insert({ user_id: userId, content, category: category ?? "fact" })
              .select("id")
              .single();
            if (error) return { success: false, error: error.message };
            const { invalidateUserContextCache } = await import("@/lib/user-context-cache.server");
            invalidateUserContextCache(userId);
            return { success: true, id: data.id };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { content: content.slice(0, 200), category },
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
