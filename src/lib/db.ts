import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Page = Tables["pages"]["Row"];
export type Block = Tables["blocks"]["Row"];
export type Task = Tables["tasks"]["Row"];
export type Goal = Tables["goals"]["Row"];
export type Milestone = Tables["milestones"]["Row"];
export type Roadmap = Tables["roadmaps"]["Row"];
export type RoadmapItem = Tables["roadmap_items"]["Row"];
export type JournalEntry = Tables["journal_entries"]["Row"];
export type FocusSession = Tables["focus_sessions"]["Row"];
export type ChatThread = Tables["chat_threads"]["Row"];
export type Profile = Tables["profiles"]["Row"];
export type AgentMemory = Tables["agent_memories"]["Row"];
export type RoadmapResource = Tables["roadmap_resources"]["Row"];
export type Flashcard = Tables["flashcards"]["Row"];
export type QuizAttempt = Tables["quiz_attempts"]["Row"];
export type Subscription = Tables["subscriptions"]["Row"];
export type UsageLog = Tables["usage_logs"]["Row"];

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function unwrap<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

export async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

/* ---------- profile ---------- */

export async function fetchProfile(): Promise<Profile | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProfile(patch: Tables["profiles"]["Update"]) {
  const userId = await requireUserId();
  return unwrap(
    await supabase.from("profiles").update(patch).eq("id", userId).select("*").single(),
  );
}

/* ---------- pages & blocks ---------- */

export async function fetchPages(): Promise<Page[]> {
  return unwrap(await supabase.from("pages").select("*").order("position").order("created_at"));
}

export async function fetchPage(id: string): Promise<Page | null> {
  const { data, error } = await supabase.from("pages").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createPage(input: {
  title?: string;
  parent_id?: string | null;
  icon?: string;
}) {
  const user_id = await requireUserId();
  return unwrap(
    await supabase
      .from("pages")
      .insert({
        user_id,
        title: input.title ?? "Untitled",
        parent_id: input.parent_id ?? null,
        icon: input.icon ?? "📄",
      })
      .select("*")
      .single(),
  );
}

export async function updatePage(id: string, patch: Tables["pages"]["Update"]) {
  return unwrap(await supabase.from("pages").update(patch).eq("id", id).select("*").single());
}

export async function deletePage(id: string) {
  const { error } = await supabase.from("pages").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchBlocks(pageId: string): Promise<Block[]> {
  return unwrap(await supabase.from("blocks").select("*").eq("page_id", pageId).order("position"));
}

export async function createBlock(input: {
  page_id: string;
  type?: string;
  content?: string;
  position: number;
}) {
  const user_id = await requireUserId();
  return unwrap(
    await supabase
      .from("blocks")
      .insert({
        user_id,
        page_id: input.page_id,
        type: input.type ?? "text",
        content: input.content ?? "",
        position: input.position,
      })
      .select("*")
      .single(),
  );
}

export async function updateBlock(id: string, patch: Tables["blocks"]["Update"]) {
  return unwrap(await supabase.from("blocks").update(patch).eq("id", id).select("*").single());
}

export async function deleteBlock(id: string) {
  const { error } = await supabase.from("blocks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------- tasks ---------- */

export async function fetchTasks(): Promise<Task[]> {
  return unwrap(
    await supabase
      .from("tasks")
      .select("*")
      .order("done")
      .order("due_date", { nullsFirst: false })
      .order("position"),
  );
}

export async function createTask(input: Partial<Tables["tasks"]["Insert"]> & { title: string }) {
  const user_id = await requireUserId();
  return unwrap(
    await supabase
      .from("tasks")
      .insert({ ...input, user_id })
      .select("*")
      .single(),
  );
}

export async function updateTask(id: string, patch: Tables["tasks"]["Update"]) {
  return unwrap(await supabase.from("tasks").update(patch).eq("id", id).select("*").single());
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------- goals ---------- */

export async function fetchGoals(): Promise<Goal[]> {
  return unwrap(await supabase.from("goals").select("*").order("created_at", { ascending: false }));
}

export async function fetchMilestones(): Promise<Milestone[]> {
  return unwrap(await supabase.from("milestones").select("*").order("position"));
}

export async function createGoal(input: {
  title: string;
  description?: string | null;
  target_date?: string | null;
}) {
  const user_id = await requireUserId();
  return unwrap(
    await supabase
      .from("goals")
      .insert({ ...input, user_id })
      .select("*")
      .single(),
  );
}

export async function updateGoal(id: string, patch: Tables["goals"]["Update"]) {
  return unwrap(await supabase.from("goals").update(patch).eq("id", id).select("*").single());
}

export async function deleteGoal(id: string) {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createMilestone(input: {
  goal_id: string;
  title: string;
  position?: number;
}) {
  const user_id = await requireUserId();
  return unwrap(
    await supabase
      .from("milestones")
      .insert({ ...input, user_id })
      .select("*")
      .single(),
  );
}

export async function updateMilestone(id: string, patch: Tables["milestones"]["Update"]) {
  return unwrap(await supabase.from("milestones").update(patch).eq("id", id).select("*").single());
}

/* ---------- roadmaps ---------- */

export async function fetchRoadmaps(): Promise<Roadmap[]> {
  return unwrap(
    await supabase.from("roadmaps").select("*").order("created_at", { ascending: false }),
  );
}

export async function fetchRoadmapItems(roadmapId?: string): Promise<RoadmapItem[]> {
  let q = supabase.from("roadmap_items").select("*").order("position");
  if (roadmapId) q = q.eq("roadmap_id", roadmapId);
  return unwrap(await q);
}

export async function fetchRoadmap(id: string): Promise<Roadmap | null> {
  const { data, error } = await supabase.from("roadmaps").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchRoadmapItem(id: string): Promise<RoadmapItem | null> {
  const { data, error } = await supabase
    .from("roadmap_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function checkAndRecordRoadmapCompletion(roadmapId: string): Promise<boolean> {
  const { data: roadmap } = await supabase
    .from("roadmaps")
    .select("id,topic,user_id")
    .eq("id", roadmapId)
    .maybeSingle();

  if (!roadmap || !roadmap.topic) return false;

  const { data: items } = await supabase
    .from("roadmap_items")
    .select("id,done")
    .eq("roadmap_id", roadmapId);

  if (!items || items.length === 0) return false;

  const allCompleted = items.every((i) => i.done === true);
  if (!allCompleted) return false;

  // Check if this mastered skill memory is already recorded
  const { data: existing } = await supabase
    .from("agent_memories")
    .select("id")
    .eq("user_id", roadmap.user_id)
    .ilike("content", `%Mastered Skill: User completed 100% of the "${roadmap.topic}" roadmap%`)
    .maybeSingle();

  if (!existing) {
    await supabase.from("agent_memories").insert({
      user_id: roadmap.user_id,
      category: "skill",
      content: `Mastered Skill: User completed 100% of the "${roadmap.topic}" roadmap.`,
      importance: 5,
    });
    return true;
  }

  return false;
}

export async function updateRoadmapItem(id: string, patch: Tables["roadmap_items"]["Update"]) {
  const updated = unwrap(
    await supabase.from("roadmap_items").update(patch).eq("id", id).select("*").single(),
  );

  if (patch.done && updated.roadmap_id) {
    void checkAndRecordRoadmapCompletion(updated.roadmap_id);
  }

  return updated;
}

export async function deleteRoadmap(id: string) {
  const { data: roadmap } = await supabase
    .from("roadmaps")
    .select("goal_id")
    .eq("id", id)
    .maybeSingle();

  // Cascade delete associated tasks
  await supabase.from("tasks").delete().eq("roadmap_id", id);

  // Delete the roadmap itself
  const { error } = await supabase.from("roadmaps").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // Cascade delete associated goal
  if (roadmap?.goal_id) {
    await supabase.from("goals").delete().eq("id", roadmap.goal_id);
  }
}

/* ---------- journal ---------- */

export async function fetchJournal(day: string): Promise<JournalEntry | null> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("day", day)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveJournal(
  day: string,
  patch: { mood?: string | null; note?: string | null },
) {
  const user_id = await requireUserId();
  return unwrap(
    await supabase
      .from("journal_entries")
      .upsert({ user_id, day, ...patch }, { onConflict: "user_id,day" })
      .select("*")
      .single(),
  );
}

/* ---------- focus ---------- */

export async function fetchFocusSessions(): Promise<FocusSession[]> {
  return unwrap(
    await supabase.from("focus_sessions").select("*").order("created_at", { ascending: false }),
  );
}

export async function createFocusSession(input: {
  title: string;
  resource_kind?: string;
  resource_url?: string | null;
  roadmap_item_id?: string | null;
  intention?: string | null;
  session_type?: string;
  work_minutes?: number;
  break_minutes?: number;
}) {
  const user_id = await requireUserId();
  return unwrap(
    await supabase
      .from("focus_sessions")
      .insert({ ...input, user_id })
      .select("*")
      .single(),
  );
}

export async function finishFocusSession(
  id: string,
  patch: {
    minutes: number;
    counted_minutes?: number | null;
    notes?: string | null;
    reflection?: string | null;
    stayed_on_task?: boolean | null;
    tab_away_count?: number;
    tab_away_seconds?: number;
  },
) {
  return unwrap(
    await supabase
      .from("focus_sessions")
      .update({ ...patch, ended_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single(),
  );
}

/* ---------- chat threads ---------- */

export async function fetchThreads(): Promise<ChatThread[]> {
  return unwrap(
    await supabase.from("chat_threads").select("*").order("updated_at", { ascending: false }),
  );
}

export async function createThread(title = "New conversation"): Promise<ChatThread> {
  const user_id = await requireUserId();
  return unwrap(
    await supabase.from("chat_threads").insert({ user_id, title }).select("*").single(),
  );
}

export async function renameThread(id: string, title: string) {
  const { error } = await supabase.from("chat_threads").update({ title }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteThread(id: string) {
  const { error } = await supabase.from("chat_threads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchThreadMessages(threadId: string) {
  return unwrap(
    await supabase.from("chat_messages").select("*").eq("thread_id", threadId).order("created_at"),
  );
}

/* ---------- memories ---------- */

export async function fetchMemories(): Promise<AgentMemory[]> {
  return unwrap(
    await supabase
      .from("agent_memories")
      .select("*")
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false }),
  );
}

export async function clearMemories(): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("agent_memories").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from("agent_memories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createMemory(
  content: string,
  category: string = "preference",
  importance = 3,
): Promise<AgentMemory> {
  const user_id = await requireUserId();
  return unwrap(
    await supabase
      .from("agent_memories")
      .insert({ user_id, content, category, importance })
      .select("*")
      .single(),
  );
}

/* ---------- roadmap resources ---------- */

export async function fetchRoadmapResources(roadmapId: string): Promise<RoadmapResource[]> {
  return unwrap(
    await supabase
      .from("roadmap_resources")
      .select("*")
      .eq("roadmap_id", roadmapId)
      .order("created_at"),
  );
}

export async function fetchRoadmapResource(id: string): Promise<RoadmapResource | null> {
  const { data, error } = await supabase
    .from("roadmap_resources")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/* ---------- roadmap streak & activity helpers ---------- */

export interface RoadmapStreakInfo {
  currentStreak: number;
  bestStreak: number;
  todayActive: boolean;
  activeDates: string[];
  weekActiveDays: string[];
  totalLessonsCompleted: number;
  totalFocusMinutes: number;
}

export function calculateStreakFromDates(dates: Set<string>): {
  currentStreak: number;
  bestStreak: number;
  todayActive: boolean;
} {
  const todayStr = today();
  const yesterdayStr = dayOffset(-1);
  const todayActive = dates.has(todayStr);

  let currentStreak = 0;
  const startOffset = todayActive ? 0 : dates.has(yesterdayStr) ? 1 : null;

  if (startOffset !== null) {
    for (let i = startOffset; i < 3650; i++) {
      const d = dayOffset(-i);
      if (dates.has(d)) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  let bestStreak = 0;
  let running = 0;
  for (let i = 0; i < 3650; i++) {
    const d = dayOffset(-i);
    if (dates.has(d)) {
      running++;
      if (running > bestStreak) bestStreak = running;
    } else {
      running = 0;
    }
  }

  return { currentStreak, bestStreak: Math.max(bestStreak, currentStreak), todayActive };
}

export async function fetchRoadmapStreakInfo(roadmapId?: string): Promise<RoadmapStreakInfo> {
  const userId = await requireUserId();

  let focusQuery = supabase
    .from("focus_sessions")
    .select("created_at, minutes, counted_minutes, roadmap_item_id")
    .eq("user_id", userId);

  let itemsQuery = supabase
    .from("roadmap_items")
    .select("id, roadmap_id, done, updated_at, created_at")
    .eq("user_id", userId);
  if (roadmapId) {
    itemsQuery = itemsQuery.eq("roadmap_id", roadmapId);
  }

  let quizQuery = supabase
    .from("quiz_attempts")
    .select("created_at, roadmap_item_id")
    .eq("user_id", userId);

  const [{ data: focusSessions }, { data: roadmapItems }, { data: quizAttempts }] =
    await Promise.all([focusQuery, itemsQuery, quizQuery]);

  const activeDates = new Set<string>();
  let totalLessonsCompleted = 0;
  let totalFocusMinutes = 0;

  const validItemIds = roadmapId
    ? new Set((roadmapItems ?? []).map((i) => i.id))
    : null;

  (roadmapItems ?? []).forEach((item) => {
    if (item.done) {
      totalLessonsCompleted++;
      if (item.updated_at) {
        activeDates.add(item.updated_at.slice(0, 10));
      } else if (item.created_at) {
        activeDates.add(item.created_at.slice(0, 10));
      }
    }
  });

  (focusSessions ?? []).forEach((fs) => {
    if (validItemIds && fs.roadmap_item_id && !validItemIds.has(fs.roadmap_item_id)) {
      return;
    }
    const mins = fs.counted_minutes ?? fs.minutes ?? 0;
    totalFocusMinutes += mins;
    if (mins > 0 && fs.created_at) {
      activeDates.add(fs.created_at.slice(0, 10));
    }
  });

  (quizAttempts ?? []).forEach((qa) => {
    if (validItemIds && qa.roadmap_item_id && !validItemIds.has(qa.roadmap_item_id)) {
      return;
    }
    if (qa.created_at) {
      activeDates.add(qa.created_at.slice(0, 10));
    }
  });

  const { currentStreak, bestStreak, todayActive } = calculateStreakFromDates(activeDates);

  const last7Days = Array.from({ length: 7 }, (_, i) => dayOffset(-6 + i));
  const weekActiveDays = last7Days.filter((d) => activeDates.has(d));

  return {
    currentStreak,
    bestStreak,
    todayActive,
    activeDates: Array.from(activeDates).sort().reverse(),
    weekActiveDays,
    totalLessonsCompleted,
    totalFocusMinutes,
  };
}

/* ---------- subscriptions & usage ---------- */

export async function fetchSubscription(): Promise<Subscription | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchUsage(weekStartDate: string): Promise<UsageLog | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("usage_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start_date", weekStartDate)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function recordUsage(patch: Partial<UsageLog> & { week_start_date: string }) {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from("usage_logs")
    .upsert({ user_id, ...patch }, { onConflict: "user_id,week_start_date" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
