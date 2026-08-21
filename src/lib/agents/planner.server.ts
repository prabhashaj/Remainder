import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAiGatewayProvider, getAiModelName } from "@/lib/ai-gateway.server";
import { tavilySearch } from "@/lib/tavily.server";
import { log } from "@/lib/logger.server";
import type { Database } from "@/integrations/supabase/types";

const PLANNER_PROMPT = `You are the planning specialist inside Remispace, a calm productivity and learning workspace.
Your job: turn the user's request into concrete structure in their workspace — tasks, goals, and deeply detailed learning roadmaps. You can create NEW ones or UPDATE existing ones.

Curriculum Personalization & Adaptation:
- Pay close attention to any user capabilities, prior experience, and specific target goals included in the instruction.
- Calibrate the starting point, depth, pace, and topic structure accordingly:
  * For beginners: start with fundamental concepts, core vocabulary, and gentle hands-on exercises.
  * For intermediate/advanced learners: skip elementary syntax, and dive straight into advanced patterns, architecture, specialized topics, and real-world projects.
  * Align the final phase with the user's specific end goals (e.g. job preparation, building a specific project, research, or exam prep).

Roadmap quality bar (this is a production learning product, be thorough):
- 3-5 phases that progress from foundations to advanced/applied work
- Each phase has 3-6 topics
- Each topic has 3-6 concrete sub-topics naming the actual concepts to learn (not vague labels like "basics")
- Give every topic and sub-topic a one-line detail and a rough time estimate
- Cover practice/projects and common pitfalls, not just theory

Before planning an unfamiliar, fast-moving or technical topic, call webSearch once or twice to ground the curriculum in current best practice (2026), then plan.

Always use your tools to actually create things — don't just describe plans in prose. After creating, give a brief 2-3 sentence summary of the structure you built.
NO EMOJIS: Do NOT use emojis anywhere in your summaries, descriptions, roadmap titles, topic names, tasks, or text. Keep everything completely emoji-free.`;

type Supabase = SupabaseClient<Database>;

const subtopicSchema = z.object({
  title: z.string().describe("The specific concept to learn"),
  detail: z.string().nullable().optional().describe("One-line explanation, or null"),
  estimated_minutes: z
    .number()
    .nullable()
    .optional()
    .describe("Rough time estimate in minutes, or null"),
});

export function createPlannerTools(supabase: Supabase, userId: string) {
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
          .optional()
          .describe("Due date in YYYY-MM-DD format, or null for no specific date"),
      }),
      execute: async ({
        title,
        due_date,
      }: {
        title: string;
        due_date?: string | null | undefined;
      }) => {
        const { data, error } = await supabase
          .from("tasks")
          .insert({ user_id: userId, title, due_date: due_date ?? null, source: "remi" })
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
        description: z.string().nullable().optional().describe("A short description, or null"),
        target_date: z
          .string()
          .nullable()
          .optional()
          .describe("Target date in YYYY-MM-DD format, or null"),
        milestones: z
          .array(z.object({ title: z.string() }))
          .nullable()
          .optional()
          .describe("Optional list of milestone titles, or null"),
      }),
      execute: async ({
        title,
        description,
        target_date,
        milestones,
      }: {
        title: string;
        description?: string | null | undefined;
        target_date?: string | null | undefined;
        milestones?: { title: string }[] | null | undefined;
      }) => {
        const { data: goal, error: gErr } = await supabase
          .from("goals")
          .insert({
            user_id: userId,
            title,
            description: description ?? null,
            target_date: target_date ?? null,
          })
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

    updateGoal: tool({
      description:
        "Update an existing goal's title, description, target date, progress percentage, or status.",
      inputSchema: z.object({
        goal_id: z.string().describe("ID or title of the goal to update"),
        title: z.string().optional().describe("New title"),
        description: z.string().nullable().optional().describe("New description, or null"),
        target_date: z.string().nullable().optional().describe("Target date YYYY-MM-DD, or null"),
        progress: z.number().min(0).max(100).optional().describe("Progress percentage (0-100)"),
        status: z.enum(["active", "done", "archived"]).optional().describe("Goal status"),
      }),
      execute: async ({
        goal_id,
        title,
        description,
        target_date,
        progress,
        status,
      }: {
        goal_id: string;
        title?: string | undefined;
        description?: string | null | undefined;
        target_date?: string | null | undefined;
        progress?: number | undefined;
        status?: "active" | "done" | "archived" | undefined;
      }) => {
        let targetId = goal_id;
        const { data: byId } = await supabase
          .from("goals")
          .select("id")
          .eq("id", goal_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (byId) {
          targetId = byId.id;
        } else {
          const { data: allGoals } = await supabase
            .from("goals")
            .select("id, title")
            .eq("user_id", userId);
          const norm = goal_id.toLowerCase().trim();
          const match = (allGoals ?? []).find(
            (g) =>
              g.id === goal_id ||
              g.title.toLowerCase().trim() === norm ||
              g.title.toLowerCase().includes(norm),
          );
          if (match) {
            targetId = match.id;
          } else {
            return { success: false, error: `Goal matching '${goal_id}' not found.` };
          }
        }
        const patch: Database["public"]["Tables"]["goals"]["Update"] = {};
        if (title !== undefined) patch.title = title;
        if (description !== undefined) patch.description = description;
        if (target_date !== undefined) patch.target_date = target_date;
        if (progress !== undefined) patch.progress = progress;
        if (status !== undefined) patch.status = status;
        const { data: updated, error } = await supabase
          .from("goals")
          .update(patch)
          .eq("id", targetId)
          .eq("user_id", userId)
          .select("*")
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, id: updated.id, title: updated.title };
      },
    }),

    addMilestone: tool({
      description: "Add milestone(s) to an existing goal.",
      inputSchema: z.object({
        goal_id: z.string().describe("ID or title of the goal to add milestone(s) to"),
        title: z.string().optional().describe("Single milestone title to add"),
        milestones: z
          .array(z.object({ title: z.string() }))
          .optional()
          .describe("List of milestone titles to add"),
      }),
      execute: async ({
        goal_id,
        title,
        milestones,
      }: {
        goal_id: string;
        title?: string | undefined;
        milestones?: { title: string }[] | undefined;
      }) => {
        let targetId = goal_id;
        let targetGoalTitle = goal_id;
        const { data: byId } = await supabase
          .from("goals")
          .select("id, title")
          .eq("id", goal_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (byId) {
          targetId = byId.id;
          targetGoalTitle = byId.title;
        } else {
          const { data: allGoals } = await supabase
            .from("goals")
            .select("id, title")
            .eq("user_id", userId);
          const norm = goal_id.toLowerCase().trim();
          const match = (allGoals ?? []).find(
            (g) =>
              g.id === goal_id ||
              g.title.toLowerCase().trim() === norm ||
              g.title.toLowerCase().includes(norm),
          );
          if (match) {
            targetId = match.id;
            targetGoalTitle = match.title;
          } else {
            return { success: false, error: `Goal matching '${goal_id}' not found.` };
          }
        }

        const titlesToAdd: string[] = [];
        if (title && title.trim()) titlesToAdd.push(title.trim());
        if (milestones && milestones.length > 0) {
          for (const m of milestones) {
            if (m.title && m.title.trim()) titlesToAdd.push(m.title.trim());
          }
        }
        if (titlesToAdd.length === 0)
          return { success: false, error: "No milestone title provided." };

        const { data: existingMs } = await supabase
          .from("milestones")
          .select("id, done, position")
          .eq("goal_id", targetId)
          .order("position", { ascending: true });

        const startPos = (existingMs ?? []).length;
        const rows = titlesToAdd.map((t, i) => ({
          user_id: userId,
          goal_id: targetId,
          title: t,
          position: startPos + i,
          done: false,
        }));

        const { data: inserted, error: mErr } = await supabase
          .from("milestones")
          .insert(rows)
          .select("id, title");

        if (mErr) return { success: false, error: mErr.message };

        const totalCount = (existingMs ?? []).length + (inserted ?? []).length;
        const doneCount = (existingMs ?? []).filter((m) => m.done).length;
        const newProgress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

        await supabase
          .from("goals")
          .update({ progress: newProgress, status: newProgress === 100 ? "done" : "active" })
          .eq("id", targetId);

        return {
          success: true,
          goal_id: targetId,
          goal_title: targetGoalTitle,
          added: (inserted ?? []).map((m) => m.title),
        };
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
          .optional()
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
                      .optional()
                      .describe("One-line explanation of the topic, or null"),
                    estimated_minutes: z
                      .number()
                      .nullable()
                      .optional()
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
        summary?: string | null | undefined;
        phases: {
          name: string;
          topics: {
            title: string;
            detail?: string | null | undefined;
            estimated_minutes?: number | null | undefined;
            subtopics: {
              title: string;
              detail?: string | null | undefined;
              estimated_minutes?: number | null | undefined;
            }[];
          }[];
        }[];
      }) => {
        const { getRemainingLimitsServer, getCurrentWeekStart } = await import("@/lib/limits");
        const limits = await getRemainingLimitsServer(supabase, userId);
        if (!limits.roadmaps.canCreate) {
          return {
            limitReached: true,
            resource: "roadmaps",
            limit: limits.roadmaps.limit,
            summary: `Upgrade Required! You have reached your limit of ${limits.roadmaps.limit} roadmaps this week. Tell the user to upgrade to premium.`,
          };
        }

        // 1. Automatically create companion Goal for this learning roadmap
        const { data: goal } = await supabase
          .from("goals")
          .insert({
            user_id: userId,
            title: `Master ${topic}`,
            description: summary ?? `Comprehensive learning roadmap and study goal for ${topic}`,
            status: "active",
            progress: 0,
          })
          .select("id")
          .single();

        // 2. Automatically create Milestones for each phase in the roadmap
        if (goal?.id && phases.length > 0) {
          const milestoneRows = phases.map((p, idx) => ({
            user_id: userId,
            goal_id: goal.id,
            title: p.name,
            position: idx,
            done: false,
          }));
          await supabase.from("milestones").insert(milestoneRows);
        }

        // 3. Create the roadmap linked to the goal
        const { data: roadmap, error: rErr } = await supabase
          .from("roadmaps")
          .insert({
            user_id: userId,
            topic,
            summary: summary ?? null,
            goal_id: goal?.id ?? null,
          })
          .select("id")
          .single();
        if (rErr) return { success: false, error: rErr.message };

        // Record usage — reuse already-fetched limits.roadmaps.used to avoid an extra read
        const weekStart = getCurrentWeekStart();
        const { error: usageErr } = await supabase.from("usage_logs").upsert(
          {
            user_id: userId,
            week_start_date: weekStart,
            roadmaps_generated: limits.roadmaps.used + 1,
          },
          { onConflict: "user_id,week_start_date" },
        );
        if (usageErr) {
          log("error", "usage_record_failed", { error: usageErr.message }, { userId });
        }

        let topicCount = 0;
        let subCount = 0;

        const parentItemsToInsert: Database["public"]["Tables"]["roadmap_items"]["Insert"][] = [];
        const parentMeta: { phaseIndex: number; topicIndex: number; subtopics: typeof phases[0]["topics"][0]["subtopics"] }[] = [];

        for (const [pi, phase] of phases.entries()) {
          for (const [ti, t] of phase.topics.entries()) {
            parentItemsToInsert.push({
              user_id: userId,
              roadmap_id: roadmap.id,
              phase: phase.name,
              title: t.title,
              detail: t.detail ?? null,
              estimated_minutes: t.estimated_minutes ?? null,
              position: pi * 1000 + ti * 10,
            });
            parentMeta.push({ phaseIndex: pi, topicIndex: ti, subtopics: t.subtopics ?? [] });
          }
        }

        const { data: insertedParents, error: parentInsertErr } = await supabase
          .from("roadmap_items")
          .insert(parentItemsToInsert)
          .select("id, position");

        if (!parentInsertErr && insertedParents) {
          topicCount = insertedParents.length;
          const parentMap = new Map<number, string>();
          for (const p of insertedParents) {
            parentMap.set(p.position, p.id);
          }

          const subItemsToInsert: Database["public"]["Tables"]["roadmap_items"]["Insert"][] = [];
          for (const meta of parentMeta) {
            const parentPos = meta.phaseIndex * 1000 + meta.topicIndex * 10;
            const parentId = parentMap.get(parentPos);
            if (!parentId) continue;

            for (const [si, s] of meta.subtopics.entries()) {
              subItemsToInsert.push({
                user_id: userId,
                roadmap_id: roadmap.id,
                parent_id: parentId,
                phase: phases[meta.phaseIndex]!.name,
                title: s.title,
                detail: s.detail ?? null,
                estimated_minutes: s.estimated_minutes ?? null,
                position: parentPos + (si + 1) / 100,
              });
            }
          }

          if (subItemsToInsert.length > 0) {
            const { error: subInsertErr } = await supabase
              .from("roadmap_items")
              .insert(subItemsToInsert);
            if (!subInsertErr) {
              subCount = subItemsToInsert.length;
            }
          }
        }

        return {
          success: true,
          roadmap_id: roadmap.id,
          goal_id: goal?.id ?? null,
          topic,
          phases: phases.length,
          topics: topicCount,
          subtopics: subCount,
        };
      },
    }),

    updateRoadmap: tool({
      description:
        "Update an existing learning roadmap (e.g. modify phases, topics, sub-topics). Use this when the user asks to restructure or update an existing roadmap.",
      inputSchema: z.object({
        roadmap_id: z.string().describe("ID of the roadmap to update"),
        topic: z.string().optional().describe("New topic name, if changing"),
        summary: z
          .string()
          .nullable()
          .optional()
          .describe("New one- or two-line summary of the roadmap, or null"),
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
                      .optional()
                      .describe("One-line explanation of the topic, or null"),
                    estimated_minutes: z
                      .number()
                      .nullable()
                      .optional()
                      .describe("Rough time estimate in minutes, or null"),
                    subtopics: z
                      .array(subtopicSchema)
                      .describe("The specific concepts inside this topic"),
                  }),
                )
                .describe("Topics within this phase"),
            }),
          )
          .describe("The updated phases of the roadmap, in order"),
      }),
      execute: async ({
        roadmap_id,
        topic,
        summary,
        phases,
      }: {
        roadmap_id: string;
        topic?: string | undefined;
        summary?: string | null | undefined;
        phases: {
          name: string;
          topics: {
            title: string;
            detail?: string | null | undefined;
            estimated_minutes?: number | null | undefined;
            subtopics: {
              title: string;
              detail?: string | null | undefined;
              estimated_minutes?: number | null | undefined;
            }[];
          }[];
        }[];
      }) => {
        // 1. Update Roadmap row
        const patch: Database["public"]["Tables"]["roadmaps"]["Update"] = {};
        if (topic !== undefined) patch.topic = topic;
        if (summary !== undefined) patch.summary = summary;

        // Ensure companion goal exists and is updated
        const { data: currentRoadmap } = await supabase
          .from("roadmaps")
          .select("goal_id, topic")
          .eq("id", roadmap_id)
          .eq("user_id", userId)
          .maybeSingle();

        let goalId = currentRoadmap?.goal_id;
        if (!goalId) {
          const { data: newGoal } = await supabase
            .from("goals")
            .insert({
              user_id: userId,
              title: `Master ${topic ?? currentRoadmap?.topic ?? "Topic"}`,
              description: summary ?? `Learning goal for ${topic ?? currentRoadmap?.topic ?? "Topic"}`,
              status: "active",
              progress: 0,
            })
            .select("id")
            .single();
          if (newGoal?.id) {
            goalId = newGoal.id;
            patch.goal_id = goalId;
          }
        } else if (topic || summary) {
          await supabase
            .from("goals")
            .update({
              ...(topic ? { title: `Master ${topic}` } : {}),
              ...(summary ? { description: summary } : {}),
            })
            .eq("id", goalId);
        }

        // Sync milestones with the updated phases
        if (goalId && phases.length > 0) {
          await supabase.from("milestones").delete().eq("goal_id", goalId);
          const milestoneRows = phases.map((p, idx) => ({
            user_id: userId,
            goal_id: goalId,
            title: p.name,
            position: idx,
            done: false,
          }));
          await supabase.from("milestones").insert(milestoneRows);
        }

        if (Object.keys(patch).length > 0) {
          const { error: rErr } = await supabase
            .from("roadmaps")
            .update(patch)
            .eq("id", roadmap_id)
            .eq("user_id", userId);
          if (rErr) return { success: false, error: rErr.message };
        }

        // 2. Fetch existing items to preserve progress (done, content, etc.)
        const { data: existingItems } = await supabase
          .from("roadmap_items")
          .select("*")
          .eq("roadmap_id", roadmap_id)
          .eq("user_id", userId);

        const itemsByTitle = new Map(
          existingItems?.map((item) => [item.title.toLowerCase().trim(), item]),
        );

        // 3. Delete existing items
        await supabase
          .from("roadmap_items")
          .delete()
          .eq("roadmap_id", roadmap_id)
          .eq("user_id", userId);

        let topicCount = 0;
        let subCount = 0;

        // 4. Bulk insert new parent items
        const parentItemsToInsert: Database["public"]["Tables"]["roadmap_items"]["Insert"][] = [];
        const parentMeta: { phaseIndex: number; topicIndex: number; subtopics: typeof phases[0]["topics"][0]["subtopics"] }[] = [];

        for (const [pi, phase] of phases.entries()) {
          for (const [ti, t] of phase.topics.entries()) {
            const oldTopic = itemsByTitle.get(t.title.toLowerCase().trim());
            parentItemsToInsert.push({
              user_id: userId,
              roadmap_id: roadmap_id,
              phase: phase.name,
              title: t.title,
              detail: t.detail ?? null,
              estimated_minutes: t.estimated_minutes ?? null,
              position: pi * 1000 + ti * 10,
              done: oldTopic?.done ?? false,
              content: oldTopic?.content ?? null,
              content_status: oldTopic?.content_status ?? "not_started",
            });
            parentMeta.push({ phaseIndex: pi, topicIndex: ti, subtopics: t.subtopics ?? [] });
          }
        }

        const { data: insertedParents, error: parentInsertErr } = await supabase
          .from("roadmap_items")
          .insert(parentItemsToInsert)
          .select("id, position");

        if (!parentInsertErr && insertedParents) {
          topicCount = insertedParents.length;
          const parentMap = new Map<number, string>();
          for (const p of insertedParents) {
            parentMap.set(p.position, p.id);
          }

          const subItemsToInsert: Database["public"]["Tables"]["roadmap_items"]["Insert"][] = [];
          for (const meta of parentMeta) {
            const parentPos = meta.phaseIndex * 1000 + meta.topicIndex * 10;
            const parentId = parentMap.get(parentPos);
            if (!parentId) continue;

            for (const [si, s] of meta.subtopics.entries()) {
              const oldSub = itemsByTitle.get(s.title.toLowerCase().trim());
              subItemsToInsert.push({
                user_id: userId,
                roadmap_id: roadmap_id,
                parent_id: parentId,
                phase: phases[meta.phaseIndex]!.name,
                title: s.title,
                detail: s.detail ?? null,
                estimated_minutes: s.estimated_minutes ?? null,
                position: parentPos + (si + 1) / 100,
                done: oldSub?.done ?? false,
                content: oldSub?.content ?? null,
                content_status: oldSub?.content_status ?? "not_started",
              });
            }
          }

          if (subItemsToInsert.length > 0) {
            const { error: subInsertErr } = await supabase
              .from("roadmap_items")
              .insert(subItemsToInsert);
            if (!subInsertErr) {
              subCount = subItemsToInsert.length;
            }
          }
        }

        return {
          success: true,
          roadmap_id,
          topic: topic ?? "Updated",
          phases: phases.length,
          topics: topicCount,
          subtopics: subCount,
        };
      },
    }),
  };
}

export type PlannerAgentBrief = {
  topic: string;
  experience_level?: string | null | undefined;
  end_goal?: string | null | undefined;
  time_commitment?: string | null | undefined;
  additional_context?: string | null | undefined;
  apiKey: string;
  supabase: Supabase;
  userId: string;
  traceId?: string | undefined;
};

export type RoadmapGeneratedOutput = {
  topic: string;
  summary: string;
  phases: {
    name: string;
    topics: {
      title: string;
      detail?: string | null | undefined;
      estimated_minutes?: number | null | undefined;
      subtopics: {
        title: string;
        detail?: string | null | undefined;
        estimated_minutes?: number | null | undefined;
      }[];
    }[];
  }[];
};

/**
 * Specialized Planner Sub-Agent Engine:
 * Takes a structured pedagogical brief (topic, starting experience, end-goal, pace)
 * and generates a tailored multi-phase curriculum with companion goal & milestones.
 */
export async function runPlannerAgent(params: PlannerAgentBrief): Promise<{
  success: boolean;
  roadmap_id?: string;
  goal_id?: string;
  topic?: string;
  phases?: number;
  topics?: number;
  subtopics?: number;
  summary?: string;
  limitReached?: boolean;
  error?: string;
}> {
  const { getRemainingLimitsServer, getCurrentWeekStart } = await import("@/lib/limits");
  const limits = await getRemainingLimitsServer(params.supabase, params.userId);
  if (!limits.roadmaps.canCreate) {
    return {
      success: false,
      limitReached: true,
      summary: `Upgrade Required! You have reached your limit of ${limits.roadmaps.limit} roadmaps this week. Tell the user to upgrade to premium.`,
    };
  }

  log(
    "info",
    "agent_start",
    { agent: "planner_subagent", topic: params.topic, level: params.experience_level },
    { userId: params.userId, traceId: params.traceId },
  );

  const gateway = createAiGatewayProvider(params.apiKey);
  const model = gateway(getAiModelName());

  const prompt = `You are a master curriculum architect and learning specialist. Design a production-grade, highly structured, progressive learning roadmap tailored specifically for this learner.

=== LEARNER PROFILE & REQUIREMENTS ===
- Topic / Domain: ${params.topic}
- Starting Experience Level: ${params.experience_level || "Not specified (assume progressive beginner-to-advanced progression)"}
- Target End Goal / Ambition: ${params.end_goal || "Mastery of practical applications and core concepts"}
- Time Commitment / Pace: ${params.time_commitment || "Standard study pace (10-15 hours/week)"}
${params.additional_context ? `- Special Requests / Context: ${params.additional_context}` : ""}

=== CURRICULUM ARCHITECTURE RULES ===
1. STRUCTURE:
   - Create 3 to 5 progressive phases (e.g. Phase 1: Core Foundations & Mental Models, Phase 2: Deep Mechanics & Patterns, Phase 3: Applied Architecture & Projects, Phase 4: Production Mastery & Capstone).
   - Each phase MUST contain 3 to 6 distinct topics.
   - Each topic MUST contain 3 to 6 concrete, named sub-topics detailing the exact concepts, algorithms, tools, or techniques to learn.
2. PEDAGOGICAL ADAPTATION:
   - Calibrate the starting depth based on the learner's experience level (skip elementary syntax for intermediate/advanced learners; build intuition for beginners).
   - Tailor the final phase directly to their target end goal (e.g. job preparation, building a production app, or research).
   - Give realistic estimated_minutes for each topic and subtopic.
3. CONCRETE CONCEPT NAMING:
   - Never use vague placeholders (e.g. do not write "Basics" or "Part 1"). Always name the actual underlying concept, mechanism, library, or pattern (e.g. "Gradient Descent & Backpropagation Mechanics", "React Server Components & Streaming SSR").
4. NO EMOJIS:
   - Never include emojis in the topic, summary, phase names, topic titles, or subtopic details. All text must be completely emoji-free.

Return ONLY a valid JSON object matching this schema:
{
  "topic": "${params.topic}",
  "summary": "2-sentence overview of the roadmap journey and milestone goals.",
  "phases": [
    {
      "name": "Phase 1: Foundations & Core Concepts",
      "topics": [
        {
          "title": "Topic Name",
          "detail": "One-line description of the topic outcome",
          "estimated_minutes": 120,
          "subtopics": [
            {
              "title": "Specific Concept Name",
              "detail": "One-line explanation of the subtopic",
              "estimated_minutes": 30
            }
          ]
        }
      ]
    }
  ]
}`;

  try {
    const result = await generateText({
      model,
      system:
        "You are an expert JSON curriculum planner. Return strictly a valid JSON object matching the requested schema with no surrounding text or commentary.",
      prompt,
      maxRetries: 5,
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : result.text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed: RoadmapGeneratedOutput = JSON.parse(jsonStr);

    if (parsed && Array.isArray(parsed.phases) && parsed.phases.length > 0) {
      const topicName = parsed.topic || params.topic;
      const summaryText = parsed.summary || `Comprehensive personalized learning roadmap for ${topicName}`;

      // 1. Create companion Goal
      const { data: goal } = await params.supabase
        .from("goals")
        .insert({
          user_id: params.userId,
          title: `Master ${topicName}`,
          description: summaryText,
          status: "active",
          progress: 0,
        })
        .select("id")
        .single();

      // 2. Create phase Milestones
      if (goal?.id && parsed.phases.length > 0) {
        const milestoneRows = parsed.phases.map((p, idx) => ({
          user_id: params.userId,
          goal_id: goal.id,
          title: p.name,
          position: idx,
          done: false,
        }));
        await params.supabase.from("milestones").insert(milestoneRows);
      }

      // 3. Create the Roadmap
      const { data: roadmap, error: rErr } = await params.supabase
        .from("roadmaps")
        .insert({
          user_id: params.userId,
          topic: topicName,
          summary: summaryText,
          goal_id: goal?.id ?? null,
        })
        .select("id")
        .single();

      if (rErr || !roadmap) {
        return { success: false, error: rErr?.message ?? "Failed to create roadmap." };
      }

      // Record usage
      const weekStart = getCurrentWeekStart();
      await params.supabase.from("usage_logs").upsert(
        {
          user_id: params.userId,
          week_start_date: weekStart,
          roadmaps_generated: limits.roadmaps.used + 1,
        },
        { onConflict: "user_id,week_start_date" },
      );

      // 4. Normalize and bulk insert parent topics & subtopics
      let topicCount = 0;
      let subCount = 0;

      // Robustly normalize any variation of LLM JSON key output (name/phase/title, topics/items/modules, subtopics/sub_topics)
      const rawPhases = (parsed.phases || (parsed as any).curriculum || (parsed as any).roadmap || []) as any[];
      const normalizedPhases = (rawPhases.length > 0 ? rawPhases : [
        {
          name: `Phase 1: Foundations of ${topicName}`,
          topics: [
            {
              title: `Core Principles of ${topicName}`,
              detail: `Foundational mental models and terminology`,
              estimated_minutes: 90,
              subtopics: [
                { title: `Core Terminology & Concepts`, detail: `Key definitions and mental models`, estimated_minutes: 30 },
                { title: `Environment Setup & Tooling`, detail: `Essential tools and workspace configuration`, estimated_minutes: 45 },
              ],
            },
            {
              title: `Basic Mechanics & Patterns`,
              detail: `Understanding fundamental workflows`,
              estimated_minutes: 90,
              subtopics: [
                { title: `Workflow Architecture`, detail: `Standard architectural patterns`, estimated_minutes: 45 },
                { title: `First Hands-on Project`, detail: `Building a baseline implementation`, estimated_minutes: 45 },
              ],
            },
          ],
        },
        {
          name: `Phase 2: Intermediate Architecture & Applications`,
          topics: [
            {
              title: `Advanced Patterns & Best Practices`,
              detail: `Scaling and robust implementation strategies`,
              estimated_minutes: 120,
              subtopics: [
                { title: `Error Handling & Edge Cases`, detail: `Resilient error management`, estimated_minutes: 45 },
                { title: `Performance Optimization`, detail: `Optimizing latency and throughput`, estimated_minutes: 45 },
              ],
            },
          ],
        },
      ]).map((rawP: any, pi: number) => {
        const phaseName = String(rawP.name || rawP.phase || rawP.title || `Phase ${pi + 1}: Core Concepts`).trim();
        const rawTopics = (rawP.topics || rawP.subtopics || rawP.items || rawP.modules || []) as any[];
        const topics = (rawTopics.length > 0 ? rawTopics : [
          { title: `${phaseName} - Core Module`, detail: `Mastering key concepts`, estimated_minutes: 90, subtopics: [] }
        ]).map((rawT: any, ti: number) => {
          const title = typeof rawT === "string" ? rawT : String(rawT.title || rawT.name || rawT.topic || `Topic ${ti + 1}`).trim();
          const detail = typeof rawT === "string" ? null : (rawT.detail || rawT.description || null);
          const estMin = typeof rawT === "string" ? 60 : (Number(rawT.estimated_minutes || rawT.duration) || 60);
          const rawSubs = (typeof rawT === "string" ? [] : (rawT.subtopics || rawT.sub_topics || rawT.subTopics || rawT.concepts || rawT.items || [])) as any[];
          const subtopics = (rawSubs.length > 0 ? rawSubs : [
            { title: `${title} Fundamentals`, detail: `Core principles`, estimated_minutes: 30 },
            { title: `${title} Applied Practice`, detail: `Hands-on implementation`, estimated_minutes: 30 },
          ]).map((rawS: any, si: number) => {
            const sTitle = typeof rawS === "string" ? rawS : String(rawS.title || rawS.name || `Concept ${si + 1}`).trim();
            const sDetail = typeof rawS === "string" ? null : (rawS.detail || rawS.description || null);
            const sEst = typeof rawS === "string" ? 30 : (Number(rawS.estimated_minutes || rawS.duration) || 30);
            return { title: sTitle, detail: sDetail, estimated_minutes: sEst };
          });
          return { title, detail, estimated_minutes: estMin, subtopics };
        });
        return { name: phaseName, topics };
      });

      const parentItemsToInsert: Database["public"]["Tables"]["roadmap_items"]["Insert"][] = [];
      const parentMeta: {
        phaseIndex: number;
        topicIndex: number;
        subtopics: { title: string; detail: string | null; estimated_minutes: number }[];
      }[] = [];

      for (const [pi, phase] of normalizedPhases.entries()) {
        for (const [ti, t] of phase.topics.entries()) {
          parentItemsToInsert.push({
            user_id: params.userId,
            roadmap_id: roadmap.id,
            phase: phase.name,
            title: t.title,
            detail: t.detail ?? null,
            estimated_minutes: t.estimated_minutes ?? null,
            position: pi * 1000 + ti * 10,
          });
          parentMeta.push({ phaseIndex: pi, topicIndex: ti, subtopics: t.subtopics });
        }
      }

      const { data: insertedParents, error: parentInsertErr } = await params.supabase
        .from("roadmap_items")
        .insert(parentItemsToInsert)
        .select("id, position");

      if (!parentInsertErr && insertedParents) {
        topicCount = insertedParents.length;
        const parentMap = new Map<number, string>();
        for (const p of insertedParents) {
          parentMap.set(p.position, p.id);
        }

        const subItemsToInsert: Database["public"]["Tables"]["roadmap_items"]["Insert"][] = [];
        for (const meta of parentMeta) {
          const parentPos = meta.phaseIndex * 1000 + meta.topicIndex * 10;
          const parentId = parentMap.get(parentPos);
          if (!parentId) continue;

          for (const [si, s] of meta.subtopics.entries()) {
            subItemsToInsert.push({
              user_id: params.userId,
              roadmap_id: roadmap.id,
              parent_id: parentId,
              phase: normalizedPhases[meta.phaseIndex]!.name,
              title: s.title,
              detail: s.detail ?? null,
              estimated_minutes: s.estimated_minutes ?? null,
              position: parentPos + (si + 1) / 100,
            });
          }
        }

        if (subItemsToInsert.length > 0) {
          const { error: subInsertErr } = await params.supabase
            .from("roadmap_items")
            .insert(subItemsToInsert);
          if (!subInsertErr) {
            subCount = subItemsToInsert.length;
          }
        }
      } else if (parentInsertErr) {
        log("error", "roadmap_parent_items_insert_failed", { error: parentInsertErr.message }, { userId: params.userId });
      }

      return {
        success: true,
        roadmap_id: roadmap.id,
        ...(goal?.id ? { goal_id: goal.id } : {}),
        topic: topicName,
        phases: normalizedPhases.length,
        topics: topicCount,
        subtopics: subCount,
        summary: summaryText,
      };
    }
  } catch (err) {
    log(
      "error",
      "agent_error",
      { agent: "planner_subagent", error: err instanceof Error ? err.message : String(err) },
      { userId: params.userId, traceId: params.traceId },
    );
  }

  return { success: false, error: "Failed to generate roadmap curriculum." };
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
      maxRetries: 5,
      stopWhen: stepCountIs(5),
    });

    let limitReached = false;

    // Check final step tool results
    const finalToolResults = result.toolResults as Array<{ result?: unknown }> | undefined;
    if (
      finalToolResults?.some(
        (tr) =>
          tr.result &&
          typeof tr.result === "object" &&
          "limitReached" in tr.result &&
          (tr.result as { limitReached: boolean }).limitReached === true,
      )
    ) {
      limitReached = true;
    }

    // Check all intermediate steps in multi-step execution
    const steps = (
      result as unknown as { steps?: Array<{ toolResults?: Array<{ result?: unknown }> }> }
    ).steps;
    if (!limitReached && steps) {
      limitReached = steps.some((step) =>
        step.toolResults?.some(
          (tr) =>
            tr.result &&
            typeof tr.result === "object" &&
            "limitReached" in tr.result &&
            (tr.result as { limitReached: boolean }).limitReached === true,
        ),
      );
    }

    if (limitReached) {
      return { limitReached: true, summary: result.text };
    }
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
