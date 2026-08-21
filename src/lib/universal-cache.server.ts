import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLRUCache } from "@/lib/cache.server";
import { log } from "@/lib/logger.server";

type Supabase = SupabaseClient<Database>;

// Normalize any topic or title into a canonical cache key
export function normalizeSlug(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/^(how to\s+)?(learn(ing)?|study(ing)?|master(ing)?|course on|intro(duction)? to|basics of|fundamentals of)\s+/i, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// In-Memory Fast Tier (L1 Cache) for sub-millisecond retrieval
const curriculumL1 = createLRUCache<{ summary: string; structure: unknown }>({ maxItems: 300, ttlMs: 12 * 60 * 60 * 1000 });
const lessonL1 = createLRUCache<{ title: string; content: string; images: unknown[]; videos: unknown[] }>({ maxItems: 600, ttlMs: 24 * 60 * 60 * 1000 });
const notebookL1 = createLRUCache<{ title: string; icon: string; blocks: unknown[] }>({ maxItems: 300, ttlMs: 24 * 60 * 60 * 1000 });
const quizL1 = createLRUCache<{ questions: unknown[]; flashcards: unknown[] }>({ maxItems: 300, ttlMs: 24 * 60 * 60 * 1000 });

/* =========================================================================
   1. ROADMAP & CURRICULUM CACHE (CAG)
   ========================================================================= */

export async function getCachedCurriculum(
  supabase: Supabase,
  topic: string,
  experienceLevel: string = "beginner",
): Promise<{ summary: string; structure: any } | null> {
  const normTopic = normalizeSlug(topic);
  const normLevel = (experienceLevel || "beginner").toLowerCase();
  const cacheKey = `${normTopic}:${normLevel}`;

  // 1. Check L1 in-memory cache
  const l1Hit = curriculumL1.get(cacheKey);
  if (l1Hit) return l1Hit;

  // 2. Check Database Cache Table (L2 curriculum_templates)
  try {
    const { data, error } = await supabase
      .from("curriculum_templates" as any)
      .select("summary, structure")
      .eq("topic_normalized", normTopic)
      .eq("experience_level", normLevel)
      .maybeSingle();

    if (!error && data) {
      const template = data as unknown as { summary: string; structure: any };
      curriculumL1.set(cacheKey, template);
      // Asynchronously bump usage counter
      void (supabase.rpc as any)("increment_template_usage", { template_id: (data as any).id }).catch(() => {});
      return template;
    }
  } catch {
    // Database table might not be migrated yet; fallback gracefully
  }

  // 3. Fallback to existing roadmaps & roadmap_items in Supabase
  try {
    const { data: roadmaps } = await supabase
      .from("roadmaps")
      .select("id, topic, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(60);

    let matchedRoadmap: { id: string; topic: string; summary: string | null } | null = null;
    for (const r of roadmaps || []) {
      const normR = normalizeSlug(r.topic);
      if (normR === normTopic || normR.includes(normTopic) || normTopic.includes(normR)) {
        matchedRoadmap = r;
        break;
      }
    }

    if (matchedRoadmap) {
      const { data: items } = await supabase
        .from("roadmap_items")
        .select("*")
        .eq("roadmap_id", matchedRoadmap.id)
        .order("position", { ascending: true });

      const parentItems = (items || []).filter((i) => !i.parent_id);
      if (parentItems.length > 0) {
        const phasesMap = new Map<string, Array<{ title: string; detail: string | null; estimated_minutes: number; subtopics: Array<{ title: string; detail: string | null; estimated_minutes: number }> }>>();

        for (const p of parentItems) {
          const phaseName = p.phase || "Phase 1: Core Concepts";
          if (!phasesMap.has(phaseName)) {
            phasesMap.set(phaseName, []);
          }
          const subs = (items || []).filter((i) => i.parent_id === p.id);
          phasesMap.get(phaseName)!.push({
            title: p.title,
            detail: p.detail || null,
            estimated_minutes: p.estimated_minutes || 60,
            subtopics: subs.map((s) => ({
              title: s.title,
              detail: s.detail || null,
              estimated_minutes: s.estimated_minutes || 30,
            })),
          });
        }

        const phases = Array.from(phasesMap.entries()).map(([name, topics]) => ({
          name,
          topics,
        }));

        const result = {
          summary: matchedRoadmap.summary || `Comprehensive personalized learning roadmap for ${matchedRoadmap.topic}`,
          structure: phases,
        };

        curriculumL1.set(cacheKey, result);
        log("info", "cag_roadmap_cache_hit_fallback", { topic, matchedTopic: matchedRoadmap.topic });
        return result;
      }
    }
  } catch (fbErr) {
    log("warn", "cache_fallback_lookup_error", { error: String(fbErr) });
  }

  return null;
}

export async function saveCachedCurriculum(
  supabase: Supabase,
  topic: string,
  experienceLevel: string,
  summary: string,
  structure: unknown,
  tags: string[] = [],
): Promise<void> {
  const normTopic = normalizeSlug(topic);
  const normLevel = (experienceLevel || "beginner").toLowerCase();
  const cacheKey = `${normTopic}:${normLevel}`;

  // Store in L1
  curriculumL1.set(cacheKey, { summary, structure });

  // Store in L2 Database
  try {
    await supabase.from("curriculum_templates" as any).upsert(
      {
        topic: topic.trim(),
        topic_normalized: normTopic,
        experience_level: normLevel,
        summary,
        structure,
        tags,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "topic_normalized, experience_level" },
    );
  } catch (err) {
    log("warn", "cache_curriculum_failed", { error: String(err) });
  }
}

/* =========================================================================
   2. SUBTOPIC LESSON CACHE
   ========================================================================= */

export async function getCachedLesson(
  supabase: Supabase,
  topic: string,
  subtopic: string,
): Promise<{ title: string; content: string; images: any[]; videos: any[] } | null> {
  const normTopic = normalizeSlug(topic);
  const normSubtopic = normalizeSlug(subtopic);
  const cacheKey = `${normTopic}:${normSubtopic}`;

  const l1Hit = lessonL1.get(cacheKey);
  if (l1Hit) return l1Hit;

  try {
    const { data, error } = await supabase
      .from("lesson_cache" as any)
      .select("title, content, images, videos")
      .eq("topic_normalized", normTopic)
      .eq("subtopic_normalized", normSubtopic)
      .maybeSingle();

    if (!error && data) {
      const lesson = data as unknown as { title: string; content: string; images: any[]; videos: any[] };
      lessonL1.set(cacheKey, lesson);
      return lesson;
    }
  } catch {
    // Graceful fallback
  }

  return null;
}

export async function saveCachedLesson(
  supabase: Supabase,
  topic: string,
  subtopic: string,
  title: string,
  content: string,
  images: unknown[] = [],
  videos: unknown[] = [],
): Promise<void> {
  const normTopic = normalizeSlug(topic);
  const normSubtopic = normalizeSlug(subtopic);
  const cacheKey = `${normTopic}:${normSubtopic}`;

  lessonL1.set(cacheKey, { title, content, images, videos });

  try {
    await supabase.from("lesson_cache" as any).upsert(
      {
        topic_normalized: normTopic,
        subtopic_normalized: normSubtopic,
        title,
        content,
        images,
        videos,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "topic_normalized, subtopic_normalized" },
    );
  } catch (err) {
    log("warn", "cache_lesson_failed", { error: String(err) });
  }
}

/* =========================================================================
   3. STUDY NOTEBOOK CACHE
   ========================================================================= */

export async function getCachedNotebook(
  supabase: Supabase,
  topicOrUrl: string,
): Promise<{ title: string; icon: string; blocks: any[] } | null> {
  const keyNorm = normalizeSlug(topicOrUrl);
  const l1Hit = notebookL1.get(keyNorm);
  if (l1Hit) return l1Hit;

  try {
    const { data, error } = await supabase
      .from("notebook_cache" as any)
      .select("title, icon, blocks")
      .eq("key_normalized", keyNorm)
      .maybeSingle();

    if (!error && data) {
      const nb = data as unknown as { title: string; icon: string; blocks: any[] };
      notebookL1.set(keyNorm, nb);
      return nb;
    }
  } catch {
    // Graceful fallback
  }

  return null;
}

export async function saveCachedNotebook(
  supabase: Supabase,
  topicOrUrl: string,
  title: string,
  icon: string,
  blocks: unknown[],
): Promise<void> {
  const keyNorm = normalizeSlug(topicOrUrl);
  notebookL1.set(keyNorm, { title, icon, blocks });

  try {
    await supabase.from("notebook_cache" as any).upsert(
      {
        key_normalized: keyNorm,
        title,
        icon: icon || "📒",
        blocks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key_normalized" },
    );
  } catch (err) {
    log("warn", "cache_notebook_failed", { error: String(err) });
  }
}

/* =========================================================================
   4. QUIZ & FLASHCARDS CACHE
   ========================================================================= */

export async function getCachedQuiz(
  supabase: Supabase,
  topic: string,
  subtopic: string,
): Promise<{ questions: any[]; flashcards: any[] } | null> {
  const normTopic = normalizeSlug(topic);
  const normSubtopic = normalizeSlug(subtopic);
  const cacheKey = `${normTopic}:${normSubtopic}`;

  const l1Hit = quizL1.get(cacheKey);
  if (l1Hit) return l1Hit;

  try {
    const { data, error } = await supabase
      .from("study_quiz_cache" as any)
      .select("questions, flashcards")
      .eq("topic_normalized", normTopic)
      .eq("subtopic_normalized", normSubtopic)
      .maybeSingle();

    if (!error && data) {
      const quiz = data as unknown as { questions: any[]; flashcards: any[] };
      quizL1.set(cacheKey, quiz);
      return quiz;
    }
  } catch {
    // Graceful fallback
  }

  return null;
}

export async function saveCachedQuiz(
  supabase: Supabase,
  topic: string,
  subtopic: string,
  questions: unknown[],
  flashcards: unknown[] = [],
): Promise<void> {
  const normTopic = normalizeSlug(topic);
  const normSubtopic = normalizeSlug(subtopic);
  const cacheKey = `${normTopic}:${normSubtopic}`;

  quizL1.set(cacheKey, { questions, flashcards });

  try {
    await supabase.from("study_quiz_cache" as any).upsert(
      {
        topic_normalized: normTopic,
        subtopic_normalized: normSubtopic,
        questions,
        flashcards,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "topic_normalized, subtopic_normalized" },
    );
  } catch (err) {
    log("warn", "cache_quiz_failed", { error: String(err) });
  }
}

/* =========================================================================
   5. AUTOMATIC BACKFILL FROM EXISTING DATABASE ROADMAPS
   ========================================================================= */

export async function backfillExistingRoadmaps(supabase: Supabase): Promise<number> {
  let backfilled = 0;
  try {
    const { data: existingRoadmaps } = await supabase
      .from("roadmaps")
      .select("id, topic, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!existingRoadmaps || existingRoadmaps.length === 0) return 0;

    for (const rm of existingRoadmaps) {
      const { data: items } = await supabase
        .from("roadmap_items")
        .select("*")
        .eq("roadmap_id", rm.id)
        .order("position", { ascending: true });

      if (!items || items.length === 0) continue;

      // Group items by topic (parent_id)
      const topicsMap = new Map<string, { title: string; estimated_minutes: number; subtopics: any[] }>();
      const parentItems = items.filter((i) => !i.parent_id);

      for (const p of parentItems) {
        topicsMap.set(p.id, {
          title: p.title,
          estimated_minutes: p.estimated_minutes || 60,
          subtopics: [],
        });
      }

      for (const sub of items) {
        if (sub.parent_id && topicsMap.has(sub.parent_id)) {
          topicsMap.get(sub.parent_id)!.subtopics.push({
            title: sub.title,
            detail: sub.detail || "",
            estimated_minutes: sub.estimated_minutes || 30,
            tasks: [],
          });

          // Also backfill lesson content if ready
          if (sub.content && sub.content_status === "ready") {
            await saveCachedLesson(
              supabase,
              rm.topic,
              sub.title,
              sub.title,
              sub.content,
              (sub as any).images || [],
              (sub as any).videos || [],
            );
          }
        }
      }

      const structuredTopics = Array.from(topicsMap.values());
      if (structuredTopics.length > 0) {
        await saveCachedCurriculum(
          supabase,
          rm.topic,
          "beginner",
          rm.summary || `Comprehensive curriculum for ${rm.topic}`,
          structuredTopics,
        );
        backfilled++;
      }
    }
  } catch (err) {
    log("warn", "backfill_roadmaps_failed", { error: String(err) });
  }

  return backfilled;
}
