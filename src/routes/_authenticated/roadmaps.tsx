import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpenCheck,
  ChevronRight,
  Compass,
  Flame,
  Layers,
  Sparkles,
  Timer,
  Trash2,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  dayOffset,
  deleteRoadmap,
  fetchRoadmapItems,
  fetchRoadmaps,
  fetchRoadmapStreakInfo,
  today,
  type Roadmap,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/roadmaps")({
  head: () => ({
    meta: [
      { title: "Roadmaps & Streaks — Remispace" },
      {
        name: "description",
        content: "Learning paths and daily study streaks built by Remi, phase by phase.",
      },
      { property: "og:title", content: "Roadmaps & Streaks — Remispace" },
      {
        property: "og:description",
        content: "Your AI-built learning roadmaps and study momentum in Remispace.",
      },
    ],
  }),
  component: RoadmapsPage,
});

const LAST_7_DAYS = Array.from({ length: 7 }, (_, i) => dayOffset(-6 + i));

function weekdayLabel(dayStr: string): string {
  return new Date(`${dayStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function RoadmapsPage() {
  const qc = useQueryClient();
  const { data: roadmaps = [] } = useQuery({
    queryKey: ["roadmaps"],
    queryFn: fetchRoadmaps,
  });

  const { data: streakInfo } = useQuery({
    queryKey: ["roadmap-streak-overall"],
    queryFn: () => fetchRoadmapStreakInfo(),
  });

  const remove = useMutation({
    mutationFn: deleteRoadmap,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["roadmaps"] });
      void qc.invalidateQueries({ queryKey: ["roadmap-streak-overall"] });
    },
  });

  const currentStreak = streakInfo?.currentStreak ?? 0;
  const bestStreak = streakInfo?.bestStreak ?? 0;
  const todayActive = streakInfo?.todayActive ?? false;
  const completedLessons = streakInfo?.totalLessonsCompleted ?? 0;
  const focusMinutes = streakInfo?.totalFocusMinutes ?? 0;
  const activeDatesSet = new Set(streakInfo?.activeDates ?? []);

  return (
    <div className="mx-auto max-w-4xl px-5 pb-32 pt-8 sm:px-8 space-y-7">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Compass className="size-5" />
          </span>
          <h1 className="font-display text-3xl font-bold">Learning Roadmaps</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Step-by-step curricula with interactive lessons, checkpoint quizzes, and daily study momentum streaks.
        </p>
      </div>

      {/* Roadmap Study Momentum & Streaks Banner */}
      <section className="card-soft overflow-hidden p-6 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex size-13 shrink-0 items-center justify-center rounded-3xl bg-primary/15 text-primary shadow-xs">
              <Flame className="size-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-bold">
                  {currentStreak} Day{currentStreak === 1 ? "" : "s"} Streak
                </span>
                {todayActive ? (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Active today
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    Study today to continue
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {todayActive
                  ? "Great job! You've logged roadmap study activity today."
                  : "Complete a lesson or start a focus session to keep your streak alive."}
              </p>
            </div>
          </div>

          <Button asChild className="press rounded-2xl shrink-0 self-start sm:self-auto gap-1.5">
            <Link to="/conversation" search={{ seed: "Help me build a learning roadmap for..." }}>
              <Sparkles className="size-4" /> New Roadmap
            </Link>
          </Button>
        </div>

        {/* 7-Day Consistency Tracker */}
        <div className="mt-6 border-t border-border/60 pt-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              7-Day Study Rhythm
            </span>
            <span className="text-xs text-muted-foreground">
              {streakInfo?.weekActiveDays.length ?? 0} of 7 days active
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {LAST_7_DAYS.map((dayStr) => {
              const isActive = activeDatesSet.has(dayStr);
              const isToday = dayStr === today();
              return (
                <div
                  key={dayStr}
                  className={`flex flex-col items-center justify-center rounded-2xl py-2.5 transition-colors text-center ${
                    isActive
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : isToday
                        ? "border-2 border-dashed border-primary/40 bg-primary/5 text-foreground font-semibold"
                        : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <span className="text-[11px] uppercase">{weekdayLabel(dayStr)}</span>
                  <span className="mt-1 text-xs">{dayStr.slice(8)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stat Highlights */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-border/60 pt-5">
          <div>
            <span className="text-xs text-muted-foreground">Best Streak</span>
            <p className="mt-0.5 font-display text-xl font-bold flex items-center gap-1.5">
              <Zap className="size-4 text-amber-500" />
              {bestStreak} Day{bestStreak === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Lessons Mastered</span>
            <p className="mt-0.5 font-display text-xl font-bold flex items-center gap-1.5">
              <BookOpenCheck className="size-4 text-primary" />
              {completedLessons}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Focus Time</span>
            <p className="mt-0.5 font-display text-xl font-bold flex items-center gap-1.5">
              <Timer className="size-4 text-primary" />
              {focusMinutes} min
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Active Roadmaps</span>
            <p className="mt-0.5 font-display text-xl font-bold flex items-center gap-1.5">
              <Compass className="size-4 text-primary" />
              {roadmaps.length}
            </p>
          </div>
        </div>
      </section>

      {/* Roadmaps List */}
      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Your Active Roadmaps</h2>

        {roadmaps.map((roadmap) => (
          <RoadmapCard
            key={roadmap.id}
            roadmap={roadmap}
            onDelete={() => remove.mutate(roadmap.id)}
          />
        ))}

        {roadmaps.length === 0 && (
          <div className="panel-soft px-6 py-12 text-center rounded-3xl">
            <Compass className="mx-auto size-8 text-primary" />
            <h3 className="mt-3 font-display text-lg font-bold">No roadmaps yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Tell Remi what you'd like to learn, your skill level, and your dream goal — Remi will build a comprehensive curriculum for you.
            </p>
            <Button asChild className="press mt-5 rounded-2xl">
              <Link to="/conversation" search={{ seed: "Build a roadmap for me to learn " }}>
                Plan a roadmap with Remi
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RoadmapCard({ roadmap, onDelete }: { roadmap: Roadmap; onDelete: () => void }) {
  const { data: items = [] } = useQuery({
    queryKey: ["roadmap-items", roadmap.id],
    queryFn: () => fetchRoadmapItems(roadmap.id),
  });

  const { data: cardStreak } = useQuery({
    queryKey: ["roadmap-streak", roadmap.id],
    queryFn: () => fetchRoadmapStreakInfo(roadmap.id),
  });

  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const phases = new Set(items.map((i) => i.phase)).size;
  const topics = items.filter((i) => !i.parent_id).length;
  const subtopics = items.length - topics;
  const roadmapStreak = cardStreak?.currentStreak ?? 0;

  return (
    <article className="card-soft p-6 transition-all hover:border-primary/30">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold">{roadmap.topic}</h3>
            {roadmapStreak > 0 && (
              <span className="flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <Flame className="size-3.5" /> {roadmapStreak}-day streak
              </span>
            )}
            {pct === 100 && (
              <span className="rounded-xl bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Completed
              </span>
            )}
          </div>

          {roadmap.summary && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{roadmap.summary}</p>
          )}

          <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="size-3.5" />
            {phases} phases · {topics} topics · {subtopics} sub-topics
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete roadmap"
          onClick={onDelete}
          className="rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Progress value={pct} className="h-2.5 rounded-full" />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {done}/{items.length} ({pct}%)
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button asChild className="press gap-1.5 rounded-2xl">
          <Link to="/roadmap/$roadmapId" params={{ roadmapId: roadmap.id }}>
            Continue Learning <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
