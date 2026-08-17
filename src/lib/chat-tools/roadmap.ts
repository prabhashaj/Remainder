import { z } from "zod";
import { tool } from "ai";
import { wrapTool } from "./wrap-tool";
import type { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { runPlanner } from "@/lib/agents/planner.server";
import { writeLesson } from "@/lib/agents/curriculum.server";

export function getRoadmapTools(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  traceId: string,
  threadId: string | null,
  key: string,
) {
  return {
    delegateToPlanner: tool({
      description:
        "Delegate to the planning specialist to create NEW or UPDATE existing roadmaps, goals, or tasks in the user's workspace. The planner will build or restructure them.",
      inputSchema: z.object({
        instruction: z
          .string()
          .describe("What the planner should create, with all necessary details"),
      }),
      execute: async ({ instruction }: { instruction: string }) =>
        wrapTool(
          "delegateToPlanner",
          async () => {
            return runPlanner({ instruction, apiKey: key, supabase, userId, traceId });
          },
          supabase,
          userId,
          traceId,
          threadId,
          { instruction },
        ),
    }),

    readRoadmap: tool({
      description:
        "Read the full structure (phases, topics, subtopics) of a specific roadmap by its ID.",
      inputSchema: z.object({
        roadmap_id: z.string().describe("ID of the roadmap to read"),
      }),
      execute: async ({ roadmap_id }: { roadmap_id: string }) =>
        wrapTool(
          "readRoadmap",
          async () => {
            const { data: roadmap, error } = await supabase
              .from("roadmaps")
              .select("id,topic,summary")
              .eq("id", roadmap_id)
              .single();
            if (error) return { success: false, error: error.message };
            const { data: items } = await supabase
              .from("roadmap_items")
              .select("id,title,phase,parent_id,detail")
              .eq("roadmap_id", roadmap_id)
              .order("position");
            return { success: true, roadmap, items: items ?? [] };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { roadmap_id },
        ),
    }),

    writeLessonForSubtopic: tool({
      description:
        "Research and write the full lesson (markdown content, images, and videos) for one roadmap sub-topic, given its id.",
      inputSchema: z.object({
        item_id: z.string().describe("The roadmap sub-topic id"),
      }),
      execute: async ({ item_id }: { item_id: string }) =>
        wrapTool(
          "writeLessonForSubtopic",
          () => writeLesson({ itemId: item_id, apiKey: key, supabase, userId, traceId }),
          supabase,
          userId,
          traceId,
          threadId,
          { item_id },
        ),
    }),
  };
}
