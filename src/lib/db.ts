import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Page = Tables["pages"]["Row"];
export type Block = Tables["blocks"]["Row"];
export type Task = Tables["tasks"]["Row"];
export type Habit = Tables["habits"]["Row"];
export type HabitLog = Tables["habit_logs"]["Row"];
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
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
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
  return unwrap(
    await supabase.from("pages").select("*").order("position").order("created_at"),
  );
}

export async function fetchPage(id: string): Promise<Page | null> {
  const { data, error } = await supabase.from("pages").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createPage(input: { title?: string; parent_id?: string | null; icon?: string }) {
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
  return unwrap(
    await supabase.from("blocks").select("*").eq("page_id", pageId).order("position"),
  );
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
    await supabase.from("tasks").select("*").order("done").order("due_date", { nullsFirst: false }).order("position"),
  );
}

export async function createTask(input: Partial<Tables["tasks"]["Insert"]> & { title: string }) {
  const user_id = await requireUserId();
  return unwrap(await supabase.from("tasks").insert({ ...input, user_id }).select("*").single());
}

export async function updateTask(id: string, patch: Tables["tasks"]["Update"]) {
  return unwrap(await supabase.from("tasks").update(patch).eq("id", id).select("*").single());
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------- habits ---------- */

export async function fetchHabits(): Promise<Habit[]> {
  return unwrap(
    await supabase.from("habits").select("*").eq("archived", false).order("created_at"),
  );
}

export async function fetchHabitLogs(sinceDay: string): Promise<HabitLog[]> {
  return unwrap(await supabase.from("habit_logs").select("*").gte("day", sinceDay));
}

export async function createHabit(input: {
  title: string;
  icon?: string;
  emoji?: string;
  target_per_week?: number;
}) {
  const user_id = await requireUserId();
  return unwrap(await supabase.from("habits").insert({ ...input, user_id }).select("*").single());
}

export async function toggleHabit(habitId: string, day: string, on: boolean) {
  if (on) {
    const user_id = await requireUserId();
    const { error } = await supabase.from("habit_logs").insert({ habit_id: habitId, day, user_id });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return;
  }
  const { error } = await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("day", day);
  if (error) throw new Error(error.message);
}

export async function archiveHabit(id: string) {
  const { error } = await supabase.from("habits").update({ archived: true }).eq("id", id);
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
  return unwrap(await supabase.from("goals").insert({ ...input, user_id }).select("*").single());
}

export async function updateGoal(id: string, patch: Tables["goals"]["Update"]) {
  return unwrap(await supabase.from("goals").update(patch).eq("id", id).select("*").single());
}

export async function deleteGoal(id: string) {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createMilestone(input: { goal_id: string; title: string; position?: number }) {
  const user_id = await requireUserId();
  return unwrap(await supabase.from("milestones").insert({ ...input, user_id }).select("*").single());
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
  const { data, error } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("id", id)
    .maybeSingle();
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

export async function updateRoadmapItem(id: string, patch: Tables["roadmap_items"]["Update"]) {
  return unwrap(
    await supabase.from("roadmap_items").update(patch).eq("id", id).select("*").single(),
  );
}

export async function deleteRoadmap(id: string) {
  const { error } = await supabase.from("roadmaps").delete().eq("id", id);
  if (error) throw new Error(error.message);
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

export async function saveJournal(day: string, patch: { mood?: string | null; note?: string | null }) {
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
    await supabase.from("focus_sessions").insert({ ...input, user_id }).select("*").single(),
  );
}

export async function finishFocusSession(
  id: string,
  patch: {
    minutes: number;
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
  return unwrap(await supabase.from("chat_threads").insert({ user_id, title }).select("*").single());
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
    await supabase
      .from("chat_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at"),
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

/* ---------- roadmap resources ---------- */

export async function fetchRoadmapResources(
  roadmapId: string,
): Promise<RoadmapResource[]> {
  return unwrap(
    await supabase
      .from("roadmap_resources")
      .select("*")
      .eq("roadmap_id", roadmapId)
      .order("created_at"),
  );
}

export async function fetchRoadmapResource(
  id: string,
): Promise<RoadmapResource | null> {
  const { data, error } = await supabase
    .from("roadmap_resources")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/* ---------- derived helpers ---------- */

export function streakFor(habitId: string, logs: HabitLog[]): number {
  const days = new Set(logs.filter((l) => l.habit_id === habitId).map((l) => l.day));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const day = dayOffset(-i);
    if (days.has(day)) streak++;
    else if (i > 0) break;
  }
  return streak;
}
