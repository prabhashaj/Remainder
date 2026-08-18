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
    .ilike("content", `%Skilled in ${roadmap.topic}%`)
    .maybeSingle();

  if (!existing) {
    await supabase.from("agent_memories").insert({
      user_id: roadmap.user_id,
      category: "skill",
      content: `Skilled in ${roadmap.topic} (completed the whole roadmap)`,
      importance: 5,
    });
    return true;
  }

  return false;
}

export async function syncRoadmapGoalProgress(roadmapId: string): Promise<void> {
  try {
    const { data: roadmap } = await supabase
      .from("roadmaps")
      .select("goal_id")
      .eq("id", roadmapId)
      .maybeSingle();

    if (!roadmap?.goal_id) return;

    const { data: items } = await supabase
      .from("roadmap_items")
      .select("id,phase,done")
      .eq("roadmap_id", roadmapId);

    if (!items || items.length === 0) return;

    const totalItems = items.length;
    const doneItems = items.filter((i) => i.done === true).length;
    const overallProgress = Math.round((doneItems / totalItems) * 100);

    // Group items by phase to check if each phase is 100% finished
    const phaseMap = new Map<string, boolean>();
    for (const item of items) {
      if (!item.phase) continue;
      const current = phaseMap.get(item.phase) ?? true;
      phaseMap.set(item.phase, current && item.done === true);
    }

    // Update milestones matching phase names
    const { data: milestones } = await supabase
      .from("milestones")
      .select("id,title")
      .eq("goal_id", roadmap.goal_id);

    if (milestones && milestones.length > 0) {
      for (const ms of milestones) {
        const isPhaseDone = phaseMap.get(ms.title);
        if (typeof isPhaseDone === "boolean") {
          await supabase.from("milestones").update({ done: isPhaseDone }).eq("id", ms.id);
        }
      }
    }

    // Update goal progress percentage and completion status
    await supabase
      .from("goals")
      .update({
        progress: overallProgress,
        status: overallProgress === 100 ? "done" : "active",
      })
      .eq("id", roadmap.goal_id);
  } catch {
    /* ignore sync error */
  }
}

export async function updateRoadmapItem(id: string, patch: Tables["roadmap_items"]["Update"]) {
  const updated = unwrap(
    await supabase.from("roadmap_items").update(patch).eq("id", id).select("*").single(),
  );

  if (updated.roadmap_id) {
    if (patch.done) {
      void checkAndRecordRoadmapCompletion(updated.roadmap_id);
    }
    void syncRoadmapGoalProgress(updated.roadmap_id);
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

/* ---------- shared conversations (ChatGPT-style) ---------- */

export interface SharedConversation {
  id: string;
  token: string;
  thread_id: string;
  user_id: string;
  title: string;
  messages: any[];
  is_anonymous: boolean;
  user_name?: string | null | undefined;
  created_at: string;
  updated_at: string;
}

export function encodeConversationToDataToken(payload: {
  title: string;
  messages: any[];
  isAnonymous?: boolean | undefined;
  userName?: string | null | undefined;
}): string {
  try {
    const compactMessages = (payload.messages || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      parts: m.parts || [{ type: "text", text: m.content || "" }],
    }));
    const jsonStr = JSON.stringify({
      t: payload.title,
      m: compactMessages,
      a: payload.isAnonymous ? 1 : 0,
      u: payload.isAnonymous ? undefined : payload.userName,
      c: Date.now(),
    });
    const b64 = btoa(unescape(encodeURIComponent(jsonStr)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return `d_${b64}`;
  } catch (e) {
    console.error("Encoding error:", e);
    return `d_${Date.now()}`;
  }
}

export function decodeConversationFromDataToken(token: string): SharedConversation | null {
  try {
    if (!token.startsWith("d_")) return null;
    let b64 = token.slice(2).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const jsonStr = decodeURIComponent(escape(atob(b64)));
    const data = JSON.parse(jsonStr);
    return {
      id: `local-${data.c || Date.now()}`,
      token: token,
      thread_id: "local",
      user_id: "anon",
      title: data.t || "Shared Conversation",
      messages: data.m || [],
      is_anonymous: Boolean(data.a),
      user_name: data.u || null,
      created_at: new Date(data.c || Date.now()).toISOString(),
      updated_at: new Date(data.c || Date.now()).toISOString(),
    };
  } catch (e) {
    console.error("Decoding error:", e);
    return null;
  }
}

export async function fetchSharedConversation(token: string): Promise<SharedConversation | null> {
  // Mode 1: Self-contained URL data token (instant & offline)
  if (token.startsWith("d_")) {
    return decodeConversationFromDataToken(token);
  }

  // Mode 2: Database lookup by token
  try {
    const { data, error } = await supabase
      .from("shared_conversations" as never)
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (error) {
      console.warn("fetchSharedConversation DB error, checking fallback:", error.message);
      return null;
    }
    return data as unknown as SharedConversation | null;
  } catch (e) {
    console.warn("fetchSharedConversation error:", e);
    return null;
  }
}

export async function fetchThreadShare(threadId: string): Promise<SharedConversation | null> {
  try {
    const { data, error } = await supabase
      .from("shared_conversations" as never)
      .select("*")
      .eq("thread_id", threadId)
      .maybeSingle();

    if (error) {
      // Table doesn't exist yet or not found, return null gracefully without throwing
      return null;
    }
    return data as unknown as SharedConversation | null;
  } catch {
    return null;
  }
}

export async function createOrUpdateThreadShare(params: {
  threadId: string;
  title: string;
  messages: any[];
  isAnonymous?: boolean;
  userName?: string;
}): Promise<SharedConversation> {
  const userId = await requireUserId();

  try {
    // Check if a share record already exists for this thread in Supabase
    const existing = await fetchThreadShare(params.threadId);

    if (existing && !existing.token.startsWith("d_")) {
      const { data, error } = await supabase
        .from("shared_conversations" as never)
        .update({
          title: params.title,
          messages: params.messages,
          is_anonymous: params.isAnonymous ?? false,
          user_name: params.userName ?? null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (!error && data) {
        return data as unknown as SharedConversation;
      }
    }

    // Generate token and attempt DB insert
    const generatedToken =
      Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

    const { data, error } = await supabase
      .from("shared_conversations" as never)
      .insert({
        thread_id: params.threadId,
        user_id: userId,
        token: generatedToken,
        title: params.title,
        messages: params.messages,
        is_anonymous: params.isAnonymous ?? false,
        user_name: params.userName ?? null,
      } as never)
      .select("*")
      .single();

    if (!error && data) {
      return data as unknown as SharedConversation;
    }
  } catch (e) {
    console.warn("Database share creation fell back to URL data token:", e);
  }

  // Graceful Fallback: Generate self-contained snapshot token
  const fallbackToken = encodeConversationToDataToken({
    title: params.title,
    messages: params.messages,
    isAnonymous: params.isAnonymous,
    userName: params.userName,
  });

  return {
    id: `local-${Date.now()}`,
    token: fallbackToken,
    thread_id: params.threadId,
    user_id: userId,
    title: params.title,
    messages: params.messages,
    is_anonymous: params.isAnonymous ?? false,
    user_name: params.userName ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function deleteThreadShare(threadId: string): Promise<void> {
  try {
    await supabase
      .from("shared_conversations" as never)
      .delete()
      .eq("thread_id", threadId);
  } catch (e) {
    console.warn("deleteThreadShare error:", e);
  }
}

export async function forkSharedConversation(token: string): Promise<ChatThread> {
  const shared = await fetchSharedConversation(token);
  if (!shared) throw new Error("Shared conversation not found");

  const userId = await requireUserId();
  const thread = await createThread(shared.title || "Forked conversation");

  if (Array.isArray(shared.messages) && shared.messages.length > 0) {
    const messageInserts = shared.messages.map((m: any) => ({
      thread_id: thread.id,
      user_id: userId,
      role: m.role || "user",
      message: m,
      client_id: m.id || null,
    }));

    const { error: msgErr } = await supabase.from("chat_messages").insert(messageInserts as never);
    if (msgErr) console.warn("Failed to copy some messages when forking conversation:", msgErr);
  }

  return thread;
}

/* ---------- memories ---------- */

export async function fetchMemories(): Promise<AgentMemory[]> {
  const userId = await requireUserId();

  // Background cleanup of any legacy corrupted flashcard or quiz rows
  void supabase
    .from("agent_memories")
    .delete()
    .eq("user_id", userId)
    .in("category", ["flashcard", "quiz", "quiz_attempt"])
    .then(() => {});

  const rows = unwrap(
    await supabase
      .from("agent_memories")
      .select("*")
      .eq("user_id", userId)
      .not("category", "in", "(flashcard,quiz,quiz_attempt)")
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false }),
  );

  return (rows ?? []).filter((m) => {
    const trimmed = (m.content || "").trim();
    return !trimmed.startsWith("{") && !trimmed.startsWith("[");
  });
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
