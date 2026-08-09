import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAiGatewayProvider, getAiModelName } from "@/lib/ai-gateway.server";
import { tavilySearch } from "@/lib/tavily.server";
import { log } from "@/lib/logger.server";
import type { Database } from "@/integrations/supabase/types";

const PLANNER_PROMPT = `You are the planning specialist inside Remainder, a calm productivity and learning workspace.
Your job: turn the user's request into concrete structure in their workspace — tasks, habits, goals, and deeply detailed learning roadmaps.

Roadmap quality bar (this is a production learning product, be thorough):
- 3-5 phases that progress from foundations to advanced/applied work
- Each phase has 3-6 topics
- Each topic has 3-6 concrete sub-topics naming the actual concepts to learn (not vague labels like "basics")
- Give every topic and sub-topic a one-line detail and a rough time estimate
- Cover practice/projects and common pitfalls, not just theory

Before planning an unfamiliar, fast-moving or technical topic, call webSearch once or twice to ground the curriculum in current best practice (2026), then plan.

Always use your tools to actually create things — don't just describe plans in prose. After creating, give a brief 2-3 sentence summary of the structure you built.`;

type Supabase = SupabaseClient<Database>;

const subtopicSchema = z.object({
  title: z.string().describe("The specific concept to learn"),
  detail: z.string().nullable().describe("One-line explanation, or null"),
  estimated_minutes: z.number().nullable().describe("Rough time estimate in minutes, or null"),
});

function createPlannerTools(supabase: Supabase, userId: string) {
  return {
    webSearch: tool({
      description:
        "Search the web for current, accurate information about a topic before planning.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }: { query: string }) => {
        const res = await tavilySearch(query, { maxResults: 5 });
        return {
          answer: res.answer,
          results: res.results.map((r) => ({
            title: r.title,
            url: r.url,
            content: r.content.slice(0, 400),
          })),
          error: res.error ?? null,
        };
      },
    }),

    createTask: tool({
      description: "Add a task to the user's to-do list.",
      inputSchema: z.object({
        title: z.string().describe("The task title"),
        due_date: z
          .string()
          .nullable()
          .describe("Due date in YYYY-MM-DD format, or null for no specific date"),
      }),
      execute: async ({ title, due_date }: { title: string; due_date: string | null }) => {
        const { data, error } = await supabase
          .from("tasks")
          .insert({ user_id: userId, title, due_date: due_date ?? null, source: "remi" })
          .select("id, title")
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, id: data.id, title: data.title };
      },
    }),

    createHabit: tool({
      description: "Create a new daily habit for the user to track.",
      inputSchema: z.object({
        title: z.string().describe("The habit name"),
        icon: z
          .enum([
            "sprout",
            "book",
            "code",
            "brain",
            "dumbbell",
            "droplet",
            "run",
            "music",
            "note",
            "language",
            "leaf",
            "sun",
            "moon",
            "timer",
            "spark",
            "file",
          ])
          .nullable()
          .describe("Icon key that best fits the habit, or null"),
        target_per_week: z
          .number()
          .nullable()
          .describe("Target completions per week, or null for daily (7)"),
      }),
      execute: async ({
        title,
        icon,
        target_per_week,
      }: {
        title: string;
        icon: string | null;
        target_per_week: number | null;
      }) => {
        const { data, error } = await supabase
          .from("habits")
          .insert({
            user_id: userId,
            title,
            icon: icon ?? "sprout",
            target_per_week: target_per_week ?? 7,
          })
          .select("id, title")
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, id: data.id, title: data.title };
      },
    }),

    createGoal: tool({
      description: "Create a long-term goal, optionally with milestones (smaller checkpoints).",
      inputSchema: z.object({
        title: z.string().describe("The goal title"),
        description: z.string().nullable().describe("A short description, or null"),
        target_date: z.string().nullable().describe("Target date in YYYY-MM-DD format, or null"),
        milestones: z
          .array(z.object({ title: z.string() }))
          .nullable()
          .describe("Optional list of milestone titles, or null"),
      }),
      execute: async ({
        title,
        description,
        target_date,
        milestones,
      }: {
        title: string;
        description: string | null;
        target_date: string | null;
        milestones: { title: string }[] | null;
      }) => {
        const { data: goal, error: gErr } = await supabase
          .from("goals")
          .insert({ user_id: userId, title, description, target_date })
          .select("id")
          .single();
        if (gErr) return { success: false, error: gErr.message };
        let milestoneCount = 0;
        if (milestones && milestones.length > 0) {
          const rows = milestones.map((m, i) => ({
            user_id: userId,
            goal_id: goal.id,
            title: m.title,
            position: i,
          }));
          const { error: mErr } = await supabase.from("milestones").insert(rows);
          if (mErr) return { success: false, error: mErr.message, goal_id: goal.id };
          milestoneCount = rows.length;
        }
        return { success: true, id: goal.id, title, milestones: milestoneCount };
      },
    }),

    createRoadmap: tool({
      description:
        "Create a detailed learning roadmap: phases -> topics -> sub-topics. Use whenever the user wants to learn a topic. Be thorough; each topic should have several named sub-topics.",
      inputSchema: z.object({
        topic: z.string().describe("What the user wants to learn"),
        summary: z
          .string()
          .nullable()
          .describe("A one- or two-line summary of the roadmap, or null"),
        phases: z
          .array(
            z.object({
              name: z.string().describe("Phase label, e.g. 'Phase 1: Foundations'"),
              topics: z
                .array(
                  z.object({
                    title: z.string().describe("A topic within this phase"),
                    detail: z
                      .string()
                      .nullable()
                      .describe("One-line explanation of the topic, or null"),
                    estimated_minutes: z
                      .number()
                      .nullable()
                      .describe("Rough time estimate in minutes, or null"),
                    subtopics: z
                      .array(subtopicSchema)
                      .describe("The specific concepts inside this topic"),
                  }),
                )
                .describe("Topics in this phase, in order"),
            }),
          )
          .describe("The phases of the roadmap, in order"),
      }),
      execute: async ({
        topic,
        summary,
        phases,
      }: {
        topic: string;
        summary: string | null;
        phases: {
          name: string;
          topics: {
            title: string;
            detail: string | null;
            estimated_minutes: number | null;
            subtopics: {
              title: string;
              detail: string | null;
              estimated_minutes: number | null;
            }[];
          }[];
        }[];
      }) => {
        const { data: roadmap, error: rErr } = await supabase
          .from("roadmaps")
          .insert({ user_id: userId, topic, summary })
          .select("id")
          .single();
        if (rErr) return { success: false, error: rErr.message };

        let topicCount = 0;
        let subCount = 0;

        for (const [pi, phase] of phases.entries()) {
          for (const [ti, t] of phase.topics.entries()) {
            const { data: parent, error: tErr } = await supabase
              .from("roadmap_items")
              .insert({
                user_id: userId,
                roadmap_id: roadmap.id,
                phase: phase.name,
                title: t.title,
                detail: t.detail,
                estimated_minutes: t.estimated_minutes,
                position: pi * 1000 + ti * 10,
              })
              .select("id")
              .single();
            if (tErr) continue;
            topicCount++;

            const subs = (t.subtopics ?? []).map((s, si) => ({
              user_id: userId,
              roadmap_id: roadmap.id,
              parent_id: parent.id,
              phase: phase.name,
              title: s.title,
              detail: s.detail,
              estimated_minutes: s.estimated_minutes,
              position: pi * 1000 + ti * 10 + (si + 1) / 100,
            }));
            if (subs.length > 0) {
              const { error: sErr } = await supabase.from("roadmap_items").insert(subs);
              if (!sErr) subCount += subs.length;
            }
          }
        }

        return {
          success: true,
          roadmap_id: roadmap.id,
          topic,
          phases: phases.length,
          topics: topicCount,
          subtopics: subCount,
        };
      },
    }),
  };
}

export async function runPlanner(params: {
  instruction: string;
  apiKey: string;
  supabase: Supabase;
  userId: string;
  traceId?: string;
}) {
  const gateway = createAiGatewayProvider(params.apiKey);
  const tools = createPlannerTools(params.supabase, params.userId);
  log(
    "info",
    "agent_start",
    { agent: "planner", instruction: params.instruction.slice(0, 200) },
    { userId: params.userId, traceId: params.traceId },
  );
  try {
    const result = await generateText({
      model: gateway(getAiModelName()),
      system: `${PLANNER_PROMPT}\n\nToday's date is: ${new Date().toISOString().split("T")[0]}.`,
      prompt: params.instruction,
      tools,
      stopWhen: stepCountIs(10),
    });
    return { summary: result.text };
  } catch (err) {
    log(
      "error",
      "agent_error",
      { agent: "planner", error: err instanceof Error ? err.message : String(err) },
      { userId: params.userId, traceId: params.traceId },
    );
    return {
      summary: `Planning failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}
