import { z } from "zod";
import { tool } from "ai";
import { wrapTool } from "./wrap-tool";
import type { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { runPlanner, runPlannerAgent, createPlannerTools } from "@/lib/agents/planner.server";
import { writeLesson } from "@/lib/agents/curriculum.server";

export function getRoadmapTools(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  traceId: string,
  threadId: string | null,
  key: string,
) {
  const plannerTools = createPlannerTools(supabase as any, userId);

  return {
    createRoadmap: tool({
      description:
        "Delegate to the specialized curriculum planning sub-agent to construct a complete, tailored learning roadmap with progressive phases, topics, and subtopics directly in the workspace. CRITICAL PROTOCOL: If the user simply requests a roadmap (e.g. 'Create a roadmap for LLMOps', 'Teach me Python') without having provided their experience level, target end goal, and weekly availability, YOU MUST NOT CALL THIS TOOL YET. First, reply in conversational text asking the 3 diagnostic questions. Only call createRoadmap AFTER the user answers those questions (or if they provided all 3 details upfront in their prompt).",
      inputSchema: z.object({
        topic: z.string().describe("The core topic, skill, subject, or technology to learn"),
        experience_level: z
          .string()
          .nullable()
          .optional()
          .describe(
            "The user's current background, familiarity, or starting experience level (e.g. beginner, intermediate, advanced, or specific prior stacks)",
          ),
        end_goal: z
          .string()
          .nullable()
          .optional()
          .describe(
            "The user's target outcome, project, career ambition, or milestone they want to achieve (e.g. land a job, build a production SaaS, exam prep)",
          ),
        time_commitment: z
          .string()
          .nullable()
          .optional()
          .describe(
            "The user's weekly availability, time commitment, or learning pace (e.g. 15 hours/week, 1 hour daily)",
          ),
        additional_context: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Any additional preferences, specific frameworks, tools, or project domains requested",
          ),
      }),
      execute: async (input) =>
        wrapTool(
          "createRoadmap",
          () =>
            runPlannerAgent({
              ...input,
              apiKey: key,
              supabase: supabase as any,
              userId,
              traceId,
            }),
          supabase,
          userId,
          traceId,
          threadId,
          input,
        ),
    }),
    updateRoadmap: plannerTools.updateRoadmap,

    delegateToPlanner: tool({
      description:
        "Delegate complex workspace planning tasks to the planner agent.",
      inputSchema: z.object({
        instruction: z
          .string()
          .describe(
            "Detailed instruction for the planner, including the topic, user's current experience level, target goal/project, and pace/timeline",
          ),
      }),
      execute: async ({ instruction }: { instruction: string }) =>
        wrapTool(
          "delegateToPlanner",
          async () => {
            return runPlanner({ instruction, apiKey: key, supabase: supabase as any, userId, traceId });
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
