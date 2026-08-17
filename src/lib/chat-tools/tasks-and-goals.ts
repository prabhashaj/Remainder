import { z } from "zod";
import { tool } from "ai";
import { wrapTool } from "./wrap-tool";
import type { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function getTasksAndGoalsTools(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  traceId: string,
  threadId: string | null,
) {
  return {
    createTask: tool({
      description: "Create a new task in the user's workspace instantly.",
      inputSchema: z.object({
        title: z.string().describe("The task title"),
        due_date: z
          .string()
          .nullable()
          .optional()
          .describe("Optional due date in YYYY-MM-DD format, or null"),
      }),
      execute: async ({
        title,
        due_date,
      }: {
        title: string;
        due_date?: string | null | undefined;
      }) =>
        wrapTool(
          "createTask",
          async () => {
            const { data, error } = await supabase
              .from("tasks")
              .insert({ user_id: userId, title, due_date: due_date ?? null, source: "remi" })
              .select("id, title")
              .single();
            if (error) return { success: false, error: error.message };
            return {
              success: true,
              id: data.id,
              message: `Task '${title}' created successfully.`,
            };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { title, due_date },
        ),
    }),

    createGoal: tool({
      description: "Create a new goal in the user's workspace instantly.",
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
      }) =>
        wrapTool(
          "createGoal",
          async () => {
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
            return {
              success: true,
              id: goal.id,
              message: `Goal '${title}' created successfully.`,
            };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { title, description, target_date, milestones },
        ),
    }),

    updateTask: tool({
      description:
        "Update an existing task (e.g., mark as done, change title, or change due date).",
      inputSchema: z.object({
        task_id: z.string().describe("ID of the task to update"),
        done: z
          .boolean()
          .nullable()
          .optional()
          .describe("Set to true to mark done, false to reopen, or null to leave unchanged"),
        title: z.string().nullable().optional().describe("New title, or null to leave unchanged"),
        due_date: z
          .string()
          .nullable()
          .optional()
          .describe("New due date (YYYY-MM-DD), or null to leave unchanged"),
      }),
      execute: async ({
        task_id,
        done,
        title,
        due_date,
      }: {
        task_id: string;
        done?: boolean | null | undefined;
        title?: string | null | undefined;
        due_date?: string | null | undefined;
      }) =>
        wrapTool(
          "updateTask",
          async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updates: any = {};
            if (done !== null) updates.done = done;
            if (title !== null) updates.title = title;
            if (due_date !== null) updates.due_date = due_date;
            if (Object.keys(updates).length === 0)
              return { success: false, error: "No fields to update" };
            const { error } = await supabase
              .from("tasks")
              .update(updates)
              .eq("id", task_id)
              .eq("user_id", userId);
            if (error) return { success: false, error: error.message };
            return { success: true, message: `Task ${task_id} updated successfully.` };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { task_id, done, title, due_date },
        ),
    }),

    updateGoal: tool({
      description:
        "Update an existing goal's title, description, target date, progress percentage, or status.",
      inputSchema: z.object({
        goal_id: z
          .string()
          .describe("ID or title of the goal to update (e.g. 'Reach 1M Followers on Instagram')"),
        title: z.string().optional().describe("New title for the goal"),
        description: z
          .string()
          .nullable()
          .optional()
          .describe("New description for the goal, or null"),
        target_date: z
          .string()
          .nullable()
          .optional()
          .describe("Target date in YYYY-MM-DD format, or null"),
        progress: z.number().min(0).max(100).optional().describe("New progress percentage (0-100)"),
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
      }) =>
        wrapTool(
          "updateGoal",
          async () => {
            let targetId = goal_id;
            let currentGoalTitle = goal_id;

            const { data: byId } = await supabase
              .from("goals")
              .select("id, title")
              .eq("id", goal_id)
              .eq("user_id", userId)
              .maybeSingle();

            if (byId) {
              targetId = byId.id;
              currentGoalTitle = byId.title;
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
                currentGoalTitle = match.title;
              } else {
                return {
                  success: false,
                  error: `Goal matching '${goal_id}' not found. Please check existing goals in workspace context.`,
                };
              }
            }

            const patch: Database["public"]["Tables"]["goals"]["Update"] = {};
            if (title !== undefined) patch.title = title;
            if (description !== undefined) patch.description = description;
            if (target_date !== undefined) patch.target_date = target_date;
            if (progress !== undefined) patch.progress = progress;
            if (status !== undefined) patch.status = status;

            if (Object.keys(patch).length === 0) {
              return { success: false, error: "No update parameters provided." };
            }

            const { data: updated, error } = await supabase
              .from("goals")
              .update(patch)
              .eq("id", targetId)
              .eq("user_id", userId)
              .select("*")
              .single();

            if (error) return { success: false, error: error.message };

            return {
              success: true,
              id: updated.id,
              title: updated.title,
              message: `Goal '${updated.title}' updated successfully.`,
            };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { goal_id, title, description, target_date, progress, status },
        ),
    }),

    addMilestone: tool({
      description: "Add one or more new milestones (checkpoints) directly to an existing goal.",
      inputSchema: z.object({
        goal_id: z
          .string()
          .describe(
            "ID or title of the goal to add milestone(s) to (e.g. 'Reach 1M Followers on Instagram')",
          ),
        title: z
          .string()
          .optional()
          .describe("Single milestone title to add (e.g. 'Post 3 times per week consistently')"),
        milestones: z
          .array(z.object({ title: z.string() }))
          .optional()
          .describe("Optional list of milestone titles to add"),
      }),
      execute: async ({
        goal_id,
        title,
        milestones,
      }: {
        goal_id: string;
        title?: string | undefined;
        milestones?: { title: string }[] | undefined;
      }) =>
        wrapTool(
          "addMilestone",
          async () => {
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
                return {
                  success: false,
                  error: `Goal matching '${goal_id}' not found. Check existing goals or create the goal first.`,
                };
              }
            }

            const titlesToAdd: string[] = [];
            if (title && title.trim()) titlesToAdd.push(title.trim());
            if (milestones && milestones.length > 0) {
              for (const m of milestones) {
                if (m.title && m.title.trim()) titlesToAdd.push(m.title.trim());
              }
            }

            if (titlesToAdd.length === 0) {
              return { success: false, error: "No milestone title provided." };
            }

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
              message: `Added ${inserted?.length ?? 0} milestone(s) to goal '${targetGoalTitle}' successfully.`,
            };
          },
          supabase,
          userId,
          traceId,
          threadId,
          { goal_id, title, milestones },
        ),
    }),

    createMilestone: tool({
      description: "Alias for addMilestone. Add milestone(s) to an existing goal.",
      inputSchema: z.object({
        goal_id: z.string().describe("ID or title of the goal"),
        title: z.string().optional().describe("Milestone title"),
        milestones: z.array(z.object({ title: z.string() })).optional(),
      }),
      execute: async ({
        goal_id,
        title,
        milestones,
      }: {
        goal_id: string;
        title?: string | undefined;
        milestones?: { title: string }[] | undefined;
      }) =>
        wrapTool(
          "createMilestone",
          async () => {
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
          supabase,
          userId,
          traceId,
          threadId,
          { goal_id, title, milestones },
        ),
    }),
  };
}
